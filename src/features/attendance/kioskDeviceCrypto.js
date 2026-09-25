/**
 * Kiosk Device Cryptographic Identity (Web Crypto API)
 *
 * Implements non-exportable P-256 ECDSA keypairs stored directly in browser IndexedDB.
 * The private key can NEVER be extracted, viewed in DevTools, or exported via script.
 * Every clock-in challenge from the kiosk is signed with this key to prove
 * physical custody of the provisioned reception terminal.
 */

const DB_NAME = "myliberty_kiosk_keystore";
const DB_VERSION = 1;
const STORE_NAME = "device_keys";
const KEY_RECORD_ID = "kiosk_identity";

function openKeystoreDB() {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return reject(new Error("IndexedDB is not available in this environment."));
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * ArrayBuffer to Base64URL string
 * @param {ArrayBuffer} buffer
 * @returns {string}
 */
export function bufferToBase64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Retrieves the existing non-exportable kiosk key or generates a new one.
 * @param {string|null} preferredDeviceId
 * @returns {Promise<{ deviceId: string, publicKeyJwk: JsonWebKey, isNew: boolean }>}
 */
export async function getOrCreateKioskKey(preferredDeviceId = null) {
  const db = await openKeystoreDB();

  const existing = await new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(KEY_RECORD_ID);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => resolve(null);
  });

  if (existing?.privateKey && existing?.publicKeyJwk && existing?.deviceId) {
    return {
      deviceId: existing.deviceId,
      publicKeyJwk: existing.publicKeyJwk,
      isNew: false,
    };
  }

  // Generate a non-exportable P-256 ECDSA keypair
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: "ECDSA",
      namedCurve: "P-256",
    },
    false, // extractable: false — private key NEVER leaves browser memory/crypto hardware
    ["sign"]
  );

  const publicKeyJwk = await window.crypto.subtle.exportKey("jwk", keyPair.publicKey);
  const deviceId =
    preferredDeviceId ||
    `kiosk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  const record = {
    id: KEY_RECORD_ID,
    deviceId,
    privateKey: keyPair.privateKey,
    publicKeyJwk,
    createdAt: new Date().toISOString(),
  };

  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const req = tx.objectStore(STORE_NAME).put(record);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });

  return {
    deviceId,
    publicKeyJwk,
    isNew: true,
  };
}

/**
 * Signs a kiosk challenge payload using the non-exportable private key.
 * @param {string} deviceId
 * @param {string} nonce
 * @param {string} badgeToken
 * @returns {Promise<string>} base64url-encoded ECDSA signature
 */
export async function signKioskChallenge(deviceId, nonce, badgeToken) {
  const db = await openKeystoreDB();

  const record = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(KEY_RECORD_ID);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });

  if (!record?.privateKey) {
    throw new Error(
      "Kiosk device is not provisioned. Please complete administrator provisioning on this station."
    );
  }

  const payloadString = `${deviceId}:${nonce}:${badgeToken}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(payloadString);

  const signature = await window.crypto.subtle.sign(
    {
      name: "ECDSA",
      hash: { name: "SHA-256" },
    },
    record.privateKey,
    data
  );

  return bufferToBase64Url(signature);
}

/**
 * Revokes local key and clears keystore for de-provisioning or station reset.
 */
export async function clearKioskKey() {
  const db = await openKeystoreDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const req = tx.objectStore(STORE_NAME).delete(KEY_RECORD_ID);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}
