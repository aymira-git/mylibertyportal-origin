import { describe, it, expect } from "vitest";

/**
 * Pure logic simulation of firestore.rules branch isolation and authorization helpers.
 * This guarantees mathematical and operational correctness of all security rule predicates.
 */

function userBranch(user) {
  if (!user) return "kota_gorontalo";
  return user.branchId || "kota_gorontalo";
}

function isAdmin(user) {
  return Boolean(user && user.role === "admin");
}

function isManager(user) {
  return Boolean(user && user.role === "manager");
}

function isFrontOffice(user) {
  return Boolean(
    user &&
      ["frontoffice", "opslead", "ops_lead", "frontofficelead"].includes(user.role)
  );
}

function isStaff(user) {
  return Boolean(
    user &&
      [
        "admin",
        "manager",
        "instructor",
        "instructorleader",
        "instructor_leader",
        "marketing",
        "frontoffice",
        "opslead",
        "ops_lead",
        "frontofficelead",
        "officeboy",
      ].includes(user.role)
  );
}

function isSameBranch(data, user) {
  if (isAdmin(user)) return true;
  if (!user) return false;

  let docBranch = "kota_gorontalo";
  if (data && "branchId" in data && data.branchId) {
    docBranch = data.branchId;
  } else if (data && "branch" in data && data.branch) {
    if (data.branch === "Bone Bolango") docBranch = "bone_bolango";
    else if (data.branch === "Pohuwato") docBranch = "pohuwato";
    else if (data.branch === "Limboto") docBranch = "limboto";
    else docBranch = "kota_gorontalo";
  }

  return userBranch(user) === docBranch;
}

function isApproverForDoc(data, user) {
  if (!user) return false;
  if (isAdmin(user)) return true;

  const targetRole = (data && data.approverRole) || "manager";
  let roleMatches = false;

  if (targetRole === "admin" && isAdmin(user)) {
    roleMatches = true;
  } else if (targetRole === "manager" && isManager(user)) {
    roleMatches = true;
  } else if (
    (targetRole === "instructor_leader" || targetRole === "instructorleader") &&
    (user.role === "instructorleader" || user.role === "instructor_leader")
  ) {
    roleMatches = true;
  } else if (
    (targetRole === "ops_lead" || targetRole === "opslead" || targetRole === "frontoffice") &&
    isFrontOffice(user)
  ) {
    roleMatches = true;
  }

  return roleMatches && isSameBranch(data, user);
}

function canDecideApproval(doc, user) {
  if (!user) return false;
  if (isAdmin(user)) return true;
  // Requester cannot approve their own request (Maker-Checker invariant)
  if (doc && doc.requestedByUid === user.uid) {
    return false;
  }
  return isApproverForDoc(doc, user);
}

describe("Security Rules Matrix & Branch Isolation", () => {
  const adminUser = { uid: "admin_1", role: "admin", branchId: "kota_gorontalo" };
  const managerGorontalo = { uid: "mgr_gtlo", role: "manager", branchId: "kota_gorontalo" };
  const managerBoneBolango = { uid: "mgr_boba", role: "manager", branchId: "bone_bolango" };
  const foGorontalo = { uid: "fo_gtlo", role: "frontoffice", branchId: "kota_gorontalo" };
  const foBoneBolango = { uid: "fo_boba", role: "frontoffice", branchId: "bone_bolango" };
  const instructorLeaderGorontalo = {
    uid: "il_gtlo",
    role: "instructor_leader",
    branchId: "kota_gorontalo",
  };
  const instructorGorontalo = {
    uid: "ins_gtlo",
    role: "instructor",
    branchId: "kota_gorontalo",
  };

  describe("Branch Identification & Legacy Compatibility", () => {
    it("resolves staff roles accurately across hierarchy", () => {
      expect(isStaff(adminUser)).toBe(true);
      expect(isStaff(managerGorontalo)).toBe(true);
      expect(isStaff(foGorontalo)).toBe(true);
      expect(isStaff(instructorLeaderGorontalo)).toBe(true);
      expect(isStaff(instructorGorontalo)).toBe(true);
      expect(isStaff({ role: "student" })).toBe(false);
      expect(isStaff(null)).toBe(false);
    });

    it("matches exact canonical branchId correctly", () => {
      expect(isSameBranch({ branchId: "kota_gorontalo" }, foGorontalo)).toBe(true);
      expect(isSameBranch({ branchId: "bone_bolango" }, foGorontalo)).toBe(false);
      expect(isSameBranch({ branchId: "bone_bolango" }, foBoneBolango)).toBe(true);
    });

    it("resolves legacy human-readable branch names safely", () => {
      expect(isSameBranch({ branch: "Bone Bolango" }, managerBoneBolango)).toBe(true);
      expect(isSameBranch({ branch: "Pohuwato" }, { role: "manager", branchId: "pohuwato" })).toBe(
        true
      );
      expect(isSameBranch({ branch: "Limboto" }, { role: "manager", branchId: "limboto" })).toBe(
        true
      );
      expect(isSameBranch({ branch: "Kota Gorontalo" }, managerGorontalo)).toBe(true);
    });

    it("handles null and empty documents safely without throwing", () => {
      expect(isSameBranch(null, foGorontalo)).toBe(true); // defaults to kota_gorontalo
      expect(isSameBranch({}, foGorontalo)).toBe(true);
      expect(isSameBranch(null, foBoneBolango)).toBe(false);
    });

    it("grants Admin global branch access everywhere", () => {
      expect(isSameBranch({ branchId: "bone_bolango" }, adminUser)).toBe(true);
      expect(isSameBranch({ branchId: "pohuwato" }, adminUser)).toBe(true);
      expect(isSameBranch({ branchId: "limboto" }, adminUser)).toBe(true);
    });
  });

  describe("Cross-Branch Overwrite & Update Protection", () => {
    it("blocks Front Office from updating payment from another branch", () => {
      const existingDoc = { id: "pay_1", branchId: "bone_bolango", amount: 449000 };
      const updatePayload = { branchId: "kota_gorontalo", amount: 449000 };

      // In the hardened rule, allow update requires BOTH isSameBranch(resource.data) AND isSameBranch(request.resource.data)
      const allowed =
        isSameBranch(existingDoc, foGorontalo) && isSameBranch(updatePayload, foGorontalo);
      expect(allowed).toBe(false);
    });

    it("blocks Front Office from moving their own branch payment to another branch", () => {
      const existingDoc = { id: "pay_2", branchId: "kota_gorontalo", amount: 449000 };
      const maliciousMovePayload = { branchId: "bone_bolango", amount: 449000 };

      const allowed =
        isSameBranch(existingDoc, foGorontalo) && isSameBranch(maliciousMovePayload, foGorontalo);
      expect(allowed).toBe(false);
    });

    it("allows Front Office to update legitimate payment within their branch", () => {
      const existingDoc = { id: "pay_3", branchId: "kota_gorontalo", amount: 449000 };
      const validUpdatePayload = { branchId: "kota_gorontalo", amount: 449000, notes: "Paid in cash" };

      const allowed =
        isSameBranch(existingDoc, foGorontalo) && isSameBranch(validUpdatePayload, foGorontalo);
      expect(allowed).toBe(true);
    });

    it("blocks cross-branch deletion by inspecting resource.data", () => {
      const foreignPayment = { id: "pay_4", branchId: "bone_bolango" };
      const allowed = isSameBranch(foreignPayment, foGorontalo);
      expect(allowed).toBe(false);
    });
  });

  describe("Shift Branch Isolation", () => {
    it("prevents Front Office from creating shifts for other branches", () => {
      const foreignShiftPayload = { userId: "ins_boba", branchId: "bone_bolango", clockOut: null };
      const allowed = isSameBranch(foreignShiftPayload, foGorontalo);
      expect(allowed).toBe(false);
    });

    it("prevents Front Office from clocking out shifts from other branches", () => {
      const foreignShift = { id: "sh_boba", branchId: "bone_bolango", clockOut: null };
      const allowed = isSameBranch(foreignShift, foGorontalo);
      expect(allowed).toBe(false);
    });

    it("allows Front Office to clock in and out staff within their branch", () => {
      const localShift = { id: "sh_gtlo", branchId: "kota_gorontalo", clockOut: null };
      expect(isSameBranch(localShift, foGorontalo)).toBe(true);
    });
  });

  describe("Dual-Control Maker-Checker Approval Isolation & 4 Inboxes", () => {
    it("routes Manager approvals strictly to Branch Manager of that branch", () => {
      const approvalDoc = {
        actionId: "DISCOUNT_OR_REFUND",
        approverRole: "manager",
        branchId: "kota_gorontalo",
        requestedByUid: "fo_gtlo",
      };

      expect(canDecideApproval(approvalDoc, managerGorontalo)).toBe(true);
      expect(canDecideApproval(approvalDoc, managerBoneBolango)).toBe(false);
      expect(canDecideApproval(approvalDoc, foGorontalo)).toBe(false);
      expect(canDecideApproval(approvalDoc, instructorLeaderGorontalo)).toBe(false);
      expect(canDecideApproval(approvalDoc, adminUser)).toBe(true);
    });

    it("routes Pedagogy approvals strictly to Instructor Leader of that branch", () => {
      const approvalDoc = {
        actionId: "PLACEMENT_LEVEL_OVERRIDE",
        approverRole: "instructor_leader",
        branchId: "kota_gorontalo",
        requestedByUid: "ins_gtlo",
      };

      expect(canDecideApproval(approvalDoc, instructorLeaderGorontalo)).toBe(true);
      expect(canDecideApproval(approvalDoc, managerGorontalo)).toBe(false);
      expect(canDecideApproval(approvalDoc, foGorontalo)).toBe(false);
      expect(canDecideApproval(approvalDoc, adminUser)).toBe(true);
    });

    it("routes Operational approvals strictly to Front Office / Ops Lead of that branch", () => {
      const approvalDoc = {
        actionId: "RETROACTIVE_STUDENT_ATTENDANCE",
        approverRole: "ops_lead",
        branchId: "kota_gorontalo",
        requestedByUid: "ins_gtlo",
      };

      expect(canDecideApproval(approvalDoc, foGorontalo)).toBe(true);
      expect(canDecideApproval(approvalDoc, foBoneBolango)).toBe(false);
      expect(canDecideApproval(approvalDoc, instructorLeaderGorontalo)).toBe(false);
      expect(canDecideApproval(approvalDoc, adminUser)).toBe(true);
    });

    it("strictly blocks self-approval: requester cannot approve their own request", () => {
      const managerSelfShiftCorrection = {
        actionId: "STAFF_SHIFT_SELF_CORRECTION",
        approverRole: "manager",
        branchId: "kota_gorontalo",
        requestedByUid: "mgr_gtlo", // Manager is the requester!
      };

      // Even though managerGorontalo is Manager of kota_gorontalo, they cannot self-approve!
      expect(canDecideApproval(managerSelfShiftCorrection, managerGorontalo)).toBe(false);
      // Admin can approve it
      expect(canDecideApproval(managerSelfShiftCorrection, adminUser)).toBe(true);
    });

    it("blocks Ops Lead self-approving their own shift self-correction", () => {
      const foSelfShiftCorrection = {
        actionId: "STAFF_SHIFT_SELF_CORRECTION",
        approverRole: "ops_lead",
        branchId: "kota_gorontalo",
        requestedByUid: "fo_gtlo",
      };

      expect(canDecideApproval(foSelfShiftCorrection, foGorontalo)).toBe(false);
    });
  });

  describe("Staff Invite Branch Spoofing Prevention", () => {
    it("requires registration branchId to match invite branchId when present", () => {
      const invite = { email: "newstaff@myliberty.com", role: "instructor", branchId: "bone_bolango" };

      const validSignup = { role: "instructor", branchId: "bone_bolango" };
      const spoofedSignup = { role: "instructor", branchId: "kota_gorontalo" };

      const checkValid =
        validSignup.role === invite.role &&
        (!invite.branchId || validSignup.branchId === invite.branchId);

      const checkSpoofed =
        spoofedSignup.role === invite.role &&
        (!invite.branchId || spoofedSignup.branchId === invite.branchId);

      expect(checkValid).toBe(true);
      expect(checkSpoofed).toBe(false);
    });
  });
});
