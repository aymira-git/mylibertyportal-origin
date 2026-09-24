/**
 * Emulator-based tests for the REAL firestore.rules file.
 *
 * Unlike securityRulesMatrix.test.js (a hand-mirrored copy of the rule logic),
 * these tests run the actual rules engine against the actual firestore.rules,
 * so a drift between code and rules fails here. Requires the Firestore
 * emulator: `npm run test:rules`. Skipped silently in a plain `npm test`.
 */
/* global process */
import { describe, it, beforeAll, beforeEach, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import { doc, setDoc, getDoc, updateDoc, collection, addDoc } from "firebase/firestore";

const RULES_PATH = join(dirname(fileURLToPath(import.meta.url)), "../../../firestore.rules");
const HAS_EMULATOR = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

let testEnv;

const USERS = {
  admin: { role: "admin", branchId: "kota_gorontalo" },
  mgrGto: { role: "manager", branchId: "kota_gorontalo" },
  mgrBoba: { role: "manager", branchId: "bone_bolango" },
  foGto: { role: "frontoffice", branchId: "kota_gorontalo" },
  foBoba: { role: "frontoffice", branchId: "bone_bolango" },
  insGto: { role: "instructor", branchId: "kota_gorontalo" },
  student1: { role: "student", branchId: "kota_gorontalo" },
  student2: { role: "student", branchId: "bone_bolango" },
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

  describe("fallback deny-all", () => {
    it("denies unauthenticated access to collections without public rules", async () => {
      const anon = testEnv.unauthenticatedContext().firestore();
      await assertFails(getDoc(doc(anon, "shifts", "whatever")));
      await assertFails(addDoc(collection(anon, "payments"), PAYMENT_KOTA));
    });

    it("documents that student user profiles are world-readable by design", async () => {
      const anon = testEnv.unauthenticatedContext().firestore();
      await assertSucceeds(getDoc(doc(anon, "users", "student1")));
    });

    it("denies everything on collections with no explicit rules", async () => {
      await assertFails(addDoc(collection(authed("admin"), "mysteryCollection"), { x: 1 }));
      await assertFails(getDoc(doc(authed("admin"), "mysteryCollection", "doc1")));
    });
  });
});
