import { branchToId } from "../../constants/branches";

/**
 * approvalGates.js
 * Central Maker-Checker Dual-Control Approval Registry.
 *
 * Provides a canonical allow-list of actions requiring oversight,
 * their designated approver role, and whether the action is "blocking"
 * or "logged" (immediate execution with async audit review).
 */

export const APPROVAL_ROLES = {
  ADMIN: "admin",
  BRANCH_MANAGER: "manager",
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
 * Locked entries are non-reassignable in config.
 */
export const GATED_ACTIONS = Object.freeze({
  // ── Admin Tier Gates (Owner / Director Tier — Staff Authority) ──
  STAFF_ROLE_ELEVATION: Object.freeze({
    id: "STAFF_ROLE_ELEVATION",
    label: "Staff Role / Permission Elevation",
    approverRole: APPROVAL_ROLES.ADMIN,
    mode: APPROVAL_MODES.BLOCKING,
    domain: "staff",
    locked: true, // Non-reassignable in config
  }),
  NEW_STAFF_ACCOUNT: Object.freeze({
    id: "NEW_STAFF_ACCOUNT",
    label: "New Staff Account Creation",
    approverRole: APPROVAL_ROLES.ADMIN,
    mode: APPROVAL_MODES.BLOCKING,
    domain: "staff",
    locked: true,
  }),
  STAFF_DEACTIVATION: Object.freeze({
    id: "STAFF_DEACTIVATION",
    label: "Staff Deactivation / Termination",
    approverRole: APPROVAL_ROLES.ADMIN,
    mode: APPROVAL_MODES.BLOCKING,
    domain: "staff",
    locked: true,
  }),

  // ── Branch Manager Gates (Financial & Status Oversight) ──
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
  TUITION_PLAN_CHANGE: Object.freeze({
    id: "TUITION_PLAN_CHANGE",
    label: "Tuition Plan Modification (Create / Edit)",
    approverRole: APPROVAL_ROLES.BRANCH_MANAGER,
    mode: APPROVAL_MODES.BLOCKING,
    domain: "finance",
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
  RETROACTIVE_STUDENT_ATTENDANCE: Object.freeze({
    id: "RETROACTIVE_STUDENT_ATTENDANCE",
    label: "Retroactive Student Attendance Edit",
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
  STAFF_SHIFT_SELF_CORRECTION: Object.freeze({
    id: "STAFF_SHIFT_SELF_CORRECTION",
    label: "Staff Shift / Clock-in Self-Correction",
    approverRole: "dynamic_hierarchy", // Evaluated via getSelfCorrectionApprover()
    mode: APPROVAL_MODES.BLOCKING,
    domain: "attendance",
  }),
});

/**
 * Resolves the designated approver for self-correction actions based on the requester's role.
 * Principle 5: staff < opslead < manager < admin (admin is exempt).
 *
 * Escalation ladder:
 * - General staff (instructor, marketing, officeboy, instructorleader) -> ops_lead (Front Office Lead)
 * - Front Office / Ops Lead's own record -> manager (Branch Manager)
 * - Branch Manager's own record -> admin (Owner / Director tier)
 * - Admin -> exempt (returns null)
 *
 * @param {string} requesterRole
 * @returns {string|null} Approver role key or null if exempt
 */
export function getSelfCorrectionApprover(requesterRole) {
  const normalized = (requesterRole || "").toLowerCase().trim();
  if (!normalized || normalized === "admin") {
    return null; // Admin is exempt
  }
  if (normalized === "manager" || normalized === "branch_manager") {
    return APPROVAL_ROLES.ADMIN;
  }
  if (
    normalized === "ops_lead" ||
    normalized === "opslead" ||
    normalized === "frontoffice" ||
    normalized === "front_office"
  ) {
    return APPROVAL_ROLES.BRANCH_MANAGER;
  }
  // All other staff (instructor, marketing, officeboy, instructorleader, etc.)
  return APPROVAL_ROLES.OPS_LEAD;
}

/**
 * Creates a standard Maker-Checker approval envelope object.
 *
 * @param {string} actionId - Key from GATED_ACTIONS
 * @param {object} requester - { name: string, uid?: string, role?: string, branchId?: string }
 * @param {object} [context={}] - Optional metadata or reason
 * @returns {object} Canonical approval envelope
 */
export function createApprovalEnvelope(actionId, requester = {}, context = {}) {
  // Admin is fully exempt from dual-control gating
  if (requester.role === "admin") {
    return null;
  }

  const gate = GATED_ACTIONS[actionId];
  if (!gate) {
    throw new Error(`Unknown gated action: "${actionId}"`);
  }

  let resolvedApproverRole = gate.approverRole;
  if (gate.id === "STAFF_SHIFT_SELF_CORRECTION") {
    resolvedApproverRole = getSelfCorrectionApprover(requester.role);
    if (!resolvedApproverRole) {
      return null; // Exempt
    }
  }

  const requestedAt = new Date().toISOString();
  const requestedBy = requester.name || requester.displayName || requester.email || "Staff";
  const rawBranch = requester.branchId || requester.branch || null;
  const approverBranchId = rawBranch ? branchToId(rawBranch) : null;

  return {
    actionId: gate.id,
    label: gate.label,
    domain: gate.domain,
    status: APPROVAL_STATUS.PENDING,
    mode: gate.mode,
    approverRole: resolvedApproverRole,
    approverBranchId,
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
  const normalized = userRole.toLowerCase().trim();
  if (normalized === "admin") return true;

  switch (approverRole) {
    case APPROVAL_ROLES.ADMIN:
      return normalized === "admin";
    case APPROVAL_ROLES.BRANCH_MANAGER:
      return normalized === "manager" || normalized === "branch_manager";
    case APPROVAL_ROLES.INSTRUCTOR_LEADER:
      return (
        normalized === "manager" ||
        normalized === "instructor_leader" ||
        normalized === "instructorleader" ||
        normalized === "head_instructor"
      );
    case APPROVAL_ROLES.OPS_LEAD:
      return (
        normalized === "manager" ||
        normalized === "frontoffice" ||
        normalized === "ops_lead" ||
        normalized === "opslead"
      );
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
