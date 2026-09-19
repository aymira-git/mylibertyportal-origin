# Admin Attendance & Staff Kiosk — Implementation Plan v2

**Built for:** Firebase free plan (Spark), no backend server, delivered one numbered step at a time as drop-in files.
**Relationship to v1:** v1's diagnosis is accurate (every claim was checked against the code). Its product direction is kept. This version changes *how* things are built so nothing needs a paid plan.

---

## 1. Decisions locked in

| Topic | Decision |
|---|---|
| School timezone | **WITA** (`Asia/Makassar`, UTC+8), one constant in code |
| Who scans staff badges | **Admin only** (ensures physical presence at the reception station; staff cannot clock in from home) |
| Who scans student badges | **Admin, Front Office, and Instructor** (reception desk under Admin can seamlessly scan students, and instructors can assist when packed) |
| Manager badge scanning | **Parked for future dedicated discussion** (left as-is for now) |
| Shift corrections | Admin only |
| Leave | **Final:** admin logs directly. Staff requests and approval are out of scope (can be added later, see Step 4) |

### Who may scan whom (enforced in `firestore.rules`, not only in the screen)

| Logged-in role | Can scan | Result |
|---|---|---|
| Admin | Staff badges (instructor, front office, marketing, office boy) & Student badges | Creates a shift (staff) OR records student attendance |
| Instructor | Student badges | Records student attendance |
| Front Office | Student badges | Records student attendance |
| Marketing, Office Boy, Student | Nothing | Refused |

*(Manager badge behavior is parked for later discussion and left untouched in this phase).*

### One real person, two accounts (manager who also teaches)

- **Manager account:** view-only, never appears in attendance lists, has no clock-in.
- **Instructor account:** has the badge, gets scanned by admin, appears in shifts, reports and leave.
- Attendance, leave and reports always use the **instructor** account.
- The person shows up twice in the staff directory (once per account); headcounts and on-duty counts only use the instructor one.
- If you later want the two linked on screen, we add a "same person" field. Not needed now.

---

## 2. What changed from v1

| v1 said | v2 does | Why |
|---|---|---|
| Cloud Function turns offline events into shifts | Firestore's built-in offline queue + one unique ID per scan | Cloud Functions require the paid Blaze plan |
| Scheduled job auto-closes stale shifts | No background job. "Stale" is calculated on screen; admin closes it with an audited correction | Nothing to host, nothing to pay |
| Corrections via transaction or backend | One atomic batch write (shift change + audit record together) | Same guarantee, client-only |
| Leave with approval workflow and attachments | Admin logs leave directly, no attachments | Overkill for a small school |
| Possible migration to Firestore `Timestamp` | Keep ISO strings | Existing data and queries already work |
| (not covered) | **New Step 0:** security holes in the rules | See section 3 |

---

## 3. Extra findings (not in v1)

1. **Critical: anyone can make themselves an admin.** In `firestore.rules`, `users` create allows any signed-in person to create *their own* profile with *any* role. Firebase sign-up can be called directly, so a stranger could write `role: "admin"`. Every attendance rule depends on roles, so this is fixed first.
2. **The scan policy exists only in the screen, not in the rules.** `studentsOnly` / `staffOnly` are display settings. Rules currently let *any* staff create a student attendance record, and let any staff update their own shift with no field limits (they could rewrite their own `clockIn`). Step 0 makes the rules match your policy.
3. **Manager is not view-only in the rules today.** Manager can update any shift, with no record of who changed what. (Manager can also create/edit/delete `todos`, the Staff Directives tab. That is outside attendance, so it is left alone unless you say otherwise.)
4. **Manager badge is trackable today.** The kiosk only rejects students, so scanning a manager badge creates a shift.
5. **The reception kiosk runs under an Admin login.** That is the only way the rules allow creating a shift for someone else, so the shared reception device holds full admin power. Kept as-is because it matches your policy; see the optional step at the end.
6. **Offline: the kiosk would look frozen.** `clockIn` waits for the server to confirm; offline, that never arrives. The offline-cache call in `firebase.js` is also the old style and fails when two tabs are open.
7. **Class switch is two separate writes** (clock out, then clock in). If the second fails, the person has no open shift.
8. **Manager dashboard listens to the entire `shifts` collection** and counts every record without `clockOut` as on duty (stale ones included). It also grows in cost every month.

*Correction to my first message:* I said Marketing staff have a clock-in widget. That widget is in `StaffDashboard.jsx`, which the app never displays (Marketing only sees a note saying to use the front desk). It is unused code, removed in Step 5.

---

## 4. Build steps

Each step is delivered as ready-to-drop files. Steps that change `firestore.rules` also need: `firebase deploy --only firestore:rules`.

### Step 0 — Close the security holes (rules + small signup change)
*Executed by a separate agent. The exact rules and deploy order are in section 5.*

- Self-created profile must carry an `inviteId`; the rule checks that invite exists, its email matches the signed-in email, and its role matches the profile role.
- `attendance` (student scans): allowed only for Instructor and Front Office, and only when the scanned user is a student.
- `shifts` create: Admin only, and only for tracked roles (never manager, never student).
- `shifts` update: Admin only may edit times. Manager loses shift write.
- **Done when:** a new account cannot create itself as `admin`; a marketing account cannot record student attendance; a manager badge cannot create a shift.

### Step 1 — One shared definition of "on duty"
- New `shiftStatus.js`: returns `on_duty | stale | auto_closed | corrected | completed`, plus a helper that detects a person having more than one open shift.
- Kiosk rejects manager badges with: "Manager accounts are not tracked. Use your instructor badge."
- Reports stop writing to the database when loaded (remove auto-close-on-read).
- Manager dashboard counts `on_duty` only, and loads the last 60 days plus open shifts instead of everything.
- Kiosk still closes a stale shift at the person's next scan (so nobody is blocked), but marks it `needs_review`.
- **Done when:** a stale shift never shows as "present", and opening Reports changes no data.

### Step 2 — Attendance Manager (read-only), replaces the raw camera tab
- Today at a glance: on duty now, stale/needs review, late today, auto-closed awaiting review, on leave (after Step 4).
- Live presence board with the badges `On duty`, `Stale — review`, `Auto-closed — review`, `Multiple open shifts`.
- Shift table: filters (date range, staff, role, status, punctuality), paginated with the existing pagination hook. Days are cut at WITA midnight.
- "Open kiosk mode" panel: the camera starts only after the button is pressed.
- **Done when:** the Admin tab opens without asking for camera permission and the counts match Reports.

### Step 3 — Audited corrections (admin only)
- `ShiftAdjustmentModal`: correct times, force-close, mark reviewed. Reason code and note are required.
- One `writeBatch`: update the shift **and** add a `shiftAuditEvents` record (before, after, reason, actor, server time).
- Rules: audit events can be created by admin only, never edited or deleted.
- Reason codes: `forgot_clock_out`, `forgot_clock_in`, `wrong_class`, `system_error`, `other`.
- **Done when:** every correction shows who, when, why, before and after.

### Step 4 — Leave (admin logs directly)
- New `staffLeave` collection, separate from `shifts`. Types: `sakit | izin | cuti | dinas_luar`, date range, optional half day, short note. Always recorded on the instructor/staff account, never the manager account.
- Day to day: staff tell admin (WhatsApp, in person). Admin picks the person, type and dates. It is saved as approved immediately.
- What leave does: shows "On leave" on the Attendance Manager, keeps that person out of the no-show list, and appears in reports as leave rather than absence. It does **not** cancel or reassign classes.
- Overlap check when saving; warning (not a block) if a shift already exists on those dates.
- "Absence candidates" are shown only for instructors who had a class that day and have neither a shift nor leave. Other roles have no schedule, so no guessing.
- Documents (doctor's note) stay outside the system; the note field is for a reference only.
- The record already has a `status` field (always `approved` now) and `createdBy`, so a staff-request and approve flow can be added later without changing old data.
- **Done when:** reports separate leave from likely no-shows without creating fake shifts.

### Step 5 — Harden the kiosk
1. Switch to the modern offline cache with multi-tab support in `firebase.js`.
2. Clock-in/out no longer wait for the server; show "Saved on this device — syncing" and a pending count.
3. Every scan gets a unique ID that is also the shift's document ID, so a retry can never create a second shift.
4. 3-second cooldown after each scan.
5. `stationId` set once per device.
6. Class switch becomes one batch write.
7. Store `createdAt: serverTimestamp()` next to the scan time; flag records where they differ by more than 10 minutes (late sync or wrong device clock).
8. Delete the unused clock-in widget from `StaffDashboard.jsx`.
- **Done when:** airplane-mode scans sync exactly once after reconnecting.

**Limit to know:** offline scanning works on the same device that has already loaded the staff list and classes while online. It is not a substitute for a trusted server clock.

### Optional later — dedicated kiosk login
A separate `kiosk` account that can only create shifts, so the reception device stops holding an Admin session. Not needed to follow your policy; worth doing if the reception device is ever shared or left unattended.

---

## 5. Firestore rules specification (for the executing agent)

This section is the contract for `firestore.rules`. The code below is a **draft**: only the collections listed change; everything else in the file stays as it is (including the final catch-all that denies unknown collections). Test each rule in the Firebase Console **Rules Playground** (free, no install) before deploying.

### 5.1 Deploy order (important)

1. **Deploy A** (after the small `StaffSignup.jsx` change that adds `inviteId` to the new profile): `users` create, `attendance`, `shifts` create, plus the two new collections.
2. **Deploy B** (only after Step 1 code is live, because Step 1 removes the "auto-close when Reports loads" write that manager and instructor accounts currently perform): `shifts` update and delete.
3. Deploying B early makes Reports throw permission errors for anyone who is not admin.

Command each time: `firebase deploy --only firestore:rules`

### 5.2 Helper (add next to the existing helpers)

```
function roleOf(uid) {
  return get(/databases/$(database)/documents/users/$(uid)).data.role;
}
// Roles that get attendance shifts. Manager and student are never tracked.
// 'admin' stays here to keep today's behaviour; remove it if admins should not be tracked.
function isTrackedRole(r) {
  return r in ['instructor', 'frontoffice', 'marketing', 'officeboy', 'admin'];
}
```

### 5.3 Deploy A

```
match /users/{userId} {
  // read, delete, update: unchanged
  allow create: if isAdmin()
    || (isFrontOffice() && request.resource.data.role == 'student')
    || (signedIn()
        && userId == request.auth.uid
        && request.resource.data.inviteId is string
        && get(/databases/$(database)/documents/invites/$(request.resource.data.inviteId)).data.email
             == request.auth.token.email.lower()
        && get(/databases/$(database)/documents/invites/$(request.resource.data.inviteId)).data.role
             == request.resource.data.role);
}

match /attendance/{attendanceId} {
  allow read: if isStaff();
  // Student scans: Admin (reception station), Front Office, and Instructor, and the scanned person must be a student.
  allow create: if (isAdmin() || isFrontOffice() || hasRole('instructor'))
    && request.resource.data.userId is string
    && request.resource.data.timestamp is string
    && roleOf(request.resource.data.userId) == 'student';
  allow update, delete: if isAdmin();
}

match /shifts/{shiftId} {
  allow read: if isAdmin()
    || isManager()
    || (signedIn() && resource.data.userId == request.auth.uid);
  // Staff scans: admin only, for tracked roles only, new shifts start open.
  allow create: if isAdmin()
    && request.resource.data.userId is string
    && request.resource.data.clockOut == null
    && isTrackedRole(roleOf(request.resource.data.userId));
  // update and delete: see Deploy B (leave the old lines in place until then)
}

match /shiftAuditEvents/{eventId} {
  allow read: if isAdmin() || isManager();
  allow create: if isAdmin()
    && request.resource.data.actorId == request.auth.uid
    && request.resource.data.shiftId is string;
  allow update, delete: if false;          // append-only
}

match /staffLeave/{leaveId} {
  allow read: if isAdmin()
    || isManager()
    || (signedIn() && resource.data.userId == request.auth.uid);
  allow create: if isAdmin()
    && request.resource.data.status == 'approved'
    && isTrackedRole(roleOf(request.resource.data.userId));
  allow update, delete: if isAdmin();      // e.g. mark cancelled
}
```

Required code change for Deploy A: in `StaffSignup.jsx`, add `inviteId: invite.id` to `userProfile`. The signup batch deletes the invite in the same batch; rules read the invite as it was before the batch, so this works.

### 5.4 Deploy B (after Step 1 code is live)

```
match /shifts/{shiftId} {
  // read and create as in Deploy A
  allow update, delete: if isAdmin();      // replaces the old manager / own-shift update rule
}
```

### 5.5 Rules acceptance checks (Rules Playground)

| Simulate | Expected |
|---|---|
| Signed-in stranger creates own `users` doc with `role: admin`, no `inviteId` | Denied |
| New staff signup with a valid `inviteId` whose role matches | Allowed |
| Marketing account creates an `attendance` record | Denied |
| Instructor creates an `attendance` record for a student | Allowed |
| Instructor creates an `attendance` record for a staff member | Denied |
| Admin creates a `shifts` doc for a manager | Denied |
| Admin creates a `shifts` doc for an instructor with `clockOut: null` | Allowed |
| Staff (non-admin) updates any `shifts` doc | Denied (after Deploy B) |
| Manager updates any `shifts` doc | Denied (after Deploy B) |
| Anyone edits or deletes a `shiftAuditEvents` doc | Denied |
| Admin creates a `staffLeave` doc for a manager | Denied |

### 5.6 Indexes

Add composite indexes to `firestore.indexes.json` only when a step's query needs one (expected: `shifts` by `role` + `clockIn`, `staffLeave` by `userId` + `endDate`). The browser console prints a one-click link when one is missing.

---

## 6. Data model (additions only)

```js
// shifts — existing fields stay. New optional fields:
{
  stationId: "reception-01",
  clockInSource: "kiosk",            // kiosk | admin_correction
  reviewStatus: "needs_review",      // needs_review | reviewed (missing = not required)
  corrected: true,                   // set by Step 3
  createdAt: serverTimestamp()
}
// Old records need no migration: autoClosed:true with no reviewStatus counts as needs_review.

// shiftAuditEvents — append only
{ shiftId, action, before, after, reasonCode, note, actorId, actorNameSnapshot, createdAt }

// staffLeave
{ userId, displayNameSnapshot, type, startDate, endDate, dayPortion, note, status: "approved", createdBy, createdAt }
```

Dates in `staffLeave` are school-local `YYYY-MM-DD` in WITA.

---

## 7. Deliberately not doing

- Cloud Functions, scheduled jobs, or any paid service.
- Leave attachments or medical documents.
- Rotating QR codes or PIN (worth adding later if buddy punching becomes a real problem; today's QR is the person's fixed ID).
- Migrating stored times to Firestore `Timestamp`.
- Staff-submitted correction requests and staff leave requests (for now).

---

## 8. Manual test checklist (no test tools needed)

- New account tries to sign up as `admin` → refused.
- Marketing account tries to record a student attendance → refused.
- Staff account tries to edit its own `clockIn` → refused.
- Manager account tries to edit a shift → refused.
- Admin scans a manager badge → "not tracked" message, no shift created.
- Leave a shift open past its limit → shows `Stale — review`, not "On duty".
- Open Reports → nothing in `shifts` changes.
- Correct a shift → audit record shows before, after, reason, admin name.
- Log leave for an instructor → shows "On leave", not in no-show list.
- Kiosk in airplane mode: scan, reconnect → exactly one shift exists.
- Scan the same badge twice quickly → one action only.
- Admin tab opens with no camera prompt until "Open kiosk mode" is pressed.
- `npm run lint` and `npm run build` pass.
