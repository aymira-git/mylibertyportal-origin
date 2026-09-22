# Manager Badge Policy — Implementation Plan

**Resolves:** the item parked in *Admin Attendance & Staff Kiosk Implementation Plan v2*, section 1: "Manager badge scanning — parked for future dedicated discussion."

**Trigger for this doc:** Kifry noticed the "one real person, two accounts" model (manager account view-only, instructor account holds the badge) doesn't cover two real cases:
1. A manager who is **not** an instructor — has no instructor account, so no badge can ever exist for them.
2. A manager who **is** an instructor, on a day they have no class scheduled.

---

## Audit notes (checked against the current zip)

- *Audit note:* `Kiosk.jsx` rejects any scan where `userData.role === "manager"` unconditionally, with "Managers do not record shift attendance at this kiosk." There is no path that produces a shift for a manager account, full stop.
- *Audit note:* Case 2 is broader than manager-specific. `Kiosk.jsx` has a special branch: when the scanned user has `role === "instructor"` and `fetchInstructorClasses` returns nothing scheduled today, the kiosk throws a hard error ("No Class Scheduled... ask an administrator to assign you to the class first") and refuses to clock in. Every *other* staff role (Front Office, Marketing, Office Boy) with nothing scheduled instead falls through to a normal clock-in with `classId: "general"`, `className: "General Duty"`. So this wall applies to **any** instructor with no class that day, not just a manager wearing an instructor badge — it just happens to bite the manager-instructor case hardest since that account exists specifically to cover non-teaching days too.
- *Audit note:* `firestore.rules` (per the v2 plan) creates shifts for a fixed list of "tracked" roles, with manager explicitly excluded. So case 1 needs a rules change too, not just a UI change.

---

## Decision 1 — Instructor "General Duty" clock-in (applies to every instructor, not just manager-instructors)

**Proposed:** remove the instructor-only hard block. When an instructor has no class today, let them fall through to the same `classId: "general"` / "General Duty" clock-in every other staff role already uses.

- No data model change needed — `clockIn()` already accepts `classId: "general"` and this path already exists for other roles.
- Reports/punctuality that key off a real `classId` should already treat `"general"` as non-teaching, since Front Office and Marketing shifts already flow through it today; worth a quick confirmation pass rather than new logic.
- Optional guardrail if you want visibility into how often this happens: tag these shifts (e.g. `generalDuty: true`) so Admin can filter "instructor clocked in with no class" separately in Staff Duty Logs, without treating it as an error.

**Open to challenge:** should this require any admin awareness (e.g. a review flag), or is silent parity with other staff roles fine? Left as-is (no flag) unless Kifry wants one.

---

## Decision 2 — Should a non-instructor manager's own attendance be tracked at all?

This is a policy call, not a code call — the fix itself is small either way.

| Option | What it means | When it fits |
|---|---|---|
| **A. Track it** | Remove the `role === "manager"` block; manager badges go through the same staff path as everyone else (Admin scans it, same as other staff badges per existing policy). Shift shows up in Staff Duty Logs like any staff member's. | The school wants to know when this manager is on-site, or their hours matter for payroll. |
| **B. Leave it view-only** | No change — managers keep zero clock-in ability. | The manager is salaried/trusted and presence-logging adds no value. |

**Recommendation: Option A.** It costs nothing extra in the data model (same `shifts` collection, same `classId: "general"` pattern as Decision 1), and it doesn't touch the manager's existing oversight permissions — "can this account edit *other people's* shifts" and "does this account's *own* presence get logged" are separate rules and can stay decoupled. If a manager truly needs zero attendance record, Option B is a one-line revert (keep the current block).

**Done when:** a manager-only account can badge in for General Duty like Front Office/Marketing, while still having no write access to other people's shifts.

---

## Rules change needed for Option A

Add `manager` to whichever "tracked roles" list gates `shifts` create in `firestore.rules` (the same list the v2 plan built for Front Office/Marketing/Office Boy). No change needed to the `shifts` **update**/delete rules — those already stay Admin-only regardless of whose shift it is.

---

## Not changed by this doc

- The two-account model for a manager who also teaches stays as-is: manager account for oversight, instructor account for the badge. Decision 1 just means that instructor account is no longer stuck on non-teaching days.
- Manager's read/oversight view of *other* staff's attendance is untouched.
