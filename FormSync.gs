// ── SETUP: these now live in Project Settings → Script Properties,
// NOT in this code — see the setup notes below the code for exactly
// what to name each one. Nothing secret sits in this file anymore.
const props = PropertiesService.getScriptProperties();
const FIREBASE_PROJECT_ID = props.getProperty("FIREBASE_PROJECT_ID");
const SERVICE_ACCOUNT_EMAIL = props.getProperty("SERVICE_ACCOUNT_EMAIL");
// Script Properties store plain text, so the key's line breaks arrive
// as literal "\n" characters instead of real newlines. RSA signing
// needs real newlines, so this converts them back.
const SERVICE_ACCOUNT_KEY = (props.getProperty("SERVICE_ACCOUNT_KEY") || "").replace(/\\n/g, "\n");

// ── FIELD MAPPING: match these to your form's EXACT question text ──
const FIELD_MAP = {
  branch: "PILIHAN CABANG",
  program: "PROGRAM",
  classType: "JENIS KELAS",
  displayName: "NAMA LENGKAP",
  gender: "JENIS KELAMIN",
  placeOfBirth: "TEMPAT LAHIR",
  dob: "TANGGAL LAHIR",
  religion: "AGAMA",
  address: "ALAMAT LENGKAP",
  phone: "NOMOR HP PENDAFTAR",
  fatherName: "NAMA AYAH",
  fatherJob: "PEKERJAAN AYAH",
  fatherPhone: "NOMOR HP AYAH",
  motherName: "NAMA IBU",
  motherJob: "PEKERJAAN IBU",
  motherPhone: "NOMOR HP IBU",
  schoolOrJob: "NAMA SEKOLAH/UNIVERSITAS/PEKERJAAN",
  classOrSemester: "KELAS/SEMESTER/JABATAN",
  referralSource: "DARI MANAKAH ANDA MEMPEROLEH INFORMASI MENGENAI MYLIBERTY?",
};

// Base64url encode (JWT needs this, NOT plain base64 — different charset, no padding)
function base64UrlEncode_(input) {
  return Utilities.base64Encode(input)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// Exchanges the service account's key for a short-lived Firestore access token.
// This is the whole "authentication" step — no library needed for this part,
// it's just signing a standard JWT and trading it in with Google directly.
function getAccessToken_() {
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: SERVICE_ACCOUNT_EMAIL,
    scope: "https://www.googleapis.com/auth/datastore",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const toSign = base64UrlEncode_(JSON.stringify(header)) + "." + base64UrlEncode_(JSON.stringify(claims));
  const signatureBytes = Utilities.computeRsaSha256Signature(toSign, SERVICE_ACCOUNT_KEY);
  const jwt = toSign + "." + base64UrlEncode_(signatureBytes);

  const res = UrlFetchApp.fetch("https://oauth2.googleapis.com/token", {
    method: "post",
    payload: {
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    },
    muteHttpExceptions: true,
  });

  const data = JSON.parse(res.getContentText());
  if (!data.access_token) throw new Error("Auth failed: " + res.getContentText());
  return data.access_token;
}

// Wraps every value as a Firestore REST "stringValue" field.
function toFirestoreFields_(obj) {
  const fields = {};
  for (const [key, value] of Object.entries(obj)) {
    fields[key] = { stringValue: String(value || "") };
  }
  return fields;
}

function onFormSubmit(e) {
  const application = { status: "pending", submittedAt: new Date().toISOString() };
  for (const [firestoreField, formQuestion] of Object.entries(FIELD_MAP)) {
    const answer = e.namedValues[formQuestion];
    application[firestoreField] = answer ? answer[0] : "";
  }

  const token = getAccessToken_();
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/applications`;

  const res = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + token },
    payload: JSON.stringify({ fields: toFirestoreFields_(application) }),
    muteHttpExceptions: true,
  });

  if (res.getResponseCode() >= 300) {
    throw new Error("Firestore write failed: " + res.getContentText());
  }
}

// Run this manually (▶ button, select this function) to test the whole
// pipeline without needing to submit the real form each time.
function testConnection() {
  onFormSubmit({
    namedValues: {
      "NAMA LENGKAP": ["Test Student"],
      "NOMOR HP PENDAFTAR": ["081234567890"],
    },
  });
  Logger.log("If no error appeared above, check Firestore's applications collection now.");
}
