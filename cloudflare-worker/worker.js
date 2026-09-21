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

function getCorsOrigin(request, env) {
  const allowed = env.ALLOWED_ORIGIN || "*";
  if (allowed === "*") return "*";
  const requestOrigin = request?.headers?.get("Origin") || "";
  const allowedList = allowed.split(",").map((s) => s.trim().toLowerCase());
  if (requestOrigin && allowedList.includes(requestOrigin.toLowerCase())) {
    return requestOrigin;
  }
  return allowedList[0] || "*";
}

function corsHeaders(request, env) {
  return {
    "Access-Control-Allow-Origin": getCorsOrigin(request, env),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function json(body, status, request, env) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(request, env) },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(request, env) });
    }
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405, request, env);
    }

    // 1. Require a real, currently-valid MYLIBERTY login before spending
    //    any Gemini quota. Anyone without a valid Firebase session token
    //    gets rejected here, before we ever touch the AI.
    const authHeader = request.headers.get("Authorization") || "";
    const idToken = authHeader.replace(/^Bearer\s+/i, "");
    if (!idToken) {
      return json({ error: "Missing auth token" }, 401, request, env);
    }
    try {
      await jwtVerify(idToken, JWKS, {
        issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
        audience: FIREBASE_PROJECT_ID,
      });
    } catch {
      return json({ error: "Invalid or expired login" }, 401, request, env);
    }

    // 2. Validate the request shape.
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400, request, env);
    }
    const { mode, input } = body || {};
    const instruction = MODES[mode];
    if (!instruction || typeof input !== "string" || !input.trim()) {
      return json({ error: "Invalid request" }, 400, request, env);
    }
    if (input.length > 4000) {
      return json({ error: "Input is too long (max 4000 characters)" }, 400, request, env);
    }

    // 3. Verify server secret exists before spending network hops
    if (!env.GEMINI_API_KEY) {
      return json(
        { error: "AI Assistant is not configured on the server (missing GEMINI_API_KEY secret in Cloudflare)." },
        500,
        request,
        env
      );
    }

    // 4. Call Gemini using the secret key, which only ever lives here on
    //    Cloudflare's server — never sent to the browser.
    try {
      const model = env.GEMINI_MODEL || "gemini-1.5-flash";
      const prompt = `${instruction}\n\n${input}`;
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
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
          request,
          env
        );
      }
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      return json({ text }, 200, request, env);
    } catch {
      return json({ error: "Server error contacting Gemini" }, 500, request, env);
    }
  },
};
