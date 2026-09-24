import { db, auth } from "../../firebase";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { APPROVAL_STATUS, APPROVAL_ROLES } from "./approvalGates";
import { branchToId, DEFAULT_BRANCH_ID } from "../../constants/branches";

const COLLECTION_NAME = "approvals";

/**
 * Submits an approval envelope to the Firestore /approvals collection.
 *
 * @param {object} envelope
 * @returns {Promise<{ id: string, [key: string]: any }>}
 */
export async function submitApprovalRequest(envelope) {
  if (!envelope || !envelope.actionId) {
    throw new Error("Invalid approval envelope submitted.");
  }

  const payload = {
    ...envelope,
    status: APPROVAL_STATUS.PENDING,
    approverBranchId: envelope.approverBranchId ? branchToId(envelope.approverBranchId) : null,
    createdAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, COLLECTION_NAME), payload);
  return { id: docRef?.id || "approval-id", ...payload };
}

/**
 * Subscribes to pending approval requests matching the approver's role and branch.
 * Admin receives all pending approvals; Branch Managers receive approvals scoped to their branch.
 *
 * @param {string} userRole
 * @param {string} [branchId]
 * @param {((approvals: any[]) => void)} onData
 * @param {((err: any) => void)} [onError]
 * @returns {(() => void)} Unsubscribe callback
 */
export function listenToPendingApprovals(userRole, branchId, onData, onError) {
  const normalizedRole = (userRole || "").toLowerCase().trim();
  const normalizedBranch = branchId ? branchToId(branchId) : DEFAULT_BRANCH_ID;

  const constraints = [where("status", "==", APPROVAL_STATUS.PENDING)];

  if (normalizedRole !== "admin") {
    if (normalizedRole === "manager" || normalizedRole === "branch_manager") {
      constraints.push(where("approverRole", "in", [APPROVAL_ROLES.BRANCH_MANAGER, APPROVAL_ROLES.OPS_LEAD]));
      constraints.push(where("approverBranchId", "==", normalizedBranch));
    } else if (normalizedRole === "instructor_leader" || normalizedRole === "instructorleader") {
      constraints.push(where("approverRole", "==", APPROVAL_ROLES.INSTRUCTOR_LEADER));
      constraints.push(where("approverBranchId", "==", normalizedBranch));
    } else if (normalizedRole === "frontoffice" || normalizedRole === "ops_lead" || normalizedRole === "opslead") {
      constraints.push(where("approverRole", "==", APPROVAL_ROLES.OPS_LEAD));
      constraints.push(where("approverBranchId", "==", normalizedBranch));
    }
  }

  const q = query(collection(db, COLLECTION_NAME), ...constraints);

  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      items.sort((a, b) => new Date(b.requestedAt || 0).getTime() - new Date(a.requestedAt || 0).getTime());
      onData(items);
    },
    (err) => {
      console.warn("listenToPendingApprovals error:", err);
      if (onError) onError(err);
    }
  );
}

/**
 * Approves a pending approval request.
 *
 * @param {string} approvalId
 * @param {{ approverUid?: string, approverName?: string, notes?: string }} [decisionData]
 */
export async function approveApprovalRequest(approvalId, decisionData = {}) {
  if (!approvalId) throw new Error("Approval ID is required");
  const currentUser = auth.currentUser;

  const updatePayload = {
    status: APPROVAL_STATUS.APPROVED,
    decidedBy: decisionData.approverName || currentUser?.displayName || currentUser?.email || "Approver",
    decidedByUid: decisionData.approverUid || currentUser?.uid || "approver",
    decidedAt: new Date().toISOString(),
    decisionNotes: decisionData.notes || "",
    updatedAt: serverTimestamp(),
  };

  await updateDoc(doc(db, COLLECTION_NAME, approvalId), updatePayload);
  return { id: approvalId, ...updatePayload };
}

/**
 * Rejects a pending approval request.
 *
 * @param {string} approvalId
 * @param {{ approverUid?: string, approverName?: string, reason?: string }} [decisionData]
 */
export async function rejectApprovalRequest(approvalId, decisionData = {}) {
  if (!approvalId) throw new Error("Approval ID is required");
  const currentUser = auth.currentUser;

  const updatePayload = {
    status: APPROVAL_STATUS.REJECTED,
    decidedBy: decisionData.approverName || currentUser?.displayName || currentUser?.email || "Approver",
    decidedByUid: decisionData.approverUid || currentUser?.uid || "approver",
    decidedAt: new Date().toISOString(),
    rejectionReason: decisionData.reason || "",
    updatedAt: serverTimestamp(),
  };

  await updateDoc(doc(db, COLLECTION_NAME, approvalId), updatePayload);
  return { id: approvalId, ...updatePayload };
}
