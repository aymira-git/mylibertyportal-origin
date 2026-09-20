# Reports & Attendance System Modernization (revision 6, 2026-09-20)

> **How to read this file.** This revision follows Kifry's latest answers (below) and a re-check of the zip. Anything marked *Audit note* is Claude's reading of the code. Claude is AI and can make mistakes, so please re-check each note against the real files before acting on it. The executing agent is welcome to disagree, reorder, or counter-propose; a short line of reasoning under the item helps Kifry follow along. Kifry keeps the final say on product intent.

## Current direction (Kifry's decisions, open to challenge)

**Goal:** simplify how people reach things, while keeping every existing ability.

1. The **Kiosk scanner** launches from the **top of the sidebar** for the three roles that scan: **Admin, Front Office and Instructor**. All three are treated the same way.
2. The **Attendance tab is replaced by that kiosk button** (Admin's "Attendance" tab and Instructor's "Attendance & Kiosk" tab go away; Front Office gets none).
3. **Everything else about attendance and reports lives in one place: the Reports tab.**
4. **Today's student check-ins** (in Reports): Front Office sees **all students**, so Admin and Front Office share the daily load; Instructors see **their own students** only.
5. **Front Office and Instructor each see their own clock-in / clock-out log** in Reports. For Instructors it connects to their punctuality and analytics.
6. The **class photo tool stays with the Instructor's kiosk**, inside the kiosk view and for Instructors only.

**Auditor's take:** this fits the goal well and avoids the Front Office permission problem (in `firestore.rules`, Front Office has no read access to other people's `shifts` / `staffLeave`, though each person can read their own). Two things to carry over so no ability gets lost by accident:

- *Audit note:* `AttendanceManager` is more than a list. It is where Admin corrects or deletes a shift (`ShiftAdjustmentModal`), logs or deletes leave (`StaffLeaveModal`), reviews auto-closed shifts, spots stale and duplicate-open shifts, and sees the at-a-glance counts. Both modals are imported nowhere else, and the rules make these actions Admin-only. **Current stance:** move them into **Reports → Staff Duty Logs**, shown to Admin only, reusing the existing modals.
- *Audit note:* the Instructor "Attendance & Kiosk" tab also holds **`ClassPhotoShare`** (class photo to WhatsApp), which is not attendance. Kifry's decision is to keep it inside the Instructor's kiosk view (see sections 1 and 2).

## Where everything lives after this change

| Place | What it holds | Who |
|-------|---------------|-----|
| Sidebar top: Kiosk button | Full-screen scanner; for Instructors the view also holds the class photo tool | Admin (staff + students), Front Office (students only), Instructor (students only, plus class photo) |
| Reports → **Today's Check-ins** (new) | Live list of today's student scans, plus who is expected but not yet in | Admin, Front Office (all students, default sub-tab), Manager (view), Instructor (own students) |
| Reports → **Staff Duty Logs** | History + CSV; for Admin also live counts, shift corrections, leave, review of auto-closed | Admin (full, everyone), Manager (view, everyone), Instructor (own log + punctuality), Front Office (own log) |
| Reports → Learner Progress / Admissions / Instructor Punctuality | Analytics | Per role, see section 5 |

Manager has no kiosk button (view-only, consistent with the earlier attendance plan).

## Proposed changes

### 1. Kiosk in the sidebar (Admin, Front Office, Instructor)

- `DashboardShell` and `MobileDashboardShell` both accept `extraSidebarContent`, and `FrontOfficeDashboard` already uses it.
- *Audit note:* Front Office runs a full-screen "reception mode" inside its own component (`receptionMode` state plus a `?action=attendance` check). Admin opens the kiosk as an overlay inside `AttendanceManager`, and Instructor shows it inside a tab. One small shared piece (for example under `src/features/attendance/`, taking `title` and `studentsOnly` / `staffOnly`) used by all three dashboards would keep a single copy. Admin uses the unified kiosk (`staffOnly={false}`); Front Office and Instructor use `studentsOnly`. The launcher could accept an optional extra-content slot so the Instructor passes `<ClassPhotoShare />` and the other two roles pass nothing.
- Worth checking on a phone: instructors likely scan from a phone, so the button needs to be easy to reach in the mobile shell.
- *Audit note:* `/?action=attendance` is a PWA home-screen shortcut (`vite.config.js`) and currently opens Front Office reception mode and the Instructor kiosk tab. It could open the kiosk overlay for all three roles.
- The Instructor Overview has a "Scan Attendance" quick action that calls `onNavigate("kiosk")`; it would open the overlay instead.

### 2. Remove the Admin and Instructor kiosk/attendance tabs

- **Admin:** delete the `kiosk` tab ("Attendance") in `AdminDashboard.jsx`, after section 3 has a new home for its actions.
- **Instructor:** delete the `kiosk` tab ("Attendance & Kiosk") in `InstructorDashboard.jsx`.
  - `ClassPhotoShare` moves into the Instructor's kiosk view, below the scanner, as it sits today (same `max-w-xl` column). Other roles keep their kiosk view as it is.
  - The PWA shortcut `/?action=class-photo` currently lands on that same tab, so it could open the kiosk view and scroll to the photo tool; `/?action=attendance` opens the same view at the scanner.
  - *Audit note:* the scanner only starts after the user taps start (`kioskScanning`), while the photo tool uses a file input with `capture="environment"` (the phone's own camera app). On some phones the camera app can misbehave while the scanner holds the camera, so a quick phone test of taking a photo before and after scanning is worth doing. If it misbehaves, stopping the scanner when the photo button is tapped is one option, or the agent may prefer a small tab of its own.
- Tab icons and categories in `tabUtils.js` are matched by name, so removal should not need changes there. The mobile bottom bar shows the first four tabs, so its order will shift; worth a look.
- Front Office has no such tab today, so nothing changes there.

### 3. Reports → Staff Duty Logs (absorbs the useful parts of AttendanceManager)

- Keep the sub-tab as is, so Manager and the Instructor default tab (`"staff"`) keep working.
- **Own log for Front Office and Instructor.**
  - *Audit note:* the rules let a person read shifts where `userId` equals their own uid, and Front Office is a tracked role (Admin scans their badge), so a Front Office "My duty log" needs no rules change. `fetchStaffShifts(false, since)` already filters by the signed-in uid, and the `userId` + `clockIn` index exists in `firestore.indexes.json`. Today the sub-tab is hidden for Front Office (`!isFrontOffice`) and its default sub-tab is `"students"`; both would change. The own-log view carries no edit or leave buttons.
  - **Instructor and punctuality.** *Audit note:* each shift already stores `punctualityStatus` and `minutesEarlyOrLate` from the moment of clock-in (`shiftsRepository.js`), so the log could show per-shift punctuality, with the monthly score from `computeMonthlyPunctuality` as a summary above it. Whether that becomes one combined "My duty & punctuality" view or stays as two sub-tabs (Staff Duty and Instructor Punctuality) is open for the agent to weigh. Front Office has no class schedule, so a punctuality score probably does not apply to them; the log alone seems enough (worth verifying).
  - Own leave (`staffLeave` is readable by its owner) could appear in the same log as an optional extra.
- **Admin-only actions:** correction and delete via `ShiftAdjustmentModal`, leave via `StaffLeaveModal`, review of auto-closed shifts.
  - Admin and Manager both pass `isAdminView` today, so the component probably needs a `role` (or `canEdit`) prop to show write buttons only to Admin. Rules already reject Manager writes; the UI would simply avoid offering them.
- **Live counts.** *Audit note:* Reports loads shifts once through a date window (`fetchStaffShifts`), while `AttendanceManager` listens live to the entire `shifts` collection, whose cost grows every month. A middle path: keep the windowed history fetch and add a small live listener for still-open shifts only (`clockOut == null`, a handful of documents) to drive "on duty now" and stale counts. Agent may propose something simpler, such as a refresh button.
- **Leave** (`staffLeave`, small collection) can be read alongside so leave shows as leave rather than absence.
- **Branded CSV.** *Audit note:* `exportTableCSV(filename, headers, rows)` writes headers as row 1. A title line above them makes Sheets and Excel treat the title as the header, which hurts sorting and filters, and the helper is shared by other exports. Ideas: an optional `meta` argument (off by default), branding in the filename only, or a metadata block below the data. Filenames such as `MYLIBERTY-Staff-Attendance-YYYY-MM-DD.csv` look fine.
- *Audit note:* the current exports use the full arrays and ignore on-screen search and filters. Exporting what is on screen (or labelling it clearly) avoids surprises.
- **Branch filter.** Shift documents carry no `branch`; staff `users` docs do (default `"Cabang Utama"`). `fetchStaffShifts` already reads `users` for admins, so it could return branch alongside; `getDistinctStaffBranches` in `staffUtils.js` is reusable.
- **Date presets.** Reports already has a Historical Horizon dropdown (30d, 90d, 12 months, all). Adding 7 days (and possibly Today) may be enough.
- *Audit note:* the old `dateFilter` compared `clockIn.startsWith("YYYY-MM-DD")` on a UTC string, so a 06:30 WITA clock-in lands on the previous day. Any "Today" logic moved over is better computed with WITA day boundaries.

### 4. Reports → Today's Check-ins (new sub-tab)

- **Purpose:** during the day, Admin, Front Office and Instructors see who has scanned in and who is expected but has not.
- **Data:** student scans in `attendance` (fields: `userId`, `displayName`, `role`, `timestamp` ISO string, `method`). A live listener limited to today (`timestamp >= start of today in WITA`) reads only a small number of documents. `attendance` is readable by all staff under the rules.
- **Instructor scope:** *Audit note:* for Instructors, `fetchStudentProgressData` already limits `classes` to their own, but `attendance` comes back for everyone, so the view would filter scans to students in the instructor's own classes on the client.
- **"Expected today":** *Audit note:* `getTodaysClasses(classes)` in `attendance/punctuality.js` picks classes by weekday, and each class has `studentIds`. Comparing those students with today's scans gives an "expected but not yet in" list. Scan records carry no class, so a student enrolled in two classes is hard to attribute to one; showing the class list next to the name is one way to keep it honest. The helper uses the device's weekday, which is fine on a WITA reception PC but is worth a WITA-aware check.
- **Active students only** (`isActiveStudent`), so graduated or paused students stay off the missing list.
- **Sharing the load:** Front Office could work the "not yet in" list. A one-tap WhatsApp follow-up (student phone exists; `normalizeWhatsAppNumber` is in `finance/receiptMessages.js`) is an idea only, left to the agent and Kifry.
- Front Office default sub-tab becomes this one; Admin may prefer Staff Duty as default.

### 5. Reports → Learner Progress, Admissions, Instructor Punctuality

- **At-Risk flag (Learner Progress).** *Audit note:* the list currently includes every `role == "student"` record plus archived ones rebuilt from old attendance, and the KPI says "All statuses". Suggested definition to refine: student is `active`, not archived, joined more than 14 days ago (`joinedDate` exists), and has no check-in in the last 14 WITA days. "0 check-ins" then means none in the loaded window, so the label could say so. The Historical Horizon starts at 30 days, which covers 14; a dedicated 14-day query would make the flag independent of the dropdown. School breaks and once-a-week classes can make 14 days normal, so a configurable threshold is worth weighing.
- Health filter (All, At Risk, Regular) and Branch filter as originally proposed. Student `branch` is already on the user document (`UserForm`, `applicationsRepository`); older records could be treated as `"Cabang Utama"`.
- **Admissions & Lead Velocity.** `fetchAdmissionsReportData(since)` reading `applications` and `classes`.
  - *Audit note:* `submittedAt` is an ISO string (`FormSync.gs`), so `where("submittedAt", ">=", since)` should work; records lacking it would be skipped silently.
  - Statuses in use are `pending`, `approved`, `rejected`, and approval creates the student in the same transaction, so "Enrolled" has no status of its own. One candidate definition: approved and the application's `studentId` currently appears in a class's `studentIds`. Please pick or propose one and show it on screen. Including Rejected lets the funnel add up to total inquiries.
  - Seat fill: `getBatchAvailability(cls)` in `classes/batchAvailability.js` already computes capacity (default 15) and seats; it is not exported from `classes/index.js` yet. Reusing it keeps numbers consistent with the Batches screen.
  - Group months in WITA. `applications` are readable by admin, front office, manager and marketing, so this sub-tab fits Admin, Manager and Front Office.
- **Instructor Punctuality.** The sub-tab and `computeMonthlyPunctuality` already exist; the work is mostly filename and branding. `fetchInstructorAnalyticsData` loads all shifts for admin and could be limited to the selected month plus open shifts, as an optional improvement.
- **Sub-tab visibility (starting suggestion):**
  - Admin: all sub-tabs.
  - Manager: all sub-tabs, view only.
  - Front Office: Today's Check-ins (all students, default), My Duty Log (own), Learner Progress, Admissions.
  - Instructor: Today's Check-ins (own students), My Duty Log and Punctuality (own), Learner Progress (own cohorts).
  - Every role needs an initial sub-tab that exists for it, so nobody lands on a blank page.

### 6. Housekeeping

- `docs/` holds this file and `Reports_and_Attendance_Modernization_Implementation_Plan.md`. They overlap and differ (the sibling still describes the Attendance-tab merge and staff clock-ins at Front Office, which this direction replaces). Merging into one file gives future sessions a single source; agent picks which to keep.
- After the move, `AttendanceManager.jsx` may be empty of purpose; deleting or trimming it is the agent's call. Its listener over the whole `shifts` collection goes away with it.

## Verification Plan

**Automated:** `npm run lint` with zero errors or warnings; `npm run build` completes. If rules or indexes change, deploy them and note it in the hand-off.

**Per role (watch the browser console for `permission-denied`):**
1. **Admin:** sidebar kiosk opens on desktop and mobile and scans staff and students; no Attendance tab; in Reports → Staff Duty Logs, correcting a shift and logging leave both work; CSV opens cleanly in Sheets with headers on row 1.
2. **Manager:** Reports visible, including Staff Duty Logs; no kiosk and no write buttons.
3. **Front Office:** kiosk works as before; Reports opens on Today's Check-ins showing all students; a scan made at the kiosk appears without reload; My Duty Log lists only their own clock-ins and outs.
4. **Instructor:** sidebar kiosk works on a phone; Overview "Scan Attendance" opens it; the class photo tool sits inside the kiosk view and works on a phone before and after scanning, and `/?action=class-photo` lands on it; Reports opens on a valid sub-tab, Today's Check-ins shows only their own students, and My Duty Log shows only their own shifts with punctuality; `/?action=attendance` opens the scanner.

**Data checks:**
- A student scanned at 06:30 WITA appears under Today; a graduated student stays off the "expected" list.
- A student who joined 3 days ago, a graduated student, and an archived student stay off the At Risk list; a genuinely inactive active student appears.
- Admissions: Pending + Approved + Rejected equals total inquiries in the period; seat fill matches the Available Batches screen.
- Exported CSV row counts match what is on screen.

## Suggested order (agent may reorder)

1. Shared kiosk launcher and sidebar buttons for Admin, Front Office, Instructor (check mobile).
2. Move Admin actions into Reports → Staff Duty Logs; relocate `ClassPhotoShare`; then remove the Admin and Instructor tabs.
3. Today's Check-ins sub-tab and Front Office default.
4. Branded CSV approach, branch filter, presets.
5. At-Risk, Admissions, role-aware tabs.
6. Optional items (windowing, doc merge), then the verification plan.
