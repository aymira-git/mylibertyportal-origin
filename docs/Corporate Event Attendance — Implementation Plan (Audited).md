# Corporate Event Attendance — Implementation Plan (Audited)

> This plan merges an earlier draft, a revision checked against the actual `mylibertyportal-origin` repo (`main` branch — `docs/ARCHITECTURE.md`, `src/features/attendance/Kiosk.jsx`, `shiftsRepository.js`, `punctuality.js`, `src/utils/dateWita.js`, `src/constants/branches.js` and `divisions.js`, `firestore.rules`), and a set of decisions Kifry made afterward. All of it can still contain mistakes — this is AI-produced twice over — so please double-check anything load-bearing, and the executing agent should push back on anything that doesn't hold up once they're in the code.

---

## 1. What this solves

Staff — especially instructors — can have a legitimate reason to be at work on a day with no scheduled class: training, meetings, company events, workshops. Today the kiosk only has two outcomes for that case: instructors get blocked with "No Class Scheduled," other staff fall through to General Duty. This adds a third, distinct outcome without turning an event into a fake `classes` document.

Confirmed during the conversation with Kifry: events aren't staff-only. They often include students, and managers are expected to attend some of them too — so this plan covers three audiences (staff, managers, students), not one.

### Design principle

A corporate event is an attendance *reason*, not a class:
- its own Firestore collection;
- explicit event metadata on whatever attendance record it touches;
- it never creates or modifies `classes` documents;
- class-based scheduling/reporting stays class-driven.

---

## 2. Repository architecture fit

Attendance and clock-in/out already live under `src/features/attendance/`; this feature stays there rather than becoming a new top-level area.

```text
src/features/attendance/
  Kiosk.jsx                     # add event matching to the staff path, the manager path, and the student path
  shiftsRepository.js           # extend shift payload with shiftType/eventId
  attendanceRepository.js       # (existing) extend student attendance write with eventId/eventName
  corporateEventsRepository.js  # new — reads/writes for corporateEvents
  corporateEvents.js            # optional pure matching/validation helpers, easy to unit test
  CorporateEventsPanel.jsx      # new Admin/Front Office management UI
  index.js                      # export new public entry points
```

Cross-domain imports still go through `attendance/index.js`, per the existing convention.

---

## 3. Data model

### New collection: `corporateEvents`

| Field | Type | Required | Notes |
|---|---|---:|---|
| `name` | string | yes | Shown as the shift/attendance record's event label. |
| `eventDate` | string (`YYYY-MM-DD`) | yes | WITA calendar date, via `todayWita()`. |
| `startTime` / `endTime` | string `HH:mm` or null | no | Informational in v1 — doesn't block a scan. |
| `audienceType` | `"all" \| "branch" \| "role" \| "division"` | yes | One dimension only, per Kifry's earlier call. |
| `audienceValue` | string or null | conditional | `null` for `all`. |
| `status` | `"active" \| "cancelled"` | yes | Soft-cancel, never hard-delete. |
| `createdBy` | uid | yes | |
| `createdAt` / `updatedAt` | timestamp | yes | |
| `cancelledBy` / `cancelledAt` | uid / timestamp, optional | no | |

Single-day events only for v1 — multi-day/recurring deferred, same as before.

### Who counts as "eligible" — revised after Kifry's input

The earlier draft excluded managers and students from matching entirely. That's been corrected:

- **`audienceType: "all"`** → literally everyone: students, every staff role, and managers.
- **`audienceType: "branch"`** → everyone (students, staff, managers) in that branch.
- **`audienceType: "division"`** → everyone in that division.
- **`audienceType: "role"`** → one specific staff/manager role (`instructor`, `frontoffice`, `marketing`, `officeboy`, `admin`, `manager`). `student` isn't offered as a role option here — it's redundant, since `all`/`branch`/`division` already cover students without needing a role dimension.

---

## 4. Kiosk integration — three separate paths, not one

This is the part that changed most from the earlier draft. Because staff, managers, and students each go through different branches of `Kiosk.jsx` and write to different collections, the event check needs to be added in three places, not one.

### 4a. Staff path (instructor/frontoffice/marketing/officeboy/admin)

Unchanged from the previous revision:

1. Resigned/terminated check.
2. Open/stale shift handling.
3. Fetch today's classes.
4. **Class(es) exist → class-selection flow, unchanged. An event never overrides a scheduled class** (confirmed again by Kifry this round — already correctly modeled, no code change needed here).
5. **No class → check for a matching active event.**
   - Exactly one match → clock in as the event (`shiftType: "corporate_event"`), may bypass kindergarten weekend closure.
   - Zero matches → existing weekend/instructor/General Duty fallback, unchanged.
   - **More than one match → clock in as General Duty anyway** (see §6, revised from the earlier "hard stop" design).

### 4b. Manager path — new, and a dependency on the separate manager-badge plan

The manager-badge-policy plan gives managers their own branch (resigned/terminated check → kindergarten weekend check → manager General Duty). For managers to actually be able to attend events, that branch needs the same "check for a matching event before falling to General Duty" step, positioned the same way as the staff path (§4a step 5).

**This is a real coordination point between the two plans.** Whichever one lands first should leave an obvious seam for the other to hook into, rather than the second implementation having to reopen and restructure the first. Worth a quick sync between whoever builds each, even though they're separate plan files.

### 4c. Student path — new, and structurally different from 4a/4b

Students don't get shift records — they get a plain `attendance` document (`recordStudentAttendance` / the `We()` writer in the current code), through the student-only kiosk screen, and unlike staff, a student's check-in is **never blocked by anything today** — any active student can scan in freely.

So this isn't "reuse the staff matching logic" — it's "tag the write students already make, with the event, when one applies":

1. Existing checks unchanged (inactive/graduated status).
2. Before calling the attendance-write function, check for a matching active event for today scoped to the student's branch/division (`all`/`branch`/`division` — no `role` matching here, since role is always `student`).
3. Exactly one match → include `eventId` / `eventName` on the attendance write.
4. Zero or multiple matches → write the attendance record exactly as it works today, untagged.

**No Firestore rules change needed for this part** — checked the actual rule:

```js
allow create: if (isAdmin() || isFrontOffice() || hasRole('instructor'))
  && request.resource.data.userId is string
  && request.resource.data.timestamp is string
  && roleOf(request.resource.data.userId) == 'student';
```

It doesn't whitelist an exact field set, just requires these three — so adding optional `eventId`/`eventName` fields to the write doesn't need a rules update. (Also worth noting for whoever builds this: the current rule allows Admin, Front Office, *and* Instructor to scan students — not just Front Office/Instructor as it's sometimes described informally.)

---

## 5. Shift representation (staff/manager side)

Unchanged from the previous revision — still the right call:

```js
{
  shiftType: "corporate_event",
  eventId: corporateEvent.id,
  classId: `corporate_event:${corporateEvent.id}`, // synthetic, namespaced — never a real class ID
  className: corporateEvent.name,
  ...existingShiftFields
}
```

`clockIn()` in `shiftsRepository.js` doesn't currently accept `shiftType`/`eventId` — confirmed against the actual function signature — so it needs extending. Existing class/General Duty clock-ins keep working unchanged.

For consistency, the student-side attendance write should carry an equivalent optional pair (`eventId`, `eventName`) rather than inventing different field names for the same concept.

---

## 6. Ambiguous / overlapping matches — revised

The earlier draft treated multiple matching events as a hard stop: show a config error, don't clock in at all. Kifry's call after walking through realistic scenarios (an all-staff event *and* a role-specific event on the same day is normal, not a mistake — e.g. an all-staff morning briefing plus an instructor-only afternoon workshop): **don't block the person over it.**

- **Staff/manager path:** two or more matching events → clock in as General Duty (not tagged to either specific event). They were at work either way; losing the specific event label for that one ambiguous day is an acceptable trade for not blocking real attendance.
- **Student path:** two or more matching events → record the check-in untagged, exactly as it works today.

No separate overlap-alerting system is being built for v1 — admins can already see overlapping events for a given date in the event management list (§9), so there's no need for extra logging infrastructure just to catch this. If that turns out to be insufficient in practice, a lightweight admin-facing notice is a cheap v2 addition, not a v1 requirement.

---

## 7. Date/timezone rules

Unchanged — use `todayWita()` from `src/utils/dateWita.js` for all "is this event today" decisions; confirmed this utility exists exactly as described (fixed WITA/UTC+8 offset, no DST). Don't use raw browser-local date arithmetic.

---

## 8. Who creates/manages events

Admin or Front Office — create, view, edit, cancel. Matches how other kiosk-adjacent duties are already split in this repo.

---

## 9. Firestore rules (draft)

```js
match /corporateEvents/{eventId} {
  allow read: if isAdmin() || isFrontOffice();

  allow create: if (isAdmin() || isFrontOffice())
    && request.resource.data.createdBy == request.auth.uid
    && request.resource.data.status == 'active'
    && request.resource.data.name is string
    && request.resource.data.eventDate is string
    && request.resource.data.audienceType in ['all', 'branch', 'role', 'division'];

  allow update: if (isAdmin() || isFrontOffice())
    && request.resource.data.createdBy == resource.data.createdBy
    && request.resource.data.createdAt == resource.data.createdAt;

  allow delete: if false;
}
```

Still a draft, not copy-paste final — add stricter field whitelisting and test with the Firebase Emulator before shipping. Don't relax the existing `shifts` create rule (Admin-only, tracked roles) to support this feature — that stays as-is.

---

## 10. UI needed

- Event creation form: name, date, optional start/end time, audience type (All / Branch / Role / Division) + value, using canonical dropdowns (not free text) for branch/division/role — now including `manager` in the role list.
- A simple list/table: Event | Date | Time | Audience | Status | Created By | Actions. Past events stay visible in an archived state; default view is upcoming/active. This list doubles as the way admins spot accidental overlaps (§6).

---

## 11. Reporting behavior

Because event shifts use a synthetic `classId` that never matches a real class document, they're automatically excluded from the classes-driven reports (instructor punctuality scorecard, seat capacity, expected-students-today) — confirmed by how those reports actually query the `classes` collection. No extra exclusion logic needed there. Worth one manual check after implementation rather than relying purely on that assumption.

---

## 12. Testing plan

### Matching / unit tests
- `all` matches everyone (student, every staff role, manager).
- `branch` / `division` match after canonical normalization, and include students.
- `role` matches an exact staff/manager role.
- Cancelled events never match. Wrong date never matches.
- Two matching events → resolves to "no specific event," not an error (§6).

### Kiosk behavior
1. Staff, no class, one matching event → event shift created.
2. Staff, no class, no event → unchanged existing behavior.
3. Staff, has a class, matching event exists → class flow wins, event ignored.
4. Resigned/terminated staff → still rejected before any event check.
5. Manager, matching event exists → event clock-in (requires the manager-badge plan's branch to include this check — see §4b).
6. Kindergarten staff/manager, weekend, matching event → event clock-in succeeds; no event → `Weekend Off` unchanged.
7. Student, matching branch/division/all event → attendance record tagged with `eventId`/`eventName`.
8. Student, no matching event → attendance record unchanged from today's behavior.
9. Two matching events, staff → General Duty, not blocked.
10. Two matching events, student → untagged attendance, not blocked.
11. Open-shift/stale-shift handling unaffected; no duplicate shift created.

### Firestore rules tests
- Admin/Front Office can read/create/update/cancel events; other roles cannot.
- `createdBy`/`createdAt` can't be forged or changed on update.
- Hard delete rejected.
- Student attendance write with optional `eventId`/`eventName` still succeeds under the existing `/attendance` rule (no rule change needed, but worth a regression test since the payload shape is changing).

### Regression
Run lint/build/existing attendance + reports test suites. Don't bundle this with unrelated refactors.

---

## 13. Implementation order

1. Pure matching helpers + unit tests (now covering student/manager eligibility too).
2. `corporateEventsRepository.js`.
3. Extend `shiftsRepository.js` (shiftType/eventId) and the student attendance writer (eventId/eventName) — two small, separate changes.
4. Firestore rules + rules tests.
5. Integrate matching into the staff path in `Kiosk.jsx`.
6. Integrate matching into the student path in `Kiosk.jsx`.
7. Coordinate with the manager-badge plan to integrate matching into the manager path (§4b) — whichever plan is implemented second does this step.
8. Admin/Front Office event-management UI.
9. Export new entry points via `attendance/index.js`.
10. Verify reports are unaffected; verify weekend/open-shift behavior is unaffected.
11. Update `docs/README.md` under Feature Plans & Specifications.

---

## 14. Rollback

Self-contained per path: stop matching, hide the management UI, remove `corporateEvents` rules if unused, revert each of the three kiosk integration points independently. Historical shift/attendance records generated by the feature stay — never deleted just because the feature is rolled back.

---

## 15. Deferred (not needed for v1)

- Multi-day / recurring events (each occurrence is its own single-day event for now).
- Hard time-window enforcement (stored, not enforced).
- Combined audience dimensions (branch + role, etc.).
- A dedicated overlap-alerting system beyond the existing event list (§6).

---

## 16. Acceptance criteria

- Admin/Front Office can create, view, edit, cancel events.
- Staff, managers, *and* students can be matched to an event depending on its audience scope.
- A scheduled class always wins over an event, for instructors.
- Manager event clock-in works once the manager-badge plan's branch includes the matching step.
- Student check-ins get tagged with the event when exactly one matches; untagged otherwise.
- Overlapping matches never block a clock-in/check-in — they fall through to General Duty (staff/manager) or an untagged check-in (student).
- Class-based reports don't count event shifts as scheduled classes.
- Firestore rules restrict event management to Admin/Front Office; no unrelated rule (shifts, attendance) is loosened to support this.
- Cancellation is soft; history is preserved.
- Lint/build/tests/rules pass without unrelated changes.

## 17. Documentation

`docs/Corporate Event Attendance — Implementation Plan.md`, indexed in `docs/README.md` under Feature Plans & Specifications, same as the manager badge plan.
