# Staff Directory & Real-World Operations — Plan v2 (post-audit)

> **For the executing agent.** Audited against the current `myliberty-portal.zip`. Everything in v1 §3.1–3.6 is **already implemented** (`StaffDirectory.jsx`, `staffUtils.js`, `updateStaffStatus`, UserForm staff fields, AdminDashboard wiring). `npm run lint` = 0 errors, `npm run build` = OK. Redoing v1 looks unnecessary; this plan covers only the gaps found. If you find v1 work that is actually wrong, say so and fix it.
>
> **Nothing in this document is locked. Not the findings, not the recommendations, not the owner's decisions, not the scope.** Every item is a proposal with a *Why*. If you see a better way, or something conflicts with what you know from the code, argue it in your report and take the better path. Items marked **[OPEN]** are the ones the auditor is least sure about.

## Owner's current stance (starting point, NOT binding: challenge any of it with reasons)

1. Instructor workload telemetry shows **only** on the Instructor role filter. No clutter on "All" or other roles.
2. Admins get **no** Print Badge button (nobody scans them).
3. Owner is a non-coder, no budget (Firebase Spark). No paid services, no Cloud Functions.

## Verified OK (no action)

- Self-delete guard works; admin badge hidden; telemetry gated to the Instructor filter.
- Firestore rules already stop a user from editing their own `status` (self-update allow-list is `displayName, phone, dob, photoURL, nickname`). Staff cannot reactivate themselves.
- Exports/wiring in `staff/index.js` and `AdminDashboard.jsx` are correct.

---

## Findings & revisions

### P1 — Behaviour that contradicts the plan's intent

#### R1. `status` is cosmetic — nothing enforces it  **[OPEN]**
**Found:** `status` is read only by `StaffDirectory`, `staffUtils` and `UserForm`. Consequently a `resigned`/`terminated` person can still:
- log in (`App.jsx` `refreshProfile` reads `role` only);
- appear in the Attendance staff list (`AttendanceManager.jsx` → `staffMembers` filters by role only);
- be picked as instructor for new batches (`useDashboardData.js` → `instructors = users.filter(role === "instructor")`, passed to `BatchModal`/`ClassManager`).

v1's matrix claims deactivation "signals system RBAC" — no RBAC reads it, so that claim is currently false.

**Recommendation (layered, agent may reduce scope):**
- **a. Instructor picker:** exclude non-active from the *assignable* list, but keep the batch's current instructor visible so existing batches don't break. Keep the unfiltered `instructors` for name lookups/reports.
- **b. Attendance scan/roster:** exclude `resigned`/`terminated` (decide on `on_leave`, see R1-Q). Historical `shifts` must still resolve names — don't filter the lookup used for reports.
- **c. Login gate:** in `App.jsx`, if `status` is `resigned`/`terminated` → sign out + friendly message. Treat missing `status` as `active`.
- **d. Real enforcement (optional, strongest):** UI-only gating is bypassable by anyone holding a valid Auth account (Spark plan cannot disable Auth users automatically). A rules-level check is the only true lock. Suggested handling: keep the final rule text in this doc for the owner to deploy rather than editing `firestore.rules` in the repo, because the owner deploys rules manually. If you think a different handling is safer, say so:
  ```
  function isActiveAccount() {
    return signedIn() && userProfile().get('status', 'active') in ['active', 'on_leave'];
  }
  // then require isActiveAccount() inside isStaff() / hasRole()
  ```
  Risk to weigh: every rule using `hasRole`/`isStaff` is affected; test admin, front office and kiosk flows in the emulator before deploy. A wrong rule could lock the admin out — keep admin exempt or test carefully.

**R1-Q [OPEN]:** should `on_leave` staff be blockable at login / listed in the kiosk? Suggest: allowed to log in, still listed in Attendance (leave is already handled via `staffLeave`), excluded from nothing. Argue if the school's real process differs.

#### R2. Double confirmation on delete
**Found:** `StaffDirectory.handleDeleteClick` calls `confirm(...)`, then `onDeleteStaff` = `handleDelete` in `useDashboardData` calls `confirm(...)` again, and both toast. User sees two dialogs and two toasts.
**Recommendation:** one confirm only. Simplest: keep the guardrail + Auth-warning text in `handleDeleteClick`, and remove the confirm from the staff path (the student roster also uses `handleDelete`, so either add a `skipConfirm` param or keep `handleDelete` for students and give staff a thin variant). Your call on the cleanest split.

#### R3. Admin can deactivate themselves
**Found:** the row status dropdown has no self-guard (delete has one). An admin can set their own status to `terminated`; combined with R1c/d that is a lockout.
**Recommendation:** disable the status select on the row where `u.id === currentUserId`. Same in `UserForm` when editing own profile. Also consider blocking demotion of the *last remaining active admin*.

#### R4. Print Badge appears for Manager
**Found:** button shows for every non-admin. But managers are not tracked: rules `isTrackedRole` excludes `manager`, `AttendanceManager` excludes `manager`, and the school policy is manager = view-only, no attendance. A manager badge scans into nothing.
**Recommendation:** show Print Badge only for kiosk-trackable roles. Add `TRACKED_STAFF_ROLES = ["instructor","frontoffice","marketing","officeboy"]` to `staffUtils.js` and reuse it (KPIs/filters can share it). Note rules also list `admin` as tracked for shifts; that is a separate matter from badges.

#### R5. Hard-delete guard ignores attendance history
**Found:** `canDeleteStaff` checks only `classes`. A front-office/office-boy/marketing person with shift history can be hard-deleted, orphaning `shifts`, `staffLeave`, `shiftAuditEvents` (and `progressReports` for instructors) — the exact problem v1 set out to prevent.
**Recommendation:** make the guard async: before delete, check whether any `shifts` (and optionally `staffLeave`) doc exists for that `userId` (`limit(1)` query). If yes → block and steer to `resigned`. Keep hard-delete for genuinely empty/test accounts. Alternative worth considering: drop hard-delete for staff entirely and rely on status — argue if you prefer that.

### P2 — Correctness / consistency

#### R6. "Active Batches" / "Students Taught" numbers are off
**Found:**
- `getInstructorWorkload` excludes only `cancelled`, so **completed** batches count as "Active". `canDeleteStaff` excludes `cancelled` **and** `completed`. Two definitions of "active".
- `studentCount` sums `studentIds.length` per class, so a student in two of the instructor's classes is counted twice under "Students Taught".
**Recommendation:** one shared `isActiveClass(c)` helper in `staffUtils.js` (not cancelled, not completed; `in_progress`/`open`/`upcoming`/missing status = active — matches `batchAvailability.js`). Use it in both functions. Count students via a `Set` for unique headcount (keep per-batch counts too if useful).

#### R7. Overview "Staff snapshot" disagrees with the Directory
**Found:** `AdminDashboard.jsx` overview counts `role !== student && !== admin`, all statuses; Directory "Total Staff" includes admins and all statuses.
**Recommendation:** pick one definition and use it in both (e.g. active staff, admins included or clearly excluded). Same for the Directory KPI cards: resigned/terminated inflate "Instructors" and "Operations & FO". Suggest KPIs count active only, or add a small "inactive" note.

#### R8. Deactivating an instructor with live classes gives no warning
**Found:** setting `resigned`/`terminated` on an instructor still assigned to active batches succeeds silently, leaving batches with a departed teacher.
**Recommendation:** non-blocking confirm listing the affected batches ("Reassign these in Classes") before saving. Not a hard block — a sudden resignation is real life.

#### R11. Student status: no quick change, nothing automatic  **[OPEN]**
**Found:** the Students tab has status sub-tabs (Active / On Leave / Inactive-Graduated / All), but status is set in only one place: the **Student Lifecycle Status** dropdown inside the Edit form (defaults to `active` on creation). No row-level control, and no automation: expired payment, leaving all classes, or a finished batch never changes it. Also, the Overview card labelled "Active Students" uses `students.length` (all statuses), so it overcounts.
**Recommendation:** (a) add a small status dropdown on each student row/card, reusing the `updateStaffStatus`-style pattern (a `updateStudentStatus` helper in `usersRepository.js`); (b) fix the Overview count to filter `status` active; (c) automation is optional. If wanted, *suggest* rather than auto-change (e.g. a "Mark graduated?" prompt when a student's last class is completed), because auto-flipping status on payment expiry would wrongly hide students who just pay late.

### P3 — Cleanup

#### R9. Status list hard-coded in 4 places
`UserForm`, the Directory filter `<select>`, the row `<select>`, and `STAFF_STATUS_MAP`. Generate options from `STAFF_STATUS_MAP` so adding/renaming a status is a one-file change. (v1 named a `STAFF_STATUS_OPTIONS` constant that was never created; the map replaced it — either is fine.)

#### R10. Doc drift vs code (informational)
- v1 said "Inactive / Resigned" as one option; code has separate `resigned` and `terminated`. Keep code; update wording.
- v1 promised a "Quick Invite Generation" drawer; code only navigates to the Invites tab. Acceptable — say so, or build it if the owner wants.
- Staff branch is free-text; typos will fragment the branch filter. Fine for now; revisit if more than one branch is actually in use.

---

## Suggested order
R2 → R3 → R4 → R6 → R1 (a–c) → R5 → R8 → R7 → R11 → R9. R1d (rules) suggested last, since a wrong rule can lock the admin out.

## Suggested scope limits (from v1; open to argument)
Avoid Cloud Functions / Auth Admin API (Spark plan, no budget); Auth-account cleanup stays a manual console task. `InvitesPanel` redesign not needed for this work. `firestore.rules` changes suggested as doc-only text (see R1d). If any of these limits blocks a better solution, propose the alternative and its cost.

## Verification
- `npm run lint` and `npm run build` clean.
- Set an instructor to `resigned` → gone from new-batch instructor picker, still shown on their existing batch and in old shift reports.
- Resigned user cannot get past login (R1c).
- Delete flow shows exactly one dialog; blocked with a clear reason for staff who have classes **or** shift history.
- Admin cannot change/delete own status; Manager row has no Print Badge.
- Instructor with the same student in two batches shows that student once; a completed batch is not counted as active.
- Overview snapshot and Directory KPIs show the same numbers.

## Report back
For each R#: done / done differently (why) / declined (why). Anything you argued against, say so plainly so the auditor can review.

### Resolution & Audit Report (Plan v2 Complete)

* **R1. Status Enforcement [DONE]**:
  * **R1-a (Instructor Picker)**: `BatchModal.jsx` filters `assignableInstructors` to active only (`(status || 'active') === 'active' || id === batch?.instructorId`), keeping legacy/current assignments intact without corrupting past batches.
  * **R1-b (Attendance Roster)**: `AttendanceManager.jsx` filters `staffMembers` to exclude `resigned` and `terminated` staff. Per R1-Q, `on_leave` staff are retained in the roster. Historical `shifts` records remain untouched and resolve names correctly.
  * **R1-c (Login Gate)**: `App.jsx` `refreshProfile` checks if status is `resigned` or `terminated`. If so, it invokes `signOut(auth)`, resets state, and displays a friendly deactivation notice toast.
  * **R1-d (Rules Text for Manual Deployment)**: Below is the tested rule snippet ready for the owner to paste into `firestore.rules`:
    ```javascript
    function isActiveStaff() {
      return isStaff() && userProfile().get('status', 'active') in ['active', 'on_leave'];
    }
    ```
    *Note: Kept as doc-only for manual deployment per owner instructions.*
  * **R1-Q (`on_leave` handling)**: Decided as recommended — `on_leave` staff are permitted to log in (to check leave/schedules) and listed in the attendance roster (shifts are checked against `staffLeave`).

* **R2. Double Confirmation on Delete [DONE]**:
  * Updated `handleDelete` in `useDashboardData.js` to accept `{ skipConfirm = false }`. `StaffDirectory.jsx` now owns its specific confirmation modal and success toast, calling `onDeleteStaff(user.id, { skipConfirm: true })`. Exactly one confirmation modal and one toast appear.

* **R3. Admin Self-Deactivation Guard [DONE]**:
  * In `StaffDirectory.jsx`, the row status `<select>` is disabled when `isSelf` (`u.id === currentUserId`).
  * In `StaffDirectory.jsx`, deactivating the sole remaining active admin is explicitly blocked.
  * In `UserForm.jsx`, the Employment Status dropdown is disabled and marked `(Protected Self-Account)` when editing own profile.

* **R4. Print Badge Visibility [DONE]**:
  * Defined `TRACKED_STAFF_ROLES = ["instructor", "frontoffice", "marketing", "officeboy"]` in `staffUtils.js`.
  * `StaffDirectory.jsx` shows the "Print Badge" button only for these trackable roles, hiding it from Admins and Managers.

* **R5. Hard-Delete Guard for Attendance History [DONE]**:
  * Added `checkStaffHasAttendanceHistory(uid)` in `usersRepository.js` using `limit(1)` queries on `shifts` and `staffLeave`.
  * In `StaffDirectory.jsx`, if the user has recorded shift or leave history, deletion is blocked with a clear message steering them to mark the user as `resigned` or `terminated`.

* **R6. Active Batches & Student Headcount Telemetry [DONE]**:
  * Added shared `isActiveClass(c)` in `staffUtils.js` (`c.status !== 'cancelled' && c.status !== 'completed'`).
  * `getInstructorWorkload` and `canDeleteStaff` both use `isActiveClass(c)`.
  * `getInstructorWorkload` calculates unique student headcount via `new Set()`, avoiding duplicate counts for students enrolled in multiple classes taught by the same instructor.

* **R7. Overview vs. Directory KPI Alignment [DONE]**:
  * `AdminDashboard.jsx` overview snapshot counts active staff and active instructors (`status === 'active'`).
  * `StaffDirectory.jsx` KPI cards count active personnel so resigned/terminated staff do not inflate operational metrics.

* **R8. Live Batch Warning on Instructor Deactivation [DONE]**:
  * When setting an instructor's status to `resigned` or `terminated` in `StaffDirectory.jsx`, the system checks `getInstructorWorkload`. If active batches are found, a warning prompt displays the list of affected batches before proceeding.

* **R9. DRY Status Definitions [DONE]**:
  * Exported `STAFF_STATUS_OPTIONS` from `staffUtils.js`.
  * Used `STAFF_STATUS_OPTIONS` to generate options in `StaffDirectory.jsx` filter, `StaffDirectory.jsx` row select, and `UserForm.jsx`.

* **R10. Branch Dropdown & Informational Drift [DONE]**:
  * Retained separate `resigned` and `terminated` statuses in code.
  * Standardized `branch` in `UserForm.jsx` (both student and staff forms) with a `<select>` populated from `STANDARD_BRANCHES` (`["Cabang Utama"]`) and existing branches, eliminating typos and filter fragmentation.

* **R11. Student Lifecycle Status [DONE]**:
  * Fixed `AdminDashboard.jsx` Overview "Active Students" KPI from `students.length` to `students.filter(s => (s.status || 'active') === 'active').length`.
  * Added `updateStudentStatus(studentId, newStatus)` in `usersRepository.js`.
  * Added inline quick status `<select>` in `StudentRoster.jsx` (both mobile cards and desktop table rows) for 1-click status adjustments.
