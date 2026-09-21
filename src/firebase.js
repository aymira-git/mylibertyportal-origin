import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCut-lqqGwpwZ9FjaifrBObi8Kr76tawIU",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "mylibertyies-f2f38.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "mylibertyies-f2f38",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "mylibertyies-f2f38.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1072836543676",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1072836543676:web:713dc5f12930e89ce5fcb9"
};

// Startup validation: ensure essential Firebase client config is present and valid
function validateFirebaseConfig(config) {
  const required = ["apiKey", "projectId", "appId"];
  const missing = required.filter(
    (key) => !config[key] || typeof config[key] !== "string" || !config[key].trim()
  );
  if (missing.length > 0) {
    throw new Error(
      `[Firebase Config Error] Missing required configuration keys: ${missing.join(", ")}. Please check your environment or configuration settings.`
    );
  }
}

validateFirebaseConfig(firebaseConfig);

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

/**
 * A second, independent Firebase App instance sharing the same project
 * config — used only when an admin creates a brand-new staff account.
 * createUserWithEmailAndPassword on the PRIMARY auth instance would sign
 * the admin out of their own session and log them in as the new user
 * instead; running it against this separate instance avoids that, so the
 * admin stays signed in throughout. This was previously defined inside
 * useDashboardData.js — moved here since it's session/auth infrastructure,
 * not dashboard-specific logic.
 */
export function getSecondaryAuth() {
  const secondaryApp = getApps().find(a => a.name === "Secondary")
    || initializeApp(firebaseConfig, "Secondary");
  return getAuth(secondaryApp);
}


// 👈 Enable the offline database cache (Called once cleanly)
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === "failed-precondition") {
    // Multiple tabs open, persistence can only be active in one tab at a time.
    console.warn("Firestore offline persistence failed: Multiple browser tabs open.");
  } else if (err.code === "unimplemented") {
    // The current browser does not support IndexedDB offline persistence features
    console.warn("Firestore offline persistence failed: Browser not supported.");
  }
});
