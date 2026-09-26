# Attendance Module v4 — MyLiberty Integration Specification

**Target repository:** `aymira-git/mylibertyportal-origin`  
**Target branch:** `main`  
**Purpose:** Agent-ready implementation specification for adding class/session-based student attendance to the existing MyLiberty Portal without breaking its current attendance, kiosk, staff-shift, corporate-event, reporting, or parent-portal behavior.

---

## 1. Executive decision

The proposed class attendance module **can and should be integrated into MyLiberty**, but it must be treated as an **incremental integration**, not a greenfield attendance rewrite.

### Most important architectural decision

**Do not repurpose the existing top-level `attendance` collection for class attendance in Phase 1.**

The repository already uses `/attendance` for an established one-record-per-student/day kiosk contract, including corporate-event matching, reports, and other consumers. Reusing it for class-specific records would silently change its semantics and could break existing workflows.

### Phase 1 target

Add a separate collection:

```text
/classAttendance/{classId}_{studentId}_{attendanceDate}
```

while keeping the existing:

```text
/attendance/{uid}_{attendanceDate}
```

behavior intact.

The new implementation still belongs under:

```text
src/features/attendance/
```

because attendance remains the domain owner.

---

## 2. Repository facts this specification is based on

The current repository is domain/feature-oriented and explicitly prefers repository/data-access modules for new Firestore access.

Relevant domains:

```text
src/features/attendance/
src/features/classes/
src/features/students/
src/features/reports/
src/features/dashboard/
src/features/shared/
```

Current stack includes React + Vite, Firebase Authentication, Firestore, Storage, Zod, Vitest, Playwright, and PWA support. The project standardizes on **WITA (`Asia/Makassar`)**.

The architecture documentation treats:

```text
firestore.rules
firestore.indexes.json
```

as protected infrastructure. Authentication and Firestore Security Rules are the authorization boundary; UI role checks are not security.

---

## 3. Existing attendance behavior that must not regress

### 3.1 Existing student kiosk attendance

Current files:

```text
src/features/attendance/kioskScanProcessor.js
src/features/attendance/shiftsRepository.js
```

Current student kiosk flow:

1. scan student QR/badge;
2. resolve user;
3. reject inactive/graduated students;
4. calculate today's WITA date;
5. resolve matching corporate events;
6. write student attendance;
7. show result.

The current `recordStudentAttendance()` uses the deterministic legacy ID:

```js
const docId = `${uid}_${dateKey}`;
setDoc(doc(db, "attendance", docId), payload, { merge: true });
```

Keep this legacy behavior intact.

### 3.2 Existing staff attendance / shifts

Do not rewrite the staff shift infrastructure. The attendance domain also owns clock-in/out, stale-shift auto-close, instructor scheduled classes, corporate-event shifts, kiosk verification, shift corrections, and audit trails.

The new class attendance workflow must not duplicate or replace those responsibilities.

### 3.3 Existing instructor class lookup

`src/features/attendance/shiftsRepository.js` already provides:

```js
fetchInstructorClasses(uid)
```

which queries both:

```text
classes.instructorId == uid
classes.substituteInstructorId == uid
```

Reuse this capability rather than creating a second instructor-class lookup path.

---

## 4. Existing class/enrollment model

`src/features/classes/classesRepository.js` already contains the class/student relationship needed for MVP attendance.

Relevant class fields include:

```text
instructorId
substituteInstructorId
studentIds
enrollments
status
schedule/class timing fields
branch/branchId where applicable
```

Existing workflows already add, remove, and transfer students while maintaining `studentIds` and `enrollments`.

### Important decision

**Do not create a new top-level `enrollments` collection just for this feature in Phase 1.**

Reuse:

```text
classes/{classId}.studentIds
classes/{classId}.enrollments
```

unless implementation/testing demonstrates that the current model cannot satisfy a required query or security rule. A normalized enrollment collection can be a later, evidence-driven change.

### `studentIds` / `enrollments` duality

The class model carries two enrollment representations:

- `studentIds` — flat string array of student UIDs, used by Firestore Security Rules, capacity checks, and most UI lookups.
- `enrollments` — array of objects `{ studentId, dateJoined, level }`, used for audit/tracking metadata.

The codebase treats `studentIds` as the **source of truth for enrollment membership**.

`addStudentToClass()` writes both fields atomically via `arrayUnion`. `removeStudentFromClass()` filters both fields. `transferStudentBetweenClasses()` updates both in a `writeBatch`.

However, legacy classes may exist where `studentIds` is empty/missing but `enrollments` contains records. The fallback pattern already exists in the codebase:

```js
// src/features/classes/BatchOutreachPanel.jsx
const ids = new Set(
  batch.studentIds || batch.enrollments?.map((e) => e.studentId) || []
);
```

**Rules for this feature:**

1. **Firestore Security Rules** must check `studentIds` only — this is the established Rules pattern (see existing `classes` and `progressReports` rules which use `studentIds.hasAny()`). Rules cannot easily iterate an array of objects.
2. **Application-level enrollment checks** (repository/UI) should use the same fallback pattern: prefer `studentIds`, fall back to `enrollments.map(e => e.studentId)` when `studentIds` is empty/missing.
3. **Close-out roster generation** must use the same fallback to avoid silently excluding students from legacy classes.
4. If a class is found where `studentIds` is empty but `enrollments` is populated, log a warning but proceed using the `enrollments` fallback. Do not silently skip those students.

---

## 5. New class attendance data model

Create:

```text
classAttendance/{attendanceId}
```

with deterministic document ID:

```text
{classId}_{studentId}_{attendanceDate}
```

Example:

```text
classA_student123_2026-09-26
```

### Recommended document shape

```js
{
  classId: "classA",
  studentId: "student123",
  attendanceDate: "2026-09-26",

  status: "PRESENT",
  method: "SCAN",

  markedBy: "staffUid",
  markedByName: "Instructor Name",
  markedAt: "2026-09-26T01:25:31.000Z",

  studentName: "Student Name",
  className: "Morning English A",
  branchId: "kota_gorontalo",
  note: "",

  createdAt: "2026-09-26T01:25:31.000Z",
  updatedAt: "2026-09-26T01:25:31.000Z"
}
```

### Zod schema

Create a validation schema at `src/schemas/classAttendanceSchema.js` following the project convention (see `batchSchema.js`, `corporateEventSchema.js`, etc.).

The schema must:

- validate required fields: `classId`, `studentId`, `attendanceDate`, `status`, `method`, `markedBy`, `markedAt`;
- constrain `status` to the allowed enum;
- constrain `method` to the allowed enum;
- default optional fields (`note`, `studentName`, `className`, `branchId`);
- export from `src/schemas/index.js`.

The repository should validate payloads through this schema before writing to Firestore.

```js
// Example shape — adapt to match project conventions
import { z } from "zod";

export const classAttendanceSchema = z.object({
  classId: z.string().min(1),
  studentId: z.string().min(1),
  attendanceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["PRESENT", "ABSENT"]),
  method: z.enum(["SCAN", "MANUAL", "CLOSE_OUT"]),
  markedBy: z.string().min(1),
  markedByName: z.string().optional().default(""),
  markedAt: z.string().min(1),
  studentName: z.string().optional().default(""),
  className: z.string().optional().default(""),
  branchId: z.string().optional().default(""),
  note: z.string().optional().default(""),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
```

### Required fields

At minimum:

```text
classId
studentId
attendanceDate
status
method
markedBy
markedAt
```

### Status values

MVP minimum:

```text
PRESENT
ABSENT
```

Add `LATE` or `EXCUSED` only if the current product requirements actually need them.

### Method values

```text
SCAN
MANUAL
CLOSE_OUT
```

Do not mix this with the legacy `/attendance` method contract such as `KIOSK`.

---

## 6. Why deterministic IDs are mandatory

A class attendance record is uniquely identified by:

```text
class + student + date
```

Deterministic IDs prevent duplicates caused by rapid scans, camera retries, UI double-clicks, and similar races.

The deterministic ID is not an authorization mechanism. Firestore Rules must still validate class ownership, enrollment, identity fields, role, marker identity, and allowed state transitions.

### Known limitation: one session per class per day

The `{classId}_{studentId}_{date}` ID scheme assumes each class meets **at most once per day**. If a class were to meet twice on the same day (morning and afternoon sessions), the ID would collide.

This is acceptable for MVP because:

- The current class scheduling model (`classDay` + `startTime`/`endTime`) represents a single recurring time slot per class.
- The `scheduleConflict.js` conflict detector treats each class as having one time window.
- There is no current product requirement for multi-session-per-day classes.

If multi-session-per-day support becomes necessary in the future, the ID scheme would need a session discriminator (e.g., `{classId}_{studentId}_{date}_{sessionIndex}`). This would be a data-model change requiring migration planning.

---

## 7. Timezone policy

Do **not** add a new `schoolSettings.timezone` document for this implementation.

The project already standardizes around WITA and already provides helpers such as:

```js
todayWita()
getTodayWitaWeekday()
```

Use the existing WITA utilities for:

```text
attendanceDate
today's class selection
close-out date
daily attendance reports
```

Do not use arbitrary device-local calendar logic.

A configurable timezone is a future requirement only if the product becomes genuinely multi-timezone.

---

## 8. Class resolution

A student can have multiple classes on the same day. **Do not silently guess the wrong class.**

### Preferred resolution order

#### A. Instructor-selected class context — primary

```text
Instructor opens Attendance
        ↓
Selects one of today's classes
        ↓
Attendance context contains classId
        ↓
Scan student QR
        ↓
Verify enrollment
        ↓
Create attendance
```

#### B. Fallback when no class is selected

1. identify student;
2. load today's active/scheduled classes;
3. find classes where the student is enrolled;
4. one match → use it;
5. multiple matches → explicit **Select Class** state;
6. zero matches → reject.

Do not make approximate clock-time matching the primary resolver. Classes can overlap, students can arrive early, and schedules can change.

---

## 9. Attendance state machine

### First scan

```text
NO RECORD
   ↓ scan
PRESENT / SCAN
```

### Repeat scan

```text
RECORD EXISTS
   ↓ scan
DO NOT OVERWRITE
```

UI can show `Already Checked In`; no mutation is needed.

### Existing manual correction

Example:

```text
ABSENT / MANUAL
```

followed by another scan must remain:

```text
ABSENT / MANUAL
```

**Manual correction has precedence.**

### Manual correction

Authorized staff may change status, but must set:

```text
method = MANUAL
markedBy = current authenticated UID
markedAt = current time
updatedAt = current time
```

Do not allow a correction to change:

```text
classId
studentId
attendanceDate
```

---

## 10. Close-out behavior

Class close-out should create absent records only for roster students with no record.

Example:

```text
Roster: Student 1, Student 2, Student 3, Student 4
Existing: Student 1=PRESENT, Student 2=PRESENT
Close-out: Student 3=ABSENT/CLOSE_OUT, Student 4=ABSENT/CLOSE_OUT
```

### Non-negotiable rule

```text
missing record → create ABSENT / CLOSE_OUT
existing record → leave unchanged
```

Never overwrite existing `SCAN` or `MANUAL` decisions.

Use a batch where appropriate, but respect Firestore batch limits.

### Confirmation requirement

Close-out is a bulk-write operation that cannot be easily undone. The UI must require explicit instructor confirmation before executing close-out.

Use the existing `useConfirm()` pattern. The confirmation dialog should show:

```text
Close Attendance for [Class Name]?
[N] students will be marked absent.
This cannot be undone.
```

### Idempotency

Close-out is idempotent: running it twice on the same class/date produces the same result because the second run finds all students already have records and creates nothing. The UI should still show feedback ("All students already have attendance records") rather than silently completing.

---

## 11. Repository structure

Recommended new file:

```text
src/features/attendance/classAttendanceRepository.js
```

Responsibilities:

- fetch class attendance;
- create first-scan records;
- create close-out absent records;
- manual corrections;
- student/class attendance history;
- Firestore access for the class-attendance model.

Keep Firestore access out of React components.

Suggested API (names may be adapted):

```js
fetchClassAttendance(classId, attendanceDate)
fetchClassAttendanceForStudent(studentId, dateFrom, dateTo)
createScanAttendance({...})
correctClassAttendance({...})
closeOutClassAttendance({...})
```

The scan path should be create-only from the application perspective. Do not use merge semantics that could mutate a manual record.

---

## 12. Integration with `kioskScanProcessor.js`

Do not rewrite the existing staff branch.

Introduce a class-attendance context/mode, for example:

```js
handleKioskScan(uid, {
  attendanceMode: "CLASS",
  classId,
  ...
})
```

Conceptual class flow:

```text
scan QR
  ↓
validate QR/user
  ↓
validate student status
  ↓
resolve class context
  ↓
verify enrollment
  ↓
check deterministic classAttendance doc
  ↓
if missing: create PRESENT / SCAN
else: do nothing
  ↓
show result
```

Preserve the current legacy student kiosk flow, staff clock-in/out, and corporate-event behavior.

---

## 13. Instructor dashboard integration

Use the existing instructor dashboard/attendance entry points rather than creating a parallel attendance application.

Expected flow:

```text
Instructor Dashboard
    ↓
Attendance
    ↓
Today's assigned classes
    ↓
Select class
    ↓
Roster / scanner
    ↓
Live attendance
```

The instructor should only see/modify classes assigned to them, including valid substitution through `substituteInstructorId`.

### Realtime listener policy

The roster/attendance view for a selected class should use a **realtime Firestore listener** (not a one-time fetch) scoped to:

```text
classAttendance where classId == selectedClassId AND attendanceDate == todayWita()
```

This is a small, bounded query (one class, one day, typically 5–30 students) and is safe for realtime use.

The listener enables:

- co-instructors/substitutes seeing each other's marks in real time;
- immediate roster updates when a student is scanned at the kiosk;
- live present/absent counters without manual refresh.

Clean up the listener when the instructor navigates away from the class view or selects a different class.

---

## 14. Instructor authorization

Create a rule helper equivalent to:

```text
isAssignedToClass(classId)
```

Conceptually:

```text
class.instructorId == request.auth.uid
OR
class.substituteInstructorId == request.auth.uid
```

Authorization must be derived from the actual class document. Never trust a client-provided instructor ID or UI role state.

---

## 15. Enrollment authorization

A student may only receive class attendance if:

```text
classes/{classId}.studentIds contains studentId
```

This must be enforced in Firestore Security Rules, not only by a client-side `includes()` check.

Client validation is UX; Rules are authorization.

---

## 16. Branch authorization

Use the branch information already carried by the class model.

The existing Firestore Rules already provide `isSameBranch(data)` which handles the `branchId` / legacy `branch` duality:

```text
1. If data.branchId exists → compare directly to userBranch()
2. Else if data.branch exists → map legacy display names to IDs
3. Else if neither exists → default to kota_gorontalo
```

The `isSameBranchStrict(data)` variant omits fallback #3 and should be used for `list` rules to prevent cross-branch leaks via queries without branch filters.

**For `classAttendance` rules:**

- Use `isSameBranch(classDoc(classId))` — branch scoping derives from the **class document**, not the attendance record itself.
- The `classAttendance` document should store `branchId` as a denormalized field (copied from the class at creation time) for reporting queries, but the Rules must derive branch authorization from the canonical class document.
- The `batchSchema` already normalizes `branchId` via `branchToId(data.branchId || data.branch)`, so newly created classes will always have `branchId`. Legacy classes may only have `branch`.

Do not allow a client to move an attendance record between branches by supplying arbitrary branch data.

---

## 17. Draft Firestore Security Rules

**This is a draft integration target, not a deployment-ready assertion. Verify exact field names, role semantics, and Rules syntax in the existing emulator test suite before deployment.**

### Rules `get()` caching note

Firestore Security Rules cache `get()` results within a single request evaluation. The `classDoc()` helper below is called multiple times per rule evaluation, but only one actual document read occurs per unique path. Each unique `get()` path counts against the 10-call-per-request limit. For `classAttendance` rules, a single create/update evaluation reads ~2 documents (1 user profile via `userProfile()`, 1 class via `classDoc()`), well within limits.

Add helpers near the current role helpers as appropriate:

```rules
function classDoc(classId) {
  return get(/databases/$(database)/documents/classes/$(classId)).data;
}

function isAssignedToClass(classId) {
  let c = classDoc(classId);
  return signedIn()
    && (
      c.instructorId == request.auth.uid
      || c.substituteInstructorId == request.auth.uid
    );
}

function canManageClassAttendance(classId) {
  return isAdmin()
    || (
      isFrontOffice()
      && isSameBranch(classDoc(classId))
    )
    || (
      (
        hasRole('instructor')
        || hasRole('instructorleader')
        || hasRole('instructor_leader')
      )
      && isAssignedToClass(classId)
    );
}

function studentIsEnrolled(classId, studentId) {
  return studentId in classDoc(classId).studentIds;
}

function validClassAttendanceIdentity(data) {
  return data.classId is string
    && data.studentId is string
    && data.attendanceDate is string
    && data.markedBy is string
    && data.markedBy == request.auth.uid;
}
```

### `studentIsEnrolled` — Rules-level limitation

The `studentIsEnrolled` helper checks `studentIds` only, not `enrollments`. This is intentional:

- Firestore Rules cannot iterate an array of objects to extract `.studentId` fields.
- `studentIds` is the flat array format that Rules can check with `in` or `hasAny()`.
- The existing `classes` and `progressReports` rules already use `studentIds.hasAny()` for the same purpose.

If a legacy class has an empty `studentIds` but populated `enrollments`, Rules will reject the attendance write. The application must detect and warn about this condition before attempting the write. In practice, all current enrollment operations (`addStudentToClass`, `transferStudentBetweenClasses`) write both fields atomically, so this gap only affects classes created before the dual-field pattern was established.

Then add a new collection rule:

```rules
match /classAttendance/{attendanceId} {

  allow read: if
    isAdmin()
    || (
      (isManager() || isFrontOffice())
      && isSameBranch(classDoc(resource.data.classId))
    )
    || (
      (
        hasRole('instructor')
        || hasRole('instructorleader')
        || hasRole('instructor_leader')
      )
      && isAssignedToClass(resource.data.classId)
    )
    || (
      signedIn()
      && resource.data.studentId == request.auth.uid
    );

  // First attendance creation only.
  allow create: if
    canManageClassAttendance(request.resource.data.classId)
    && validClassAttendanceIdentity(request.resource.data)
    && studentIsEnrolled(
      request.resource.data.classId,
      request.resource.data.studentId
    )
    && request.resource.data.status in ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']
    && request.resource.data.method in ['SCAN', 'MANUAL', 'CLOSE_OUT'];

  // Existing records must not be overwritten by scan.
  allow update: if
    canManageClassAttendance(resource.data.classId)
    && request.resource.data.classId == resource.data.classId
    && request.resource.data.studentId == resource.data.studentId
    && request.resource.data.attendanceDate == resource.data.attendanceDate
    && validClassAttendanceIdentity(request.resource.data)
    && request.resource.data.method == 'MANUAL'
    && request.resource.data.status in ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'];

  allow delete: if isAdmin();
}
```

### Rule verification checklist

The agent must verify:

1. class documents consistently expose `studentIds`;
2. branch fields are actually `branchId`, `branch`, or both;
3. instructor leader scope matches intended product policy;
4. manager read access is appropriate;
5. anonymous parent access stays blocked;
6. deterministic ID enforcement is implemented safely rather than assuming unsupported Rules string/path features;
7. `LATE` and `EXCUSED` are actually needed before keeping them in Rules.

Do not weaken the collection to:

```rules
allow read, write: if isStaff();
```

---

## 18. Stronger create/update strategy

The Rules and repository should preserve this separation:

```text
SCAN
  → create only

MANUAL
  → explicit update only

CLOSE_OUT
  → create missing records only
```

This is the primary mechanism for preserving the requirement:

```text
manual correction takes precedence over later scans
```

---

## 19. Parent portal policy

Current parent portal files:

```text
src/features/students/ParentPortalPage.jsx
src/features/students/parentPortalRepository.js
```

The current portal is intentionally public/read-only and reads a bounded student/batch bundle; it does not directly expose raw attendance history.

### Do not make `classAttendance` publicly readable

Do not add anonymous access based on discoverable student identifiers.

Phase 1 recommendation: leave parent attendance behavior unchanged. If a parent attendance history is required later, build a deliberate privacy-safe access layer rather than granting public collection reads.

---

## 20. Reporting integration

Existing reporting code reads the legacy `/attendance` collection for today's scans.

Do not automatically mix `classAttendance` into those queries in Phase 1. Add explicit class-attendance reporting functions such as:

```text
fetchClassAttendanceForDate()
fetchClassAttendanceSummary()
fetchStudentClassAttendance()
```

Only combine legacy and class attendance in a report when that report intentionally defines how the two models should be counted.

---

## 21. Firestore indexes

Start with indexes required by real queries. Candidate indexes are:

```json
{
  "collectionGroup": "classAttendance",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "classId", "order": "ASCENDING" },
    { "fieldPath": "attendanceDate", "order": "ASCENDING" }
  ]
}
```

and:

```json
{
  "collectionGroup": "classAttendance",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "studentId", "order": "ASCENDING" },
    { "fieldPath": "attendanceDate", "order": "DESCENDING" }
  ]
}
```

Do not add speculative indexes. Verify current query shapes first and update `firestore.indexes.json` only when justified.

---

## 22. Attendance UI requirements

### Instructor class view

Minimum:

```text
Class name
Instructor
Date
Roster size
Present count
Absent count
Attendance completion state
```

### Student row

```text
Student name
Current status
Marked time
Method
Manual/correction indicator
```

### Scanner feedback

First scan:

```text
Attendance Recorded
```

Repeat scan:

```text
Already Checked In
```

Manual record exists:

```text
Attendance Already Decided
```

Non-enrolled:

```text
Student Not Enrolled In This Class
```

Ambiguous/no class context:

```text
Select Class
```

Never show generic success when class association is ambiguous.

---

## 23. Kiosk and offline security

The repository already has kiosk security and browser-side scanning behavior. Preserve it.

Do not:

- bypass existing kiosk authentication/device checks;
- bypass Cloudflare Worker proof mechanisms already used by the kiosk path;
- weaken fail-closed behavior;
- create a new offline queue that can replay class attendance without revalidation.

Reuse the existing scanner surface, but enforce the new class-attendance authorization independently.

---

## 24. Testing requirements

The repo already exposes these scripts (verify `package.json` before execution):

```bash
npm test
npm run test:rules
npm run test:e2e
npm run typecheck
npm run lint
npm run build
```

### Firestore Rules test matrix

Extend the current emulator test coverage with:

```text
✓ assigned instructor can read own class attendance
✓ assigned substitute can read own class attendance
✗ instructor cannot read another instructor's class
✗ instructor cannot read another branch's class
✓ permitted front office can read same-branch attendance
✗ cross-branch front office cannot read attendance
✓ enrolled student can be marked
✗ non-enrolled student cannot be marked
✗ client cannot rewrite classId/studentId/date
✓ markedBy must equal authenticated UID
✗ invalid status rejected
✗ invalid method rejected
✓ first scan can create PRESENT
✗ scan cannot update an existing record
✗ scan cannot overwrite MANUAL
✓ authorized manual correction works
✗ unauthorized correction fails
✓ close-out creates missing ABSENT
✗ close-out does not overwrite PRESENT
✗ close-out does not overwrite MANUAL
✗ anonymous classAttendance read fails
```

Negative tests are required.

### Repository/unit tests

Cover:

```text
create deterministic attendance ID
do not update existing scan record
manual correction behavior
close-out behavior
enrollment validation
WITA date behavior
```

### Class-resolution tests

Test a pure resolver for:

```text
selected class + enrolled student → selected class
selected class + non-enrolled student → reject
no selection + one matching class → resolve
no selection + multiple matching classes → ambiguous
no selection + no matching class → reject
```

### E2E minimum

Cover:

```text
login as instructor
→ open Attendance
→ select class
→ scan/enter student
→ PRESENT appears
→ scan same student again
→ no duplicate
→ manually mark ABSENT
→ scan again
→ ABSENT remains
```

And:

```text
close class
→ missing students become ABSENT
→ already-present students remain PRESENT
```

---

## 25. Migration strategy

### Phase 0 — No behavior change

Create repository utilities and pure resolution/validation functions. Do not change legacy `/attendance`.

### Phase 1 — Firestore model + Rules

Add `classAttendance` rules and emulator tests. Pass security tests before wiring UI.

### Phase 2 — Instructor attendance UI

Add class selection, roster, and attendance states to the existing instructor workflow.

### Phase 3 — Scanner integration

Add class context to scanning while retaining the legacy student kiosk path.

### Phase 4 — Close-out

Add missing-student absent generation.

### Phase 5 — Reporting

Add dedicated class-attendance reporting.

### Phase 6 — Optional parent view

Only if product requirements justify it, using a privacy-safe access layer.

---

## 26. Do not do these things

Do not:

```text
replace /attendance with /classAttendance
delete recordStudentAttendance()
rewrite the entire attendance feature
create a second class model
create a second enrollment model without a demonstrated need
trust instructor role from client state
trust class ownership from client state
let scan update an existing attendance record
grant anonymous access to classAttendance
add schoolSettings.timezone for this feature
use device-local dates
add speculative Firestore indexes
put Firestore reads/writes directly into React components
```

---

## 27. Architecture-change requirement

This feature adds a new Firestore data model, so it is an intentional architecture/data-model change.

After implementation:

1. document the new collection;
2. document ownership/security;
3. document query shapes;
4. document indexes;
5. add tests;
6. verify build/lint/typecheck;
7. update architecture/proposal documentation as required.

Do not silently add the collection and leave the architecture documentation inaccurate.

---

## 28. Definition of done

### Data

```text
classAttendance exists
deterministic ID is used
classId/studentId/date are immutable identity fields
```

### Security

```text
instructors are restricted to their own classes
substitutes can access valid substitute classes
enrollment is enforced by Rules
marker identity is enforced by Rules
cross-branch access is blocked
anonymous access is blocked
scan cannot overwrite existing records
manual correction is authorized
```

### Behavior

```text
first scan → PRESENT
repeat scan → no mutation
manual correction → MANUAL
scan after manual correction → unchanged
close-out → creates only missing ABSENT records
```

### Time

```text
WITA date is used consistently
```

### Integration

```text
legacy /attendance still works
staff shifts still work
corporate events still work
existing reports still work
parent portal still works
existing kiosk security remains intact
```

### Verification

```text
npm test
npm run test:rules
npm run typecheck
npm run lint
npm run build
```

and relevant E2E tests should pass.

---

## 29. Recommended implementation order for the coding agent

Use this sequence:

```text
1. Read AGENTS.md
2. Read docs/ARCHITECTURE.md
3. Inspect current attendance/classes code
4. Confirm current class field names
5. Add classAttendance repository
6. Add pure class-resolution logic
7. Add Firestore Rules helpers/rules
8. Add emulator Rules tests
9. Run Rules tests
10. Add instructor attendance UI
11. Add scanner/class-context integration
12. Add close-out
13. Add repository/unit tests
14. Add E2E coverage
15. Review indexes
16. Run lint/typecheck/build/full tests
17. Update architecture documentation
```

Do not start by modifying Rules and UI together without first establishing the schema and test fixtures.

---

## 30. Schema verification checklist before coding

The implementation agent must verify these against the current repository:

```text
[ ] exact class status values
[ ] exact class schedule fields
[ ] exact class branch fields
[ ] instructorId
[ ] substituteInstructorId
[ ] studentIds
[ ] enrollments shape
[ ] exact student identifier field
[ ] existing QR/badge lookup field
[ ] existing kiosk mode/context mechanism
[ ] existing instructor attendance entry point
[ ] exact role names
[ ] instructor-leader scope
```

Do not invent replacements for these fields without checking the code.

---

## 31. Final architecture

The feature should feel like a native extension of MyLiberty rather than a second attendance application.

```text
                    MyLiberty Attendance Domain
                              │
             ┌────────────────┴─────────────────┐
             │                                  │
     Existing attendance                 Class attendance
        /attendance                      /classAttendance
             │                                  │
      student/day kiosk                  class/student/day
             │                                  │
     corporate events                   instructor/session UI
     staff/reports                      roster/close-out
             │                                  │
             └──────── shared Auth / Firestore ─────────┘
```

The key compatibility boundary is:

```text
LEGACY ATTENDANCE
     ≠
CLASS ATTENDANCE
```

The two models can coexist safely while sharing authentication, Firestore, WITA utilities, QR scanning infrastructure, role semantics, branch semantics, and the existing test infrastructure.

---

## Source snapshot used

This specification was grounded against the repository's current `main` branch structure and these implementation areas:

```text
README.md
docs/ARCHITECTURE.md
package.json
firestore.rules
firestore.indexes.json

src/features/attendance/shiftsRepository.js
src/features/attendance/kioskScanProcessor.js
src/features/classes/classesRepository.js
src/features/students/parentPortalRepository.js
src/features/shared/firestoreRules.emulator.test.js
```

Repository:

```text
https://github.com/aymira-git/mylibertyportal-origin
```

**Status:** Implementation specification / coding-agent handoff.  
**Important:** Draft Firestore Rules must be verified in the repository's Firestore emulator before deployment.
