# MyLiberty Portal — Execution Brief for Coding Agent

This replaces the earlier directional draft with concrete tasks. Items
already marked ACCEPTED below are locked on *what* to build — you still
own *how*, but stop guessing scope, it's decided. Items still marked
OPEN/NEEDS-DATA are not yours to start.

## 0. Mandatory process — do this before writing any code

The repo already defines its own governance. Follow it, don't improvise:

1. Read `AGENTS.md` and `docs/ARCHITECTURE.md` in full before touching anything.
2. For every task below, check `docs/proposals/` and `docs/plans/` first —
   update an existing doc if one already covers this area; only create a
   new file if none does (repo rule: don't create a new .md when an
   existing one can be updated).
3. Any new Firestore access goes through a repository/data-access module
   — never call Firestore directly from a component (this is an existing
   architectural rule, not new).
4. Any change to `firestore.rules` or `firestore.indexes.json`: review for
   read/write cost and least-privilege before committing. If indexes
   change, run `firebase deploy --only firestore:indexes` and say so in
   your summary — don't assume local success means production is correct.
5. Stay inside `src/features/<domain>/` boundaries. Cross-domain access
   goes through a feature's public entry point, not a deep import into
   another feature's internals.
6. Before calling any task done: `npm run lint`, `npm run typecheck`,
   `npm test`, and `npm run build` must all pass.
7. Confirm the exact current path of anything I reference below before
   editing it — I have the repo's high-level architecture (from README/
   ARCHITECTURE.md), not its full file listing. Where I say "likely",
   verify; don't assume.

Known feature map (`src/features/`): `auth`, `students`, `attendance`,
`classes`, `finance`, `staff`, `reports`, `shared`, and
`dashboard/{manager,marketing,instructor,kids}`.

---

## 1. Front Office dashboard — ACCEPTED
- New dashboard entry point: `src/features/dashboard/front-office/`,
  parallel to the existing `manager`/`marketing`/`instructor`/`kids`
  dashboards. Per `ARCHITECTURE.md`'s own rule, this is an orchestration
  layer over existing domains — it must **compose** `students`,
  `attendance`, and `finance` features scoped down, not duplicate their
  logic.
- Scope for this role: student check-in, desk inquiry logging, cash/QRIS
  payment intake.
- **Front Office "Reports" tab — explicit scope, not a stripped-down copy
  of the Manager one, a genuinely different set:**
  - Daily Cash Register Reconciliation (see the embedded shape below)
  - Daily Inquiry Count — today's walk-in leads only, not historical trend data
  - Personal Shift Log — the logged-in staff member's own clock-in/out
    hours only, not other staff members' hours
- **Explicitly excluded from Front Office, Manager-only:** this branch's
  financials (revenue, profit margins, overdue tuition ledgers for
  **this branch**, not the whole school — see item 8, Manager is
  per-branch), staff audit logs / shift histories for this branch's
  employees, and marketing/conversion analytics. This is the actual
  privacy motivation for splitting the dashboard in the first place —
  don't let this collapse into "same reports, fewer buttons." If a
  coder's implementation can technically reach Manager-only data through
  a shared reports component, that's a bug against this spec, not an
  acceptable shortcut.
- Check `src/features/auth/` for how roles are modeled (claims vs. a
  Firestore `role` field) before adding a new `frontoffice`-tier lead
  role value — match the existing lowercase, no-separator convention
  (`frontoffice`, `officeboy`), don't invent a second mechanism or a
  different naming style (see item 8 — this role is also now per-branch).
- Update `firestore.rules`: new role gets least-privilege access limited
  to exactly the above — not full Manager access minus a few screens.
- **Cash reconciliation, embedded on the existing shift/clock-out record
  — not a new collection:**
  ```js
  cashReconciliation: {
    expectedCash: 1500000,
    expectedQris: 500000,
    countedCash: 1480000,
    countedQris: 500000,
    discrepancy: -20000,
    notes: "short by 20k, till was busy at 3pm"
  }
  ```
  When `discrepancy` exceeds a configurable threshold (default: Rp 25,000
  or 1% of that day's expected total, whichever is smaller — store this
  as an adjustable config value, not a hardcoded constant), auto-create
  an `approval` entry (see item 7) routed to Branch Manager. Do not build
  a separate cash-specific review mechanism — reuse item 7's pattern.
  **Ownership note:** this record lives on `attendance`'s shift/clock-out
  document (no new collection), but it's conceptually finance data. Do
  not let `finance` reach into `attendance`'s internals to read it —
  expose it through `attendance`'s public feature entry point (a
  `getShiftCashReconciliation()`-style accessor), per the architecture
  doc's own rule on cross-domain access. `attendance` owns the document;
  `finance` consumes it through the public interface only.

## 2. Placement Test → level assignment — ACCEPTED (spec locked)
- No new collection. Add `placementTests: []` (array, not object — retest
  history matters) to the relevant `students`/inquiry document:
  ```js
  placementTests: [
    { score: 84, assessedLevel: "Pre-Intermediate 1", testedBy: "Staff Name",
      testedAt: "2026-09-23", notes: "Strong speaking, needs grammar review." }
  ]
  ```
- Locate the actual desk-inquiry and application schema first (likely
  under `src/features/students/`, possibly touching `marketing` too if
  desk inquiries live there — verify, don't assume) before adding the
  field so it lands on the right document type.
- `firestore.rules`: define exactly which role(s) can write
  `placementTests` — this is staff-assessed data, don't leave it as
  open as the rest of a shared document.
- No index changes needed unless you later add a query that filters by
  `assessedLevel` or similar inside the array — flag that separately if
  it comes up, don't add it preemptively.

## 3. Desk Inquiry → Enrolled Student pipeline — ACCEPTED
- Add a "Convert to Student" action on a desk inquiry record that:
  1. Creates the new student/application record, carrying forward
     contact details and the `placementTests` array (if present) from
     the inquiry.
  2. Marks the original inquiry with a status field (e.g.
     `status: "converted"`, plus `convertedTo: <new doc ref>`) — **do not
     delete the original inquiry.** Preserve it for lead-funnel history.
- This depends on task 2's field being in place first if a placement
  test happened before conversion — build 2 before 3, or at least land
  them in the same change set.

## 4. Parent Portal — ACCEPTED, read-only scope only for now
- Default to option (a) from prior discussion: read-only visibility
  (attendance, progress, amount due) for parents. **No automated
  WhatsApp/SMS reminders** — that has a real per-message cost the owner
  has not approved.
- Needs a way to link a parent identity to a student record (e.g. a
  `parentUserId` field on the student doc, or a separate `parents`
  auth-linked lookup — check what `src/features/auth/` already supports
  before inventing a new auth pattern).
- New dashboard surface, likely `src/features/dashboard/parent/` or an
  extension of the existing `kids` dashboard scoped to parent auth
  instead of student auth — your call which fits the existing auth
  model better, but don't build a payment-reminder trigger of any kind
  as part of this task.

## 5. School outreach vs. digital leads — NOT ACCEPTED, do nothing (business decision only)
- No task here **on the business question**: owner has not confirmed the
  underlying lead-source data, so do not deprioritize, shrink, or replace
  `/schoolOutreach` with digital lead tracking as part of any other
  task's cleanup.
- **Exception, and it's a real one, not a loophole:** item 8's
  `branchId` scoping work DOES touch `/schoolOutreach` and its rules —
  `hasRole('marketing')` currently grants global read access to outreach
  data, which is the same access-isolation bug item 8 is fixing for
  Manager, now that Marketing is also confirmed branch-level. That fix
  is required regardless of how the business question resolves. Don't
  read "do not touch" as blocking item 8's security fix — it only
  blocks changes motivated by the deprioritization argument itself.
- If anything, branch-scoping this data reinforces that outreach is
  already a real per-branch operational tool (each branch presumably
  visiting schools near it), not obviously legacy scope creep — worth
  noting to the owner, though it still doesn't substitute for actually
  checking the lead-source numbers.

## 6. Split staff clock-in from student attendance kiosk — ACCEPTED
- Add a second kiosk display mode/route inside `src/features/attendance/`
  — same backend writes, two front-end entry points (e.g.
  `/kiosk/staff` and `/kiosk/students`), so lobby traffic doesn't queue
  behind shift clock-ins.
- No data model change. Pure UI/routing split.

## 8. Multi-branch data isolation (`branchId` scoping) — NEEDS DESIGN, blocks item 7
- **This is foundational — resolve before finishing item 7's routing, not after.**
- Confirmed org structure: Owner / Director / Vice Director are global
  (oversee all branches). Manager (existing `manager` role), the new
  `opslead` role, the new `instructorleader` role, and the existing
  `marketing` role are all **per-branch** — a separate person holds each
  of these roles at every location. (`schoolOutreach`/lead data currently
  reads globally via `hasRole('marketing')` — same scoping gap as
  Manager, needs the same fix.)
- Confirmed via `firestore.rules`: **no branch scoping exists today.**
  `role` is a flat string with no `branchId` anywhere; `isManager()`
  grants global read access across all users, payments, and shifts with
  no per-branch filter. The only "branch" reference in the whole rules
  file is an unrelated `audienceType` enum value on `corporateEvents`
  (`'all' | 'branch' | 'role' | 'division'`) — not an access boundary.
  A branch value is already captured on the registration form but never
  enforced anywhere downstream.
- Required work: add a `branchId` field to user documents for
  branch-scoped roles (`manager`, `opslead`, `instructorleader`, and
  presumably `frontoffice`/`instructor`/`student` too — verify), and add
  branch-matching checks to `firestore.rules` for every collection
  Manager currently reads/writes globally (`users`, `payments`, `shifts`,
  `applications`, etc.) — this is a `firestore.rules` rewrite of
  meaningful size, treat it as an architecture change per `AGENTS.md`,
  not a quick patch.
- **Assumption, not yet confirmed by owner:** the existing `admin` role
  is provisionally treated as filling the Owner/Director/Vice Director
  tier for now, since it's the only role above `manager` in the current
  schema. Do not build separate `owner`/`director`/`vicedirector` role
  values unless the owner confirms that's actually wanted — flag this
  back rather than assuming.
- **Not yet scoped, do not build:** what Owner/Director/Vice Director
  dashboards should actually show (presumably cross-branch aggregate
  reporting). This is a real open item for later, not part of this task.
- **Why this blocks item 7:** every `approverRole` in item 7's table
  needs to resolve to *the specific person* holding that role at *the
  requester's branch* — not "any manager." The `approval` object shape
  in item 7 already includes `approverBranchId` for this reason; don't
  implement item 7's routing logic until this task's `branchId` model
  exists to populate it correctly.

## 7. Dual-control (maker-checker) approval gates — ACCEPTED, routing + mode + admin exemption locked, blocked on item 8
- **`admin` (Owner/Director/Vice Director tier) is fully exempt from this
  entire system** — never a requester whose actions get gated (matches
  their existing unconditional access in `firestore.rules`), but they
  ARE the approver for the three staff-authority actions below. Do not
  build any gating logic that could apply to an `admin`-role actor.
- Reusable object, added to whichever document the gated action lives on:
  ```js
  approval: {
    status: "pending" | "approved" | "rejected",
    mode: "blocking" | "logged",
    approverRole: "manager" | "instructorleader" | "opslead" | "admin",
    approverBranchId: "<branch id of the specific approver, see item 8; omit/null for admin-tier approvals, which are global>",
    requestedBy: "Staff Name",
    requestedAt: "2026-09-24",
    decidedBy: null,
    decidedAt: null,
    reason: null
  }
  ```
- **Two behaviors, not one — this is the most important distinction to
  get right:**
  - `mode: "blocking"` — the underlying change does not take effect
    (is not treated as active/final by any other part of the system)
    until `status` becomes `"approved"`.
  - `mode: "logged"` — the underlying change takes effect **immediately**
    regardless of `status`. The approval record exists purely for
    after-the-fact review. **A later `"rejected"` does NOT automatically
    reverse anything** — do not build any rollback logic tied to
    rejection for logged-mode actions. Rejection just means the approver
    flagged it; any correction is a separate, manual action taken by a
    human, not a system-triggered undo.
- **Build this as a small shared config/allow-list** mapping action type
  → `{approverRole, mode}` (in `src/features/shared/` per the
  architecture doc's guidance on cross-domain helpers) — not hardcoded
  per-feature logic. One entry (role elevation) must be non-reassignable
  in the config itself so a future bulk-edit of the routing table can't
  accidentally sweep it up.
- `firestore.rules` shape: for `blocking` actions, the requesting role
  may only write `status: "pending"` plus their own
  `requestedBy`/`requestedAt` — the real field change is rejected by
  rules unless `status` is already `"approved"`. For `logged` actions,
  the real field change is allowed immediately; only the approval
  object's `decidedBy`/`decidedAt`/`status` transition is restricted to
  the matching `approverRole`.
- Confirm each role's auth/claim representation in `src/features/auth/`
  before wiring rules.

**Full locked table:**

| Approver | Gated action | Mode | Feature | Status |
|---|---|---|---|---|
| Branch Manager | Discounts & refunds | Blocking | `finance` | Confirmed |
| Branch Manager | Cash discrepancy over threshold (item 1) | Blocking | `finance` via `attendance` | Confirmed |
| Branch Manager | Tuition plan — create or edit (not just initial admission) | Blocking | `finance` or `students` (verify owner) | Confirmed |
| **Admin (Owner/Director tier)** | Staff role/permission elevation | Blocking | `staff` | Confirmed — hardcoded, never reassignable. **Escalated up from Branch Manager**, not left there — a Branch Manager could otherwise approve their own hiring/promotion decisions at their branch |
| **Admin (Owner/Director tier)** | New staff account creation | Blocking | `staff` | Confirmed — same escalation reasoning |
| **Admin (Owner/Director tier)** | Staff deactivation/termination | Blocking | `staff` | Confirmed — same escalation reasoning |
| Instructor Leader | Placement level overrides | Blocking | `students` | Confirmed |
| Instructor Leader | Substitute instructor assignment | **Logged** — time-critical | `staff` | Confirmed |
| Ops/Front Office Lead | Whole-class cancellation/reschedule | **Logged** — time-critical | `classes` | Confirmed (owned by Front Office Lead, who owns scheduling) |
| Ops/Front Office Lead | Retroactive **student** attendance edits | Blocking | `attendance` | Confirmed |
| Ops/Front Office Lead (default) → Branch Manager (if requester is Front Office Lead) → Admin (if requester is Branch Manager) | Staff shift/clock-record self-correction — **own record only**, distinct from the row above | Blocking | `attendance` (`shifts` collection) | Confirmed — first gated action whose approver depends on the requester's own role, not a fixed role; see principle 5 below |
| Ops/Front Office Lead | Change of student's class/batch | Blocking | `classes` or `students` (verify owner) | Confirmed |
| Branch Manager | Student withdrawal / enrollment freeze | **Logged** — fast for the student, reviewed after by Branch Manager (kept off Front Office Lead deliberately — they process these day-to-day, shouldn't be the sole check) | `students` or `finance` (verify owner) | Confirmed |
| Reactivation (no gate) | Ungated unless it also edits the tuition plan, in which case the tuition-plan gate above already applies | — | `students` | n/a |
| — (exempt) | Any action by an `admin`-role actor | n/a | all | Confirmed — admin is never a requester subject to this system |

- **Standing principles for classifying any future gated action:**
  1. Anything that grants or modifies someone's access/authority always
     escalates to the top (Admin/Owner/Director), **not just Branch
     Manager** — Branch Manager can be the one initiating an
     access-granting action (hiring, promoting, deactivating staff at
     their own branch), so they can't also be its checker. This
     supersedes an earlier draft of this principle that said "Branch
     Manager always" — that version didn't yet account for Branch
     Manager itself being a possible source of the risk.
  2. Anything requiring domain expertise routes to the role with that
     expertise; default to the top (Admin/Owner/Director) only when no
     specialist role exists for that domain.
  3. Default new actions to `mode: "blocking"` unless the action is
     genuinely time-critical (delay would cause real operational harm,
     like a class going uncovered) — `logged` is the exception, not the
     default.
  4. `admin` (Owner/Director/Vice Director tier) is never a requester
     subject to this system, for any action, present or future. It can
     still be named as an approver (as in the three staff-authority rows
     above) — the exemption only means its own actions are never gated.
  5. For any "self-correction" action (a person fixing their own record,
     not someone else's), the approver is the role one tier above the
     *requester's own role*, not a fixed role for the action type: staff
     → Front Office Lead; Front Office Lead's own → Branch Manager;
     Branch Manager's own → Admin. This is a different lookup than every
     other row in the table (which route by action type, not by who's
     asking) — build it as a small role-hierarchy helper
     (`staff < opslead < manager < admin`) that any future self-correction
     action can reuse, not a one-off if/else for shift records alone.

---

## If something here doesn't fit
If any of the above conflicts with what you find in `AGENTS.md`,
`docs/ARCHITECTURE.md`, or the actual current schema, say so and propose
the adjustment — this brief describes intent and locked decisions, not a
line-by-line diff. Don't silently reinterpret a locked item (sections
1–3, 6–7's confirmed five) to make it easier to build; flag the conflict
back through this audit process instead.
