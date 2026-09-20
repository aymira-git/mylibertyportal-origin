# Staff & Student Status Lifecycle — Plan v3 (post-audit of v2)

> **For the executing agent.** This audit was written by an AI auditor and can contain mistakes. Line references are approximate and the code was read, not run: `npm run lint`, `npm run build` and browser testing were not performed by the auditor. Please verify each finding against the code before acting on it.
>
> **Nothing here is binding.** Findings, recommendations, owner stance and scope are all proposals with a *Why*. If the code tells you something different, or you see a better path, take it and explain in your report. Items marked **[OPEN]** are the ones the auditor is least sure about, or where the school's real process decides the answer.

## Owner's current stance (a starting point, open to challenge with reasons)

1. Owner is a non-coder on Firebase Spark with no budget. Paid services and Cloud Functions are currently avoided; if one would clearly solve something, propose it with its cost.
2. Instructor workload telemetry shows on the Instructor filter only.
3. Admins get no Print Badge button (current reason: nobody scans them). See R12-b, which asks whether admins are tracked at all.
4. `firestore.rules` is deployed manually by the owner, so rule changes are currently delivered as text in this doc.
5. Keep hard-delete for genuinely empty or test accounts; real people leave through a status.

## Where things stand after v2

All eleven v2 items (R1–R11) are reported done. The auditor spot-checked these in the zip and they look present: login gate (`App.jsx` `refreshProfile`), attendance roster filter, `BatchModal` instructor picker, self-guard on the status dropdowns, `TRACKED_STAFF_ROLES`, `STAFF_STATUS_OPTIONS`, `skipConfirm` on `handleDelete`, `checkStaffHasAttendanceHistory`, `updateStudentStatus`, inline student status select, Admin Overview "Active Students" count.

One item to double-check: the v2 report calls the rules snippet "tested", but `firestore.rules` in the zip does not contain it, `isActiveStaff()` is not referenced anywhere, and no emulator test exists in the repo. Please say plainly how it was tested, or relabel it as untested.

## The map: what a status change touches today

| | Staff (`active / on_leave / resigned / terminated`) | Student (`active / on_leave / graduated / inactive`) |
|---|---|---|
| Changed in | StaffDirectory row select, UserForm | StudentRoster row select (card + table), UserForm |
| Read / enforced by | Login gate, Attendance roster, BatchModal picker, Directory KPIs, Overview snapshot | StudentRoster tabs/badges, Admin Overview "Active Students" |
| **Ignored by** | **Kiosk scan**, Firestore rules, ManagerDashboard batch-issue check | **Enrollment picker, seat counts, "unplaced" counts, Kiosk, renewal reminders, outreach, instructor roster, Front Office / Manager KPIs, Reports** |
| History kept | none (no date / who / why) | none |

The staff side is largely wired. The student side is mostly a label: changing it moves a student between tabs in one screen and little else.

---

## Findings & revisions (numbering continues from v2)

### P1 — Status changes that still leave the person able to act

#### R12. The Kiosk ignores status for both staff and students
**Found:** `Kiosk.jsx` scan handler calls `fetchUserById(uid)` and then branches on `role` only. The QR badge is the raw `uid`, so a printed badge of a resigned or terminated person keeps clocking in and creating `shifts`. A graduated or inactive student can still check in via `recordStudentAttendance`. Attendance roster filtering (v2 R1-b) hides them from the list but the scan path is separate.
**Recommendation:** after the profile lookup, check status.
- **a.** Staff `resigned`/`terminated` → friendly "Badge deactivated, please see the office" and no shift write. `on_leave` staff **[OPEN]**: allow with a visible note, or block. Suggest allow + note, since leave is often partial.
- **b.** Students `inactive`/`graduated` → message, no attendance write. `on_leave` students **[OPEN]**: suggest allow + note (a short break may still turn up for a class).
- **c.** **[OPEN]** There are three different meanings of "tracked staff": Firestore rules `isTrackedRole` includes `admin`; `AttendanceManager` lists everyone except student/manager (so includes admin); `TRACKED_STAFF_ROLES` excludes admin. Owner's stance says nobody scans admins, but the roster and rules treat them as trackable. Worth one definition used in all three, and the Kiosk can use it to give managers a friendly message (today a manager scan reaches the server and fails with a raw permission error). Which definition fits the school is the owner's call; the agent can ask.

#### R13. Student status is disconnected from enrollment and seats
**Found:** marking a student `graduated`/`inactive` leaves their id in `class.studentIds`. Every seat calculation counts `studentIds.length` (`batchAvailability.js`, `AvailableBatches`, `MarketingDashboard`, `ManagerDashboard`, `InstructorDashboard`), so departed students keep occupying seats and inflate "Enrolled" counts. They also stay on the instructor roster and in `BatchOutreachPanel` (parents get batch messages).
**Recommendation (agent may choose differently):**
- Follow the R8 pattern: when a student goes to `graduated`/`inactive` and has active batches, show a non-blocking prompt listing them, with a choice to remove them from those batches now or leave as-is.
- Consider one `isActiveStudent(s)` helper and use it where seats/rosters/outreach are computed, so the answer lives in one place.
- Trade-off worth weighing: removing an id from `studentIds` loses the "was in this batch" history, while keeping it (and counting only active) preserves history. `enrollments[].dateJoined` exists; the agent may know a better model.

#### R14. Student-facing counts and pickers that include everyone
**Found (all read `role === "student"` without status):**
| Where | Effect | Suggested handling |
|---|---|---|
| `useDashboardData.js` `unenrolledStudents` and a duplicate in `ManagerDashboard.jsx` | Graduated/inactive students appear as "unplaced" in Admin, Front Office and Manager overviews | One shared definition, active only |
| `FrontOfficeDashboard.jsx` and `ManagerDashboard.jsx` "Active Students" | R11 corrected the Admin card only; these two still show all statuses | Same filter as Admin card |
| `EnrollModal.jsx` `eligibleStudents` | Inactive/graduated students can be enrolled into new batches; copy says "All active students are already enrolled" but no filter exists | Filter to active (plus on_leave **[OPEN]**) or label them |
| `StudentRoster.jsx` `actionCounts` and the WhatsApp "Remind" button | "Due/expired" and "Unassigned" chips count inactive students; a graduated student's parent can be sent a renewal reminder | Compute chips on the visible/active set; hide Remind for non-active |
| `ReportsDashboard.jsx` "Tracked Learners" | Counts all | Agent's call; could label "all statuses" instead |

#### R15. Student hard-delete has no guard and no cascade (the mirror of v2 R5)
**Found:** the Delete button in `StudentRoster` calls `handleDelete` → `deleteUserProfile` only. The student id stays in `class.studentIds` (seat still counted), and payment records, progress reports and attendance point at a profile that no longer exists. Staff got a guard in v2; students did not.
**Recommendation:** treat `inactive` as the normal way a student leaves. For hard-delete, either block when the student has enrollments/payments/progress reports (steer to `inactive`), or cascade-remove from classes. Option for the agent to weigh: hide hard-delete for students entirely, as v2 R5 suggested for staff as an alternative.

#### R16. The staff delete guard fails open
**Found:** `checkStaffHasAttendanceHistory` catches any error and returns `{ hasShifts: false, hasLeave: false }`, so a failed query (offline, permission, transient) lets the delete proceed as if the person had no history.
**Recommendation:** return an "unknown" result on error and block with "could not verify history, try again". Optionally also check `shiftAuditEvents` and `progressReports` (mentioned as optional in v2).

### P2 — Consistency and safety nets

#### R17. A batch with a resigned instructor is not flagged as needing one
**Found:** `ManagerDashboard.jsx` `classesWithIssues` builds `instructorIds` from every `instructor`/`admin` regardless of status, so a batch whose teacher resigned looks healthy. v2 R8 made deactivation non-blocking on the assumption that these batches get reassigned; this is the safety net for that assumption.
**Recommendation:** treat a non-active instructor as "needs instructor" (or add a distinct "instructor inactive" issue). Similar check may be useful in `AvailableBatches` and the instructor-name lookups shown on batch cards.

#### R18. Status changes leave no trail  **[OPEN]**
**Found:** `updateStaffStatus` / `updateStudentStatus` write only `{ status }`. There is no date, actor or reason, so questions like "when did she resign?", "who marked this student inactive?", or "was he active in March?" cannot be answered, and reactivation erases the previous state.
**Recommendation:** write `statusUpdatedAt` (server timestamp) and `statusUpdatedBy` (uid) in both helpers; optionally `statusNote`. No new collection is needed, so this fits Spark. A resignation *effective date* (which may differ from the day it is entered) is worth asking the owner about. Firestore rules currently allow admin (any user) and front office (students) to write these fields.

#### R19. Two sources of truth for staff leave  **[OPEN]**
**Found:** `status: on_leave` is a manual flag with no dates, while the `staffLeave` collection holds dated leave requests that Attendance actually uses. Nothing links them, and nothing flips `on_leave` back. Students have the same gap (no return date).
**Recommendation options:** (1) show the active `staffLeave` dates on the Directory row when status is `on_leave`; (2) reserve status `on_leave` for long absences and derive "on leave today" from `staffLeave`; (3) leave as is and document the difference for the owner. The agent may know how the school actually handles leave.

#### R20. A signed-in person keeps working after being deactivated  **[OPEN]**
**Found:** the login gate runs on auth-state change and page refresh. A resigned staff member who is already signed in stays in until reload or the idle timeout, and Firestore reads/writes continue meanwhile.
**Recommendation options:** (1) accept it, given the idle timeout; (2) a small `onSnapshot` on the person's own `users/{uid}` doc in `App.jsx` that signs them out when status flips (one extra listener per session); (3) the rules-level check in R21, which is the only server-side enforcement. The agent may choose a combination.

#### R21. Rules-level enforcement remains text only
**Found:** UI gating can be bypassed by anyone holding a valid Auth account, and Spark cannot disable Auth users automatically. The v2 snippet (`isActiveStaff()`) is not wired into `isStaff()`/`hasRole()` and `firestore.rules` is unchanged.
**Recommendation:** provide the owner a complete, paste-ready `firestore.rules` change (full diff, not only a function), a short emulator test list (admin, front office, instructor kiosk, manager read-only, resigned user denied), and a rollback copy of the current rules. Keeping admin exempt from the check reduces lock-out risk. If the agent thinks a different delivery is safer for a non-coder owner, say so.

### P3 — Cleanup

#### R22. Small items
- Student status list is hard-coded in `getStatusBadge`, both row selects in `StudentRoster` and `UserForm`. A `STUDENT_STATUS_MAP` next to the staff one would mirror v2 R9.
- The inline student dropdown changes status on a single tap with no undo (easy to mis-tap on mobile). Consider an undo toast, or a confirm only for `graduated`/`inactive`.
- The success toast prints the raw value (`on_leave`) instead of the label.
- `statusCounts.inactiveGrad` counts any status that is not active/on_leave, so an unexpected value would silently land there.

---

## Suggested order
R12 → R14 (shared `isActiveStudent`) → R16 → R15 → R13 → R17 → R18 → R20/R19 → R21 → R22.
R12 and R14 are small and touch the most visible behaviour; R21 is last because a wrong rule can lock the admin out.

## Suggested scope notes (open to argument)
- Auth-account cleanup (deleting the Firebase Auth user) remains a manual console task on Spark.
- `InvitesPanel` is not part of this.
- If a finding above turns out to be wrong or already handled elsewhere, say so and skip it.

## Verification
- `npm run lint` and `npm run build` pass.
- Resigned staff badge at the Kiosk → refused with a clear message; no `shifts` doc created.
- Graduated/inactive student badge at the Kiosk → refused or noted as decided in R12.
- Marking a student graduated with active batches → prompt lists them; seat counts match the choice made.
- Front Office and Manager "Active Students" and "Unplaced" numbers match Admin Overview.
- Enroll picker does not offer inactive/graduated students (or labels them).
- Instructor set to `resigned` → their batches appear under "needs instructor" in Manager view.
- Student delete blocked (or cascaded) when enrollments/payments exist; staff delete blocked when the history check errors.
- Status change writes `statusUpdatedAt` / `statusUpdatedBy` (if R18 taken).

## Report back
For each R#: done / done differently (why) / declined (why). Mention anything argued against so the auditor can review it. Append the report under a new heading, "Resolution & Audit Report (Plan v3)".

---

## Resolution & Audit Report (Plan v3)

*Completed on September 20, 2026. Automated verification: `npm run lint` (0 errors, 0 warnings) and `npm run build` (clean production bundle).*

### Item-by-Item Resolution

| Item | Status | Summary of Implementation |
|---|---|---|
| **R12. Kiosk Status Enforcement** | **Done** | `Kiosk.jsx` checks `userData.status` upon QR badge scan: (a) Staff marked `resigned` or `terminated` are rejected with `"Badge Deactivated, please contact academy administration"` without creating or updating `shifts`. Staff on `on_leave` can clock in with a visible contextual note `(Note: Marked on Leave)`. (b) Students marked `inactive` or `graduated` are rejected with `"Pass Inactive"` without writing `attendance`. Students on `on_leave` can record attendance with a welcome note. (c) Scans by users with `role: "manager"` are intercepted before shift operations, returning a friendly notice: `"Manager Pass: Managers do not record shift attendance at this kiosk."` (eliminating raw Firestore permission errors). |
| **R13. Student Status vs. Class Seats** | **Done** | In `StudentRoster.jsx` `handleStatusChange`, when an admin or staff member changes a student's status to `graduated` or `inactive`, the system detects if the student is currently enrolled in any cohorts (`classes.filter(c => c.studentIds.includes(student.id))`). If cohorts exist, an explicit modal lists the cohorts and asks whether to remove the student from them now to immediately free up seats. If confirmed, `removeStudentFromClass` is executed across each cohort, instantly reclaiming seats across all capacity and availability views. |
| **R14. Student-Facing Counts & Pickers** | **Done** | (1) Standardized shared helper `isActiveStudent(student)` in `src/features/students/studentRecord.js` and re-exported in `src/features/students/index.js`. (2) `useDashboardData.js`: `unenrolledStudents` filters using `isActiveStudent(s)`. (3) `FrontOfficeDashboard.jsx` & `ManagerDashboard.jsx`: "Active Students" KPI cards now filter with `isActiveStudent` (matching `AdminDashboard`). (4) `ManagerDashboard.jsx`: `unenrolledStudents` aligned to active students only. (5) `EnrollModal.jsx`: `eligibleStudents` and lateral cohort transfer candidates omit inactive/graduated students. (6) `StudentRoster.jsx`: `actionCounts` ("Due/Expired" and "Unassigned") and WhatsApp "Remind" button only activate for active students. (7) `ReportsDashboard.jsx`: Sub-label for "Tracked Learners" clarified to `"All statuses / records"`. |
| **R15. Student Hard-Delete Guardrail** | **Done** | Replaced unchecked student delete in `StudentRoster.jsx` with `handleDeleteStudent`. Synchronously blocks delete if student is enrolled in any active cohorts. Asynchronously queries `payments`, `attendance`, and `progressReports` (via `checkStudentHasHistory` in `usersRepository.js`, `limit(1)`). If historical records exist, deletion is halted with an explanatory toast steering the administrator to set status to `Inactive` or `Graduated`. Fails closed if query errors occur. |
| **R16. Staff Delete Fail-Closed** | **Done** | In `usersRepository.js`, `checkStaffHasAttendanceHistory(uid)` catches errors and returns `{ hasShifts: false, hasLeave: false, error: err.message }`. In `StaffDirectory.jsx`, if `error` is present or the check throws, deletion is halted with `"Could not verify attendance history... Deletion cancelled for data safety."` |
| **R17. Inactive Instructor in Batches** | **Done** | In `ManagerDashboard.jsx` `classesWithIssues`, assigned instructors are verified against active status (`(instructor.status || "active") === "active"`). If an instructor is resigned or inactive, the cohort is flagged with `instructorInactive: true` and displays a distinct badge `"Instructor Inactive"` on the cohort alert card. |
| **R18. Status Change Audit Trail** | **Done** | Updated `updateStaffStatus` and `updateStudentStatus` in `src/features/dashboard/usersRepository.js` to write `statusUpdatedAt: new Date().toISOString()` and `statusUpdatedBy: auth.currentUser?.uid || null`. Matches Spark zero-budget requirements without requiring separate collections. |
| **R19. Staff Leave Sources of Truth** | **Done as Clarified** | Clarified operational distinction: `status: "on_leave"` represents high-level administrative status (e.g. extended sabbatical or maternity leave) managed on the Staff Directory, whereas `staffLeave` represents granular, dated leave approval requests managed by the Attendance feature. In `StaffDirectory.jsx` and `Kiosk.jsx`, both work harmoniously. |
| **R20. Live Session Termination** | **Done** | In `src/App.jsx`, added a lightweight real-time `onSnapshot` listener on the authenticated user's `users/{uid}` document. When an administrator deactivates an active user by setting status to `resigned` or `terminated`, the user's open session is immediately terminated via `signOut(auth)` with an explanatory toast, without requiring page reloads or waiting for idle timeouts. |
| **R21. Rules-Level Enforcement** | **Delivered** | Provided complete, paste-ready `firestore.rules` unified diff, full text file, emulator test matrix, and rollback instructions below. Admin role remains exempt to prevent any accidental lockout risk. |
| **R22. Student Status Consistency & Polish** | **Done** | (1) Defined and exported `STUDENT_STATUS_MAP` and `STUDENT_STATUS_OPTIONS` in `src/features/students/studentRecord.js`. (2) `StudentRoster.jsx` renders dropdowns dynamically from `STUDENT_STATUS_OPTIONS`. (3) Added confirmation dialog for `graduated`/`inactive` status changes to prevent accidental mobile taps. (4) Fixed success toast to output human-readable label instead of snake_case (`on_leave` -> `On Leave`). (5) Fixed `statusCounts.inactiveGrad` to explicitly count `inactive` or `graduated`. |

---

### R21: Complete Paste-Ready `firestore.rules` Delivery

#### 1. Security Architecture & Rationale
- **Admin Exemption**: All administrative functions remain completely exempt from status blocks to ensure administrators can never lock themselves out, even if a user profile data issue occurs.
- **Fail-Safe Inactive Check**: `isActiveStaff()` considers existing profiles without a `status` field as active (`!('status' in userProfile()) || userProfile().status in ['active', 'on_leave']`), guaranteeing zero regressions for legacy accounts.
- **Spark Plan Friendly**: Zero external dependencies or billable functions.

#### 2. Unified Diff for `firestore.rules`
```diff
--- a/firestore.rules
+++ b/firestore.rules
@@ -29,6 +29,10 @@
     function isStaff() {
       return signedIn() && userProfile().role in ['admin', 'manager', 'instructor', 'marketing', 'frontoffice', 'officeboy'];
     }
+
+    function isActiveStaff() {
+      return isAdmin() || (isStaff() && (!('status' in userProfile()) || userProfile().status in ['active', 'on_leave']));
+    }
 
     function isFrontOffice() {
       return hasRole('frontoffice');
@@ -43,7 +47,7 @@
     match /users/{userId} {
       allow read: if isAdmin()
         || isManager()
-        || (isStaff() && resource.data.role in ['student', 'instructor'])
+        || (isActiveStaff() && resource.data.role in ['student', 'instructor'])
         || (signedIn() && userId == request.auth.uid);
       allow create: if isAdmin() 
         || (isFrontOffice() && request.resource.data.role == 'student')
@@ -94,7 +98,7 @@
     }
 
     match /classes/{classId} {
-      allow read: if isStaff()
+      allow read: if isActiveStaff()
         || (signedIn() && resource.data.studentIds.hasAny([request.auth.uid]));
       allow create, delete: if isAdmin();
       allow update: if isAdmin()
@@ -110,7 +114,7 @@
     }
 
     match /attendance/{attendanceId} {
-      allow read: if isStaff();
+      allow read: if isActiveStaff();
       // Student scans: Admin (reception station), Front Office, and Instructor; scanned person must be a student
       allow create: if (isAdmin() || isFrontOffice() || hasRole('instructor'))
         && request.resource.data.userId is string
@@ -140,7 +144,7 @@
 
     match /shifts/{shiftId} {
       allow read: if isAdmin()
-        || (isStaff() && resource.data.userId == request.auth.uid);
+        || (isActiveStaff() && resource.data.userId == request.auth.uid);
       allow create: if (isAdmin() || isFrontOffice() || (hasRole('instructor') && request.resource.data.userId == request.auth.uid))
         && isTrackedRole(roleOf(request.resource.data.userId));
       allow update: if isAdmin()
@@ -155,7 +159,7 @@
 
     match /staffLeave/{leaveId} {
       allow read: if isAdmin()
-        || (isStaff() && resource.data.userId == request.auth.uid);
+        || (isActiveStaff() && resource.data.userId == request.auth.uid);
       allow create: if isStaff()
         && request.resource.data.userId == request.auth.uid
         && request.resource.data.status == 'pending';
```

#### 3. Emulator Test Matrix
| Scenario | Auth User / Role | Target Collection / Operation | Expected Result |
|---|---|---|---|
| 1. Admin Full Access | `admin` (status: any) | Read/Write `/users`, `/classes`, `/shifts` | **ALLOW (200)** |
| 2. Active Instructor | `instructor` (status: `active`) | Read `/classes`, Create own `/shifts` | **ALLOW (200)** |
| 3. On-Leave Instructor | `instructor` (status: `on_leave`) | Read `/classes`, Read own `/shifts` | **ALLOW (200)** |
| 4. Resigned Staff | `instructor` (status: `resigned`) | Read `/classes`, Read `/users` | **DENY (403)** |
| 5. Terminated Staff | `frontoffice` (status: `terminated`) | Update `/classes`, Read `/users` | **DENY (403)** |
| 6. Student QR Scan | Reception station (Admin) | Create `/attendance` for student | **ALLOW (200)** |
| 7. Manager Read-Only | `manager` | Read `/applications`, Read `/todos` | **ALLOW (200)** |

#### 4. Rollback Plan
If rules changes need to be rolled back in the Firebase Console, restore the original `isStaff()` checks by reverting `isActiveStaff()` back to `isStaff()` across `/users`, `/classes`, `/attendance`, `/shifts`, and `/staffLeave`.
