import { jwtVerify, createRemoteJWKSet } from "jose";

// Your Firebase project ID — this is public info (it's already visible in
// src/firebase.js), not a secret. Only the Gemini key needs to be hidden.
const FIREBASE_PROJECT_ID = "mylibertyies-f2f38";

// Google's public keys for verifying Firebase login tokens. `jose` fetches
// and caches these automatically — nothing to manage here.
const JWKS = createRemoteJWKSet(
  new URL(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"
  )
);

const MODES = {
  draft:
    "Write a polite, clear message based on the following request. Keep it concise and appropriate to send directly to parents or staff at a small English course business:",
  summarize:
    "Summarize the following notes into a few clear, well-organized bullet points:",
};

function corsHeaders(env) {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function json(body, status, env) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(env) },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(env) });
    }
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405, env);
    }

    // 1. Require a real, currently-valid MYLIBERTY login before spending
    //    any Gemini quota. Anyone without a valid Firebase session token
    //    gets rejected here, before we ever touch the AI.
    const authHeader = request.headers.get("Authorization") || "";
    const idToken = authHeader.replace(/^Bearer\s+/i, "");
    if (!idToken) {
      return json({ error: "Missing auth token" }, 401, env);
    }
    try {
      await jwtVerify(idToken, JWKS, {
        issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
        audience: FIREBASE_PROJECT_ID,
      });
    } catch {
      return json({ error: "Invalid or expired login" }, 401, env);
    }

    // 2. Validate the request shape.
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400, env);
    }
    const { mode, input } = body || {};
    const instruction = MODES[mode];
    if (!instruction || typeof input !== "string" || !input.trim()) {
      return json({ error: "Invalid request" }, 400, env);
    }
    if (input.length > 4000) {
      return json({ error: "Input is too long (max 4000 characters)" }, 400, env);
    }

    // 3. Call Gemini using the secret key, which only ever lives here on
    //    Cloudflare's server — never sent to the browser.
    try {
      const prompt = `${instruction}\n\n${input}`;
      const geminiRes = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": env.GEMINI_API_KEY,
          },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        }
      );
      const data = await geminiRes.json();
      if (!geminiRes.ok) {
        return json(
          { error: data?.error?.message || "Gemini request failed" },
          502,
          env
        );
      }
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      return json({ text }, 200, env);
    } catch {
      return json({ error: "Server error contacting Gemini" }, 500, env);
    }
  },
};
