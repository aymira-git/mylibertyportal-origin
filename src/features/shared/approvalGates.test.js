import { describe, it, expect } from "vitest";
import {
  GATED_ACTIONS,
  APPROVAL_ROLES,
  APPROVAL_MODES,
  APPROVAL_STATUS,
  createApprovalEnvelope,
  canApproveGate,
  isActionOperational,
} from "./approvalGates";

describe("Maker-Checker Approval Gates", () => {
  it("defines all locked actions correctly with domains and modes", () => {
    expect(GATED_ACTIONS.STAFF_ROLE_ELEVATION.locked).toBe(true);
    expect(GATED_ACTIONS.STAFF_ROLE_ELEVATION.approverRole).toBe(APPROVAL_ROLES.BRANCH_MANAGER);
    expect(GATED_ACTIONS.STAFF_ROLE_ELEVATION.mode).toBe(APPROVAL_MODES.BLOCKING);

    expect(GATED_ACTIONS.DISCOUNT_OR_REFUND.mode).toBe(APPROVAL_MODES.BLOCKING);
    expect(GATED_ACTIONS.CASH_DISCREPANCY.mode).toBe(APPROVAL_MODES.BLOCKING);

    // Time-critical logged actions
    expect(GATED_ACTIONS.SUBSTITUTE_INSTRUCTOR.mode).toBe(APPROVAL_MODES.LOGGED);
    expect(GATED_ACTIONS.SUBSTITUTE_INSTRUCTOR.approverRole).toBe(APPROVAL_ROLES.INSTRUCTOR_LEADER);

    expect(GATED_ACTIONS.CLASS_CANCELLATION_OR_RESCHEDULE.mode).toBe(APPROVAL_MODES.LOGGED);
    expect(GATED_ACTIONS.CLASS_CANCELLATION_OR_RESCHEDULE.approverRole).toBe(APPROVAL_ROLES.OPS_LEAD);

    expect(GATED_ACTIONS.STUDENT_WITHDRAWAL_OR_FREEZE.mode).toBe(APPROVAL_MODES.LOGGED);
    expect(GATED_ACTIONS.STUDENT_WITHDRAWAL_OR_FREEZE.approverRole).toBe(APPROVAL_ROLES.BRANCH_MANAGER);
  });

  it("creates standard approval envelopes correctly", () => {
    const envelope = createApprovalEnvelope(
      "DISCOUNT_OR_REFUND",
      { name: "Alice Frontdesk", uid: "u-123", role: "frontoffice" },
      { reason: "Family discount 10%" }
    );

    expect(envelope.status).toBe(APPROVAL_STATUS.PENDING);
    expect(envelope.mode).toBe(APPROVAL_MODES.BLOCKING);
    expect(envelope.approverRole).toBe(APPROVAL_ROLES.BRANCH_MANAGER);
    expect(envelope.requestedBy).toBe("Alice Frontdesk");
    expect(envelope.requestedByUid).toBe("u-123");
    expect(envelope.reason).toBe("Family discount 10%");
    expect(envelope.decidedBy).toBeNull();
  });

  it("throws error when creating envelope for unknown action", () => {
    expect(() => createApprovalEnvelope("UNKNOWN_ACTION")).toThrow();
  });

  it("evaluates role authority correctly", () => {
    // Admin approves all
    expect(canApproveGate("admin", APPROVAL_ROLES.BRANCH_MANAGER)).toBe(true);
    expect(canApproveGate("admin", APPROVAL_ROLES.INSTRUCTOR_LEADER)).toBe(true);
    expect(canApproveGate("admin", APPROVAL_ROLES.OPS_LEAD)).toBe(true);

    // Branch manager
    expect(canApproveGate("manager", APPROVAL_ROLES.BRANCH_MANAGER)).toBe(true);
    expect(canApproveGate("manager", APPROVAL_ROLES.OPS_LEAD)).toBe(true);

    // Instructor
    expect(canApproveGate("instructor", APPROVAL_ROLES.BRANCH_MANAGER)).toBe(false);
    expect(canApproveGate("instructor", APPROVAL_ROLES.INSTRUCTOR_LEADER)).toBe(false);
    expect(canApproveGate("head_instructor", APPROVAL_ROLES.INSTRUCTOR_LEADER)).toBe(true);

    // Front office
    expect(canApproveGate("frontoffice", APPROVAL_ROLES.BRANCH_MANAGER)).toBe(false);
    expect(canApproveGate("frontoffice", APPROVAL_ROLES.OPS_LEAD)).toBe(true);
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
