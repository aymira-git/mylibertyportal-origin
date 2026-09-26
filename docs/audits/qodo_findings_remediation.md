# Qodo Security Findings — Remediation Summary

All 6 findings have been addressed and verified.

---

## Finding 1: Firestore Rules `classDoc()` null guards ✅

**Risk:** Rule evaluation error (hard-deny / DoS) when a referenced class doc is missing.

**Fix:** Added `c != null` guards to:
- [`isAssignedToClass()`](file:///E:/myliberty-portal/firestore.rules#L121-L130)
- [`canManageClassAttendance()`](file:///E:/myliberty-portal/firestore.rules#L132-L151)
- [`studentIsEnrolled()`](file:///E:/myliberty-portal/firestore.rules#L153-L156)

All three now fail closed (deny) when the class document doesn't exist, instead of crashing the rule evaluator.

---

## Finding 2: Firestore index alignment ✅

**Risk:** Missing composite indexes for actual query shapes.

**Fix:** Added to [`firestore.indexes.json`](file:///E:/myliberty-portal/firestore.indexes.json):
- `classAttendance` — `studentId` ASC + `attendanceDate` **DESC** (for newest-first student history)
- `classAttendance` — `classId` ASC + `attendanceDate` ASC (for class roster queries)

> [!IMPORTANT]
> These indexes need to be deployed: `firebase deploy --only firestore:indexes`

---

## Finding 3: `uid` vs `rawId` inconsistency ✅

**Risk:** Whitespace-padded or non-string scan values could create mismatched document IDs.

**Fix:** In [`kioskScanProcessor.js`](file:///E:/myliberty-portal/src/features/attendance/kioskScanProcessor.js#L77-L128), changed `resolveStudentClass({ studentId: uid })` and `recordClassAttendanceScan({ studentId: uid })` to use the sanitized `rawId` consistently.

---

## Finding 4: Manual update bypasses schema validation ✅

**Risk:** Invalid status/note/fields could be written to Firestore, breaking UI assumptions.

**Fix:** In [`classAttendanceRepository.js`](file:///E:/myliberty-portal/src/features/attendance/classAttendanceRepository.js#L203-L220), the update path now merges `existingSnap.data()` with `updates` and passes the result through `classAttendanceSchema.parse()` before calling `updateDoc()`.

---

## Finding 5: Scanner empty error callback ✅

**Risk:** Camera permission errors and scan failures were silently swallowed.

**Fix:** In [`InstructorAttendanceView.jsx`](file:///E:/myliberty-portal/src/features/attendance/InstructorAttendanceView.jsx#L251-L264), replaced `() => {}` with a real error callback that:
- Filters out high-frequency "not found" frames (normal QR scanning noise)
- Surfaces genuine errors as `scannerStatus` messages visible to the instructor

---

## Finding 6: Close-out TOCTOU race condition ✅

**Risk:** Concurrent scans during close-out could cause batch commit failures or partial writes.

**Fix:** In [`classAttendanceRepository.js`](file:///E:/myliberty-portal/src/features/attendance/classAttendanceRepository.js#L290-L365):
- Added catch-and-retry logic: if a batch fails with `ALREADY_EXISTS`, the function re-reads each doc in the chunk and retries only truly missing students
- Changed `createdCount` to track actual successful creates rather than assumed count
- The operation remains idempotent and safe under concurrent marking

---

## Verification

| Check | Result |
|---|---|
| `npm test` | ✅ 747 passed, 39 skipped |
| `npm run typecheck` | ✅ Clean |
| `npm run build` | ✅ Clean |
| `npm run lint` | ⚠️ 5 pre-existing errors (unrelated to these changes) |
