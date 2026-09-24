/**
 * approvalGates.js
 * Central Maker-Checker Dual-Control Approval Registry.
 *
 * Provides a canonical allow-list of actions requiring oversight,
 * their designated approver role, and whether the action is "blocking"
 * or "logged" (immediate execution with async audit review).
 */

export const APPROVAL_ROLES = {
  BRANCH_MANAGER: "branch_manager",
  INSTRUCTOR_LEADER: "instructor_leader",
  OPS_LEAD: "ops_lead",
};

export const APPROVAL_MODES = {
  BLOCKING: "blocking",
  LOGGED: "logged",
};

export const APPROVAL_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
};

/**
 * Canonical registry of dual-control gated actions.
 * STAFF_ROLE_ELEVATION is hardcoded & non-reassignable.
 */
export const GATED_ACTIONS = Object.freeze({
  // ── Branch Manager Gates (Financial & Authority) ──
  DISCOUNT_OR_REFUND: Object.freeze({
    id: "DISCOUNT_OR_REFUND",
    label: "Discounts & Refunds",
    approverRole: APPROVAL_ROLES.BRANCH_MANAGER,
    mode: APPROVAL_MODES.BLOCKING,
    domain: "finance",
  }),
  CASH_DISCREPANCY: Object.freeze({
    id: "CASH_DISCREPANCY",
    label: "Cash Discrepancy Escalation",
    approverRole: APPROVAL_ROLES.BRANCH_MANAGER,
    mode: APPROVAL_MODES.BLOCKING,
    domain: "finance",
  }),
  STAFF_ROLE_ELEVATION: Object.freeze({
    id: "STAFF_ROLE_ELEVATION",
    label: "Staff Role / Permission Elevation",
    approverRole: APPROVAL_ROLES.BRANCH_MANAGER,
    mode: APPROVAL_MODES.BLOCKING,
    domain: "staff",
    locked: true, // Non-reassignable in config
  }),
  NEW_STAFF_ACCOUNT: Object.freeze({
    id: "NEW_STAFF_ACCOUNT",
    label: "New Staff Account Creation",
    approverRole: APPROVAL_ROLES.BRANCH_MANAGER,
    mode: APPROVAL_MODES.BLOCKING,
    domain: "staff",
  }),
  TUITION_PLAN_CHANGE: Object.freeze({
    id: "TUITION_PLAN_CHANGE",
    label: "Tuition Plan Modification",
    approverRole: APPROVAL_ROLES.BRANCH_MANAGER,
    mode: APPROVAL_MODES.BLOCKING,
    domain: "finance",
  }),
  STAFF_DEACTIVATION: Object.freeze({
    id: "STAFF_DEACTIVATION",
    label: "Staff Deactivation / Termination",
    approverRole: APPROVAL_ROLES.BRANCH_MANAGER,
    mode: APPROVAL_MODES.BLOCKING,
    domain: "staff",
  }),
  STUDENT_WITHDRAWAL_OR_FREEZE: Object.freeze({
    id: "STUDENT_WITHDRAWAL_OR_FREEZE",
    label: "Student Withdrawal / Enrollment Freeze",
    approverRole: APPROVAL_ROLES.BRANCH_MANAGER,
    mode: APPROVAL_MODES.LOGGED,
    domain: "students",
  }),

  // ── Instructor Leader Gates (Pedagogy & Coverage) ──
  PLACEMENT_LEVEL_OVERRIDE: Object.freeze({
    id: "PLACEMENT_LEVEL_OVERRIDE",
    label: "Placement Level Override",
    approverRole: APPROVAL_ROLES.INSTRUCTOR_LEADER,
    mode: APPROVAL_MODES.BLOCKING,
    domain: "students",
  }),
  SUBSTITUTE_INSTRUCTOR: Object.freeze({
    id: "SUBSTITUTE_INSTRUCTOR",
    label: "Substitute Instructor Assignment",
    approverRole: APPROVAL_ROLES.INSTRUCTOR_LEADER,
    mode: APPROVAL_MODES.LOGGED,
    domain: "staff",
  }),

  // ── Ops / Front Office Lead Gates (Scheduling & Operations) ──
  CLASS_CANCELLATION_OR_RESCHEDULE: Object.freeze({
    id: "CLASS_CANCELLATION_OR_RESCHEDULE",
    label: "Whole-Class Cancellation / Reschedule",
    approverRole: APPROVAL_ROLES.OPS_LEAD,
    mode: APPROVAL_MODES.LOGGED,
    domain: "classes",
  }),
  RETROACTIVE_ATTENDANCE_EDIT: Object.freeze({
    id: "RETROACTIVE_ATTENDANCE_EDIT",
    label: "Retroactive Attendance Edit",
    approverRole: APPROVAL_ROLES.OPS_LEAD,
    mode: APPROVAL_MODES.BLOCKING,
    domain: "attendance",
  }),
  STUDENT_CLASS_TRANSFER: Object.freeze({
    id: "STUDENT_CLASS_TRANSFER",
    label: "Student Class / Batch Transfer",
    approverRole: APPROVAL_ROLES.OPS_LEAD,
    mode: APPROVAL_MODES.BLOCKING,
    domain: "classes",
  }),
});

/**
 * Creates a standard Maker-Checker approval envelope object.
 *
 * @param {string} actionId - Key from GATED_ACTIONS (e.g. "DISCOUNT_OR_REFUND")
 * @param {object} requester - { name: string, uid?: string, role?: string }
 * @param {object} [context={}] - Optional metadata or reason
 * @returns {object} Canonical approval envelope
 */
export function createApprovalEnvelope(actionId, requester = {}, context = {}) {
  const gate = GATED_ACTIONS[actionId];
  if (!gate) {
    throw new Error(`Unknown gated action: "${actionId}"`);
  }

  const requestedAt = new Date().toISOString();
  const requestedBy = requester.name || requester.displayName || requester.email || "Staff";

  return {
    actionId: gate.id,
    label: gate.label,
    domain: gate.domain,
    status: APPROVAL_STATUS.PENDING,
    mode: gate.mode,
    approverRole: gate.approverRole,
    requestedBy,
    requestedByUid: requester.uid || null,
    requestedAt,
    decidedBy: null,
    decidedByUid: null,
    decidedAt: null,
    reason: context.reason || null,
    payload: context.payload || null,
  };
}

/**
 * Evaluates whether a user's role satisfies the required approverRole.
 *
 * Role mapping:
 * - Admin satisfies all approval gates.
 * - Manager satisfies branch_manager and ops_lead.
 * - Instructor Leader / Head Teacher satisfies instructor_leader.
 * - Front Office / Operations Lead satisfies ops_lead.
 */
export function canApproveGate(userRole, approverRole) {
  if (!userRole) return false;
  if (userRole === "admin") return true;

  switch (approverRole) {
    case APPROVAL_ROLES.BRANCH_MANAGER:
      return userRole === "manager";
    case APPROVAL_ROLES.INSTRUCTOR_LEADER:
      return userRole === "manager" || userRole === "instructor_leader" || userRole === "head_instructor";
    case APPROVAL_ROLES.OPS_LEAD:
      return userRole === "manager" || userRole === "frontoffice" || userRole === "ops_lead";
    default:
      return false;
  }
}

/**
 * Checks if a record with an approval envelope is currently active/operational.
 * For "blocking" mode: only active if status === "approved".
 * For "logged" mode: active immediately regardless of status.
 */
export function isActionOperational(approvalEnvelope) {
  if (!approvalEnvelope) return true; // Ungated actions are always operational
  if (approvalEnvelope.mode === APPROVAL_MODES.LOGGED) return true;
  return approvalEnvelope.status === APPROVAL_STATUS.APPROVED;
}
