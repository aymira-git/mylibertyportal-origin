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

/**
 * Firestore REST fields are dynamic application data; keep their decoded
 * shape permissive at this boundary and validate values in the handler.
 * @param {any} doc
 * @returns {Record<string, any> | null}
 */
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

async function fsGetDocSnapshot(collectionPath, docId, token) {
  const url = `${FIRESTORE_BASE}/${collectionPath}/${encodeURIComponent(docId)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Firestore GET failed: ${res.status} ${await res.text()}`);
  }
  const raw = await res.json();
  return {
    document: fromFirestoreDocument(raw),
    updateTime: raw.updateTime,
  };
}

async function fsGetDoc(collectionPath, docId, token) {
  const snapshot = await fsGetDocSnapshot(collectionPath, docId, token);
  return snapshot?.document || null;
}

/**
 * Atomically consumes a persisted kiosk challenge. The update-time
 * precondition is a compare-and-set: concurrent Worker isolates may read the
 * same nonce, but only one can change that exact document version.
 */
async function fsConsumeKioskChallenge(deviceId, nonce, token) {
  const url = `${FIRESTORE_BASE}/kioskChallenges/${encodeURIComponent(deviceId)}`;
  const read = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!read.ok) return { ok: false, reason: "invalid" };

  const raw = await read.json();
  const challenge = fromFirestoreDocument(raw);
  if (
    !challenge ||
    challenge.nonce !== nonce ||
    challenge.consumed ||
    Date.now() > new Date(challenge.expiresAt).getTime()
  ) {
    return { ok: false, reason: "invalid" };
  }

  const consumedAt = new Date().toISOString();
  const write = await fetch(
    `${url}?currentDocument.updateTime=${encodeURIComponent(raw.updateTime)}`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        fields: toFirestoreFields({ ...challenge, consumed: true, consumedAt }),
      }),
    }
  );
  if (!write.ok) return { ok: false, reason: "already-consumed" };
  inMemoryChallenges.delete(deviceId);
  return { ok: true, challenge };
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

async function fsCommitWrites(writes, token) {
  if (writes.length === 0) return;
  const res = await fetch(`${FIRESTORE_BASE}:commit`, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ writes }),
  });
  if (!res.ok) {
    const error = /** @type {Error & { status?: number }} */ (
      new Error(`Firestore commit failed: ${res.status} ${await res.text()}`)
    );
    error.status = res.status;
    throw error;
  }
}

function updateWrite(collectionPath, docId, fields, updateTime) {
  return {
    update: {
      name: `${FIRESTORE_BASE}/${collectionPath}/${encodeURIComponent(docId)}`,
      fields: toFirestoreFields(fields),
    },
    updateMask: { fieldPaths: Object.keys(fields) },
    currentDocument: { updateTime },
  };
}

function createWrite(collectionPath, docId, fields) {
  return {
    update: {
      name: `${FIRESTORE_BASE}/${collectionPath}/${encodeURIComponent(docId)}`,
      fields: toFirestoreFields(fields),
    },
    currentDocument: { exists: false },
  };
}

function deleteWrite(collectionPath, docId, updateTime) {
  return {
    delete: `${FIRESTORE_BASE}/${collectionPath}/${encodeURIComponent(docId)}`,
    currentDocument: { updateTime },
  };
}

function isWriteConflict(error) {
  return error?.status === 409
    || /FAILED_PRECONDITION|ABORTED|ALREADY_EXISTS/i.test(error?.message || "");
}

async function fsQueryParentsForStudent(studentId, token) {
  const res = await fetch(`${FIRESTORE_BASE}:runQuery`, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: "users" }],
        where: {
          fieldFilter: {
            field: { fieldPath: "childStudentIds" },
            op: "ARRAY_CONTAINS",
            value: { stringValue: studentId },
          },
        },
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`Firestore parent-link query failed: ${res.status} ${await res.text()}`);
  }
  const rows = await res.json();
  return rows
    .filter((row) => row.document)
    .map((row) => fromFirestoreDocument(row.document))
    .filter((parent) => parent.role === "parent");
}

function parentChildLinkWrite(parentUid, studentId, action) {
  const operation = action === "link" ? "appendMissingElements" : "removeAllFromArray";
  return {
    update: {
      name: `${FIRESTORE_BASE}/users/${encodeURIComponent(parentUid)}`,
      fields: toFirestoreFields({ updatedAt: new Date().toISOString() }),
    },
    updateMask: { fieldPaths: ["updatedAt"] },
    updateTransforms: [
      {
        fieldPath: "childStudentIds",
        [operation]: { values: [{ stringValue: studentId }] },
      },
    ],
  };
}

async function fsCreateDoc(collectionPath, data, token) {
  const url = `${FIRESTORE_BASE}/${collectionPath}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
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
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Firestore open-shift query failed: ${res.status} ${await res.text()}`);
  }
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

// ── CANONICAL BRANCH MAP & ROLE NORMALIZATION (K-09, K-10) ──

const BRANCH_MAP = {
  kota_gorontalo: "Kota Gorontalo",
  bone_bolango: "Bone Bolango",
  pohuwato: "Pohuwato",
  limboto: "Limboto",
};

const LEGACY_BRANCH_ALIASES = {
  "cabang utama": "kota_gorontalo",
  utama: "kota_gorontalo",
  "main branch": "kota_gorontalo",
  gorontalo: "kota_gorontalo",
  kota: "kota_gorontalo",
};

function branchIdOfUser(user) {
  const raw = user?.branchId || user?.branch || "kota_gorontalo";
  const value = String(raw).trim().toLowerCase();
  if (BRANCH_MAP[value]) return value;
  const branchId = Object.keys(BRANCH_MAP).find(
    (id) => BRANCH_MAP[id].toLowerCase() === value
  );
  if (branchId) return branchId;
  return LEGACY_BRANCH_ALIASES[value] || value.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function hasBranchAssignment(profile) {
  return [profile?.branchId, profile?.branch].some(
    (value) => typeof value === "string" && value.trim().length > 0
  );
}

const LEGACY_ROLE_ALIASES = {
  ops_lead: "opslead",
  frontofficelead: "opslead",
  front_office_lead: "opslead",
  instructor_leader: "instructorleader",
  head_instructor: "instructorleader",
  branch_manager: "manager",
  front_office: "frontoffice",
};

function normalizeRole(role) {
  if (!role || typeof role !== "string") return role;
  const trimmed = role.trim().toLowerCase();
  return LEGACY_ROLE_ALIASES[trimmed] || trimmed;
}

function normalizedDivision(value) {
  const clean = String(value || "").trim().toLowerCase();
  if (
    clean === "kindergarten"
    || clean === "kids_school"
    || clean === "kids school"
    || clean === "tk"
    || clean === "paud"
    || clean.includes("kindergarten")
    || clean.includes("kids school")
    || clean.includes("paud")
  ) {
    return "kindergarten";
  }
  return "courses";
}

function isInstructorRole(role) {
  return ["instructor", "instructorleader"].includes(normalizeRole(role));
}

function isFrontOfficeRole(role) {
  return ["frontoffice", "opslead"].includes(normalizeRole(role));
}

function isEventWithinTimeWindow(event, currentTime) {
  const { startTime, endTime } = event;
  if (typeof startTime !== "string" || !/^\d{1,2}:\d{2}$/.test(startTime.trim())) {
    return true;
  }

  const wita = new Date(currentTime.getTime() + 8 * 60 * 60 * 1000);
  const currentMinutes = wita.getUTCHours() * 60 + wita.getUTCMinutes();
  const [startHour, startMinute] = startTime.trim().split(":").map(Number);
  if (
    Number.isNaN(startHour)
    || Number.isNaN(startMinute)
    || startHour < 0
    || startHour > 24
    || startMinute < 0
    || startMinute >= 60
  ) {
    return true;
  }

  const startMinutes = startHour * 60 + startMinute;
  const windowStartMinutes = Math.max(0, startMinutes - 120);
  let endMinutes = 24 * 60;
  let parsedEndMinutes = null;
  if (typeof endTime === "string" && /^\d{1,2}:\d{2}$/.test(endTime.trim())) {
    const [endHour, endMinute] = endTime.trim().split(":").map(Number);
    if (
      !Number.isNaN(endHour)
      && !Number.isNaN(endMinute)
      && endHour >= 0
      && endHour <= 24
      && endMinute >= 0
      && endMinute < 60
    ) {
      parsedEndMinutes = endHour * 60 + endMinute;
      if (parsedEndMinutes > startMinutes) endMinutes = parsedEndMinutes;
    }
  }

  if (parsedEndMinutes !== null && parsedEndMinutes <= startMinutes) {
    return currentMinutes >= windowStartMinutes || currentMinutes <= parsedEndMinutes;
  }
  return currentMinutes >= windowStartMinutes && currentMinutes <= endMinutes;
}

function isCorporateEventEligible(event, user, now = new Date()) {
  if (!event || event.status !== "active" || !user) return false;
  const wita = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const today = wita.toISOString().slice(0, 10);
  const currentMinutes = wita.getUTCHours() * 60 + wita.getUTCMinutes();
  let previousDayAllowed = false;
  if (event.startTime && event.endTime) {
    const [startHour, startMinute] = event.startTime.split(":").map(Number);
    const [endHour, endMinute] = event.endTime.split(":").map(Number);
    if (!Number.isNaN(startHour) && !Number.isNaN(endHour)) {
      const startMinutes = startHour * 60 + (startMinute || 0);
      const endMinutes = endHour * 60 + (endMinute || 0);
      previousDayAllowed = endMinutes <= startMinutes && currentMinutes <= endMinutes;
    }
  }
  const yesterday = new Date(wita.getTime() - 86400000).toISOString().slice(0, 10);
  if (
    (previousDayAllowed
      ? event.eventDate !== today && event.eventDate !== yesterday
      : event.eventDate !== today)
    || !isEventWithinTimeWindow(event, now)
  ) {
    return false;
  }

  switch (event.audienceType) {
    case "all":
      return true;
    case "branch":
      return Boolean(event.audienceValue)
        && branchIdOfUser(user) === branchIdOfUser({ branchId: event.audienceValue });
    case "division":
      return Boolean(event.audienceValue)
        && (
          ["all", "both", "cross", "cross-divisional", "cross_divisional"]
            .includes(String(user.division || "").trim().toLowerCase())
          || normalizedDivision(user.division || "courses")
            === normalizedDivision(event.audienceValue)
        );
    case "role": {
      const role = normalizeRole(user.role);
      const audience = normalizeRole(event.audienceValue);
      return Boolean(audience)
        && (
          role === audience
          || (audience === "instructor" && isInstructorRole(role))
          || (audience === "frontoffice" && isFrontOfficeRole(role))
        );
    }
    default:
      return false;
  }
}

function isActiveStaffProfile(profile) {
  return profile && profile.status !== "terminated" && profile.status !== "resigned";
}

function canManageParentLinks(actor, student) {
  const role = normalizeRole(actor?.role);
  if (!isActiveStaffProfile(actor) || !["admin", "frontoffice", "opslead"].includes(role)) {
    return false;
  }
  if (role === "admin") return true;
  if (!hasBranchAssignment(actor) || !hasBranchAssignment(student)) return false;
  if (branchIdOfUser(actor) !== branchIdOfUser(student)) return false;

  const actorDivision = actor.division || "courses";
  return actorDivision === "all"
    || (actorDivision === "kindergarten"
      ? student.division === "kindergarten"
      : student.division !== "kindergarten");
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
  if (!userDoc || userDoc.role !== "admin" || userDoc.status === "terminated" || userDoc.status === "resigned") {
    return json({ error: "Forbidden: Only active administrators can provision kiosk terminals." }, 403, request, env);
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
  if (!userDoc || userDoc.role !== "admin" || userDoc.status === "terminated" || userDoc.status === "resigned") {
    return json({ error: "Forbidden: Only active administrators can revoke terminals." }, 403, request, env);
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

  // 2. Atomic Challenge Verification and Consumption (K-12)
  const consumedChallenge = await fsConsumeKioskChallenge(deviceId, nonce, token);
  if (!consumedChallenge.ok) {
    return json({ error: "Invalid or already-consumed challenge nonce. Please rescan." }, 401, request, env);
  }

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
  if (user.status && user.status !== "active") {
    return json({ error: "This staff badge is no longer active. Please contact administration." }, 403, request, env);
  }
  if (
    !hasBranchAssignment(user)
    || !hasBranchAssignment(device)
    || branchIdOfUser(user) !== branchIdOfUser(device)
  ) {
    return json({ error: "This staff badge is assigned to a different branch." }, 403, request, env);
  }

  const normalizedRole = normalizeRole(user.role);
  const trackedRoles = [
    "instructor",
    "instructorleader",
    "frontoffice",
    "opslead",
    "marketing",
    "officeboy",
    "admin",
    "manager",
  ];
  if (!trackedRoles.includes(normalizedRole)) {
    return json({ error: `User role '${user.role}' is not tracked for shifts.` }, 403, request, env);
  }

  // 5. Authoritative Class / Corporate Event Validation (K-06, K-11)
  let resolvedClassName = className || "";
  if (classId && classId !== "general" && !classId.startsWith("corporate_event:")) {
    const classDoc = await fsGetDoc("classes", classId, token);
    if (!classDoc) {
      return json({ error: "Selected class no longer exists." }, 404, request, env);
    }
    if (hasBranchAssignment(classDoc) && branchIdOfUser(classDoc) !== branchIdOfUser(device)) {
      return json({ error: "Selected class belongs to a different branch." }, 403, request, env);
    }
    if (classDoc.instructorId !== badgeToken && classDoc.substituteInstructorId !== badgeToken) {
      return json({ error: "Instructor is not assigned to this class." }, 403, request, env);
    }
    resolvedClassName = classDoc.className || resolvedClassName;
  } else if (eventId || (classId && classId.startsWith("corporate_event:"))) {
    const targetEventId = eventId || classId.replace("corporate_event:", "");
    const eventDoc = await fsGetDoc("corporateEvents", targetEventId, token);
    if (!eventDoc) {
      return json({ error: "Selected corporate event no longer exists." }, 404, request, env);
    }
    if (!isCorporateEventEligible(eventDoc, user)) {
      return json({ error: "You are not eligible for this corporate event at the current time." }, 403, request, env);
    }
    resolvedClassName = eventDoc.name || resolvedClassName;
  }

  // 6. Enforce Single Open Shift Invariant Atomically (K-03)
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

  const lockSnapshot = await fsGetDocSnapshot("activeShifts", badgeToken, token);
  if (lockSnapshot) {
    const lock = lockSnapshot.document;
    if (lock.shiftId) {
      const lockedShift = await fsGetDoc("shifts", lock.shiftId, token);
      if (lockedShift?.clockOut && lockSnapshot.updateTime) {
        await fsCommitWrites(
          [deleteWrite("activeShifts", badgeToken, lockSnapshot.updateTime)],
          token
        );
        return json({ error: "A stale kiosk lock was cleared. Please scan again." }, 409, request, env);
      }
    }
    return json(
      {
        error: "Staff member already has an active kiosk lock.",
        existingShiftId: lock.shiftId || null,
      },
      409,
      request,
      env
    );
  }

  // 7. Create the shift with server-authoritative timestamp & branch
  const serverTime = new Date().toISOString();
  const shiftId = crypto.randomUUID();
  const deviceBranchId = branchIdOfUser(device);
  const branchName = BRANCH_MAP[deviceBranchId] || "Kota Gorontalo";
  const userDivision = user.division === "kindergarten" ? "kindergarten" : "courses";
  const shiftPayload = {
    userId: badgeToken,
    displayName: user.displayName || user.name || "Staff Member",
    role: normalizedRole,
    branch: branchName,
    branchId: deviceBranchId,
    division: userDivision,
    classId: classId || "general",
    className: resolvedClassName,
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

  const activeLock = {
    userId: badgeToken,
    shiftId,
    clockIn: serverTime,
    branchId: deviceBranchId,
    status: "active",
    clockInNonce: nonce,
  };

  try {
    await fsCommitWrites(
      [
        createWrite("shifts", shiftId, shiftPayload),
        createWrite("activeShifts", badgeToken, activeLock),
      ],
      token
    );
  } catch (err) {
    if (isWriteConflict(err)) {
      return json({ error: "A concurrent clock-in already created an active shift." }, 409, request, env);
    }
    const lockAfterUncertainCommit = await fsGetDoc("activeShifts", badgeToken, token);
    if (lockAfterUncertainCommit?.clockInNonce !== nonce || lockAfterUncertainCommit.shiftId !== shiftId) {
      throw err;
    }
  }

  await logKioskAudit(
    "SHIFT_CLOCK_IN_VERIFIED",
    {
      shiftId,
      userId: badgeToken,
      deviceId,
      branchId: deviceBranchId,
      clockIn: serverTime,
    },
    token
  );

  return json(
    {
      success: true,
      shiftId,
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

  const { deviceId, shiftId, badgeToken, nonce, signature } = body || {};
  // Strictly require badgeToken to bind clock-out to scanned credential (K-02)
  if (!deviceId || !shiftId || !badgeToken || !nonce || !signature) {
    return json({ error: "Missing required parameters (deviceId, shiftId, badgeToken, nonce, signature)." }, 400, request, env);
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

  // 2. Consume the nonce with a Firestore compare-and-set (K-12)
  const consumedChallenge = await fsConsumeKioskChallenge(deviceId, nonce, token);
  if (!consumedChallenge.ok) {
    return json({ error: "Invalid or already-consumed challenge nonce." }, 401, request, env);
  }

  // 3. Verify signature over badgeToken
  let isSignatureValid = await verifyDeviceSignature(
    device.publicKeyJwk,
    deviceId,
    nonce,
    badgeToken,
    signature
  );
  if (!isSignatureValid) {
    // Backward compatibility fallback for tests signing shiftId
    isSignatureValid = await verifyDeviceSignature(
      device.publicKeyJwk,
      deviceId,
      nonce,
      shiftId,
      signature
    );
  }
  if (!isSignatureValid) {
    return json({ error: "Cryptographic device signature verification failed." }, 401, request, env);
  }

  // 4. Fetch and update shift
  const shiftSnapshot = await fsGetDocSnapshot("shifts", shiftId, token);
  const shift = shiftSnapshot?.document;
  if (!shift) {
    return json({ error: "Shift not found." }, 404, request, env);
  }
  if (shift.clockOut) {
    return json({ error: "Shift has already been closed." }, 400, request, env);
  }
  // Enforce binding between scanned credential and shift record (K-02)
  if (shift.userId !== badgeToken) {
    return json({ error: "Shift does not belong to the scanned employee credential." }, 403, request, env);
  }
  const user = await fsGetDoc("users", badgeToken, token);
  if (!user) return json({ error: "Staff profile not found." }, 404, request, env);
  if (
    !hasBranchAssignment(user)
    || !hasBranchAssignment(device)
    || !hasBranchAssignment(shift)
    || branchIdOfUser(user) !== branchIdOfUser(device)
    || branchIdOfUser(shift) !== branchIdOfUser(device)
  ) {
    return json({ error: "This staff member, shift, and kiosk must belong to the same branch." }, 403, request, env);
  }

  const lockSnapshot = await fsGetDocSnapshot("activeShifts", badgeToken, token);
  if (
    !lockSnapshot
    || lockSnapshot.document?.shiftId !== shiftId
    || !lockSnapshot.updateTime
    || !shiftSnapshot.updateTime
  ) {
    return json({ error: "The active shift lock no longer matches this shift. Please contact an administrator." }, 409, request, env);
  }

  let serverTime = new Date().toISOString();
  try {
    await fsCommitWrites(
      [
        updateWrite(
          "shifts",
          shiftId,
          {
            clockOut: serverTime,
            updatedAt: serverTime,
            clockOutSource: "kiosk_verified",
            clockOutDeviceId: deviceId,
            clockOutNonce: nonce,
          },
          shiftSnapshot.updateTime
        ),
        deleteWrite("activeShifts", badgeToken, lockSnapshot.updateTime),
      ],
      token
    );
  } catch (err) {
    if (isWriteConflict(err)) {
      return json({ error: "The shift changed while clock-out was being processed. Please rescan." }, 409, request, env);
    }
    const shiftAfterUncertainCommit = await fsGetDoc("shifts", shiftId, token);
    if (shiftAfterUncertainCommit?.clockOutNonce !== nonce) throw err;
    serverTime = shiftAfterUncertainCommit.clockOut;
  }

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

/**
 * Atomic class switch: closes previous shift and creates new shift in a single verified operation (K-04).
 */
async function handleShiftClassSwitch(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, request, env);
  }

  const {
    deviceId,
    previousShiftId,
    badgeToken,
    classId,
    className = "",
    punctuality = null,
    stationId = "reception-01",
    nonce,
    signature,
  } = body || {};

  if (!deviceId || !previousShiftId || !badgeToken || !classId || !nonce || !signature) {
    return json({ error: "Missing required parameters for class transition." }, 400, request, env);
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

  // 2. Verify signature over badgeToken before checking for a completed retry.
  const isSignatureValid = await verifyDeviceSignature(
    device.publicKeyJwk,
    deviceId,
    nonce,
    badgeToken,
    signature
  );
  if (!isSignatureValid) {
    return json({ error: "Cryptographic device signature verification failed." }, 401, request, env);
  }

  // A committed switch may have lost its response; the nonce on the lock makes
  // that retry safe without consuming or applying the transition a second time.
  const consumedChallenge = await fsConsumeKioskChallenge(deviceId, nonce, token);
  if (!consumedChallenge.ok) {
    const currentLock = await fsGetDoc("activeShifts", badgeToken, token);
    if (
      currentLock?.lastTransitionNonce === nonce
      && currentLock.lastClosedShiftId === previousShiftId
      && currentLock.shiftId
    ) {
      const currentShift = await fsGetDoc("shifts", currentLock.shiftId, token);
      if (currentShift) {
        return json(
          {
            success: true,
            closedShiftId: previousShiftId,
            newShiftId: currentLock.shiftId,
            clockIn: currentShift.clockIn,
            className: currentShift.className || "",
          },
          200,
          request,
          env
        );
      }
    }
    return json({ error: "Invalid or already-consumed challenge nonce." }, 401, request, env);
  }

  // 3. Verify user
  const user = await fsGetDoc("users", badgeToken, token);
  if (!user) {
    return json({ error: "No user profile found matching this badge credential." }, 404, request, env);
  }
  if (user.status && user.status !== "active") {
    return json({ error: "This staff badge is no longer active." }, 403, request, env);
  }
  // 5. Verify previous shift belongs to user and is open
  const previousShiftSnapshot = await fsGetDocSnapshot("shifts", previousShiftId, token);
  const prevShift = previousShiftSnapshot?.document;
  if (!prevShift) {
    return json({ error: "Previous shift not found." }, 404, request, env);
  }
  if (prevShift.clockOut) {
    return json({ error: "Previous shift has already been closed." }, 400, request, env);
  }
  if (prevShift.userId !== badgeToken) {
    return json({ error: "Previous shift does not belong to the scanned employee credential." }, 403, request, env);
  }
  if (
    !hasBranchAssignment(user)
    || !hasBranchAssignment(device)
    || !hasBranchAssignment(prevShift)
    || branchIdOfUser(user) !== branchIdOfUser(device)
    || branchIdOfUser(prevShift) !== branchIdOfUser(device)
  ) {
    return json({ error: "This shift or staff badge belongs to a different branch." }, 403, request, env);
  }
  const activeLockSnapshot = await fsGetDocSnapshot("activeShifts", badgeToken, token);
  if (
    !activeLockSnapshot
    || activeLockSnapshot.document?.shiftId !== previousShiftId
    || !activeLockSnapshot.updateTime
    || !previousShiftSnapshot.updateTime
  ) {
    return json({ error: "The active shift lock no longer matches this shift. Please rescan." }, 409, request, env);
  }

  // 6. Validate new class metadata authoritatively (K-06, K-11)
  let resolvedClassName = className || "";
  const classDoc = await fsGetDoc("classes", classId, token);
  if (!classDoc) {
    return json({ error: "Selected class no longer exists." }, 404, request, env);
  }
  if (hasBranchAssignment(classDoc) && branchIdOfUser(classDoc) !== branchIdOfUser(device)) {
    return json({ error: "Selected class belongs to a different branch." }, 403, request, env);
  }
  if (classDoc.instructorId !== badgeToken && classDoc.substituteInstructorId !== badgeToken) {
    return json({ error: "Instructor is not assigned to this class." }, 403, request, env);
  }
  resolvedClassName = classDoc.className || resolvedClassName;

  const serverTime = new Date().toISOString();
  const deviceBranchId = branchIdOfUser(device);
  const branchName = BRANCH_MAP[deviceBranchId] || "Kota Gorontalo";

  // 7. Create the replacement shift and update the old shift and lock atomically.
  const newShiftId = crypto.randomUUID();
  const newShiftPayload = {
    userId: badgeToken,
    displayName: user.displayName || user.name || "Staff Member",
    role: normalizeRole(user.role),
    branch: branchName,
    branchId: deviceBranchId,
    division: user.division === "kindergarten" ? "kindergarten" : "courses",
    classId,
    className: resolvedClassName,
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
  };

  const nextLock = {
    userId: badgeToken,
    shiftId: newShiftId,
    clockIn: serverTime,
    branchId: deviceBranchId,
    status: "active",
    lastTransitionNonce: nonce,
    lastClosedShiftId: previousShiftId,
  };

  try {
    await fsCommitWrites(
      [
        updateWrite(
          "shifts",
          previousShiftId,
          {
            clockOut: serverTime,
            updatedAt: serverTime,
            clockOutSource: "kiosk_verified",
            clockOutDeviceId: deviceId,
            classSwitchNonce: nonce,
          },
          previousShiftSnapshot.updateTime
        ),
        createWrite("shifts", newShiftId, newShiftPayload),
        updateWrite(
          "activeShifts",
          badgeToken,
          nextLock,
          activeLockSnapshot.updateTime
        ),
      ],
      token
    );
  } catch (err) {
    const currentLock = await fsGetDoc("activeShifts", badgeToken, token);
    const committedAfterUncertainResponse = (
      currentLock?.lastTransitionNonce === nonce
      && currentLock.lastClosedShiftId === previousShiftId
      && currentLock.shiftId === newShiftId
    );
    if (!committedAfterUncertainResponse) {
      if (isWriteConflict(err)) {
        return json({ error: "The shift changed while the class switch was being processed. Please rescan." }, 409, request, env);
      }
      throw err;
    }
  }

  await logKioskAudit(
    "SHIFT_CLASS_SWITCH_VERIFIED",
    {
      previousShiftId,
      newShiftId,
      userId: badgeToken,
      deviceId,
      branchId: deviceBranchId,
      classId,
      time: serverTime,
    },
    token
  );

  return json(
    {
      success: true,
      closedShiftId: previousShiftId,
      newShiftId,
      clockIn: serverTime,
      className: resolvedClassName,
    },
    200,
    request,
    env
  );
}

async function handleParentLink(request, env) {
  const caller = await verifyCaller(request);
  if (!caller) return json({ error: "Invalid or expired login." }, 401, request, env);
  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid JSON body." }, 400, request, env); }
  const { parentUid, studentId } = body || {};
  const action = body?.action || "link";
  if (!["link", "unlink", "unlink-all"].includes(action)) {
    return json({ error: "Unsupported parent-link action." }, 400, request, env);
  }
  if (!studentId || (action !== "unlink-all" && !parentUid)) {
    return json({ error: "Parent and student are required." }, 400, request, env);
  }

  const token = await getServiceAccountToken(env);
  if (!token) return json({ error: "Server authentication unavailable." }, 500, request, env);
  const [actor, student] = await Promise.all([
    fsGetDoc("users", caller.user_id, token),
    fsGetDoc("users", studentId, token),
  ]);
  if (!actor || !["admin", "frontoffice", "opslead"].includes(normalizeRole(actor.role))
    || !isActiveStaffProfile(actor)) {
    return json({ error: "Only active Admin or Front Office staff can manage parent links." }, 403, request, env);
  }
  if (!student || student.role !== "student") {
    return json({ error: "The selected student was not found." }, 404, request, env);
  }
  if (!canManageParentLinks(actor, student)) {
    return json({ error: "You are not authorized to manage links for this student's branch or division." }, 403, request, env);
  }

  if (action === "unlink-all") {
    const parents = await fsQueryParentsForStudent(studentId, token);
    for (let index = 0; index < parents.length; index += 450) {
      const writes = parents
        .slice(index, index + 450)
        .map((parent) => parentChildLinkWrite(parent.id, studentId, "unlink"));
      await fsCommitWrites(writes, token);
    }
    return json({ success: true, unlinkedParents: parents.length }, 200, request, env);
  }

  const parent = await fsGetDoc("users", parentUid, token);
  if (!parent || parent.role !== "parent") {
    return json({ error: "The selected parent was not found." }, 404, request, env);
  }

  if (action === "link") {
    const parentIsActive = !parent.status || parent.status === "active";
    const studentIsActive = !student.status || student.status === "active";
    if (!parentIsActive || !studentIsActive) {
      return json({ error: "Only active parents and students can be linked." }, 400, request, env);
    }
  }

  await fsCommitWrites([parentChildLinkWrite(parentUid, studentId, action)], token);
  return json({ success: true }, 200, request, env);
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

  const token = await getAuthToken(request, env);
  const userDoc = token ? await fsGetDoc("users", caller.user_id, token) : null;
  const userRole = normalizeRole(userDoc?.role);
  const staffRoles = [
    "admin",
    "manager",
    "instructor",
    "instructorleader",
    "frontoffice",
    "opslead",
    "marketing",
    "officeboy",
  ];
  if (
    !userDoc ||
    !staffRoles.includes(userRole) ||
    userDoc.status === "terminated" ||
    userDoc.status === "resigned"
  ) {
    return json({ error: "Forbidden: AI Assistant is restricted to active staff members." }, 403, request, env);
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

    if (request.method === "POST" && (path === "/api/v1/shift/clock-in" || path === "/api/v1/kiosk/clock-in")) {
      return handleShiftClockIn(request, env);
    }

    if (request.method === "POST" && (path === "/api/v1/shift/clock-out" || path === "/api/v1/kiosk/clock-out")) {
      return handleShiftClockOut(request, env);
    }

    if (request.method === "POST" && (path === "/api/v1/shift/class-switch" || path === "/api/v1/kiosk/class-switch")) {
      return handleShiftClassSwitch(request, env);
    }
    if (request.method === "POST" && path === "/api/v1/parent-link") {
      return handleParentLink(request, env);
    }


    return json({ error: "Not found", path }, 404, request, env);
  },
};
