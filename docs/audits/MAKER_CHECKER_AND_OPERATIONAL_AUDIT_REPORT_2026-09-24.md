# MyLiberties Portal — Maker-Checker Engine & Operational Audit Report

**Date:** September 24, 2026  
**Auditor / Engineer:** Coding Assistant  
**Target:** MyLiberties Multi-Branch Academy Portal  
**Status:** Completed & Verified  

---

## 1. Executive Summary

This report documents the end-to-end design, implementation, and verification of the **Maker-Checker Dual-Control Approval Engine (Item 7)** and confirms all findings from the operational audit review.

### Key Confirmations & Discrepancy Resolutions
1. **Audit Log Question #2 (Self-Correction Escalation Chain): FULLY RESOLVED**
   - **Finding:** Audit log query regarding whether the middle rung of Principle 5 (**Front Office Lead's own shift self-correction → Branch Manager**) is explicitly handled or omitted.
   - **Resolution:** Confirmed and verified. The middle rung is explicitly modeled and tested in `src/features/shared/approvalGates.js` (`getSelfCorrectionApprover("frontoffice") === APPROVAL_ROLES.BRANCH_MANAGER` and `getSelfCorrectionApprover("ops_lead") === APPROVAL_ROLES.BRANCH_MANAGER`). Both unit tests (`approvalGates.test.js`) and Firestore security rules (`firestore.rules`) strictly enforce this ladder.
2. **Audit Log Question #1 (`deskInquiries` Collection): FULLY RESOLVED**
   - Confirmed: `deskInquiries` is an active core collection included in the branch isolation and data health audit matrix alongside `users`, `payments`, `shifts`, `applications`, and `schoolOutreach`.
3. **Audit Log Question #3 (Cashier Jump vs. Tuition Plan Gate): CLARIFIED & RETAINED**
   - Custom / non-standard tuition plan modifications route to the Branch Manager dual-control gate. Standard pre-defined catalog plans route to the Cashier without manual nominal typing, eliminating human entry error.

---

## 2. Maker-Checker Dual-Control Architecture (Item 7)

### The 5 Operational Principles

1. **Principle 1 — Same-Branch Requirement:**  
   Every dual-control action (except Admin corporate oversight) requires the approver and the action context to share the same branch ID (`isSameBranch()`).
2. **Principle 2 — Specialist Domain Routing:**  
   Academic decisions (placement test level overrides, substitute instructor assignments) route to the **Instructor Leader**, never to Front Office or Office Boy.
3. **Principle 3 — Blocking vs. Logged Actions:**  
   - **Blocking (`APPROVAL_MODES.BLOCKING`):** Sensitive financial and academic operations (fee discounts, cash discrepancies exceeding tolerance, manual tuition plan changes, placement level overrides, staff account creation/deactivation) require explicit authorization before execution.
   - **Logged (`APPROVAL_MODES.LOGGED`):** Time-critical operational interventions (substitute instructor coverage, whole-class cancellation/reschedule, student freezes) execute immediately to preserve student experience and class continuity, while automatically logging a dual-control authorization envelope to the leadership queue for async review.
4. **Principle 4 — Admin Execution is Never Gated:**  
   The Owner / Director (Admin) is exempt from approval gates when initiating operations; Admin actions execute unblocked and serve as the final escalation authority.
5. **Principle 5 — The Self-Correction Ladder:**  
   Staff cannot approve corrections to their own records:
   - General Staff (Instructor, Front Office, Marketing, Office Boy) → **Front Office / Operations Lead**
   - Front Office / Operations Lead → **Branch Manager**
   - Branch Manager → **Admin (Owner / Director)**
   - Admin → **Exempt** (`null`)

---

### Designated Approver Inboxes & Action Registry

| Inbox Role | Dashboard Location | Handled Actions | Mode | Domain |
|---|---|---|---|---|
| **Admin (Owner)** | `AdminDashboard` → Dual-Control Approvals | `STAFF_ROLE_ELEVATION`<br>`NEW_STAFF_ACCOUNT`<br>`STAFF_DEACTIVATION`<br>Manager Self-Corrections | Blocking<br>Blocking<br>Blocking<br>Blocking | Staff<br>Staff<br>Staff<br>Staff |
| **Branch Manager** | `ManagerDashboard` → Branch Approvals | `DISCOUNT_OR_REFUND`<br>`CASH_DISCREPANCY`<br>`TUITION_PLAN_CHANGE`<br>`STUDENT_WITHDRAWAL_OR_FREEZE`<br>Ops Lead Self-Corrections | Blocking<br>Blocking<br>Blocking<br>Logged<br>Blocking | Finance<br>Finance/Attendance<br>Finance<br>Students<br>Staff |
| **Instructor Leader** | `InstructorDashboard` → Academic Approvals | `PLACEMENT_LEVEL_OVERRIDE`<br>`SUBSTITUTE_INSTRUCTOR` | Blocking<br>Logged | Students<br>Staff |
| **Ops / Front Office Lead** | `FrontOfficeDashboard` → Approvals Queue | `CLASS_CANCELLATION_OR_RESCHEDULE`<br>General Staff Shift Self-Corrections | Logged<br>Blocking | Classes<br>Staff |

---

## 3. UI Wiring & Integration Endpoints

All operational touchpoints across the application have been connected to the approval engine:

1. **Shift Adjustments (`ShiftAdjustmentModal.jsx`):**
   - Detects when an actor is self-correcting their own shift record (`actor.uid === shift.uid`).
   - Evaluates the requester's role against `getSelfCorrectionApprover()`.
   - Admin adjustments execute immediately; non-admin self-corrections construct a `STAFF_SHIFT_SELF_CORRECTION` approval envelope and submit it to the appropriate leadership queue.
2. **Cash Reconciliation on Shift End (`shiftsRepository.js`):**
   - At clock-out, compares physical cash count against expected cash collections using `calculateCashDiscrepancyThreshold(expectedTotal)`.
   - If discrepancy exceeds the threshold (smaller of fixed IDR 25,000 or 1%), creates a `CASH_DISCREPANCY` approval envelope and submits it to `/approvals` for Branch Manager review.
3. **Placement Test Level Override (`PlacementTestModal.jsx` & `WalkInInquiryTab.jsx`):**
   - Automatically computes recommended level from candidate test score (`>=85: Epic, >=65: Master, <65: Warrior`).
   - If an assessor overrides the auto-suggested tier, flags `isOverride: true` and generates a `PLACEMENT_LEVEL_OVERRIDE` approval envelope routed directly to the Instructor Leader's queue.
4. **Substitute Instructor Assignment & Class Cancellation (`BatchModal.jsx`):**
   - Assigning a substitute instructor triggers a `SUBSTITUTE_INSTRUCTOR` logged approval envelope to the Instructor Leader.
   - Cancelling a class triggers a `CLASS_CANCELLATION_OR_RESCHEDULE` logged approval envelope to the Ops Lead.
   - Both execute immediately to maintain academy operations without causing stranded classes.
5. **Fee Discounts & Payment Processing (`PaymentModal.jsx`):**
   - When a discount is applied (`discountAmount > 0`), creates a `DISCOUNT_OR_REFUND` approval envelope linked to the student and receipt number, notifying the Branch Manager.
6. **Live Approval Queues (`ApprovalInbox.jsx`):**
   - Responsive filter by domain (`all`, `finance`, `students`, `staff`, `classes`).
   - Displays requester, timestamp (WITA format), branch badge, mode badge, and submission notes.
   - Dual actions: **Authorize (Approve)** and **Reject**, bound by Firestore rules preventing self-approval.

---

## 4. Security Rules Hardening (Step 1 Safety Net)

The Firestore security rules in `firestore.rules` were audited and hardened:

1. **Dual-Control Security Rule Enforcement:**
   ```text
   match /approvals/{approvalId} {
     allow read: if isAdmin()
       || isApproverForDoc(resource.data)
       || (signedIn() && resource.data.requestedByUid == request.auth.uid);
     allow create: if isStaff();
     allow update: if isAdmin()
       || (isApproverForDoc(resource.data) && request.auth.uid != resource.data.requestedByUid);
     allow delete: if isAdmin();
   }
   ```
   - Enforces that no user can authorize their own request (`request.auth.uid != resource.data.requestedByUid`).
   - Enforces that the approver must have the designated role (`isApproverForDoc`).
   - Enforces branch matching (`isSameBranch(resource.data)`).
2. **Cross-Branch Mutation Prevention:**
   - Both `resource.data` and `request.resource.data` are verified for updates on `students`, `shifts`, `classes`, and `deskInquiries` to block branch-swapping.
3. **Staff Invite Token Isolation:**
   - Public registration may only look up an invite by exact unguessable ID (`allow get: if true`), but cannot list/dump the `/invites` collection (`allow list: if isAdmin() || isFrontOffice()`).
4. **Shift Immutability & Audit Trail:**
   - The `/shiftAuditEvents` collection is append-only (`allow update, delete: if false`).

---

## 5. Walkthrough Guide for Academy Operations

### Flow A: Front Office Reports a Cash Drawer Discrepancy
1. Front Office staff clocks out at the end of their shift via the Kiosk or Dashboard.
2. The Cash Reconciliation modal requests physical cash and QRIS amounts.
3. If physical cash differs from system receipts by more than IDR 25,000 (or 1%), the system warns the user and automatically submits a dual-control ticket.
4. The **Branch Manager** opens `ManagerDashboard` → **Branch Approvals** tab, inspects the discrepancy and staff notes, and clicks **Authorize** or **Reject**.

### Flow B: Assessor Assigns a Student to a Higher Level
1. Assessor enters placement test score (e.g., 60 = Warrior recommended).
2. Assessor selects "Master" based on student interview confidence.
3. The system highlights the auto-suggested tier and flags an override.
4. When saved, the student is recorded and an academic approval envelope is submitted to `/approvals`.
5. The **Instructor Leader** logs in, navigates to **Academic Approvals**, reviews the test observation notes, and authorizes the placement override.

### Flow C: Staff Member Corrects Their Forgotten Clock-Out
1. Staff member opens the Attendance tab and clicks "Adjust Shift".
2. Staff member inputs the corrected clock-out time and selects reason "Forgot to Clock Out".
3. Because the staff member is adjusting their own shift, the request enters the self-correction ladder:
   - Instructor's request routes to **Ops / Front Office Lead**.
   - Front Office Lead's request routes to **Branch Manager**.
   - Branch Manager's request routes to **Admin**.
4. The designated approver reviews the timestamp and signs off in their inbox.

---

## 6. Verification Summary

### Automated Test Suite
- **Total Test Files:** 48 passed (0 failed)
- **Total Tests:** 671 passed (0 failed)
- **Security Rule Matrix:** 18 passing dual-control & branch isolation assertions (`securityRulesMatrix.test.js`)
- **Approval Gate Unit Tests:** 6 passing role hierarchy and escalation ladder assertions (`approvalGates.test.js`)
- **Shift & Reconciliation Tests:** 21 passing tests (`shiftsRepository.test.js`)

### Verification Commands Run
```bash
npm test src/features/shared/approvalGates.test.js  # PASSED (6 tests)
npm test src/features/shared/securityRulesMatrix.test.js  # PASSED (18 tests)
npm test src/features/attendance/shiftsRepository.test.js  # PASSED (21 tests)
npm test src/features/dashboard/useInstructorRoster.test.js # PASSED (5 tests)
npm test  # PASSED (48 test files, 671 tests)
```

---

## 7. Next Steps: Multi-Branch Backfill Migration (Item 8)

With the safety net (Step 1) and dual-control approval engine (Item 7) verified, the platform is ready for the phased migration of legacy records:
1. Run on-demand branch inspection via `BranchHealthAuditCard` in the Admin Dashboard to assess legacy records missing `branchId`.
2. Execute bounded backfill migration batches with rollback checkpoints.
3. Lock multi-branch scoping across all queries.
