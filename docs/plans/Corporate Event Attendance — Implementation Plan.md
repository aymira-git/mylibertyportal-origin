# Corporate Event Attendance — Implementation Plan

> This plan was drafted by Claude from a conversation with Kifry, not from reading existing repo code for this specific feature (it doesn't exist yet). The design choices below are Kifry's current stance, open to the executing agent's pushback — nothing here is final.

## What this solves

Right now, staff (instructors especially) with no scheduled class today have no way to log presence for things like training, meetings, or company events. This is a separate, standalone feature from the manager badge work — related only in that both touch `Kiosk.jsx`.

It's a deliberate alternative to making the event look like a "class" (batch): classes in this repo are single-instructor records (`instructorId` + optional `substituteInstructorId`), so they can't natively represent "this applies to a group of people." Building this as its own collection avoids that mismatch, and — as a side effect — keeps events completely invisible to the classes-based reports (instructor punctuality scorecard, seat capacity, expected-students-today), since those all query the `classes` collection directly. No extra exclusion logic needed there.

---

## Data model

New collection: `corporateEvents`

| Field | Type | Notes |
|---|---|---|
| `name` | string | Event name, shown as the shift's `className` |
| `date` | string (or `startDate`/`endDate` for multi-day) | Kifry: single day covers most cases; range is cheap to add if needed |
| `startTime` / `endTime` | string, optional | Not enforced as a hard clock-in window at first — see open question below |
| `audienceType` | `"all"` \| `"branch"` \| `"role"` \| `"division"` | Single-dimension only (Kifry's call) — not combinable in v1 |
| `audienceValue` | string, required unless `audienceType === "all"` | e.g. a specific branch name, role, or division |
| `createdBy` | uid | Admin or Front Office |
| `createdAt` | timestamp | |

No changes needed to the `users` collection — role, branch, and division already exist there for matching at scan time.

### Open question: is the time window enforced?

Kifry listed "time and date" as a field, but didn't say whether scanning outside that window should be blocked or just recorded as-is (like classes' punctuality tracking does). Two reasonable options:
- **Informational only**: event just needs to be today; clock-in always succeeds, time window is just a label.
- **Enforced**: scanning outside the window is treated like the "no match" case (falls through to normal weekend/General Duty logic instead).

Leaving this open — easy to add later either way, and gold-plating it now risks kiosk logic complexity for a case that might not matter in practice.

---

## Kiosk integration — where this sits in the scan flow

Building on the manager-badge decisions from the other plan (resigned/terminated check first, kindergarten-weekend check applies to managers too), the proposed order for the *non-manager staff* path is:

1. Resigned/terminated check (unchanged — a deactivated badge never works, event or not)
2. Open-shift / stale-shift handling (unchanged)
3. Fetch today's assigned classes
4. **If they have a class today → existing class-selection flow runs, unchanged.** An event never overrides a scheduled class (Kifry's earlier call, carried over from the manager plan).
5. **If no class today → check for a matching corporate event** (today's date, audience matches this person's role/branch/division)
   - Match found → clock in with `className` = event name, tagged so it's identifiable as an event (not a class or generic General Duty) in reports.
   - No match → falls through to the existing logic: kindergarten weekend check, then instructor block / General Duty as it works today (or as revised, if the earlier instructor-block gap also gets fixed).

### Open question: does a matching event override the weekend closure?

If an event matches, I'd skip the kindergarten Sat/Sun block for that person — the reasoning being that if an admin deliberately scheduled an event for kindergarten staff on a weekend, that's presumably intentional. The alternative is to keep the weekend block absolute and simply not let admins schedule kindergarten-audience events on weekends (a process rule rather than a code rule). Either is defensible — flagging so it's a decision, not an accident.

---

## Who creates events

Admin or Front Office (matches Kifry's ask, and lines up with how kiosk-adjacent staff actions are already split in this repo — e.g. only Admin scans staff badges, but Front Office already has its own duties elsewhere).

## Firestore rules (draft)

```js
match /corporateEvents/{eventId} {
  allow read: if isAdmin(); // kiosk scans run under Admin auth per existing policy
  allow create: if isAdmin() || isFrontOffice();
  allow update, delete: if isAdmin() || isFrontOffice();
}
```

Open question: should Front Office be able to edit/cancel an event Admin created (and vice versa), or should edit rights be creator-only? Kept both able to for now since that matches "who can create" — narrow later if it causes a real problem.

---

## UI needed (new, not audited against existing code since this is a new feature)

- A simple event creation form for Admin/Front Office: name, date, optional time window, audience picker (All / Branch / Role / Division + value).
- A way to see/cancel upcoming or active events (a simple list is enough for v1).
- No changes needed to the kiosk's visual flow beyond the new matching check — it reuses the existing clock-in confirmation screens.

---

## Test plan

- Staff member with no class today, matching event exists for their role → clocks into the event, shift record shows the event name.
- Staff member with no class today, no matching event → falls through to existing behavior (weekend block / instructor error / General Duty) unchanged.
- Staff member **with** a class today, matching event also exists → class flow wins, event is ignored.
- Event scoped to `branch: X` → someone from branch Y doesn't match, even on the same date.
- Kindergarten-division staff, weekend, matching event exists → clocks in (per the open-question decision above — confirm expected behavior before writing this test).
- Kindergarten-division staff, weekend, no matching event → still gets "Weekend Off," unchanged.
- Event shifts don't appear anywhere in the classes-based reports (punctuality scorecard, seat capacity) — should be true automatically since events never touch the `classes` collection, but worth one manual check.
- Only Admin/Front Office can create/edit an event; other roles' write attempts are rejected.

## Rollback

Self-contained: the `corporateEvents` collection and its rules can be dropped, and the one new "check for matching event" step in `Kiosk.jsx` removed, without touching the manager badge work or any existing class/General Duty logic.

## Documentation

Suggest `docs/Corporate Event Attendance — Implementation Plan.md`, indexed in `docs/README.md`, consistent with how the manager badge plan is being filed.
