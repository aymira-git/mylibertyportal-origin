import { describe, it, expect } from "vitest";
import {
  GATED_ACTIONS,
  APPROVAL_ROLES,
  APPROVAL_MODES,
  APPROVAL_STATUS,
  createApprovalEnvelope,
  canApproveGate,
  isActionOperational,
  getSelfCorrectionApprover,
} from "./approvalGates";

describe("Maker-Checker Approval Gates", () => {
  it("defines all locked actions correctly with domains and modes", () => {
    // Admin escalated staff authority actions (Principle 1)
    expect(GATED_ACTIONS.STAFF_ROLE_ELEVATION.locked).toBe(true);
    expect(GATED_ACTIONS.STAFF_ROLE_ELEVATION.approverRole).toBe(APPROVAL_ROLES.ADMIN);
    expect(GATED_ACTIONS.STAFF_ROLE_ELEVATION.mode).toBe(APPROVAL_MODES.BLOCKING);

    expect(GATED_ACTIONS.NEW_STAFF_ACCOUNT.locked).toBe(true);
    expect(GATED_ACTIONS.NEW_STAFF_ACCOUNT.approverRole).toBe(APPROVAL_ROLES.ADMIN);
    expect(GATED_ACTIONS.NEW_STAFF_ACCOUNT.mode).toBe(APPROVAL_MODES.BLOCKING);

    expect(GATED_ACTIONS.STAFF_DEACTIVATION.locked).toBe(true);
    expect(GATED_ACTIONS.STAFF_DEACTIVATION.approverRole).toBe(APPROVAL_ROLES.ADMIN);
    expect(GATED_ACTIONS.STAFF_DEACTIVATION.mode).toBe(APPROVAL_MODES.BLOCKING);

    // Branch manager actions
    expect(GATED_ACTIONS.DISCOUNT_OR_REFUND.mode).toBe(APPROVAL_MODES.BLOCKING);
    expect(GATED_ACTIONS.DISCOUNT_OR_REFUND.approverRole).toBe(APPROVAL_ROLES.BRANCH_MANAGER);

    expect(GATED_ACTIONS.CASH_DISCREPANCY.mode).toBe(APPROVAL_MODES.BLOCKING);
    expect(GATED_ACTIONS.CASH_DISCREPANCY.approverRole).toBe(APPROVAL_ROLES.BRANCH_MANAGER);

    expect(GATED_ACTIONS.TUITION_PLAN_CHANGE.mode).toBe(APPROVAL_MODES.BLOCKING);
    expect(GATED_ACTIONS.TUITION_PLAN_CHANGE.approverRole).toBe(APPROVAL_ROLES.BRANCH_MANAGER);

    // Time-critical logged actions
    expect(GATED_ACTIONS.SUBSTITUTE_INSTRUCTOR.mode).toBe(APPROVAL_MODES.LOGGED);
    expect(GATED_ACTIONS.SUBSTITUTE_INSTRUCTOR.approverRole).toBe(APPROVAL_ROLES.INSTRUCTOR_LEADER);

    expect(GATED_ACTIONS.CLASS_CANCELLATION_OR_RESCHEDULE.mode).toBe(APPROVAL_MODES.LOGGED);
    expect(GATED_ACTIONS.CLASS_CANCELLATION_OR_RESCHEDULE.approverRole).toBe(APPROVAL_ROLES.OPS_LEAD);

    expect(GATED_ACTIONS.STUDENT_WITHDRAWAL_OR_FREEZE.mode).toBe(APPROVAL_MODES.LOGGED);
    expect(GATED_ACTIONS.STUDENT_WITHDRAWAL_OR_FREEZE.approverRole).toBe(APPROVAL_ROLES.BRANCH_MANAGER);
  });

  it("evaluates self-correction ladder correctly (Principle 5)", () => {
    // 1. General staff -> Front Office / Ops Lead
    expect(getSelfCorrectionApprover("instructor")).toBe(APPROVAL_ROLES.OPS_LEAD);
    expect(getSelfCorrectionApprover("marketing")).toBe(APPROVAL_ROLES.OPS_LEAD);
    expect(getSelfCorrectionApprover("officeboy")).toBe(APPROVAL_ROLES.OPS_LEAD);
    expect(getSelfCorrectionApprover("instructor_leader")).toBe(APPROVAL_ROLES.OPS_LEAD);

    // 2. Front Office Lead's own record -> Branch Manager
    expect(getSelfCorrectionApprover("frontoffice")).toBe(APPROVAL_ROLES.BRANCH_MANAGER);
    expect(getSelfCorrectionApprover("ops_lead")).toBe(APPROVAL_ROLES.BRANCH_MANAGER);

    // 3. Branch Manager's own record -> Admin (Owner / Director tier)
    expect(getSelfCorrectionApprover("manager")).toBe(APPROVAL_ROLES.ADMIN);

    // 4. Admin -> Exempt (null)
    expect(getSelfCorrectionApprover("admin")).toBeNull();
  });

  it("creates standard approval envelopes with branchId and self-correction resolution", () => {
    const envelope = createApprovalEnvelope(
      "DISCOUNT_OR_REFUND",
      { name: "Alice Frontdesk", uid: "u-123", role: "frontoffice", branchId: "branch_gorontalo_main" },
      { reason: "Family discount 10%" }
    );

    expect(envelope.status).toBe(APPROVAL_STATUS.PENDING);
    expect(envelope.mode).toBe(APPROVAL_MODES.BLOCKING);
    expect(envelope.approverRole).toBe(APPROVAL_ROLES.BRANCH_MANAGER);
    expect(envelope.approverBranchId).toBe("branch_gorontalo_main");
    expect(envelope.requestedBy).toBe("Alice Frontdesk");
    expect(envelope.requestedByUid).toBe("u-123");
    expect(envelope.reason).toBe("Family discount 10%");
    expect(envelope.decidedBy).toBeNull();

    // Admin requester is fully exempt -> returns null
    const adminAction = createApprovalEnvelope("DISCOUNT_OR_REFUND", { role: "admin" });
    expect(adminAction).toBeNull();

    // Self correction for Front Office Lead -> routes to Branch Manager
    const foSelfCorrection = createApprovalEnvelope(
      "STAFF_SHIFT_SELF_CORRECTION",
      { name: "Budi FO Lead", uid: "u-fo-1", role: "frontoffice", branchId: "branch_gorontalo_main" },
      { reason: "Forgot to clock in after lunch" }
    );
    expect(foSelfCorrection.approverRole).toBe(APPROVAL_ROLES.BRANCH_MANAGER);

    // Self correction for Instructor -> routes to Ops Lead
    const instructorSelfCorrection = createApprovalEnvelope(
      "STAFF_SHIFT_SELF_CORRECTION",
      { name: "Siti Teacher", uid: "u-inst-1", role: "instructor", branchId: "branch_gorontalo_main" }
    );
    expect(instructorSelfCorrection.approverRole).toBe(APPROVAL_ROLES.OPS_LEAD);
  });

  it("throws error when creating envelope for unknown action", () => {
    expect(() => createApprovalEnvelope("UNKNOWN_ACTION", { role: "staff" })).toThrow();
  });

  it("evaluates role authority correctly", () => {
    // Admin approves all
    expect(canApproveGate("admin", APPROVAL_ROLES.ADMIN)).toBe(true);
    expect(canApproveGate("admin", APPROVAL_ROLES.BRANCH_MANAGER)).toBe(true);
    expect(canApproveGate("admin", APPROVAL_ROLES.INSTRUCTOR_LEADER)).toBe(true);
    expect(canApproveGate("admin", APPROVAL_ROLES.OPS_LEAD)).toBe(true);

    // Branch manager cannot approve Admin escalated actions, but can approve Manager and OpsLead
    expect(canApproveGate("manager", APPROVAL_ROLES.ADMIN)).toBe(false);
    expect(canApproveGate("manager", APPROVAL_ROLES.BRANCH_MANAGER)).toBe(true);
    expect(canApproveGate("manager", APPROVAL_ROLES.OPS_LEAD)).toBe(true);

    // Instructor Leader
    expect(canApproveGate("instructor", APPROVAL_ROLES.BRANCH_MANAGER)).toBe(false);
    expect(canApproveGate("instructor", APPROVAL_ROLES.INSTRUCTOR_LEADER)).toBe(false);
    expect(canApproveGate("head_instructor", APPROVAL_ROLES.INSTRUCTOR_LEADER)).toBe(true);
    expect(canApproveGate("instructor_leader", APPROVAL_ROLES.INSTRUCTOR_LEADER)).toBe(true);

    // Front office / Ops Lead
    expect(canApproveGate("frontoffice", APPROVAL_ROLES.BRANCH_MANAGER)).toBe(false);
    expect(canApproveGate("frontoffice", APPROVAL_ROLES.OPS_LEAD)).toBe(true);
    expect(canApproveGate("ops_lead", APPROVAL_ROLES.OPS_LEAD)).toBe(true);
  });

  it("evaluates operational status according to blocking vs logged mode", () => {
    // Blocking action pending -> not operational
    const blockingPending = {
      mode: APPROVAL_MODES.BLOCKING,
      status: APPROVAL_STATUS.PENDING,
    };
    expect(isActionOperational(blockingPending)).toBe(false);

    // Blocking action approved -> operational
    const blockingApproved = {
      mode: APPROVAL_MODES.BLOCKING,
      status: APPROVAL_STATUS.APPROVED,
    };
    expect(isActionOperational(blockingApproved)).toBe(true);

    // Logged action pending -> operational immediately
    const loggedPending = {
      mode: APPROVAL_MODES.LOGGED,
      status: APPROVAL_STATUS.PENDING,
    };
    expect(isActionOperational(loggedPending)).toBe(true);

    // Logged action rejected -> still operational (rejection is informational, no auto-rollback)
    const loggedRejected = {
      mode: APPROVAL_MODES.LOGGED,
      status: APPROVAL_STATUS.REJECTED,
    };
    expect(isActionOperational(loggedRejected)).toBe(true);

    // Ungated
    expect(isActionOperational(null)).toBe(true);
  });
});
