import { db } from "../../firebase";
import { doc, deleteDoc, setDoc } from "firebase/firestore";

/**
 * All direct Firestore writes for invites live here instead of inside
 * useDashboardData.js — same pattern as classesRepository.js,
 * paymentsRepository.js, and applicationsRepository.js.
 */

import { inviteSchema } from "../../schemas";
import { DEFAULT_BRANCH } from "../../constants/branches.js";
import { DEFAULT_DIVISION } from "../../constants/divisions.js";

export const INVITE_EXPIRATION_DAYS = 7;

export function createInvite(email, role, branch = DEFAULT_BRANCH, division = DEFAULT_DIVISION) {
  const validated = inviteSchema.parse({ email, role, branch, division });
  const token = crypto.randomUUID();
  const now = Date.now();
  const expiresAt = now + INVITE_EXPIRATION_DAYS * 24 * 60 * 60 * 1000;

  return setDoc(doc(db, "invites", token), {
    email: validated.email,
    role: validated.role,
    branch: validated.branch,
    division: validated.division,
    createdAt: new Date(now).toISOString(),
    expiresAt,
    used: false,
    token,
  });
}

export function deleteInvite(id) {
  return deleteDoc(doc(db, "invites", id));
}
