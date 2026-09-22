# Manager Badge Policy — Implementation Plan (Audited)

> Note: this plan was produced by an AI (Claude) auditing an earlier AI-produced plan against the actual repository. Both the earlier plan and this audit can contain mistakes — please double-check anything load-bearing before building on it, and feel free to push back on any of it.

## Audit basis

Checked against `src/features/attendance/Kiosk.jsx` (source + built `dist` bundle) and `firestore.rules` in the uploaded `myliberty-portal.zip`, inspected 2026-09-22.

---

## ⚠️ Correction to the previous version's core premise

The previous version of this plan concluded that **Decision 1 — "instructors with no class today can clock in as General Duty"** is already implemented on `main`, and recommended deleting it from scope.

That does not match the actual code. The relevant branch in `Kiosk.jsx` is:

```js
if (todayClasses.length > 0) {
  setPendingClockIn({ uid, userData, classes: todayClasses });
} else {
  if (userData.role === "instructor") {
    return showStatus(
      "No Class Scheduled",
      "error",
      "You have no classes scheduled today. If you are substituting, please ask an administrator to assign you to the class first."
    );
  }
  // only reached for non-instructor staff (frontoffice/marketing/officeboy/admin):
  await clockIn({ ...classId: "general", className: "General Duty"... });
}
```

**An instructor with no class today is still hard-blocked with an error.** The automatic General Duty fallback only applies to non-instructor staff roles. So if the original submitted plan's "Decision 1" was about giving instructors a General Duty fallback, that appears to still be an open task, not something to remove from scope.

This is worth a second look from whoever has the original plan text, since this revision doesn't have it — but based on current `main`, deleting Decision 1 on the stated grounds would leave a real gap.

---

## What did check out

### The `isTrackedRole()` shared-helper risk is real

Confirmed in `firestore.rules`:

```js
function isTrackedRole(r) {
  return r in ['instructor', 'frontoffice', 'marketing', 'officeboy', 'admin'];
}
```

used by both `/shifts` create and `/staffLeave` create. Adding `manager` directly to this helper would silently make managers eligible for the Admin-created staff-leave path too — not something this feature asked for. Splitting into two predicates (`isTrackedShiftRole` / `isTrackedLeaveRole`) still looks like the right call.

### The manager block is exactly as quoted

```js
if (userData.role === "manager") {
  return showStatus(
    "Manager Pass", "info",
    "Managers do not record shift attendance at this kiosk.",
    userData.displayName
  );
}
```

This is the real blocker to remove/replace for manager badge tracking.

---

## Two points Kifry decided (current stance — still open to challenge if the executing agent sees a problem)

### 1. Resigned/terminated managers should be blocked like other staff

Kifry's call: a resigned/terminated manager's badge should be blocked with the same "Badge Deactivated" treatment other staff get, not the neutral "Managers don't clock in here" message.

Reasoning: right now the manager check runs **before** the resigned/terminated staff-status check, so a resigned manager currently still gets waved through with the neutral message. Implementing this means the new manager clock-in code needs to sit **after** the resigned/terminated status check, not before it — a small reordering from the draft in the original submitted plan. If the resigned/terminated check currently only runs inside the non-manager `else` branch, moving the manager check below it means either restructuring that check to also cover managers, or duplicating it above the manager branch — worth a quick look at the surrounding code before writing this line-for-line.

### 2. Kindergarten-division managers get the weekend block too

Kifry's call: a manager tagged as kindergarten division should be blocked from clocking in on Sat/Sun, same as other kindergarten staff.

Reasoning: this means the manager branch needs to run the same `isKindergartenStaff` + weekend check that the generic staff path already has, rather than skipping it. Practically, this means the manager branch can't fully exit before the kindergarten/weekend check the way the original draft assumed — it needs to pass through that check first, then branch to General Duty.

---

## Manager badge → General Duty (product decision, open to challenge)

Recording manager presence as its own General Duty path (rather than routing managers through the generic instructor/staff flow) still seems like a reasonable choice, for a concrete reason: if a manager's UID is ever referenced as an `instructorId` on a class (data entry mistake, or a manager who also teaches under the wrong account), the generic path would route them into "Confirm Teaching Shift" — a dedicated branch avoids that. If someone prefers the simpler "just let managers through the generic staff path" approach instead, the tradeoff is: less code, but that edge case becomes possible.

Recommended shape, incorporating both decisions above:

- Resigned/terminated staff-status check runs **first**, and applies to managers too → "Badge Deactivated" if resigned/terminated.
- Kindergarten-division + Sat/Sun weekend check runs **next**, and applies to managers too → "Weekend Off" if kindergarten-division and it's the weekend.
- Only after both checks pass does the manager-specific General Duty path run: normal `shifts` document with `role: "manager"`, `classId: "general"`, `className: "General Duty"`, `clockInSource: "kiosk"`.
- No instructor class-selection workflow for managers.
- Second scan of the same manager closes the open shift (standard clock-out) — this part doesn't need the status/weekend checks again since it's just ending an already-valid shift.

### Two-account model unchanged

Manager account = oversight identity. Instructor account = teaching identity. This plan doesn't attempt to reconcile the two UIDs — consistent with the existing project decision that multi-hat staff are modeled as two separate accounts.

| Real-world situation | Badge/account to scan | Recorded shift |
|---|---|---|
| Manager-only employee working normally | Manager badge | General Duty |
| Manager who is also an instructor, teaching today | Instructor badge | Assigned class |
| Manager who is also an instructor, no class today but working | Manager badge or instructor badge | General Duty |

---

## Firestore rules change

```js
function isTrackedShiftRole(r) {
  return r in ['instructor', 'frontoffice', 'marketing', 'officeboy', 'admin', 'manager'];
}

function isTrackedLeaveRole(r) {
  return r in ['instructor', 'frontoffice', 'marketing', 'officeboy', 'admin'];
}
```

`/shifts` create uses `isTrackedShiftRole`; `/staffLeave` create keeps `isTrackedLeaveRole`. `/shifts` create is Admin-only already (matches the existing project policy that only admin scans staff badges) — this change doesn't touch that.

---

## Test plan

Run existing validation:
```bash
npm run lint
npm run test
npm run build
```

Behavioral scenarios worth covering:
- Manager first scan → one `shifts` doc, General Duty, success shown.
- Manager second scan → existing shift closes, no duplicate.
- Stale manager shift → auto-close runs, then a fresh General Duty shift can be created.
- Manager UID accidentally set as a class's `instructorId` → manager scan still General Duty, no teaching modal.
- Instructor with no class today → confirm this is **still** the existing "No Class Scheduled" error unless Decision 1 gets implemented (see correction above) — don't let this scenario silently change as a side effect of the manager work.
- Resigned/terminated manager scan → expect "Badge Deactivated," not "Manager Pass" (decision #1).
- Kindergarten-division manager scan on Sat/Sun → expect "Weekend Off," not a General Duty clock-in (decision #2).
- Kindergarten-division manager scan on a weekday → General Duty clock-in proceeds normally.
- Non-kindergarten manager scan on Sat/Sun → General Duty clock-in proceeds normally (weekend block only applies to kindergarten division).
- `/staffLeave` authorization unaffected by the rules split.
- Manager still cannot create/update/delete other staff shifts.

## Rollback

Two independent pieces: revert the `Kiosk.jsx` manager branch back to rejection, and drop `manager` from `isTrackedShiftRole`. The instructor General Duty question (correction above) is a separate piece of work either way and isn't part of this rollback.

## Documentation

If committed, suggest placing under `docs/` and indexing in `docs/README.md`, per the repo's existing documentation convention.
