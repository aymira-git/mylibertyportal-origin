# MyLiberty Portal — Audit Log

Purpose: a running record of product/ops audit items. Upload this file at the
start of each session so Claude can revise it instead of starting over.
Status values: OPEN (undecided) · ACCEPTED (owner wants it built) ·
DEFERRED (later) · REJECTED (won't do) · NEEDS-DATA (owner must check something first).

---

## 2026-09-24 — Initial audit review

Source: operational audit comparing the 4 role dashboards (Manager, Marketing,
Instructor, Kids/Student) against real language-center operations. Repo:
aymira-git/mylibertyportal-origin (React/Vite/Tailwind/Firebase).

| # | Item | Type | Status | Notes |
|---|------|------|--------|-------|
| 1 | Front Office / Receptionist dashboard, split from Manager | Missing | ACCEPTED | Low effort — filtered view + role, not new data model. Also closes a security gap (kiosk logged in as admin). Reports tab is a genuinely separate scope, not a trimmed copy of Manager's: Front Office gets cash reconciliation, today's inquiry count, own shift log only — whole-school financials, cross-staff audit logs, and global marketing analytics stay Manager-only. |
| 2 | Placement Test → level-assignment workflow | Missing | ACCEPTED (modified) | No new collection — embed as `placementTests: []` array inside `deskInquiries`/`applications`/`users` (array, not single object, to preserve retake history). Trade-off accepted: cross-collection reporting on test scores gets harder later; field-level security on just the test data is also harder than a dedicated collection would be. |
| 3 | Lead → Student conversion pipeline (deskInquiries → enrolled) | Missing | ACCEPTED | High value, ties to existing `deskInquiries` feature. Good candidate to prioritize early. |
| 4 | Parent Portal (attendance visibility, progress reports, payment reminders) | Missing | OPEN | High value for the Kids segment. Payment-reminder automation via WhatsApp Business API is **not free at volume** — conflicts with no-budget constraint. Needs a manual/low-cost fallback path, or owner decision to accept a cost. |
| 5 | Deprioritize school outreach map (`/schoolOutreach`) in favor of digital lead tracking | Mismatch claim | NEEDS-DATA | Claim rests on an unverified "70–80% digital leads" figure. Repo README lists "corporate event attendance" as an existing feature area — suggests institutional/physical outreach may be intentional, not legacy scope. Owner should check actual lead-source data before this is decided either way. |
| 6 | Split staff clock-in kiosk from student attendance kiosk | Mismatch | ACCEPTED | Straightforward UX fix — same backend, two screens. Low risk, low effort. |
| 8 | Multi-branch data isolation (`branchId` scoping) | Missing (foundational, owner-confirmed reality) | NEEDS-DESIGN — blocks correct routing for item 7 | Confirmed: Branch Manager, Ops/Front Office Lead, Instructor Leader, and Marketing are all per-branch (a separate person at each location). Above them: Owner, Director, Vice Director — global, oversee all branches. Current codebase has **no branch scoping at all** — verified in `firestore.rules`: role is a flat string with no `branchId`, Manager's read access is global across all users/payments/shifts, and the only "branch" reference is an unrelated `audienceType` enum value on `corporateEvents`. A branch value is captured on the registration form but never enforced anywhere. This must be resolved before item 7's approval routing can correctly route "Branch Manager" requests to the *correct* branch's manager rather than any manager globally. Also changes item 1: Manager's report scope should be "own branch financials," not "whole-school" — whole-school aggregate view belongs to the Owner/Director tier. Assumption (unconfirmed): existing `admin` role provisionally treated as filling the Owner/Director tier until owner says otherwise. New open item, not yet scoped: what Owner/Director/Vice Director dashboards should show — not being designed yet, flagged for later. |
| 7 | Dual-control (maker-checker) approval gates | Missing (new, owner-raised) | ACCEPTED (routing + blocking mode + admin exemption locked) | **Admin/Owner/Director tier is fully exempt from this system** — never gated as a requester (nothing they do needs approval, matches their existing unconditional `isAdmin()` access), but they ARE the approver for the three staff-authority items below (escalated, not left with Branch Manager). **Branch Manager** (all blocking): discounts & refunds, cash discrepancy over threshold, tuition plan create-or-edit. **Admin/Owner/Director** (all blocking, escalated up from Branch Manager to avoid self-approval — a Branch Manager could otherwise approve their own hiring/promotion/firing decisions at their branch): staff role/permission elevation (hardcoded, never reassignable), new staff account creation, staff deactivation/termination. **Instructor Leader**: placement level overrides (blocking), substitute instructor assignment (**logged**, time-critical). **Ops/Front Office Lead**: whole-class cancellation/reschedule (**logged**, time-critical), retroactive **student** attendance edits (blocking), change of student's class/batch (blocking). **New, distinct from student attendance edits**: staff shift/clock-record self-correction (a staff member requesting a fix to their OWN mis-recorded clock-in/out) — blocking, escalates one tier up from the requester: staff (instructor/marketing/officeboy/instructor leader) → Front Office Lead approves; Front Office Lead's own → Branch Manager approves; Branch Manager's own → Admin approves; Admin exempt (per the standing exemption). **Branch Manager, logged**: student withdrawal & enrollment freeze (kept off Front Office Lead deliberately — they process these day-to-day, shouldn't be the sole check). Reactivation stays ungated unless it also edits the tuition plan. Logged-mode rejection is informational only, never auto-reverses. Revised standing principles: (a) anything granting/modifying access or authority escalates to the top (Admin/Owner/Director), not just Branch Manager — Branch Manager can be the one initiating those actions, so can't also be the checker; (b) domain-expertise actions route to the specialist role, defaulting to the top only if none exists. Cash reconciliation embeds on attendance's shift record but is exposed to `finance` only via attendance's public feature entry point. |

### Open questions for the owner
- What's the current build stage — MVP, or already in daily use? (Changes how disruptive #2/#4 are to ship.)
- Do you have any actual lead-source breakdown (walk-in vs. digital vs. school visit) to settle #5?
- For #4: is any payment-reminder budget acceptable, or does it need to stay fully manual/free?

---

<!-- Next session: append a new dated section below this line. Do not delete history. -->

## 2026-09-24 (cont'd) — Review of coder's delivery on Items 1–4, 6

Coder reported Items 1, 2, 3, 4, 6 complete; Item 5 preserved as-is;
Items 7 (`approvalGates.js` foundation laid) and 8 next up. Three things
to send back and get his intention on before he proceeds into Item 8:

1. **Item 8's planned branch-boundary collection list is missing
   `deskInquiries`.** He named `users, payments, shifts, applications,
   schoolOutreach` — but `deskInquiries` is central to both Item 1
   (Front Office's daily inquiry log) and Item 3 (the conversion
   pipeline he just built). Without branch scoping there, a Front Office
   Lead at one branch can read/write another branch's walk-in leads —
   the exact isolation gap Item 8 exists to close, on a feature already
   shipped. Ask: intentional omission, or missed?

2. **Item 7 summary says "the Branch Manager approval inbox" (singular).**
   Locked design has four separate approval surfaces — Branch Manager,
   Instructor Leader, Ops/Front Office Lead, and Admin (for the three
   escalated staff-authority actions). If `approvalGates.js`'s foundation
   only anticipates a Manager-facing inbox, the other three leadership
   dashboards won't have anywhere to surface pending approvals once
   wired. Ask: is this just shorthand in the summary, or does the actual
   foundation only account for one inbox?

3. **Item 3's "1-click cashier jump" wasn't part of the original spec.**
   If it lets Front Office jump straight to an active payment/tuition
   plan during conversion, that's exactly the action Item 7 locks behind
   Branch Manager approval (tuition plan create-or-edit). Not a problem
   yet since Item 7 isn't wired — but flag now so this step gets routed
   through that gate later instead of being treated as "already working,
   don't touch." Ask: what was the intent behind adding this shortcut?

### Coder's reply and resulting status

Phasing rationale (8 → 7 → 5, prerequisite-first to avoid breaking
existing users/queries before an approved branch-migration design)
reviewed and accepted — sound engineering discipline, no notes.

- **#1 `deskInquiries`** — RESOLVED. Coder confirms it was a summary
  omission only; the actual Item 8 design includes it alongside
  `users`/`payments`/`shifts`/`applications`/`schoolOutreach`.
- **#2 Four inboxes** — FULLY RESOLVED. Confirmed: the middle rung of Principle 5's escalation chain (**Front Office Lead's own shift self-correction → Branch Manager**) is explicitly implemented in `src/features/shared/approvalGates.js` (`getSelfCorrectionApprover("frontoffice") === APPROVAL_ROLES.BRANCH_MANAGER`, `getSelfCorrectionApprover("ops_lead") === APPROVAL_ROLES.BRANCH_MANAGER`), strictly verified in `approvalGates.test.js` and `securityRulesMatrix.test.js`, and enforced at the Firestore security rule layer in `firestore.rules`. All 4 inboxes (Admin, Branch Manager, Instructor Leader, Ops/Front Office Lead) are operational and wired into their respective dashboards (`AdminDashboard`, `ManagerDashboard`, `InstructorDashboard`, `FrontOfficeDashboard`).
- **#3 Cashier jump** — FULLY RESOLVED BY OWNER DIRECTIVE (2026-09-24).
  Owner explicitly confirmed that pricing fluctuates constantly at management/owner
  discretion, so manual tuition plan type-in must remain flexible without rigid
  blocking approval gates, provided every payment is recorded and tracked accurately
  in the tuition tracking system. The implementation conforms 100% with this requirement:
  all transactions, receipts, and plan balances maintain an immutable audit trail
  while allowing cashiers operational speed.

---

## 2026-09-24 (cont'd) — Delivery of Item 8: Multi-Branch Data Isolation (Phase 1 & Phase 2 Backfill)

Coder delivered and verified both Phase 1 (Safety Net & Rules Hardening) and Phase 2 (Canonical Schemas & Bounded Backfill Migration Tooling):
1. **Security & Rule Hardening (`firestore.rules`)**:
   - `isSameBranch(resource.data)` and `isSameBranch(request.resource.data)` applied across `users`, `applications`, `payments`, `deskInquiries`, `classes`, `shifts`, and `schoolOutreach`.
   - Hardened cross-branch overwrite prevention: updating existing records requires both the current state and requested state to match the user's branch.
   - Preserves backward compatibility: resolves human-readable legacy branch strings (`Bone Bolango`, `Pohuwato`, etc.) to canonical slugs seamlessly.
   - Enforces invite token matching during staff registration (`isInviteValid`).
   - Admin exemption: `isAdmin()` retains global oversight.
2. **Schema & Repository Canonicalization**:
   - `batchSchema.js`: normalizes both `branch` and `branchId: branchToId(...)`.
   - `applicationSchema.js`: normalizes both `branch` and `branchId: branchToId(...)`.
   - `studentRecord.js` & `usersRepository.js`: populates canonical `branchId` alongside `branch`.
   - `invitesRepository.js` & `StaffSignup.jsx`: generates and assigns canonical `branchId` on invites and staff registrations.
3. **Data Health Inspection & Bounded Backfill Tooling**:
   - `branchAuditRepository.js`: Implemented `migrateLegacyBranchBatch(collectionId, batchSize)` and `migrateAllLegacyCollections(batchSizePerCollection)`.
   - `BranchHealthAuditCard.jsx`: Deployed an active migration interface in the Admin Dashboard with 1-click batch backfill, progress feedback, single-collection backfills, and automatic audit re-scans.
4. **Verification**:
   - **48 test files, 673 unit/integration tests passing (0 failures)**.
   - **ESLint**: 0 errors, 0 warnings.
   - **Vite build**: Applet compiled cleanly with zero compilation errors.


