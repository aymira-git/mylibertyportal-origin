import { jwtVerify, createRemoteJWKSet, SignJWT, importPKCS8 } from "jose";

const FIREBASE_PROJECT_ID = "mylibertyies-f2f38";
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

// Google's public keys for verifying Firebase login tokens.
const JWKS = createRemoteJWKSet(
  new URL(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"
  )
);

// Memory cache for active challenge nonces & rate limits (per Cloudflare instance)
const rateLimits = new Map();
const inMemoryChallenges = new Map();

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
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Device-Id",
  };
}

function json(body, status, request, env) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(request, env) },
  });
}

// ── FIRESTORE REST API CONVERTERS ──

function toFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === "boolean") return { booleanValue: val };
  if (typeof val === "number") {
    return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  }
  if (typeof val === "string") return { stringValue: val };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(toFirestoreValue) } };
  }
  if (typeof val === "object") {
    const fields = {};
    for (const [k, v] of Object.entries(val)) {
      fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function fromFirestoreValue(valObj) {
  if (!valObj || typeof valObj !== "object") return null;
  if ("nullValue" in valObj) return null;
  if ("booleanValue" in valObj) return valObj.booleanValue;
  if ("integerValue" in valObj) return parseInt(valObj.integerValue, 10);
  if ("doubleValue" in valObj) return valObj.doubleValue;
  if ("stringValue" in valObj) return valObj.stringValue;
  if ("timestampValue" in valObj) return valObj.timestampValue;
  if ("arrayValue" in valObj) {
    return (valObj.arrayValue?.values || []).map(fromFirestoreValue);
  }
  if ("mapValue" in valObj) {
    const res = {};
    for (const [k, v] of Object.entries(valObj.mapValue?.fields || {})) {
      res[k] = fromFirestoreValue(v);
    }
    return res;
  }
  return null;
}

function toFirestoreFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    fields[k] = toFirestoreValue(v);
  }
  return fields;
}

function fromFirestoreDocument(doc) {
  if (!doc || !doc.fields) return null;
  const data = {};
  for (const [k, v] of Object.entries(doc.fields)) {
    data[k] = fromFirestoreValue(v);
  }
  const id = doc.name ? doc.name.split("/").pop() : undefined;
  return { id, ...data };
}

// ── AUTHENTICATION & SERVICE ACCOUNT ──

let cachedSaToken = null;
let saTokenExpiresAt = 0;

async function getServiceAccountToken(env) {
  const now = Math.floor(Date.now() / 1000);
  if (cachedSaToken && now < saTokenExpiresAt - 60) {
    return cachedSaToken;
  }

  const rawKey = env.FIREBASE_SERVICE_ACCOUNT_KEY;
  const clientEmail = env.FIREBASE_SERVICE_ACCOUNT_EMAIL;

  if (!rawKey || !clientEmail) {
    return null;
  }

  try {
    const pemKey = rawKey.replace(/\\n/g, "\n");
    const privateKey = await importPKCS8(pemKey, "RS256");

    const jwt = await new SignJWT({
      iss: clientEmail,
      sub: clientEmail,
      aud: "https://oauth2.googleapis.com/token",
      scope: "https://www.googleapis.com/auth/datastore",
      exp: now + 3600,
      iat: now,
    })
      .setProtectedHeader({ alg: "RS256" })
      .sign(privateKey);

    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });

    const data = await res.json();
    if (data.access_token) {
      cachedSaToken = data.access_token;
      saTokenExpiresAt = now + (data.expires_in || 3600);
      return cachedSaToken;
    }
  } catch (err) {
    console.error("Failed to acquire Service Account token:", err);
  }
  return null;
}

async function getAuthToken(request, env) {
  const saToken = await getServiceAccountToken(env);
  if (saToken) return saToken;

  const authHeader = request.headers.get("Authorization") || "";
  return authHeader.replace(/^Bearer\s+/i, "");
}

async function verifyCaller(request) {
  const authHeader = request.headers.get("Authorization") || "";
  const idToken = authHeader.replace(/^Bearer\s+/i, "");
  if (!idToken) return null;
  try {
    const { payload } = await jwtVerify(idToken, JWKS, {
      issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
      audience: FIREBASE_PROJECT_ID,
    });
    return payload;
  } catch {
    return null;
  }
}

// ── FIRESTORE OPERATIONS ──

async function fsGetDoc(collectionPath, docId, token) {
  const url = `${FIRESTORE_BASE}/${collectionPath}/${encodeURIComponent(docId)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Firestore GET failed: ${res.status} ${await res.text()}`);
  }
  return fromFirestoreDocument(await res.json());
}

async function fsSetDoc(collectionPath, docId, data, token) {
  const url = `${FIRESTORE_BASE}/${collectionPath}/${encodeURIComponent(docId)}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields: toFirestoreFields(data) }),
  });
  if (!res.ok) {
    throw new Error(`Firestore PATCH failed: ${res.status} ${await res.text()}`);
  }
  return fromFirestoreDocument(await res.json());
}

async function fsCreateDoc(collectionPath, data, token) {
  const url = `${FIRESTORE_BASE}/${collectionPath}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields: toFirestoreFields(data) }),
  });
  if (!res.ok) {
    throw new Error(`Firestore CREATE failed: ${res.status} ${await res.text()}`);
  }
  return fromFirestoreDocument(await res.json());
}

async function fsDeleteDoc(collectionPath, docId, token) {
  const url = `${FIRESTORE_BASE}/${collectionPath}/${encodeURIComponent(docId)}`;
  await fetch(url, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function fsQueryOpenShift(userId, token) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents:runQuery`;
  const body = {
    structuredQuery: {
      from: [{ collectionId: "shifts" }],
      where: {
        compositeFilter: {
          op: "AND",
          filters: [
            {
              fieldFilter: {
                field: { fieldPath: "userId" },
                op: "EQUAL",
                value: { stringValue: userId },
              },
            },
            {
              fieldFilter: {
                field: { fieldPath: "clockOut" },
                op: "EQUAL",
                value: { nullValue: null },
              },
            },
          ],
        },
      },
      limit: 1,
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) return null;
  const results = await res.json();
  const first = Array.isArray(results) ? results.find((r) => r.document) : null;
  return first ? fromFirestoreDocument(first.document) : null;
}

// ── CRYPTOGRAPHIC CHALLENGE UTILITIES ──

function generateNonce() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBuffer(b64url) {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  const binary = atob(b64 + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function verifyDeviceSignature(publicKeyJwk, deviceId, nonce, badgeToken, signatureB64) {
  try {
    const key = await crypto.subtle.importKey(
      "jwk",
      publicKeyJwk,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"]
    );
    const dataString = `${deviceId}:${nonce}:${badgeToken}`;
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(dataString);
    const signatureBuffer = base64UrlToBuffer(signatureB64);

    return await crypto.subtle.verify(
      { name: "ECDSA", hash: { name: "SHA-256" } },
      key,
      signatureBuffer,
      dataBuffer
    );
  } catch (err) {
    console.error("Signature verification error:", err);
    return false;
  }
}

// ── AUDIT LOGGER ──

async function logKioskAudit(action, details, token) {
  try {
    await fsCreateDoc(
      "kioskAuditEvents",
      {
        action,
        ...details,
        timestamp: new Date().toISOString(),
      },
      token
    );
  } catch (err) {
    console.warn("Failed to write to kioskAuditEvents:", err);
  }
}

// ── HANDLERS ──

async function handleKioskChallenge(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, request, env);
  }
  const { deviceId } = body || {};
  if (!deviceId || typeof deviceId !== "string") {
    return json({ error: "Missing deviceId" }, 400, request, env);
  }

  // Rate limit: 1 challenge request per 2 seconds per device
  const now = Date.now();
  const lastReq = rateLimits.get(deviceId) || 0;
  if (now - lastReq < 1500) {
    return json({ error: "Rate limit exceeded. Please wait a moment." }, 429, request, env);
  }
  rateLimits.set(deviceId, now);

  const token = await getAuthToken(request, env);
  if (!token) {
    return json({ error: "Service unauthenticated" }, 500, request, env);
  }

  // Verify device is registered and active
  const device = await fsGetDoc("kioskDevices", deviceId, token);
  if (!device || device.status !== "active") {
    return json({ error: "Device is not registered or has been revoked." }, 403, request, env);
  }

  const nonce = generateNonce();
  const expiresAt = now + 60000; // 60 seconds strict TTL

  // Store in memory and in Firestore for multi-worker consistency
  inMemoryChallenges.set(deviceId, { nonce, expiresAt });
  try {
    await fsSetDoc(
      "kioskChallenges",
      deviceId,
      {
        nonce,
        expiresAt: new Date(expiresAt).toISOString(),
        createdAt: new Date().toISOString(),
      },
      token
    );
  } catch (err) {
    console.warn("Firestore challenge save warning:", err);
  }

  return json({ nonce, expiresAt }, 200, request, env);
}

async function handleKioskProvision(request, env) {
  const caller = await verifyCaller(request);
  if (!caller) {
    return json({ error: "Unauthorized" }, 401, request, env);
  }

  const token = await getAuthToken(request, env);
  const userDoc = await fsGetDoc("users", caller.user_id, token);
  if (!userDoc || userDoc.role !== "admin") {
    return json({ error: "Forbidden: Only administrators can provision kiosk terminals." }, 403, request, env);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, request, env);
  }

  const { deviceId, branchId, label, publicKeyJwk } = body || {};
  if (!deviceId || !branchId || !publicKeyJwk) {
    return json({ error: "Missing required provisioning parameters (deviceId, branchId, publicKeyJwk)." }, 400, request, env);
  }

  const deviceData = {
    deviceId,
    branchId,
    label: label || "Lobby Reception Terminal",
    publicKeyJwk,
    status: "active",
    provisionedBy: caller.user_id,
    provisionedAt: new Date().toISOString(),
  };

  await fsSetDoc("kioskDevices", deviceId, deviceData, token);

  await logKioskAudit(
    "DEVICE_PROVISIONED",
    {
      deviceId,
      branchId,
      label,
      actorUid: caller.user_id,
    },
    token
  );

  return json({ success: true, deviceId, branchId }, 200, request, env);
}

async function handleKioskRevoke(request, env) {
  const caller = await verifyCaller(request);
  if (!caller) {
    return json({ error: "Unauthorized" }, 401, request, env);
  }

  const token = await getAuthToken(request, env);
  const userDoc = await fsGetDoc("users", caller.user_id, token);
  if (!userDoc || userDoc.role !== "admin") {
    return json({ error: "Forbidden: Only administrators can revoke terminals." }, 403, request, env);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, request, env);
  }

  const { deviceId, reason } = body || {};
  if (!deviceId) {
    return json({ error: "Missing deviceId" }, 400, request, env);
  }

  await fsSetDoc(
    "kioskDevices",
    deviceId,
    {
      status: "revoked",
      revokedAt: new Date().toISOString(),
      revokedBy: caller.user_id,
      revokeReason: reason || "Manual administrator revocation",
    },
    token
  );

  // Invalidate any active challenge immediately
  inMemoryChallenges.delete(deviceId);
  await fsDeleteDoc("kioskChallenges", deviceId, token);

  await logKioskAudit(
    "DEVICE_REVOKED",
    {
      deviceId,
      reason,
      actorUid: caller.user_id,
    },
    token
  );

  return json({ success: true }, 200, request, env);
}

async function handleShiftClockIn(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, request, env);
  }

  const {
    deviceId,
    badgeToken,
    nonce,
    signature,
    stationId = "reception-01",
    classId = "general",
    className = "",
    shiftType = null,
    eventId = null,
    punctuality = null,
  } = body || {};

  if (!deviceId || !badgeToken || !nonce || !signature) {
    return json({ error: "Missing required parameters (deviceId, badgeToken, nonce, signature)." }, 400, request, env);
  }

  const token = await getAuthToken(request, env);
  if (!token) {
    return json({ error: "Server authentication unavailable" }, 500, request, env);
  }

  // 1. Verify device exists and is active
  const device = await fsGetDoc("kioskDevices", deviceId, token);
  if (!device || device.status !== "active") {
    return json({ error: "Kiosk terminal is not authorized or has been revoked." }, 403, request, env);
  }

  // 2. Atomic Challenge Verification and Consumption
  const now = Date.now();
  let challenge = inMemoryChallenges.get(deviceId);
  if (!challenge) {
    const docChallenge = await fsGetDoc("kioskChallenges", deviceId, token);
    if (docChallenge) {
      challenge = {
        nonce: docChallenge.nonce,
        expiresAt: new Date(docChallenge.expiresAt).getTime(),
      };
    }
  }

  if (!challenge || challenge.nonce !== nonce) {
    return json({ error: "Invalid or already-consumed challenge nonce." }, 401, request, env);
  }

  if (now > challenge.expiresAt) {
    inMemoryChallenges.delete(deviceId);
    await fsDeleteDoc("kioskChallenges", deviceId, token);
    return json({ error: "Challenge nonce has expired. Please rescan." }, 401, request, env);
  }

  // Consume nonce immediately to prevent any replay
  inMemoryChallenges.delete(deviceId);
  await fsDeleteDoc("kioskChallenges", deviceId, token);

  // 3. Verify device signature against stored public key
  const isSignatureValid = await verifyDeviceSignature(
    device.publicKeyJwk,
    deviceId,
    nonce,
    badgeToken,
    signature
  );
  if (!isSignatureValid) {
    await logKioskAudit("SIGNATURE_VERIFICATION_FAILED", { deviceId, badgeToken }, token);
    return json({ error: "Cryptographic device signature verification failed." }, 401, request, env);
  }

  // 4. Server-Side Identity Derivation (never trust client-supplied userId)
  const user = await fsGetDoc("users", badgeToken, token);
  if (!user) {
    return json({ error: "No user profile found matching this badge credential." }, 404, request, env);
  }

  const trackedRoles = [
    "instructor",
    "instructorleader",
    "instructor_leader",
    "frontoffice",
    "opslead",
    "ops_lead",
    "frontofficelead",
    "marketing",
    "officeboy",
    "admin",
    "manager",
  ];
  if (!trackedRoles.includes(user.role)) {
    return json({ error: `User role '${user.role}' is not tracked for shifts.` }, 403, request, env);
  }

  // 5. Enforce Single Open Shift Invariant (D2)
  const existingOpenShift = await fsQueryOpenShift(badgeToken, token);
  if (existingOpenShift) {
    return json(
      {
        error: "Staff member already has an active open shift.",
        existingShiftId: existingOpenShift.id,
      },
      409,
      request,
      env
    );
  }

  // 6. Create the shift with server-authoritative timestamp
  const serverTime = new Date().toISOString();
  const shiftPayload = {
    userId: badgeToken,
    displayName: user.displayName || user.name || "Staff Member",
    role: user.role,
    branch: device.branchId === "bone_bolango" ? "Bone Bolango" : "Kota Gorontalo",
    branchId: device.branchId,
    classId: classId || "general",
    className: className || "",
    clockIn: serverTime,
    clockOut: null,
    stationId,
    clockInSource: "kiosk_verified",
    verifiedDeviceId: deviceId,
    scheduledStart: punctuality?.scheduledStart || null,
    requiredArrival: punctuality?.requiredArrival || null,
    punctualityStatus: punctuality?.status || "Present",
    minutesEarlyOrLate: punctuality?.minutesEarlyOrLate ?? 0,
    createdAt: serverTime,
    ...(shiftType ? { shiftType } : {}),
    ...(eventId ? { eventId } : {}),
  };

  const createdShift = await fsCreateDoc("shifts", shiftPayload, token);

  await logKioskAudit(
    "SHIFT_CLOCK_IN_VERIFIED",
    {
      shiftId: createdShift.id,
      userId: badgeToken,
      deviceId,
      branchId: device.branchId,
      clockIn: serverTime,
    },
    token
  );

  return json(
    {
      success: true,
      shiftId: createdShift.id,
      clockIn: serverTime,
      employee: {
        uid: badgeToken,
        displayName: shiftPayload.displayName,
        role: user.role,
      },
    },
    200,
    request,
    env
  );
}

async function handleShiftClockOut(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, request, env);
  }

  const { deviceId, shiftId, nonce, signature } = body || {};
  if (!deviceId || !shiftId || !nonce || !signature) {
    return json({ error: "Missing required parameters (deviceId, shiftId, nonce, signature)." }, 400, request, env);
  }

  const token = await getAuthToken(request, env);
  if (!token) {
    return json({ error: "Server authentication unavailable" }, 500, request, env);
  }

  // 1. Verify device
  const device = await fsGetDoc("kioskDevices", deviceId, token);
  if (!device || device.status !== "active") {
    return json({ error: "Kiosk terminal is not authorized or has been revoked." }, 403, request, env);
  }

  // 2. Consume challenge
  const now = Date.now();
  let challenge = inMemoryChallenges.get(deviceId);
  if (!challenge) {
    const docChallenge = await fsGetDoc("kioskChallenges", deviceId, token);
    if (docChallenge) {
      challenge = {
        nonce: docChallenge.nonce,
        expiresAt: new Date(docChallenge.expiresAt).getTime(),
      };
    }
  }

  if (!challenge || challenge.nonce !== nonce) {
    return json({ error: "Invalid or already-consumed challenge nonce." }, 401, request, env);
  }

  if (now > challenge.expiresAt) {
    inMemoryChallenges.delete(deviceId);
    await fsDeleteDoc("kioskChallenges", deviceId, token);
    return json({ error: "Challenge nonce has expired." }, 401, request, env);
  }

  inMemoryChallenges.delete(deviceId);
  await fsDeleteDoc("kioskChallenges", deviceId, token);

  // 3. Verify signature
  const isSignatureValid = await verifyDeviceSignature(
    device.publicKeyJwk,
    deviceId,
    nonce,
    shiftId,
    signature
  );
  if (!isSignatureValid) {
    return json({ error: "Cryptographic device signature verification failed." }, 401, request, env);
  }

  // 4. Fetch and update shift
  const shift = await fsGetDoc("shifts", shiftId, token);
  if (!shift) {
    return json({ error: "Shift not found." }, 404, request, env);
  }
  if (shift.clockOut) {
    return json({ error: "Shift has already been closed." }, 400, request, env);
  }

  const serverTime = new Date().toISOString();
  await fsSetDoc(
    "shifts",
    shiftId,
    {
      ...shift,
      clockOut: serverTime,
      updatedAt: serverTime,
      clockOutSource: "kiosk_verified",
      clockOutDeviceId: deviceId,
    },
    token
  );

  await logKioskAudit(
    "SHIFT_CLOCK_OUT_VERIFIED",
    {
      shiftId,
      userId: shift.userId,
      deviceId,
      clockOut: serverTime,
    },
    token
  );

  return json({ success: true, shiftId, clockOut: serverTime }, 200, request, env);
}

// ── AI ASSISTANT PROXY ──

const MODES = {
  draft:
    "Write a polite, clear message based on the following request. Keep it concise and appropriate to send directly to parents or staff at a small English course business:",
  summarize:
    "Summarize the following notes into a few clear, well-organized bullet points:",
};

async function handleAIAssistant(request, env) {
  const caller = await verifyCaller(request);
  if (!caller) {
    return json({ error: "Invalid or expired login" }, 401, request, env);
  }

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

  if (!env.GEMINI_API_KEY) {
    return json(
      { error: "AI Assistant is not configured on the server (missing GEMINI_API_KEY secret in Cloudflare)." },
      500,
      request,
      env
    );
  }

  try {
    const model = env.GEMINI_MODEL || "gemini-flash-latest";
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
      return json({ error: data?.error?.message || "Gemini request failed" }, 502, request, env);
    }
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return json({ text }, 200, request, env);
  } catch {
    return json({ error: "Server error contacting Gemini" }, 500, request, env);
  }
}

// ── ROUTER ──

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(request, env) });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // AI Assistant route (root or /api/v1/ai)
    if (request.method === "POST" && (path === "/" || path === "/api/v1/ai")) {
      return handleAIAssistant(request, env);
    }

    // Kiosk Hardening Routes
    if (request.method === "POST" && path === "/api/v1/kiosk/challenge") {
      return handleKioskChallenge(request, env);
    }

    if (request.method === "POST" && path === "/api/v1/kiosk/provision") {
      return handleKioskProvision(request, env);
    }

    if (request.method === "POST" && path === "/api/v1/kiosk/revoke") {
      return handleKioskRevoke(request, env);
    }

    if (request.method === "POST" && path === "/api/v1/shift/clock-in") {
      return handleShiftClockIn(request, env);
    }

    if (request.method === "POST" && path === "/api/v1/shift/clock-out") {
      return handleShiftClockOut(request, env);
    }

    return json({ error: "Not found", path }, 404, request, env);
  },
};
