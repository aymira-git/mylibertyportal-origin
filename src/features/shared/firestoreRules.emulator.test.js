/**
 * Emulator-based tests for the REAL firestore.rules file.
 *
 * Unlike securityRulesMatrix.test.js (a hand-mirrored copy of the rule logic),
 * these tests run the actual rules engine against the actual firestore.rules,
 * so a drift between code and rules fails here. Requires the Firestore
 * emulator: `npm run test:rules`. Skipped silently in a plain `npm test`.
 */
/* global process */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import { doc, setDoc, getDoc, updateDoc, collection, addDoc, writeBatch, deleteField, query, where, getDocs } from "firebase/firestore";

const RULES_PATH = join(dirname(fileURLToPath(import.meta.url)), "../../../firestore.rules");
const HAS_EMULATOR = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

let testEnv;

const USERS = {
  admin: { role: "admin", branchId: "kota_gorontalo" },
  mgrGto: { role: "manager", branchId: "kota_gorontalo" },
  mgrBoba: { role: "manager", branchId: "bone_bolango" },
  foGto: { role: "frontoffice", branchId: "kota_gorontalo" },
  foKgGto: { role: "frontoffice", branchId: "kota_gorontalo", division: "kindergarten" },
  foBoba: { role: "frontoffice", branchId: "bone_bolango" },
  insGto: { role: "instructor", branchId: "kota_gorontalo" },
  mktGto: { role: "marketing", branchId: "kota_gorontalo" },
  obGto: { role: "officeboy", branchId: "kota_gorontalo" },
  cleanerGto: { role: "cleaner", branchId: "kota_gorontalo" },
  parent1: { role: "parent", branchId: "kota_gorontalo", childStudentIds: ["student1"] },
  parent2: { role: "parent", branchId: "bone_bolango", childStudentIds: ["student2"] },
  student1: { role: "student", branchId: "kota_gorontalo" },
  student2: { role: "student", branchId: "bone_bolango" },
};

const FRONT_OFFICE_PROFILE_UID = "frontOfficeOwnProfile";
const FRONT_OFFICE_PROFILE = {
  role: "frontoffice",
  division: "kindergarten",
  branch: "Kota Gorontalo",
  branchId: "kota_gorontalo",
  status: "active",
};

function authed(uid) {
  return testEnv.authenticatedContext(uid).firestore();
}

async function seedDoc(pathSegments, data) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), ...pathSegments), data);
  });
}

async function seedUsers() {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [uid, data] of Object.entries(USERS)) {
      await setDoc(doc(db, "users", uid), { displayName: uid, ...data });
    }
  });
}

const PAYMENT_KOTA = { studentId: "student1", branchId: "kota_gorontalo", amount: 449000 };

const APPROVAL_KOTA = {
  actionId: "DISCOUNT_OR_REFUND",
  status: "pending",
  mode: "blocking",
  approverRole: "manager",
  approverBranchId: "kota_gorontalo",
  requestedBy: "FO Budi",
  requestedByUid: "foGto",
  requestedAt: "2026-09-20T01:00:00.000Z",
  payload: null,
};

const APPROVAL_BOBA = { ...APPROVAL_KOTA, approverBranchId: "bone_bolango", requestedByUid: "foBoba" };

const SHIFT_KOTA = {
  userId: "insGto",
  role: "instructor",
  branchId: "kota_gorontalo",
  clockIn: "2026-09-21T01:00:00.000Z",
  clockOut: null,
};

const APPROVED_CORRECTION = {
  actionId: "STAFF_SHIFT_SELF_CORRECTION",
  status: "approved",
  mode: "blocking",
  approverRole: "manager",
  approverBranchId: "kota_gorontalo",
  requestedBy: "Ms. Rina",
  requestedByUid: "insGto",
  decidedBy: "Manager",
  decidedByUid: "mgrGto",
  payload: { shiftId: "shift1", beforeShift: { clockIn: "2026-09-21T01:00:00.000Z" }, afterData: { clockIn: "2026-09-21T00:30:00.000Z" } },
};

describe.skipIf(!HAS_EMULATOR)("firestore.rules against the real emulator", () => {
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: "myliberty-rules-test",
      firestore: { rules: readFileSync(RULES_PATH, "utf8") },
    });
  });

  afterAll(async () => {
    await testEnv?.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
    await seedUsers();
  });

  describe("users own profile get", () => {
    beforeEach(async () => {
      await seedDoc(["users", FRONT_OFFICE_PROFILE_UID], FRONT_OFFICE_PROFILE);
    });

    it("lets an authenticated front office user read their own profile", async () => {
      await assertSucceeds(
        getDoc(doc(authed(FRONT_OFFICE_PROFILE_UID), "users", FRONT_OFFICE_PROFILE_UID))
      );
    });

    it("does not let an unrelated role read the front office profile", async () => {
      await assertFails(
        getDoc(doc(authed("cleanerGto"), "users", FRONT_OFFICE_PROFILE_UID))
      );
    });

    it("does not let front office read another same-branch front office profile", async () => {
      await seedDoc(["users", "otherFrontOffice"], {
        role: "frontoffice",
        division: "kindergarten",
        branchId: "kota_gorontalo",
        status: "active",
      });
      await assertFails(
        getDoc(doc(authed(FRONT_OFFICE_PROFILE_UID), "users", "otherFrontOffice"))
      );
    });

    it("keeps front office profile reads scoped to the same branch", async () => {
      await assertFails(
        getDoc(doc(authed(FRONT_OFFICE_PROFILE_UID), "users", "student2"))
      );
    });
  });

  describe("payments get owner scoping (C1)", () => {
    beforeEach(async () => {
      await seedDoc(["payments", "pay1"], PAYMENT_KOTA);
    });

    it("lets the owning student read their own payment", async () => {
      await assertSucceeds(getDoc(doc(authed("student1"), "payments", "pay1")));
    });

    it("blocks another student from reading it", async () => {
      await assertFails(getDoc(doc(authed("student2"), "payments", "pay1")));
    });

    it("blocks signed-out reads", async () => {
      await assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore(), "payments", "pay1")));
    });

    it("lets same-branch front office read it but not another branch", async () => {
      await assertSucceeds(getDoc(doc(authed("foGto"), "payments", "pay1")));
      await assertFails(getDoc(doc(authed("foBoba"), "payments", "pay1")));
    });

    it("blocks cross-branch update and cross-branch moves", async () => {
      await assertFails(
        updateDoc(doc(authed("foBoba"), "payments", "pay1"), { amount: 1 })
      );
      await assertFails(
        updateDoc(doc(authed("foGto"), "payments", "pay1"), { branchId: "bone_bolango" })
      );
    });

    it("allows a legitimate same-branch update", async () => {
      await assertSucceeds(
        updateDoc(doc(authed("foGto"), "payments", "pay1"), { notes: "Paid in cash" })
      );
    });
  });

  describe("payment recording batch (F1)", () => {
    // Mirrors paymentsRepository.recordPayment: a single batch creates the
    // payment doc and stamps the summary fields on the student doc. The
    // allow-list must contain every field that batch writes, or the whole
    // batch fails — which is exactly what happened in production.
    const SUMMARY_FIELDS = {
      paymentStatus: "paid",
      lastPaymentPeriod: "September 2026 – November 2026 (3 Mo)",
      lastPaymentDate: "2026-09-21",
      lastPaymentAmount: 1050000,
      lastPaymentMethod: "Cash",
      paymentPlan: "quarterly",
      paidUntil: "2026-12-21",
    };

    beforeEach(async () => {
      // A student with an earlier payment on file, so every summary field
      // actually changes during the batch (an unchanged field would not
      // appear in the rule diff and the test would pass trivially).
      await seedDoc(["users", "student1"], {
        displayName: "student1",
        role: "student",
        branchId: "kota_gorontalo",
        paymentStatus: "pending",
        lastPaymentPeriod: "June 2026 – August 2026 (3 Mo)",
        lastPaymentDate: "2026-06-20",
        lastPaymentAmount: 450000,
        lastPaymentMethod: "Transfer",
        paymentPlan: "quarterly",
        paidUntil: "2026-09-20",
      });
    });

    function recordPaymentBatch(db) {
      const batch = writeBatch(db);
      batch.set(doc(db, "payments", "payNew"), {
        studentId: "student1",
        branchId: "kota_gorontalo",
        amount: 1050000,
        method: "Cash",
      });
      batch.set(doc(db, "users", "student1"), SUMMARY_FIELDS, { merge: true });
      return batch.commit();
    }

    it("lets same-branch front office record a payment end to end", async () => {
      await assertSucceeds(recordPaymentBatch(authed("foGto")));
    });

    it("lets front office mark a payment pending (clears paidUntil)", async () => {
      await assertSucceeds(
        updateDoc(doc(authed("foGto"), "users", "student1"), {
          paymentStatus: "pending",
          paidUntil: deleteField(),
        })
      );
    });

    it("blocks other branches and staff without a cashier role", async () => {
      await assertFails(recordPaymentBatch(authed("foBoba")));
      await assertFails(recordPaymentBatch(authed("insGto")));
    });

    it("blocks kindergarten front office from recording a non-kindergarten payment", async () => {
      await assertFails(recordPaymentBatch(authed("foKgGto")));
    });

    it("still rejects summary writes that smuggle foreign fields", async () => {
      const db = authed("foGto");
      const batch = writeBatch(db);
      batch.set(doc(db, "payments", "payNew"), PAYMENT_KOTA);
      batch.set(
        doc(db, "users", "student1"),
        { ...SUMMARY_FIELDS, secretBackdoor: true },
        { merge: true }
      );
      await assertFails(batch.commit());
    });
  });

  describe("approval decision contract (C2)", () => {
    beforeEach(async () => {
      await seedDoc(["approvals", "appr1"], APPROVAL_KOTA);
      await seedDoc(["approvals", "apprBoba"], APPROVAL_BOBA);
    });

    const decision = (uid) => ({
      status: "approved",
      decidedBy: USERS[uid].role,
      decidedByUid: uid,
      decidedAt: "2026-09-21T02:00:00.000Z",
      updatedAt: "2026-09-21T02:00:00.000Z",
    });

    it("routes manager approvals to the manager of that branch", async () => {
      await assertSucceeds(getDoc(doc(authed("mgrGto"), "approvals", "appr1")));
      await assertFails(getDoc(doc(authed("mgrBoba"), "approvals", "appr1")));
      await assertSucceeds(updateDoc(doc(authed("mgrGto"), "approvals", "appr1"), decision("mgrGto")));
      await assertFails(updateDoc(doc(authed("mgrBoba"), "approvals", "appr1"), decision("mgrBoba")));
    });

    it("gives the Bone Bolango manager access to Bone Bolango approvals", async () => {
      await assertSucceeds(getDoc(doc(authed("mgrBoba"), "approvals", "apprBoba")));
      await assertFails(getDoc(doc(authed("mgrGto"), "approvals", "apprBoba")));
      await assertSucceeds(updateDoc(doc(authed("mgrBoba"), "approvals", "apprBoba"), decision("mgrBoba")));
    });

    it("blocks non-approver roles from deciding", async () => {
      await assertFails(updateDoc(doc(authed("foGto"), "approvals", "appr1"), decision("foGto")));
      await assertFails(updateDoc(doc(authed("insGto"), "approvals", "appr1"), decision("insGto")));
    });

    it("blocks the requester from approving their own request", async () => {
      const opsApproval = {
        ...APPROVAL_KOTA,
        actionId: "RETROACTIVE_STUDENT_ATTENDANCE",
        approverRole: "ops_lead",
        requestedByUid: "foGto",
      };
      await seedDoc(["approvals", "apprSelf"], opsApproval);
      const selfDecision = { status: "approved", decidedByUid: "foGto", decidedAt: "t", updatedAt: "t" };
      await assertFails(updateDoc(doc(authed("foGto"), "approvals", "apprSelf"), selfDecision));
    });

    it("requires decidedByUid to be the deciding user", async () => {
      await assertFails(
        updateDoc(doc(authed("mgrGto"), "approvals", "appr1"), { ...decision("mgrGto"), decidedByUid: "admin" })
      );
    });

    it("keeps requestedByUid immutable and the decision fields in the allow-list", async () => {
      await assertFails(
        updateDoc(doc(authed("mgrGto"), "approvals", "appr1"), {
          ...decision("mgrGto"),
          requestedByUid: "student1",
        })
      );
      await assertFails(
        updateDoc(doc(authed("mgrGto"), "approvals", "appr1"), {
          ...decision("mgrGto"),
          payload: { forged: true },
        })
      );
      await assertFails(
        updateDoc(doc(authed("mgrGto"), "approvals", "appr1"), { ...decision("mgrGto"), status: "pending" })
      );
    });

    it("lets staff create only their own pending requests", async () => {
      await assertSucceeds(
        addDoc(collection(authed("insGto"), "approvals"), {
          actionId: "PLACEMENT_LEVEL_OVERRIDE",
          status: "pending",
          approverRole: "instructor_leader",
          requestedByUid: "insGto",
        })
      );
      await assertFails(
        addDoc(collection(authed("insGto"), "approvals"), {
          actionId: "PLACEMENT_LEVEL_OVERRIDE",
          status: "pending",
          approverRole: "instructor_leader",
          requestedByUid: "foGto",
        })
      );
      await assertFails(
        addDoc(collection(authed("insGto"), "approvals"), {
          actionId: "PLACEMENT_LEVEL_OVERRIDE",
          status: "approved",
          approverRole: "instructor_leader",
          requestedByUid: "insGto",
        })
      );
    });
  });

  describe("users frontoffice student fields (H1)", () => {
    it("allows status updates with audit fields on a same-branch student", async () => {
      await assertSucceeds(
        updateDoc(doc(authed("foGto"), "users", "student1"), {
          status: "inactive",
          statusUpdatedAt: "2026-09-21T02:00:00.000Z",
          statusUpdatedBy: "foGto",
        })
      );
    });

    it("blocks branch moves, role escalation, and foreign fields", async () => {
      await assertFails(updateDoc(doc(authed("foGto"), "users", "student1"), { branchId: "bone_bolango" }));
      await assertFails(updateDoc(doc(authed("foGto"), "users", "student1"), { role: "instructor" }));
      await assertFails(updateDoc(doc(authed("foGto"), "users", "student1"), { tuitionFee: 0 }));
      await assertFails(updateDoc(doc(authed("foGto"), "users", "student1"), { secretBackdoor: true }));
    });

    it("blocks frontoffice from editing other branches' students or staff", async () => {
      await assertFails(updateDoc(doc(authed("foGto"), "users", "student2"), { status: "inactive" }));
      await assertFails(updateDoc(doc(authed("foGto"), "users", "insGto"), { status: "inactive" }));
    });

    it("keeps kindergarten front office limited to kindergarten students", async () => {
      await assertFails(
        updateDoc(doc(authed("foKgGto"), "users", "student1"), { status: "inactive" })
      );
      await seedDoc(["users", "studentKg"], {
        displayName: "studentKg",
        role: "student",
        branchId: "kota_gorontalo",
        division: "kindergarten",
      });
      await assertSucceeds(
        updateDoc(doc(authed("foKgGto"), "users", "studentKg"), { status: "inactive" })
      );
    });

    it("lets a user edit only their own profile basics", async () => {
      await assertSucceeds(updateDoc(doc(authed("insGto"), "users", "insGto"), { displayName: "Rina S." }));
      await assertFails(updateDoc(doc(authed("insGto"), "users", "insGto"), { level: "Advanced" }));
    });
  });

  describe("shifts kiosk flow (C3 guard, H2 autoClosed)", () => {
    beforeEach(async () => {
      await seedDoc(["shifts", "shift1"], SHIFT_KOTA);
    });

    it("lets same-branch front office clock in tracked staff", async () => {
      await assertSucceeds(
        addDoc(collection(authed("foGto"), "shifts"), {
          ...SHIFT_KOTA,
          userId: "insGto",
        })
      );
    });

    it("blocks cross-branch clock-in, closed-shift creation, and untracked roles", async () => {
      await assertFails(
        addDoc(collection(authed("foGto"), "shifts"), { ...SHIFT_KOTA, branchId: "bone_bolango" })
      );
      await assertFails(
        addDoc(collection(authed("foGto"), "shifts"), { ...SHIFT_KOTA, clockOut: "2026-09-21T09:00:00.000Z" })
      );
      await assertFails(
        addDoc(collection(authed("foGto"), "shifts"), { ...SHIFT_KOTA, userId: "student1" })
      );
    });

    it("allows kiosk clock-out with the autoClosed key", async () => {
      await assertSucceeds(
        updateDoc(doc(authed("foGto"), "shifts", "shift1"), {
          ...SHIFT_KOTA,
          clockOut: "2026-09-21T09:00:00.000Z",
          updatedAt: "2026-09-21T09:00:00.000Z",
          autoClosed: true,
        })
      );
    });

    it("blocks clock-out payloads that smuggle extra fields like an approval envelope", async () => {
      await assertFails(
        updateDoc(doc(authed("foGto"), "shifts", "shift1"), {
          ...SHIFT_KOTA,
          clockOut: "2026-09-21T09:00:00.000Z",
          approval: { actionId: "STAFF_SHIFT_SELF_CORRECTION" },
        })
      );
    });

    it("blocks clock-out that rewrites identity or clock-in time", async () => {
      await assertFails(
        updateDoc(doc(authed("foGto"), "shifts", "shift1"), {
          ...SHIFT_KOTA,
          userId: "student1",
          clockOut: "2026-09-21T09:00:00.000Z",
        })
      );
      await assertFails(
        updateDoc(doc(authed("foGto"), "shifts", "shift1"), {
          ...SHIFT_KOTA,
          clockIn: "2026-09-21T03:00:00.000Z",
          clockOut: "2026-09-21T09:00:00.000Z",
        })
      );
      await assertFails(updateDoc(doc(authed("foBoba"), "shifts", "shift1"), { clockOut: "t" }));
    });
  });

  describe("approved shift self-correction gate (C4)", () => {
    beforeEach(async () => {
      await seedDoc(["shifts", "shift1"], SHIFT_KOTA);
      await seedDoc(["approvals", "corr1"], APPROVED_CORRECTION);
    });

    const applied = (approvalId) => ({
      ...SHIFT_KOTA,
      clockIn: "2026-09-21T00:30:00.000Z",
      corrected: true,
      reviewStatus: "pending",
      appliedFromApproval: approvalId,
    });

    it("applies an approved correction for the matching shift", async () => {
      await assertSucceeds(updateDoc(doc(authed("foGto"), "shifts", "shift1"), applied("corr1")));
      await assertSucceeds(updateDoc(doc(authed("mgrGto"), "shifts", "shift1"), applied("corr1")));
    });

    it("blocks corrections without an approved, shift-matching approval", async () => {
      await seedDoc(["approvals", "corrPending"], { ...APPROVED_CORRECTION, status: "pending" });
      await seedDoc(["approvals", "corrOther"], {
        ...APPROVED_CORRECTION,
        payload: { shiftId: "shift999", afterData: { clockIn: "t" } },
      });
      await assertFails(updateDoc(doc(authed("foGto"), "shifts", "shift1"), applied("corrPending")));
      await assertFails(updateDoc(doc(authed("foGto"), "shifts", "shift1"), applied("corrOther")));
      await assertFails(updateDoc(doc(authed("foGto"), "shifts", "shift1"), applied("nonexistent")));
    });

    it("blocks corrections touching anything beyond the correction keys", async () => {
      await assertFails(
        updateDoc(doc(authed("foGto"), "shifts", "shift1"), { ...applied("corr1"), notes: "oops" })
      );
      await assertFails(
        updateDoc(doc(authed("foGto"), "shifts", "shift1"), { ...applied("corr1"), userId: "student1" })
      );
    });

    it("blocks corrections if target values do not match approved afterData (INT-019)", async () => {
      const tampered = {
        ...applied("corr1"),
        clockIn: "2026-09-21T00:00:00.000Z", // does not match approved 00:30:00
      };
      await assertFails(updateDoc(doc(authed("foGto"), "shifts", "shift1"), tampered));
    });

    it("blocks instructors and other branches from applying corrections", async () => {
      await assertFails(updateDoc(doc(authed("insGto"), "shifts", "shift1"), applied("corr1")));
      await assertFails(updateDoc(doc(authed("mgrBoba"), "shifts", "shift1"), applied("corr1")));
    });
  });

  describe("shift audit events (C4 dual-control trail)", () => {
    beforeEach(async () => {
      await seedDoc(["shifts", "shift1"], SHIFT_KOTA);
      await seedDoc(["approvals", "corr1"], APPROVED_CORRECTION);
    });

    it("lets admin append any audit event for a shift they acted on", async () => {
      await assertSucceeds(
        addDoc(collection(authed("admin"), "shiftAuditEvents"), {
          shiftId: "shift1",
          actorId: "admin",
          action: "flag_review",
        })
      );
    });

    it("lets front office log a manual adjustment only behind an approved correction", async () => {
      await assertSucceeds(
        addDoc(collection(authed("foGto"), "shiftAuditEvents"), {
          shiftId: "shift1",
          actorId: "foGto",
          action: "manual_adjustment",
          appliedFromApproval: "corr1",
        })
      );
      await assertFails(
        addDoc(collection(authed("foGto"), "shiftAuditEvents"), {
          shiftId: "shift1",
          actorId: "foGto",
          action: "note",
          appliedFromApproval: "corr1",
        })
      );
      await assertFails(
        addDoc(collection(authed("foGto"), "shiftAuditEvents"), {
          shiftId: "shift1",
          actorId: "foGto",
          action: "manual_adjustment",
          appliedFromApproval: "bogus",
        })
      );
      await assertFails(
        addDoc(collection(authed("foGto"), "shiftAuditEvents"), {
          shiftId: "shift1",
          actorId: "admin",
          action: "manual_adjustment",
          appliedFromApproval: "corr1",
        })
      );
    });

    it("keeps the audit trail append-only", async () => {
      await seedDoc(["shiftAuditEvents", "evt1"], { shiftId: "shift1", actorId: "admin" });
      await assertFails(updateDoc(doc(authed("admin"), "shiftAuditEvents", "evt1"), { tampered: true }));
      await assertFails(updateDoc(doc(authed("admin"), "shiftAuditEvents", "evt1"), {}));
    });
  });

  describe("classAttendance collection", () => {
    const CLASS_DOC = {
      instructorId: "insGto",
      substituteInstructorId: "insSub",
      studentIds: ["student1"],
      branchId: "kota_gorontalo",
    };

    beforeEach(async () => {
      await seedDoc(["classes", "class1"], CLASS_DOC);
      await seedDoc(["users", "insSub"], { displayName: "insSub", role: "instructor", branchId: "kota_gorontalo" });
    });

    it("allows assigned instructor to create attendance for enrolled student", async () => {
      await assertSucceeds(
        setDoc(doc(authed("insGto"), "classAttendance", "class1_student1_2026-09-27"), {
          classId: "class1",
          studentId: "student1",
          attendanceDate: "2026-09-27",
          status: "PRESENT",
          method: "SCAN",
          markedBy: "insGto",
        })
      );
    });

    it("denies unassigned instructor or unenrolled student", async () => {
      await assertFails(
        setDoc(doc(authed("insSub"), "classAttendance", "class1_student2_2026-09-27"), {
          classId: "class1",
          studentId: "student2",
          attendanceDate: "2026-09-27",
          status: "PRESENT",
          method: "SCAN",
          markedBy: "insSub",
        })
      );
    });

    it("blocks updates via scan method and enforces method == MANUAL", async () => {
      await seedDoc(["classAttendance", "class1_student1_2026-09-27"], {
        classId: "class1",
        studentId: "student1",
        attendanceDate: "2026-09-27",
        status: "PRESENT",
        method: "SCAN",
        markedBy: "insGto",
      });

      // Attempt update with SCAN method -> fails
      await assertFails(
        setDoc(doc(authed("insGto"), "classAttendance", "class1_student1_2026-09-27"), {
          classId: "class1",
          studentId: "student1",
          attendanceDate: "2026-09-27",
          status: "PRESENT",
          method: "SCAN",
          markedBy: "insGto",
        })
      );

      // Attempt update with MANUAL method -> succeeds
      await assertSucceeds(
        setDoc(doc(authed("insGto"), "classAttendance", "class1_student1_2026-09-27"), {
          classId: "class1",
          studentId: "student1",
          attendanceDate: "2026-09-27",
          status: "ABSENT",
          method: "MANUAL",
          markedBy: "insGto",
        })
      );
    });
  });

  describe("fallback deny-all", () => {
    it("denies unauthenticated access to collections without public rules", async () => {
      const anon = testEnv.unauthenticatedContext().firestore();
      await assertFails(getDoc(doc(anon, "shifts", "whatever")));
      await assertFails(addDoc(collection(anon, "payments"), PAYMENT_KOTA));
    });

    it("denies unauthenticated access to student user profiles", async () => {
      const anon = testEnv.unauthenticatedContext().firestore();
      await assertFails(getDoc(doc(anon, "users", "student1")));
    });

    it("denies everything on collections with no explicit rules", async () => {
      await assertFails(addDoc(collection(authed("admin"), "mysteryCollection"), { x: 1 }));
      await assertFails(getDoc(doc(authed("admin"), "mysteryCollection", "doc1")));
    });
  });

  describe("integration audit verification & remediation (Phase 2)", () => {
    beforeEach(async () => {
      await seedUsers();
    });

    it("INT-004: Front Office can read same-branch staff user doc and shifts, but cross-branch is blocked", async () => {
      // 1. Same-branch staff profile getDoc succeeds
      await assertSucceeds(getDoc(doc(authed("foGto"), "users", "cleanerGto")));

      // 2. Cross-branch staff profile getDoc fails
      await assertFails(getDoc(doc(authed("foBoba"), "users", "cleanerGto")));

      // 3. Same-branch staff open shift query succeeds
      await seedDoc(["shifts", "shift_insGto"], {
        userId: "insGto",
        role: "instructor",
        branchId: "kota_gorontalo",
        clockIn: "2026-09-21T01:00:00.000Z",
        clockOut: null,
      });

      await assertSucceeds(
        getDocs(
          query(
            collection(authed("foGto"), "shifts"),
            where("userId", "==", "insGto"),
            where("clockOut", "==", null),
            where("branchId", "==", "kota_gorontalo")
          )
        )
      );

      // 4. Cross-branch staff shift query fails
      await assertFails(
        getDocs(
          query(
            collection(authed("foBoba"), "shifts"),
            where("userId", "==", "insGto"),
            where("clockOut", "==", null),
            where("branchId", "==", "kota_gorontalo")
          )
        )
      );
    });

    it("INT-002: scoped directives queries succeed and maintain branch isolation; unfiltered queries are blocked", async () => {
      await seedDoc(["todos", "todoKota"], {
        title: "Kota todo",
        branchId: "kota_gorontalo",
        completed: false,
      });
      await seedDoc(["todos", "todoBoba"], {
        title: "Boba todo",
        branchId: "bone_bolango",
        completed: false,
      });
      await seedDoc(["todos", "todoAll"], {
        title: "Academy All todo",
        branchId: "all",
        completed: false,
      });

      // 1. Unfiltered query is now blocked for all staff branches (no more leakage!)
      await assertFails(getDocs(collection(authed("foGto"), "todos")));
      await assertFails(getDocs(collection(authed("foBoba"), "todos")));

      // 2. Branch-scoped query succeeds for Kota Gorontalo and receives Kota + All
      const snapKota = await assertSucceeds(
        getDocs(query(collection(authed("foGto"), "todos"), where("branchId", "in", ["kota_gorontalo", "all"])))
      );
      const kotaIds = snapKota.docs.map((d) => d.id);
      if (!kotaIds.includes("todoKota") || !kotaIds.includes("todoAll") || kotaIds.includes("todoBoba")) {
        throw new Error("Kota query returned incorrect directives: " + JSON.stringify(kotaIds));
      }

      // 3. Branch-scoped query succeeds for Bone Bolango and receives Boba + All
      const snapBoba = await assertSucceeds(
        getDocs(query(collection(authed("foBoba"), "todos"), where("branchId", "in", ["bone_bolango", "all"])))
      );
      const bobaIds = snapBoba.docs.map((d) => d.id);
      if (!bobaIds.includes("todoBoba") || !bobaIds.includes("todoAll") || bobaIds.includes("todoKota")) {
        throw new Error("Boba query returned incorrect directives: " + JSON.stringify(bobaIds));
      }
    });

    it("INT-009: prevents Kota manager from modifying a Bone Bolango corporate event", async () => {
      await seedDoc(["corporateEvents", "bobaEvent"], {
        name: "Bone Bolango Gathering",
        branchId: "bone_bolango",
        audienceType: "branch",
        audienceValue: "Bone Bolango",
        eventDate: "2026-09-30",
      });

      // 1. Cross-branch modification is now BLOCKED by isSameBranch(resource.data)
      await assertFails(
        updateDoc(doc(authed("mgrGto"), "corporateEvents", "bobaEvent"), {
          audienceType: "branch",
          audienceValue: "Kota Gorontalo",
        })
      );

      // 2. Same-branch manager can update their event
      await assertSucceeds(
        updateDoc(doc(authed("mgrBoba"), "corporateEvents", "bobaEvent"), {
          name: "Updated Bone Bolango Gathering",
        })
      );
    });

    it("INT-013: progress reports are branch-isolated for staff and parent-ready", async () => {
      await seedDoc(["progressReports", "bobaReport"], {
        instructorId: "insBoba",
        studentId: "student2",
        classId: "classBoba",
        branchId: "bone_bolango",
      });
      await seedDoc(["progressReports", "kotaReport"], {
        instructorId: "insGto",
        studentId: "student1",
        classId: "class1",
        branchId: "kota_gorontalo",
      });

      // 1. Front office in Kota is BLOCKED from reading Bone Bolango progress report
      await assertFails(getDoc(doc(authed("foGto"), "progressReports", "bobaReport")));

      // 2. Front office in Kota can read Kota progress report
      await assertSucceeds(getDoc(doc(authed("foGto"), "progressReports", "kotaReport")));

      // 3. Parent ready: parent1 can read report for their linked child (student1)
      await assertSucceeds(getDoc(doc(authed("parent1"), "progressReports", "kotaReport")));

      // 4. Parent ready: parent1 CANNOT read report for another child (student2)
      await assertFails(getDoc(doc(authed("parent1"), "progressReports", "bobaReport")));
    });

    it("INT-017: verifies parent class query shape under parent rules", async () => {
      await seedDoc(["classes", "class1"], {
        instructorId: "insGto",
        studentIds: ["student1"],
        branchId: "kota_gorontalo",
        status: "open",
      });

      const snap = await assertSucceeds(
        getDocs(
          query(
            collection(authed("parent1"), "classes"),
            where("studentIds", "array-contains", "student1"),
            where("status", "==", "open"),
            where("branchId", "==", "kota_gorontalo")
          )
        )
      );
      expect(snap.docs.map((d) => d.id)).toEqual(["class1"]);
    });

    it("allows active linked-child reads and applies the same archive predicate to report get and list", async () => {
      await seedDoc(["classes", "class1"], {
        instructorId: "insGto",
        studentIds: ["student1"],
        branchId: "kota_gorontalo",
        status: "open",
      });
      await seedDoc(["classAttendance", "attendance1"], {
        classId: "class1",
        studentId: "student1",
        attendanceDate: "2026-09-30",
        status: "PRESENT",
      });
      await seedDoc(["payments", "payment1"], {
        studentId: "student1",
        branchId: "kota_gorontalo",
        amount: 100,
      });
      await seedDoc(["progressReports", "report1"], {
        instructorId: "insGto",
        studentId: "student1",
        classId: "class1",
        branchId: "kota_gorontalo",
      });

      await assertSucceeds(getDoc(doc(authed("parent1"), "users", "student1")));
      await assertSucceeds(
        getDocs(
          query(
            collection(authed("parent1"), "classes"),
            where("studentIds", "array-contains", "student1"),
            where("status", "==", "open"),
            where("branchId", "==", "kota_gorontalo")
          )
        )
      );
      await assertSucceeds(getDoc(doc(authed("parent1"), "classAttendance", "attendance1")));
      await assertSucceeds(getDoc(doc(authed("parent1"), "payments", "payment1")));
      await assertSucceeds(getDoc(doc(authed("parent1"), "progressReports", "report1")));
      await assertSucceeds(
        getDocs(
          query(
            collection(authed("parent1"), "progressReports"),
            where("studentId", "==", "student1")
          )
        )
      );

      await seedDoc(["users", "student1"], {
        displayName: "student1",
        role: "student",
        branchId: "kota_gorontalo",
        status: "archived",
      });
      await assertFails(getDoc(doc(authed("parent1"), "users", "student1")));
      await assertFails(getDoc(doc(authed("parent1"), "classAttendance", "attendance1")));
      await assertFails(getDoc(doc(authed("parent1"), "payments", "payment1")));
      await assertFails(getDoc(doc(authed("parent1"), "progressReports", "report1")));
      await assertFails(
        getDocs(
          query(
            collection(authed("parent1"), "progressReports"),
            where("studentId", "==", "student1")
          )
        )
      );
      await seedDoc(["classes", "class1"], {
        instructorId: "insGto",
        studentIds: [],
        branchId: "kota_gorontalo",
        status: "open",
      });
      await assertFails(getDoc(doc(authed("parent1"), "classes", "class1")));
      const archivedClasses = await assertSucceeds(
        getDocs(
          query(
            collection(authed("parent1"), "classes"),
            where("studentIds", "array-contains", "student1"),
            where("status", "==", "open"),
            where("branchId", "==", "kota_gorontalo")
          )
        )
      );
      expect(archivedClasses.empty).toBe(true);
    });

    it("revokes all parent reads after unlink without affecting staff reads", async () => {
      await seedDoc(["users", "parent1"], {
        role: "parent",
        branchId: "kota_gorontalo",
        childStudentIds: [],
      });
      await seedDoc(["classes", "class1"], {
        instructorId: "insGto",
        studentIds: ["student1"],
        branchId: "kota_gorontalo",
        status: "open",
      });
      await seedDoc(["classAttendance", "attendance1"], {
        classId: "class1",
        studentId: "student1",
        attendanceDate: "2026-09-30",
        status: "PRESENT",
      });
      await seedDoc(["payments", "payment1"], {
        studentId: "student1",
        branchId: "kota_gorontalo",
        amount: 100,
      });
      await seedDoc(["progressReports", "report1"], {
        instructorId: "insGto",
        studentId: "student1",
        classId: "class1",
        branchId: "kota_gorontalo",
      });

      await assertFails(getDoc(doc(authed("parent1"), "users", "student1")));
      await assertFails(
        getDocs(
          query(
            collection(authed("parent1"), "classes"),
            where("studentIds", "array-contains", "student1"),
            where("status", "==", "open"),
            where("branchId", "==", "kota_gorontalo")
          )
        )
      );
      await assertFails(getDoc(doc(authed("parent1"), "classAttendance", "attendance1")));
      await assertFails(getDoc(doc(authed("parent1"), "payments", "payment1")));
      await assertFails(getDoc(doc(authed("parent1"), "progressReports", "report1")));
      await assertFails(
        getDocs(
          query(
            collection(authed("parent1"), "progressReports"),
            where("studentId", "==", "student1")
          )
        )
      );
    });

    it("INT-020: Front Office parent listing and querying with branch isolation", async () => {
      // 1. Kota front office can query students, instructors, and parents
      await assertSucceeds(
        getDocs(
          query(
            collection(authed("foGto"), "users"),
            where("role", "in", ["student", "instructor", "parent"]),
            where("branchId", "==", "kota_gorontalo")
          )
        )
      );

      // 2. Bone Bolango front office can query their own branch
      await assertSucceeds(
        getDocs(
          query(
            collection(authed("foBoba"), "users"),
            where("role", "in", ["student", "instructor", "parent"]),
            where("branchId", "==", "bone_bolango")
          )
        )
      );

      // 3. Bone Bolango front office CANNOT query Kota Gorontalo branch
      await assertFails(
        getDocs(
          query(
            collection(authed("foBoba"), "users"),
            where("role", "in", ["student", "instructor", "parent"]),
            where("branchId", "==", "kota_gorontalo")
          )
        )
      );

      // 4. Dedicated parent query with branchId
      const snapGto = await assertSucceeds(
        getDocs(
          query(
            collection(authed("foGto"), "users"),
            where("role", "==", "parent"),
            where("branchId", "==", "kota_gorontalo")
          )
        )
      );
      expect(snapGto.docs.map((d) => d.id)).toContain("parent1");
      expect(snapGto.docs.map((d) => d.id)).not.toContain("parent2");

      // 5. Unfiltered query (no branch filter) for non-Kota staff (foBoba) is blocked
      await assertFails(
        getDocs(
          query(
            collection(authed("foBoba"), "users"),
            where("role", "in", ["student", "instructor", "parent"])
          )
        )
      );

      // 6. Test foGto without branchId filter: blocked under isSameBranchStrict
      await assertFails(
        getDocs(
          query(
            collection(authed("foGto"), "users"),
            where("role", "in", ["student", "instructor", "parent"])
          )
        )
      );

      // 6b. Unscoped query without branchId is also blocked for instructor, marketing, and office boy
      await assertFails(
        getDocs(
          query(
            collection(authed("insGto"), "users"),
            where("role", "in", ["student", "instructor", "parent"])
          )
        )
      );
      await assertFails(
        getDocs(
          query(
            collection(authed("mktGto"), "users"),
            where("role", "in", ["student", "instructor", "parent"])
          )
        )
      );
      await assertFails(
        getDocs(
          query(
            collection(authed("obGto"), "users"),
            where("role", "in", ["student", "instructor", "parent"])
          )
        )
      );

      // 7. array-contains query for foGto WITHOUT branchId is blocked
      await assertFails(
        getDocs(
          query(
            collection(authed("foGto"), "users"),
            where("role", "==", "parent"),
            where("childStudentIds", "array-contains", "student1")
          )
        )
      );

      // 7b. array-contains query for foGto WITH branchId succeeds
      await assertSucceeds(
        getDocs(
          query(
            collection(authed("foGto"), "users"),
            where("role", "==", "parent"),
            where("branchId", "==", "kota_gorontalo"),
            where("childStudentIds", "array-contains", "student1")
          )
        )
      );

      // 8. array-contains query for foBoba WITHOUT branchId fails
      await assertFails(
        getDocs(
          query(
            collection(authed("foBoba"), "users"),
            where("role", "==", "parent"),
            where("childStudentIds", "array-contains", "student2")
          )
        )
      );

      // 9. array-contains query for foBoba WITH branchId succeeds
      await assertSucceeds(
        getDocs(
          query(
            collection(authed("foBoba"), "users"),
            where("role", "==", "parent"),
            where("branchId", "==", "bone_bolango"),
            where("childStudentIds", "array-contains", "student2")
          )
        )
      );
    });
  });
});
