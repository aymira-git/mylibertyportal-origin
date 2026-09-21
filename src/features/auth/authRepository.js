import { db } from "../../firebase";
import { doc, getDoc, updateDoc, writeBatch } from "firebase/firestore";

/**
 * All direct Firestore reads/writes for the auth domain (a user's own
 * profile, and the staff-signup-from-invite flow) live here instead of
 * inside ProfilePanel.jsx and StaffSignup.jsx — same pattern as the other
 * domain repositories.
 */

export async function fetchOwnProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

export function updateProfilePhoto(uid, photoURL) {
  return updateDoc(doc(db, "users", uid), { photoURL });
}

export function updateProfileDetails(uid, { displayName, phone, dob }) {
  return updateDoc(doc(db, "users", uid), { displayName, phone, dob });
}

/**
 * @returns {Promise<any>}
 */
export async function fetchInviteByToken(token) {
  const snap = await getDoc(doc(db, "invites", token));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * Creating the Firestore profile and clearing the invite that was used to
 * sign up happen atomically as one batch — either both land or neither
 * does. This is the Firestore-side half of signup only: the Auth account
 * itself (createUserWithEmailAndPassword) has to be created first and
 * separately, since Firebase Auth and Firestore are different systems —
 * a batch can't span both. That first step stays its own irreducible
 * step in StaffSignup.jsx; this function is what runs right after it.
 */
export function completeStaffSignup(uid, userProfile, inviteId) {
  const batch = writeBatch(db);
  batch.set(doc(db, "users", uid), userProfile);
  batch.delete(doc(db, "invites", inviteId));
  return batch.commit();
}
