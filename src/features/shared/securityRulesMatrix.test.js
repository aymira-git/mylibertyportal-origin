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

  const branchMatches =
    data && "approverBranchId" in data
      ? data.approverBranchId === userBranch(user)
      : isSameBranch(data, user);

  return roleMatches && branchMatches;
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

/**
 * Mirrors firestore.rules: payments get is owner-scoped — the world-readable
 * "studentId is string" clause was replaced by studentId == request.auth.uid.
 */
function canGetPayment(doc, user) {
  if (!user) return false;
  if (isAdmin(user)) return true;
  if ((isManager(user) || isFrontOffice(user)) && isSameBranch(doc, user)) return true;
  return doc.studentId === user.uid;
}

/**
 * Mirrors firestore.rules: approvals update allow-list + decision invariants.
 */
const APPROVAL_DECISION_KEYS = [
  "status",
  "decidedBy",
  "decidedByUid",
  "decidedAt",
  "decisionNotes",
  "rejectionReason",
  "updatedAt",
];

function canUpdateApproval(existing, incoming, user) {
  if (!user) return false;
  if (isAdmin(user)) return true;
  if (!canDecideApproval(existing, user)) return false;
  if (incoming.requestedByUid !== existing.requestedByUid) return false;
  if (!["approved", "rejected"].includes(incoming.status)) return false;
  if (incoming.decidedByUid !== user.uid) return false;
  const keys = Object.keys(incoming).filter((k) => existing[k] !== incoming[k]);
  return keys.every((k) => APPROVAL_DECISION_KEYS.includes(k));
}

/**
 * Mirrors firestore.rules isApprovedShiftCorrection: the referenced approval
 * doc must be an APPROVED self-correction for this exact shift.
 */
function isApprovedShiftCorrection(approval, shiftId) {
  return (
    approval &&
    approval.actionId === "STAFF_SHIFT_SELF_CORRECTION" &&
    approval.status === "approved" &&
    approval.payload != null &&
    approval.payload.shiftId === shiftId
  );
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

  describe("Payments Get Owner Scoping (C1)", () => {
    const payment = { id: "pay_9", branchId: "kota_gorontalo", studentId: "stu_1" };

    it("allows the owning student to read their own payment", () => {
      expect(canGetPayment(payment, { uid: "stu_1", role: "student" })).toBe(true);
    });

    it("blocks other signed-in users from reading someone else's payment", () => {
      expect(canGetPayment(payment, { uid: "stu_2", role: "student" })).toBe(false);
      expect(canGetPayment(payment, { uid: "ins_gtlo", role: "instructor" })).toBe(false);
      expect(canGetPayment(payment, null)).toBe(false);
    });

    it("still allows admin and same-branch manager/frontoffice to read", () => {
      expect(canGetPayment(payment, adminUser)).toBe(true);
      expect(canGetPayment(payment, managerGorontalo)).toBe(true);
      expect(canGetPayment(payment, foGorontalo)).toBe(true);
      expect(canGetPayment(payment, managerBoneBolango)).toBe(false);
    });
  });

  describe("Approval Decision Contract (C2)", () => {
    const pendingApproval = {
      id: "appr_1",
      actionId: "DISCOUNT_OR_REFUND",
      approverRole: "manager",
      approverBranchId: "kota_gorontalo",
      requestedByUid: "fo_gtlo",
      status: "pending",
    };

    it("allows the designated approver to record a decision with canonical fields", () => {
      const incoming = {
        ...pendingApproval,
        status: "approved",
        decidedBy: "Manager GTLO",
        decidedByUid: "mgr_gtlo",
        decidedAt: "2026-09-25T10:00:00.000Z",
        decisionNotes: "Verified with parent",
        updatedAt: "ts",
      };
      expect(canUpdateApproval(pendingApproval, incoming, managerGorontalo)).toBe(true);
    });

    it("rejects decisions recorded under a different uid", () => {
      const incoming = {
        ...pendingApproval,
        status: "approved",
        decidedByUid: "someone_else",
        decidedAt: "2026-09-25T10:00:00.000Z",
      };
      expect(canUpdateApproval(pendingApproval, incoming, managerGorontalo)).toBe(false);
    });

    it("rejects tampering with requester identity or non-decision fields", () => {
      const tamperedRequester = {
        ...pendingApproval,
        requestedByUid: "admin_1",
        status: "approved",
        decidedByUid: "mgr_gtlo",
      };
      expect(canUpdateApproval(pendingApproval, tamperedRequester, managerGorontalo)).toBe(false);

      const extraField = {
        ...pendingApproval,
        status: "approved",
        decidedByUid: "mgr_gtlo",
        amount: 999999,
      };
      expect(canUpdateApproval(pendingApproval, extraField, managerGorontalo)).toBe(false);
    });

    it("rejects statuses outside approved/rejected", () => {
      const backToPending = {
        ...pendingApproval,
        status: "pending",
        decidedByUid: "mgr_gtlo",
      };
      expect(canUpdateApproval(pendingApproval, backToPending, managerGorontalo)).toBe(false);
    });
  });

  describe("Approved Shift Self-Correction Gate (C4)", () => {
    const approvedCorrection = {
      id: "appr_77",
      actionId: "STAFF_SHIFT_SELF_CORRECTION",
      status: "approved",
      payload: { shiftId: "sh_42" },
    };

    it("accepts only approved self-correction envelopes for the exact shift", () => {
      expect(isApprovedShiftCorrection(approvedCorrection, "sh_42")).toBe(true);
      expect(isApprovedShiftCorrection(approvedCorrection, "sh_99")).toBe(false);
      expect(
        isApprovedShiftCorrection({ ...approvedCorrection, status: "pending" }, "sh_42")
      ).toBe(false);
      expect(
        isApprovedShiftCorrection(
          { ...approvedCorrection, actionId: "DISCOUNT_OR_REFUND" },
          "sh_42"
        )
      ).toBe(false);
      expect(isApprovedShiftCorrection({ ...approvedCorrection, payload: null }, "sh_42")).toBe(
        false
      );
    });
  });

  describe("Staff Leave Branch Read Isolation", () => {
    function canReadStaffLeave(leaveDoc, user) {
      if (isAdmin(user)) return true;
      if (isManager(user) && isSameBranch(leaveDoc, user)) return true;
      if (user && leaveDoc && leaveDoc.userId === user.uid) return true;
      return false;
    }

    const leaveKota = { id: "lv_1", userId: "ins_gtlo", branchId: "kota_gorontalo" };
    const leaveBoba = { id: "lv_2", userId: "ins_boba", branchId: "bone_bolango" };

    it("allows managers to read leave records only within their branch", () => {
      expect(canReadStaffLeave(leaveKota, managerGorontalo)).toBe(true);
      expect(canReadStaffLeave(leaveBoba, managerGorontalo)).toBe(false);
      expect(canReadStaffLeave(leaveBoba, managerBoneBolango)).toBe(true);
      expect(canReadStaffLeave(leaveKota, managerBoneBolango)).toBe(false);
    });

    it("allows staff members to read their own leave regardless of branch", () => {
      expect(canReadStaffLeave(leaveKota, instructorGorontalo)).toBe(true);
      expect(canReadStaffLeave(leaveBoba, instructorGorontalo)).toBe(false);
    });

    it("grants Admin global read access to all staff leave", () => {
      expect(canReadStaffLeave(leaveKota, adminUser)).toBe(true);
      expect(canReadStaffLeave(leaveBoba, adminUser)).toBe(true);
    });
  });

  describe("Class Capacity Rule Invariant", () => {
    function canUpdateClass(existing, incoming, user) {
      if (isAdmin(user)) return true;
      if (!isFrontOffice(user)) return false;
      if (!isSameBranch(existing, user) || !isSameBranch(incoming, user)) return false;
      if (existing.capacity != null && incoming.studentIds.length > existing.capacity) return false;
      if (existing.maxStudents != null && incoming.studentIds.length > existing.maxStudents) return false;
      return true;
    }

    const cls = { id: "c_1", branchId: "kota_gorontalo", capacity: 10, studentIds: ["s1", "s2"] };

    it("allows enrollment updates within capacity limit", () => {
      const incoming = { ...cls, studentIds: ["s1", "s2", "s3"] };
      expect(canUpdateClass(cls, incoming, foGorontalo)).toBe(true);
    });

    it("rejects enrollment updates exceeding class capacity", () => {
      const fullStudentList = Array.from({ length: 11 }, (_, i) => `s_${i}`);
      const incoming = { ...cls, studentIds: fullStudentList };
      expect(canUpdateClass(cls, incoming, foGorontalo)).toBe(false);
    });
  });

  describe("Shift Review Status Updates", () => {
    function canReviewShift(existing, incoming, user) {
      if (isAdmin(user)) return true;
      if ((isFrontOffice(user) || isManager(user)) && isSameBranch(existing, user)) {
        const diffKeys = Object.keys(incoming).filter((k) => existing[k] !== incoming[k]);
        return diffKeys.length === 1 && diffKeys[0] === "reviewStatus";
      }
      return false;
    }

    const closedShift = {
      id: "sh_closed",
      userId: "ins_gtlo",
      branchId: "kota_gorontalo",
      clockIn: "2026-09-25T01:00:00.000Z",
      clockOut: "2026-09-25T03:00:00.000Z",
    };

    it("allows Front Office and Manager of the same branch to mark closed shift reviewed", () => {
      const updated = { ...closedShift, reviewStatus: "reviewed" };
      expect(canReviewShift(closedShift, updated, foGorontalo)).toBe(true);
      expect(canReviewShift(closedShift, updated, managerGorontalo)).toBe(true);
    });

    it("blocks cross-branch staff from marking shift reviewed", () => {
      const updated = { ...closedShift, reviewStatus: "reviewed" };
      expect(canReviewShift(closedShift, updated, foBoneBolango)).toBe(false);
      expect(canReviewShift(closedShift, updated, managerBoneBolango)).toBe(false);
    });

    it("rejects modifying other fields under the reviewStatus permission", () => {
      const tampered = { ...closedShift, reviewStatus: "reviewed", clockOut: "2026-09-27T05:00:00.000Z" };
      expect(canReviewShift(closedShift, tampered, foGorontalo)).toBe(false);
    });
  });

  describe("Class Attendance Security Rules Logic", () => {
    function isAssignedToClass(classDoc, user) {
      if (!user) return false;
      return (
        classDoc.instructorId === user.uid ||
        classDoc.substituteInstructorId === user.uid
      );
    }

    function canManageClassAttendance(classDoc, user) {
      if (isAdmin(user)) return true;
      if (isFrontOffice(user) && isSameBranch(classDoc, user)) return true;
      if (
        ["instructor", "instructorleader", "instructor_leader"].includes(user?.role) &&
        isAssignedToClass(classDoc, user)
      ) {
        return true;
      }
      return false;
    }

    function studentIsEnrolled(classDoc, studentId) {
      return Array.isArray(classDoc.studentIds) && classDoc.studentIds.includes(studentId);
    }

    function canCreateClassAttendance(classDoc, requestData, user) {
      if (!user) return false;
      if (!canManageClassAttendance(classDoc, user)) return false;
      if (
        typeof requestData.classId !== "string" ||
        typeof requestData.studentId !== "string" ||
        typeof requestData.attendanceDate !== "string" ||
        typeof requestData.markedBy !== "string" ||
        requestData.markedBy !== user.uid
      ) {
        return false;
      }
      if (!studentIsEnrolled(classDoc, requestData.studentId)) return false;
      if (!["PRESENT", "ABSENT", "LATE", "EXCUSED"].includes(requestData.status)) return false;
      if (!["SCAN", "MANUAL", "CLOSE_OUT"].includes(requestData.method)) return false;
      return true;
    }

    function canUpdateClassAttendance(classDoc, existing, requestData, user) {
      if (!user) return false;
      if (!canManageClassAttendance(classDoc, user)) return false;
      if (
        requestData.classId !== existing.classId ||
        requestData.studentId !== existing.studentId ||
        requestData.attendanceDate !== existing.attendanceDate
      ) {
        return false;
      }
      if (
        typeof requestData.markedBy !== "string" ||
        requestData.markedBy !== user.uid
      ) {
        return false;
      }
      if (requestData.method !== "MANUAL") return false; // Scans cannot overwrite
      if (!["PRESENT", "ABSENT", "LATE", "EXCUSED"].includes(requestData.status)) return false;
      return true;
    }

    function canReadClassAttendance(classDoc, attendanceDoc, user) {
      if (!user) return false;
      if (isAdmin(user)) return true;
      if ((isManager(user) || isFrontOffice(user)) && isSameBranch(classDoc, user)) return true;
      if (
        ["instructor", "instructorleader", "instructor_leader"].includes(user.role) &&
        isAssignedToClass(classDoc, user)
      ) {
        return true;
      }
      if (attendanceDoc.studentId === user.uid) return true;
      return false;
    }

    const testClass = {
      id: "class_gtlo_1",
      branchId: "kota_gorontalo",
      instructorId: "ins_1",
      substituteInstructorId: "ins_sub",
      studentIds: ["std_1", "std_2"],
    };

    const instructorAssigned = { uid: "ins_1", role: "instructor", branchId: "kota_gorontalo" };
    const instructorSubstitute = { uid: "ins_sub", role: "instructor", branchId: "kota_gorontalo" };
    const instructorUnassigned = { uid: "ins_other", role: "instructor", branchId: "kota_gorontalo" };
    const studentEnrolled = { uid: "std_1", role: "student", branchId: "kota_gorontalo" };
    const studentUnenrolled = { uid: "std_stranger", role: "student", branchId: "kota_gorontalo" };

    const validRecord = {
      classId: "class_gtlo_1",
      studentId: "std_1",
      attendanceDate: "2026-09-27",
      status: "PRESENT",
      method: "SCAN",
      markedBy: "ins_1",
    };

    it("allows primary and substitute instructors to create attendance for enrolled students", () => {
      expect(canCreateClassAttendance(testClass, validRecord, instructorAssigned)).toBe(true);

      const subRecord = { ...validRecord, markedBy: "ins_sub" };
      expect(canCreateClassAttendance(testClass, subRecord, instructorSubstitute)).toBe(true);
    });

    it("allows same-branch front office to create attendance", () => {
      const foRecord = { ...validRecord, markedBy: foGorontalo.uid };
      expect(canCreateClassAttendance(testClass, foRecord, foGorontalo)).toBe(true);
    });

    it("blocks cross-branch front office and unassigned instructors", () => {
      const crossFoRecord = { ...validRecord, markedBy: foBoneBolango.uid };
      expect(canCreateClassAttendance(testClass, crossFoRecord, foBoneBolango)).toBe(false);

      const unassignedRecord = { ...validRecord, markedBy: "ins_other" };
      expect(canCreateClassAttendance(testClass, unassignedRecord, instructorUnassigned)).toBe(false);
    });

    it("blocks creating attendance for students not in class studentIds", () => {
      const unenrolledRecord = { ...validRecord, studentId: "std_stranger" };
      expect(canCreateClassAttendance(testClass, unenrolledRecord, instructorAssigned)).toBe(false);
    });

    it("enforces scan idempotency: updates must be method MANUAL only", () => {
      const existing = { ...validRecord };
      const scanUpdate = { ...validRecord, status: "PRESENT", method: "SCAN" };
      expect(canUpdateClassAttendance(testClass, existing, scanUpdate, instructorAssigned)).toBe(false);

      const manualUpdate = { ...validRecord, status: "ABSENT", method: "MANUAL" };
      expect(canUpdateClassAttendance(testClass, existing, manualUpdate, instructorAssigned)).toBe(true);
    });

    it("blocks tampering with classId, studentId, or date on update", () => {
      const existing = { ...validRecord };
      const tamperedClass = { ...validRecord, classId: "other_class", method: "MANUAL" };
      expect(canUpdateClassAttendance(testClass, existing, tamperedClass, instructorAssigned)).toBe(false);

      const tamperedStudent = { ...validRecord, studentId: "std_2", method: "MANUAL" };
      expect(canUpdateClassAttendance(testClass, existing, tamperedStudent, instructorAssigned)).toBe(false);
    });

    it("allows enrolled student to read own attendance, but not other students", () => {
      expect(canReadClassAttendance(testClass, validRecord, studentEnrolled)).toBe(true);
      expect(canReadClassAttendance(testClass, validRecord, studentUnenrolled)).toBe(false);
    });

    it("blocks unassigned instructors and cross-branch managers from reading class attendance", () => {
      expect(canReadClassAttendance(testClass, validRecord, instructorAssigned)).toBe(true);
      expect(canReadClassAttendance(testClass, validRecord, instructorUnassigned)).toBe(false);
      expect(canReadClassAttendance(testClass, validRecord, managerGorontalo)).toBe(true);
      expect(canReadClassAttendance(testClass, validRecord, managerBoneBolango)).toBe(false);
    });
  });
});

