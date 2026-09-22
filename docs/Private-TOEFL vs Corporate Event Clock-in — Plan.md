# Private/TOEFL Instructor vs Corporate Event Clock-in — Plan

Scope: instructor-only, per your steer. Everything about office boy/front office/marketing/managers from earlier sessions is parked, not part of this.

## The bug

`Kiosk.jsx`, instructor clock-in branch (~line 275–345):

```
const { match: matchedEvent } = findMatchingCorporateEvents(...)   // ~line 275
...
if (todayClasses.length > 0) {
  return setPendingClockIn({ uid, userData, classes: todayClasses });   // line 304-305
}
// matchedEvent is only checked AFTER this return, i.e. never for private/TOEFL instructors
```

`isPrivateBatch()` makes private/TOEFL classes always appear in `todayClasses` (see `punctuality.js`), so line 304's condition is always true for those instructors — the `matchedEvent` check a few lines below is dead code for them.

## Recommended fix (Option A — offer both)

1. **Pass the event through instead of dropping it.** Change line 305 to include `matchedEvent` in the state: `setPendingClockIn({ uid, userData, classes: todayClasses, matchedEvent })`.
2. **Render it as an extra pickable option.** In the picker UI (~line 617–660, where `pendingClockIn.classes.map(...)` renders each class as a choice), add one more option when `pendingClockIn.matchedEvent` exists — same visual treatment as a class, labeled with the event name.
3. **Branch `createShift()` (~line 70–104) on what got picked.** If the selected option is the event (not a class id), call `clockIn()` with the same `corporate_event` payload shape already used elsewhere in this file (`classId: `corporate_event:${event.id}``, `shiftType: "corporate_event"`, `eventId`) instead of the class-based payload. If a class was picked, existing logic runs unchanged.

Net effect: private/TOEFL instructors with a same-day matching event get a real choice at the kiosk instead of being silently forced into the class path. Non-private instructors and days with no matching event are untouched — this only adds a branch, doesn't change existing behavior.

## Alternative (Option B — do nothing here, handle manually)

Leave the code as-is; if a private/TOEFL instructor needs to be credited for a corporate event instead, an admin corrects the shift afterward via the existing `ShiftAdjustmentModal.jsx`. Zero code risk, but relies on someone noticing every collision after the fact.

## Recommendation

Option A. It's a contained, three-spot change reusing data (`matchedEvent`) and a payload shape (`corporate_event`) that already exist in this same file — not new infrastructure. Option B just defers the same problem to manual tracking indefinitely, which is the pattern you already decided against for the rostering questions.

Not locked — exec agent can push back or propose a third approach.
