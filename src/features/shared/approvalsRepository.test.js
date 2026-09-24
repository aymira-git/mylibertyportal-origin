import { describe, it, expect, vi } from "vitest";
import {
  submitApprovalRequest,
  approveApprovalRequest,
  rejectApprovalRequest,
} from "./approvalsRepository";
import { APPROVAL_STATUS } from "./approvalGates";

vi.mock("../../firebase", () => ({
  db: {},
  auth: { currentUser: { uid: "user_123", displayName: "Test Officer", email: "test@myliberty.com" } },
}));

vi.mock("firebase/firestore", () => {
  return {
    collection: vi.fn(),
    doc: vi.fn(),
    addDoc: vi.fn().mockResolvedValue({ id: "appr_999" }),
    updateDoc: vi.fn().mockResolvedValue(),
    serverTimestamp: vi.fn().mockReturnValue("SERVER_TIMESTAMP"),
    query: vi.fn(),
    where: vi.fn(),
    onSnapshot: vi.fn(),
  };
});

describe("approvalsRepository", () => {
  it("submits an approval envelope with PENDING status and normalized branchId", async () => {
    const envelope = {
      actionId: "DISCOUNT_OR_REFUND",
      label: "Discounts & Refunds",
      approverRole: "manager",
      approverBranchId: "Kota Gorontalo",
      requestedBy: "Staff Member",
    };

    const result = await submitApprovalRequest(envelope);
    expect(result.id).toBe("appr_999");
    expect(result.status).toBe(APPROVAL_STATUS.PENDING);
    expect(result.approverBranchId).toBe("kota_gorontalo");
  });

  it("throws an error when submitting an invalid envelope", async () => {
    await expect(submitApprovalRequest(null)).rejects.toThrow("Invalid approval envelope");
    await expect(submitApprovalRequest({})).rejects.toThrow("Invalid approval envelope");
  });

  it("approves an approval request with decision payload", async () => {
    const result = await approveApprovalRequest("appr_999", {
      approverName: "Branch Manager",
      notes: "Approved after receipt inspection",
    });

    expect(result.id).toBe("appr_999");
    expect(result.status).toBe(APPROVAL_STATUS.APPROVED);
    expect(result.decidedBy).toBe("Branch Manager");
    expect(result.decisionNotes).toBe("Approved after receipt inspection");
  });

  it("rejects an approval request with rejection reason", async () => {
    const result = await rejectApprovalRequest("appr_999", {
      approverName: "Branch Manager",
      reason: "Missing documentation",
    });

    expect(result.id).toBe("appr_999");
    expect(result.status).toBe(APPROVAL_STATUS.REJECTED);
    expect(result.decidedBy).toBe("Branch Manager");
    expect(result.rejectionReason).toBe("Missing documentation");
  });
});
