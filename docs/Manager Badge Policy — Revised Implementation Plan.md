# Manager Badge Policy — Revised Implementation Plan

## Review basis

This revision is based on:

- The submitted **Manager Badge Policy — Implementation Plan**.
- The current `main` branch of `aymira-git/mylibertyportal-origin` inspected on 2026-09-22.
- The repository's current architecture guidance and Firestore rules.

## Executive conclusion

The original plan identified the right product gap, but it is now partly stale against `main`.

The proposed **Decision 1 — Instructor "General Duty" clock-in** should be removed from the implementation scope: the current `src/features/attendance/Kiosk.jsx` already lets any non-student staff member with no class today clock in as `classId: "general"` / `className: "General Duty"`. There is no longer an instructor-only hard block in that code path.

The remaining change is **Manager badge attendance**. I recommend implementing it as a narrowly scoped manager-specific General Duty path rather than simply removing the manager guard and sending managers through the generic instructor/staff flow.

There is also one important Firestore-rules correction: the current `isTrackedRole()` helper is used by both `/shifts` and `/staffLeave`. Therefore, adding `manager` to that single helper would change staff-leave authorization as a side effect. Split the role predicates so manager shift tracking can be enabled without changing leave behavior.

---

## 1. Current-state audit

### 1.1 The submitted plan's Decision 1 is already implemented

Current `src/features/attendance/Kiosk.jsx` does this for a scanned non-student staff member:

1. Looks for an open shift.
2. If there is no open shift, fetches today's instructor classes.
3. If there are no classes today, clocks the person in with:
   - `classId: "general"`
   - `className: "General Duty"`
   - `punctuality.status: "Present"`
4. Shows a normal "Duty Started" confirmation.

This behavior is already present for the current main branch. Do **not** implement another instructor-specific relaxation unless the repository changes again before development begins.

### 1.2 Managers are still explicitly blocked

The current kiosk has an explicit manager branch before the generic staff flow:

```js
if (userData.role === "manager") {
  return showStatus(
    "Manager Pass",
    "info",
    "Managers do not record shift attendance at this kiosk.",
    userData.displayName
  );
}
```

That is the actual application-level blocker that needs to change.

### 1.3 Firestore rules also exclude managers from shift creation

The current rules define:

```js
function isTrackedRole(r) {
  return r in ['instructor', 'frontoffice', 'marketing', 'officeboy', 'admin'];
}
```

and `/shifts` creation requires `isTrackedRole(roleOf(request.resource.data.userId))`.

So the manager feature requires both:

- a kiosk behavior change; and
- a Firestore rules change.

### 1.4 Hidden side effect in the original rules proposal

The same `isTrackedRole()` helper is also used by `/staffLeave` creation.

Therefore this seemingly simple change:

```js
return r in ['instructor', 'frontoffice', 'marketing', 'officeboy', 'admin', 'manager'];
```

would not only enable manager shifts; it would also make managers eligible targets for the Admin-created staff-leave record path.

That side effect is not part of the stated manager-badge requirement and should not happen implicitly.

---

# 2. Final policy decision

## Decision: Track manager presence, but record it as General Duty

A manager badge should be accepted by the existing staff attendance scanner.

A manager badge scan should create a normal `shifts` document with:

- `role: "manager"`
- `classId: "general"`
- `className: "General Duty"`
- `clockInSource: "kiosk"`
- normal `clockIn` / `clockOut` lifecycle

The manager should **not** enter the instructor class-selection workflow.

### Why this is preferable to simply removing the manager block

The generic staff path is intentionally capable of discovering instructor classes. That makes sense for instructors, but manager attendance has a different semantic meaning: manager presence is administrative duty, not teaching duty.

A dedicated manager branch keeps the behavior deterministic:

> Manager badge → General Duty.

This also avoids accidentally showing a manager a "Confirm Teaching Shift" modal because a class happens to reference that UID in the future.

---

# 3. Two-account manager/instructor case

The existing two-account model remains valid:

- **Manager account** = oversight / manager identity.
- **Instructor account** = teaching identity and teaching badge.

The new manager badge does **not** replace the instructor badge for teaching attendance.

### Intended behavior

| Real-world situation | Badge/account to scan | Recorded shift |
|---|---|---|
| Manager-only employee working normally | Manager badge | General Duty |
| Manager who is also an instructor, teaching today | Instructor badge | Assigned class |
| Manager who is also an instructor, no class today but working | Manager badge or instructor badge | General Duty |
| Manager who is also an instructor, teaching + administrative work | Teaching attendance should remain tied to instructor account; administrative presence can be recorded separately if the operational policy requires it | See note below |

### Important operational note

Because the application has two user records, the system cannot automatically know that the manager UID and instructor UID belong to the same human being. Do not attempt to infer or reconcile those identities inside this change.

Keep the two records independent and make the intended scanning policy explicit to staff.

---

# 4. Recommended code change

## File: `src/features/attendance/Kiosk.jsx`

Replace the current manager rejection with a manager-specific attendance path.

### Recommended control flow

After the inactive/resigned/terminated status check and before the generic instructor/class flow:

```js
if (userData.role === "manager") {
  const openShift = await fetchOpenShiftFor(uid);

  if (openShift && isShiftStale(openShift)) {
    await autoCloseShift(openShift);
  }

  if (openShift) {
    await clockOutShift(openShift.id);
    showStatus(
      "Shift Concluded",
      "success",
      "Manager General Duty shift completed.",
      userData.displayName
    );
    setLastScanned({
      name: userData.displayName,
      role: "manager",
      time: new Date(),
      type: "Clock Out"
    });
  } else {
    await clockIn({
      uid,
      displayName: userData.displayName,
      role: "manager",
      classId: "general",
      className: "General Duty",
      clockInAt: new Date(),
      punctuality: {
        status: "Present",
        scheduledStart: null,
        requiredArrival: null,
        minutesEarlyOrLate: 0,
      },
    });
    showStatus(
      "Duty Started",
      "success",
      "Clocked in on General Administrative Duty.",
      userData.displayName
    );
    setLastScanned({
      name: userData.displayName,
      role: "manager",
      time: new Date(),
      type: "Clock In"
    });
  }

  return;
}
```

### Implementation note

The exact code should reuse the repository's existing stale-shift handling and status/toast conventions rather than duplicating unnecessary logic. The important design rule is that the manager branch exits before `fetchInstructorClasses()` and before the class-selection / class-transition paths.

---

# 5. Recommended Firestore-rules change

## File: `firestore.rules`

Do **not** add `manager` to the existing `isTrackedRole()` helper.

Instead, split the predicates by domain of meaning.

### Suggested structure

```js
function isTrackedShiftRole(r) {
  return r in ['instructor', 'frontoffice', 'marketing', 'officeboy', 'admin', 'manager'];
}

function isTrackedLeaveRole(r) {
  return r in ['instructor', 'frontoffice', 'marketing', 'officeboy', 'admin'];
}
```

Then update the relevant rules:

```js
// /shifts
&& isTrackedShiftRole(roleOf(request.resource.data.userId));
```

and leave the staff-leave rule using:

```js
&& isTrackedLeaveRole(roleOf(request.resource.data.userId));
```

### Result

This gives the requested capability:

- manager shift creation: **enabled**
- manager shift update/delete: **still Admin-only**
- manager read access to shifts: **unchanged**
- manager staff-leave eligibility: **unchanged**

That separation is important because the repository's architecture treats Firestore rules as protected infrastructure and calls for a dedicated verification pass when they are changed.

---

# 6. Permissions and UI scope

No new Manager Dashboard attendance editor should be introduced by this change.

The existing `KioskModal` is described as a scanner used across Admin, Front Office, and Instructor dashboards. The Manager Dashboard itself currently does not add a kiosk launcher.

Therefore the intended operational model is:

> An authorized existing kiosk operator scans the manager's badge; the resulting manager shift becomes visible to the existing staff-duty/reporting views.

This keeps the feature focused on badge recognition rather than expanding manager write access or creating a new self-service attendance surface.

---

# 7. Badge/credential verification

The current kiosk resolves a scanned credential by reading the user record through `fetchUserById(uid)`, so no new attendance identifier field is required.

Before implementation is considered complete, verify the actual manager badge/QR issuance path in the staff/auth UI:

1. A manager account can be given its normal credential.
2. Scanning that credential returns the manager UID.
3. `fetchUserById(uid)` returns a user with `role: "manager"`.
4. The manager-specific kiosk branch is reached.

Do not add a second badge format unless the existing staff credential system cannot represent manager users.

---

# 8. Test plan

## Automated validation

Run the repository's normal validation commands:

```bash
npm run lint
npm run test
npm run build
```

The repository already exposes these scripts through `package.json`.

## Required behavioral scenarios

### Scenario A — manager first scan

Given an active manager with no open shift:

- scan manager badge
- one `shifts` document is created
- `role === "manager"`
- `classId === "general"`
- `className === "General Duty"`
- `clockOut === null`
- success confirmation is shown

### Scenario B — manager second scan

Given the manager has an open shift:

- scan the same manager badge
- the existing shift is closed
- no second open shift is created
- confirmation says the shift was concluded

### Scenario C — stale manager shift

Given the manager has an open but stale shift:

- normal stale-shift handling runs
- the stale shift is auto-closed according to existing behavior
- a new General Duty shift can then be created

### Scenario D — manager with class data accidentally present

Given a manager user UID is referenced by a class:

- the manager scan must still use General Duty
- no teaching-class selection modal should appear

This scenario is specifically why the manager branch should be explicit rather than relying on the generic staff flow.

### Scenario E — instructor behavior regression

Given an instructor with no classes today:

- scan instructor badge
- General Duty behavior continues to work
- no instructor-specific error is introduced

This is a regression test, not a new feature, because the behavior already exists on current `main`.

### Scenario F — manager leave behavior regression

Verify that adding manager shift tracking does **not** alter the authorization semantics for `/staffLeave`.

### Scenario G — manager permissions remain unchanged

Verify that a manager still cannot directly create, update, or delete other staff shifts merely because manager shifts are now tracked. Current `/shifts` create/update/delete authorization remains Admin-centric.

---

# 9. Acceptance criteria

The implementation is complete when all of the following are true:

- [ ] Manager badges are accepted by the existing staff attendance scanner.
- [ ] Manager clock-in creates a General Duty shift.
- [ ] Manager clock-out closes the existing General Duty shift.
- [ ] Manager scans never enter instructor class selection.
- [ ] Existing instructor General Duty behavior remains unchanged.
- [ ] Firestore rules permit Admin-created manager shift records.
- [ ] Firestore rules do not accidentally expand manager staff-leave eligibility.
- [ ] Existing manager read/oversight permissions remain intact.
- [ ] No new manager self-service attendance UI is introduced.
- [ ] `npm run lint` passes.
- [ ] `npm run test` passes.
- [ ] `npm run build` passes.
- [ ] The change is verified against the deployed Firestore rules, not only the local file.

---

# 10. Rollback plan

The change has two separable pieces:

1. Revert the manager branch in `Kiosk.jsx` to the current manager rejection.
2. Revert `isTrackedShiftRole()` so `manager` is removed from the allowed shift roles.

Keep the instructor General Duty behavior untouched during rollback; that behavior is already part of the current main branch and is not part of the manager feature.

---

# 11. Documentation follow-up

When this plan is committed to the repository, place it under `docs/` and add it to `docs/README.md` because the repository's documentation guidance asks major implementation plans to live there and be indexed.

Suggested filename:

`docs/Manager Badge Policy — Revised Implementation Plan.md`

---

# Final recommendation

Proceed with **Manager badge → General Duty attendance**, but keep it intentionally narrow.

The original plan should be revised in three material ways:

1. **Delete Decision 1 as an implementation task** because current `Kiosk.jsx` already does it.
2. **Implement a dedicated manager kiosk branch** so managers cannot accidentally enter the teaching-class workflow.
3. **Split shift-tracking and leave-tracking role helpers in `firestore.rules`** so enabling manager shifts has no unrelated permission side effect.

That gives the feature the smallest behavioral footprint while matching the repository's current architecture and permission model.
