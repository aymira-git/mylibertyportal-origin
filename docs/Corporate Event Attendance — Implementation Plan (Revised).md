# Corporate Event Attendance — Implementation Plan (Revised)

> Revised after reviewing the original plan against the current `mylibertyportal-origin` repository architecture and attendance implementation.
>
> Repository baseline reviewed: `main` branch, including `docs/ARCHITECTURE.md`, `docs/README.md`, `src/features/attendance/Kiosk.jsx`, `src/features/attendance/shiftsRepository.js`, `src/features/attendance/punctuality.js`, `src/utils/dateWita.js`, `src/constants/branches.js`, `src/constants/divisions.js`, and `firestore.rules`.
>
> The original plan's core direction is retained: corporate events are a separate concept from scheduled classes and should not be represented as fake class records.

---

## 1. What this solves

Staff members — especially instructors — can have a legitimate work activity on a day when they have no scheduled class: training, meetings, company events, workshops, internal programs, etc.

Today, the staff kiosk path only has two relevant no-class outcomes:

- instructors receive **"No Class Scheduled"**;
- other tracked staff fall through to **General Duty**.

Corporate Event Attendance adds a distinct third case without turning an event into a `classes` document.

This remains separate from manager-badge work. The event feature touches the attendance domain and kiosk flow, but it should not change manager attendance behavior.

### Design principle

A corporate event is **an attendance reason, not a class**.

That means:

- it gets its own Firestore collection;
- an event attendance shift gets explicit event metadata;
- event shifts never create or modify `classes` documents;
- class-based scheduling/reporting remains class-driven.

---

## 2. Repository architecture fit

The repository uses a domain-centered structure. Attendance and clock-in/out belong under `src/features/attendance/`, and direct Firestore access belongs in repository files rather than React components.

Therefore the feature should live inside the **attendance domain**, not in a new top-level feature area.

### Proposed files

```text
src/features/attendance/
  Kiosk.jsx                         # add event matching to existing staff flow
  shiftsRepository.js              # extend shift creation payload for event metadata
  corporateEventsRepository.js      # new Firestore reads/writes
  corporateEvents.js                # optional pure matching/validation helpers
  CorporateEventsPanel.jsx          # new Admin/Front Office management UI
  index.js                          # export new public entry points
```

The exact UI host should be chosen by auditing the existing Admin/Front Office dashboard rather than creating an unnecessary new top-level route.

Cross-domain imports must continue to use the feature's public `index.js` boundary.

---

## 3. Data model

### New collection: `corporateEvents`

Use a single-day event for v1.

| Field | Type | Required | Notes |
|---|---|---:|---|
| `name` | string | yes | Human-readable event name; becomes the displayed shift `className`. |
| `eventDate` | string (`YYYY-MM-DD`) | yes | Calendar date in WITA (`Asia/Makassar`). |
| `startTime` | string `HH:mm` or null | no | Informational in v1. |
| `endTime` | string `HH:mm` or null | no | Informational in v1. |
| `audienceType` | `"all" \| "branch" \| "role" \| "division"` | yes | One audience dimension only in v1. |
| `audienceValue` | string or null | conditional | `null` for `all`; canonical value for other audience types. |
| `status` | `"active" \| "cancelled"` | yes | Use soft-cancel instead of deleting event records. |
| `createdBy` | uid | yes | UID of Admin/Front Office creator. |
| `createdAt` | timestamp | yes | Server timestamp. |
| `updatedAt` | timestamp | yes | Server timestamp when modified. |
| `cancelledBy` | uid or null | no | UID of the person who cancelled it. |
| `cancelledAt` | timestamp or null | no | Server timestamp when cancelled. |

### Why soft-cancel instead of delete

An event can already have generated attendance records. Deleting the event later would make historical shifts harder to explain or audit.

Cancellation should therefore be a state change:

```text
active -> cancelled
```

Past event records remain available for reporting and audit context.

Physical deletion is not part of v1.

---

## 4. Audience matching

The existing `users` documents already expose the fields needed by the feature:

- `role`
- `branch`
- `division`

The repository also already has canonical normalization helpers for branch and division values. Event matching should use those helpers instead of comparing arbitrary free-form strings.

### Matching rules

```text
audienceType = all
  -> every eligible staff member matches

audienceType = branch
  -> normalized event branch == normalized user branch

audienceType = role
  -> event role == user role

audienceType = division
  -> normalized event division == normalized user division
```

### Eligibility

Corporate events are a staff attendance feature, so the audience UI should not offer `student` or `manager` as event-attendance roles.

The existing kiosk manager behavior remains unchanged: managers are handled by the current manager-pass branch and do not become event clock-ins through this feature.

### Multiple matching events

A person may accidentally match more than one event on the same day — for example an `all` event plus a branch event.

Do **not** silently pick one.

For v1:

- `0` matching active events -> continue normal fallback;
- `1` matching active event -> use that event;
- `>1` matching active events -> stop with a clear configuration message and do not create an event shift.

The event-management UI should warn admins/front office when creating potentially overlapping audience rules, but the kiosk must still protect itself from ambiguity.

---

## 5. Date and timezone rules

All event-date decisions must use the existing WITA utilities.

Use:

```js
import { todayWita } from "../../utils/dateWita.js";
```

Do not use raw browser-local calendar arithmetic for deciding whether an event is "today".

The application explicitly standardizes operational date calculations to WITA / `Asia/Makassar`.

### v1 date scope

Keep v1 to a **single calendar day**.

Do not add recurring or multi-day range events until there is a real operational requirement. A range model sounds small but affects UI, querying, cancellation, overlap detection, and kiosk matching.

---

## 6. Time-window policy

Store optional `startTime` and `endTime` in `HH:mm` format, but treat them as **informational only in v1**.

### Why

The current kiosk has no generic staff time-window gate. Introducing a new hard block would create a second attendance policy path and could accidentally cause a valid event participant to fall into General Duty or the instructor no-class error.

So in v1:

- event date must match today;
- active audience match is required;
- the optional event time is displayed/stored but does not block a scan.

A future change can add explicit enforcement, preferably as a separately specified behavior rather than a hidden side effect of event lookup.

---

## 7. Shift representation

Do **not** encode an event only by writing its name into `className`.

The existing shift schema already contains `classId`, `className`, punctuality fields, source metadata, and timestamps. Add explicit event metadata so downstream code can identify the record safely.

### Recommended event shift fields

```js
{
  shiftType: "corporate_event",
  eventId: corporateEvent.id,
  classId: `corporate_event:${corporateEvent.id}`,
  className: corporateEvent.name,
  ...existingShiftFields
}
```

`classId` uses a namespaced synthetic ID only for compatibility with existing shift structure. It must never be the ID of an actual class document.

### Why add `shiftType`

A dedicated type prevents future reporting code from having to guess whether a shift is:

- a real class;
- General Duty;
- a corporate event;
- some later attendance category.

The event metadata also makes historical records self-describing after an event is cancelled.

### Repository change

Extend `clockIn()` / the event clock-in helper so the existing shift payload can carry optional:

```js
shiftType
)
eventId
```

Keep all existing fields and behavior unchanged for normal class and General Duty clock-ins.

---

## 8. Kiosk integration

The current kiosk implementation has this effective staff path:

1. validate badge/user;
2. reject resigned/terminated staff;
3. apply the existing kindergarten weekend guard;
4. inspect open/stale shift;
5. fetch today's classes;
6. class flow, instructor no-class error, or General Duty.

The original plan's intended business rules are correct, but the implementation must explicitly reconcile them with this real order.

### Desired v1 decision tree

After the existing inactive-badge check and open-shift handling:

```text
Find today's scheduled classes.

IF scheduled class(es) exist:
    preserve class selection flow.
    event does not override a class.

ELSE:
    find active corporate event(s) matching today + this user.

    IF exactly one event matches:
        clock into corporate event.
        this may intentionally bypass kindergarten weekend closure.

    IF multiple events match:
        show configuration error.
        do not clock in as an event.

    IF no event matches:
        preserve existing weekend / instructor / General Duty behavior.
```

### Kindergarten weekend behavior

This needs to be a deliberate exception, not an accidental consequence of code order.

For a kindergarten-division staff member on Saturday/Sunday:

- matching corporate event -> event clock-in is allowed;
- no matching corporate event -> existing `Weekend Off` behavior remains;
- a scheduled class still wins over an event, so the event never overrides class selection.

When implementing this, avoid making the event feature change unrelated class/weekend behavior.

### Existing open-shift behavior

Do not make an event create a second open shift.

The existing stale-shift and open-shift transition logic remains authoritative. Event matching is for the **new clock-in decision when there is no valid open shift**.

---

## 9. Event lookup strategy

Create the Firestore access in `corporateEventsRepository.js`.

Recommended API:

```js
fetchActiveEventsForDate(eventDate)
findMatchingCorporateEvents({ userData, eventDate })
createCorporateEvent(data)
updateCorporateEvent(eventId, data)
cancelCorporateEvent(eventId, actorId)
```

The repository should own all direct `corporateEvents` Firestore calls.

### Query strategy for v1

Query by date and filter the small result set in memory:

```text
where("eventDate", "==", todayWita())
```

Then apply audience matching locally.

This keeps the query simple, avoids building four separate audience queries, and makes the multiple-match rule deterministic.

### Cancelled events

Cancelled events must never match kiosk attendance.

---

## 10. Creating and managing events

### Who can manage events

- Admin
- Front Office

They can:

- create an event;
- view upcoming/active events;
- edit future event details;
- cancel an event.

### UI fields

The form should contain:

- Event name
- Date
- Optional start time
- Optional end time
- Audience type: All / Branch / Role / Division
- Audience value when required

For v1, use canonical dropdowns rather than free-text values for branch and division.

### Suggested event list

A simple management table/list is enough:

```text
Event | Date | Time | Audience | Status | Created By | Actions
```

Past events should remain visible in historical/archived state, while the primary screen can default to upcoming/active events.

---

## 11. Firestore rules

The original rule draft has one important permission problem: if Front Office can create/update/cancel events, Front Office must also be able to read them.

Also, event documents should not be writable with arbitrary fields or creator metadata controlled by the client.

### Draft rule shape

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

This is intentionally a draft, not a copy-paste final rule. Before deployment, add strict field whitelisting/type checks and test the rules with the Firebase Emulator.

### Important kiosk constraint

Do not relax the existing `shifts` write rule just to support events. The current shift-create rule is intentionally Admin-only and restricted to tracked staff roles.

The existing kiosk/admin-station authentication model should continue to authorize the actual shift write.

---

## 12. Reporting and analytics behavior

The original plan is directionally correct: event attendance should not become a class, so it should not create scheduled-class demand or class capacity.

The repository's instructor punctuality calculation matches shifts against actual class IDs. An event shift using its own namespaced ID will therefore not be mistaken for a scheduled class session.

### Expected behavior

Corporate event shifts should:

- appear in ordinary staff shift/attendance history;
- be identifiable as `shiftType = corporate_event`;
- carry `eventId` and `className` for human-readable reporting;
- not count as class attendance for scheduled-class punctuality;
- not contribute to seat-capacity or expected-student calculations that are sourced from `classes`.

### Reporting test requirement

Verify the actual affected reports after implementation rather than relying only on the data-model assumption.

---

## 13. Testing plan

### Matching unit tests

- `all` matches eligible staff.
- `branch` matches the canonical branch after normalization.
- `role` matches exact role.
- `division` matches the canonical division after normalization.
- cancelled events never match.
- wrong date never matches.
- no match returns zero events.
- two matching events returns two and is treated as ambiguous.

### Kiosk behavior

1. Staff member with no class + one matching event -> corporate event shift is created.
2. Staff member with no class + no event -> existing behavior is unchanged.
3. Staff member with a class + matching event -> class selection wins.
4. Resigned/terminated staff -> still rejected before event attendance.
5. Manager badge -> existing manager-pass behavior is unchanged.
6. Open shift -> existing clock-out/transition behavior is unchanged; no second shift is created.
7. Kindergarten Saturday/Sunday + matching event -> event clock-in succeeds.
8. Kindergarten Saturday/Sunday + no event -> `Weekend Off` remains.
9. Outside the optional event time window -> v1 still allows clock-in because time is informational.
10. WITA date boundary -> event matching follows `todayWita()`.
11. Multiple matching events -> kiosk shows a configuration error and does not silently choose one.

### Firestore security tests

Verify with the emulator that:

- Admin can read/create/update/cancel.
- Front Office can read/create/update/cancel.
- unrelated roles cannot manage events.
- create cannot forge `createdBy` as another UID.
- update cannot change `createdBy` or `createdAt`.
- physical delete is rejected.
- event documents cannot contain unexpected fields once strict validation is added.

### Regression checks

Run the normal project verification after implementation:

- lint;
- build;
- attendance tests;
- relevant reports tests;
- Firestore rules tests.

Do not combine this feature with unrelated refactors.

---

## 14. Implementation order

Recommended sequence:

1. Add pure event matching helpers and tests.
2. Add `corporateEventsRepository.js`.
3. Add the event fields to shift creation without changing normal shift payloads.
4. Add Firestore rules and rules tests.
5. Integrate event matching into `Kiosk.jsx` at the no-class decision point.
6. Add Admin/Front Office event-management UI.
7. Add event-management exports through `attendance/index.js`.
8. Verify reports and existing weekend/open-shift behavior.
9. Update `docs/README.md` with the final plan link when the feature is accepted.

This order keeps the kiosk change small and gives the matching logic a deterministic test surface before UI work begins.

---

## 15. Rollback

The feature is still reasonably isolated.

Rollback should:

- stop creating/matching corporate events;
- hide/remove the event-management UI;
- remove the `corporateEvents` rules if the collection is no longer used;
- revert the kiosk event branch;
- preserve existing historical shift documents unless a separate data cleanup is explicitly approved.

Do **not** delete historical event-generated shifts simply because the feature code is rolled back.

---

## 16. Open decisions intentionally deferred

These are not needed to ship v1:

### Multi-day events

Deferred until there is a real use case.

### Recurring events

Deferred. Each occurrence can be represented as its own single-day event in v1.

### Hard time-window enforcement

Deferred. v1 stores the window but does not block outside it.

### Audience combinations

Deferred. v1 supports exactly one dimension per event. There is no `branch + role` or `division + role` expression language.

### Event priority

No automatic priority between `all`, branch, role, and division events. Multiple matching events are treated as a configuration error.

---

## 17. Final acceptance criteria

The feature is ready when all of the following are true:

- Admin and Front Office can create, view, edit, and cancel events.
- Event records are stored in `corporateEvents` with WITA dates.
- Staff with no scheduled class can clock into a single matching event.
- Existing class selection takes precedence over events.
- Existing General Duty / instructor no-class behavior remains the fallback when no event matches.
- Kindergarten weekend closure is bypassed only by an explicitly matching event.
- Manager behavior remains unchanged.
- Event shifts are explicitly tagged with `shiftType` and `eventId`.
- Class-based analytics do not count event shifts as scheduled classes.
- Firestore permissions allow Admin/Front Office management without granting event writes to unrelated roles.
- Cancellation is soft, preserving historical event context.
- The feature passes lint/build/tests/rules verification without unrelated architectural changes.

---

## 18. Documentation

Store the accepted plan as:

```text
docs/Corporate Event Attendance — Implementation Plan.md
```

Then add it to `docs/README.md` under **Feature Plans & Specifications**, following the repository's existing documentation convention.
