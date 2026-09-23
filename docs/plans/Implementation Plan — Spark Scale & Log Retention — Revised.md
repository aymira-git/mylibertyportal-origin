# Implementation Plan — Spark Scale & Log Retention — Revised

## Review Summary

The original plan has the right overall direction, but I would change the implementation order and tighten several architectural details before coding.

The main recommendations are:

1. Keep multi-tab Firestore persistence, but treat it as a read-reduction mechanism rather than a guarantee that the app will stay under the Spark quota.
2. Fix the instructor roster at the **data-hook level and component level**: scope student reads to assigned class IDs **and** stop mounting duplicate `useInstructorRoster()` listeners.
3. Keep the 38-day `errorLogs` cleanup client-side because the project is intentionally staying on Spark, but put the Firestore logic behind the dashboard repository boundary and add quota-safe, resumable behavior.
4. Do **not** implement the original "load `users` only on Students/Staff tabs" change as written. The current dashboard uses user data in multiple workflows, including classes, applications, enrollment, instructor lookup, and overview widgets. Replace it with a measured, two-phase optimization.
5. Add a small usage/budget verification step so "1,000 students + 200 employees" is a measurable target rather than an assumption.

---

## 1. Objective

Support approximately:

- **1,000 students**
- **200 employees/staff**
- Firebase **Spark** plan
- No paid dependencies
- No external services

while keeping Firestore usage predictable and preserving the current application behavior, security rules, and schema unless a change is explicitly justified.

### Important quota facts

Cloud Firestore's current no-cost quota is:

| Resource | Daily free quota |
|---|---:|
| Document reads | 50,000 |
| Document writes | 20,000 |
| Document deletes | 20,000 |

Reads from realtime listeners are still billed as document reads when documents are added, updated, or removed from the listener result set.

Therefore, this plan must optimize both:

- **initial result-set size**, and
- **number of live listeners / listener result-set changes**.

> The 50,000-read target is a budget, not a promise. Real usage depends on active users, dashboard opens, listener changes, and other Firestore features.

References:
- https://firebase.google.com/docs/firestore/quotas
- https://firebase.google.com/docs/firestore/pricing

---

# 2. Architectural Constraints

The repository architecture explicitly treats `src/firebase.js`, the Firestore schema, security rules, authentication semantics, environment variables, and Firebase project configuration as protected infrastructure.

Any change to those areas needs an explicit reason and a separate verification pass.

The project also uses the repository pattern: direct Firestore reads/writes should live in the owning feature's `*Repository.js` file rather than in generic utilities.

Reference:
- `docs/ARCHITECTURE.md`

This affects two changes in the original plan:

- the Firebase cache change is allowed, but must be treated as a protected-infrastructure change;
- log-retention Firestore operations should not live in `src/utils/logRetention.js`.

---

# 3. Phase 0 — Establish a Read/Write Baseline

Before optimizing aggressively, measure the current application.

## 3.1 Add temporary development instrumentation

For a local/test environment, record:

- dashboard role
- active tab
- collection/query name
- number of documents returned by each initial snapshot
- number of documents changed during a session
- number of `getDocs`/aggregation calls
- retention deletes performed per run

Do not persist this instrumentation to Firestore.

## 3.2 Baseline scenarios

Test at realistic scale:

1. Admin opens dashboard once.
2. Front Office opens dashboard once.
3. Instructor opens Overview.
4. Instructor opens Classes.
5. Instructor opens Student Progress.
6. 5–10 staff members use the portal concurrently.
7. Repeat tab switching during the same session.
8. Open the application in two browser tabs.

## 3.3 Budget target

Use the following as the engineering guardrail:

> Keep normal school-day usage below roughly **70–80% of the free read quota**, leaving headroom for unexpected activity and background updates.

Do not declare success from a single page-load count.

---

# 4. Phase 1 — Multi-Tab Persistent Cache

## Goal

Allow multiple browser tabs on the same workstation to share the Firestore IndexedDB cache.

This is a valid optimization and also removes the current single-tab `failed-precondition` behavior.

## Modify

### `src/firebase.js`

Replace:

```js
enableIndexedDbPersistence(db)
```

with the current Firestore initialization model:

```js
initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});
```

Import the required APIs from `firebase/firestore`.

Keep the existing Auth and App Check behavior unchanged.

## Important safety note

Persistent Firestore cache survives across sessions and stores local cached documents.

Because this portal contains student/staff information, persistence should be treated as appropriate for trusted/managed workstations rather than assumed safe on arbitrary shared computers.

The Firebase documentation specifically warns about persistent web caches for sensitive data.

Reference:

https://firebase.google.com/docs/firestore/manage-data/enable-offline

## Verification

Test:

- one tab
- two tabs
- three tabs
- hard refresh
- browser restart
- offline/online transition
- sign-out/sign-in
- unsupported/private browsing environments where IndexedDB may not be available

Expected behavior:

- no obsolete `enableIndexedDbPersistence` warning
- no multi-tab `failed-precondition` warning under normal supported conditions
- application remains usable if persistent cache cannot be enabled

> Do not claim that multi-tab persistence alone reduces Firestore reads by a fixed percentage. Measure it.

---

# 5. Phase 2 — Instructor Roster Optimization

## Current issue

`useInstructorRoster()` currently listens to the entire student collection:

```js
query(collection(db, "users"), where("role", "==", "student"))
```

That means an instructor receives the full school student directory even though the UI only needs students enrolled in the instructor's assigned cohorts.

Reference:

`src/features/dashboard/useInstructorRoster.js`

## Additional issue discovered during review

`useInstructorRoster()` is also used inside:

- `InstructorDashboard`
- `InstructorClasses`
- `InstructorProgress`

The dashboard only renders the active tab, but the parent hook and the active child hook can both subscribe to the same roster data.

So the optimization should fix **both** the query scope and the duplicate hook ownership.

---

## 5.1 Single owner for roster data

### Modify

`src/features/dashboard/InstructorDashboard.jsx`

Keep one:

```js
const {
  uid,
  classes,
  students,
  instructorName,
  loading,
  error,
} = useInstructorRoster();
```

Then pass these values into child components.

### Modify

`InstructorClasses.jsx`

Remove its second `useInstructorRoster()` call.

Receive:

```js
classes
students
instructorName
loading
error
```

as props.

### Modify

`InstructorProgress.jsx`

Remove its second `useInstructorRoster()` call.

Receive the same roster state as props.

This prevents duplicated listeners in the active instructor tabs.

---

## 5.2 Scope student queries by assigned class IDs

### Modify

`src/features/dashboard/useInstructorRoster.js`

Flow:

1. Listen to primary instructor classes.
2. Listen to substitute instructor classes.
3. Merge/deduplicate class records.
4. Collect the union of all `studentIds`.
5. Query only those student documents.
6. Keep the student listeners synchronized when class membership changes.
7. Keep the instructor's own profile listener unchanged.

### Query strategy

Use document-ID queries:

```js
where(documentId(), "in", studentIdChunk)
```

Firestore limits an `in` query to **30 comparison values**, so the IDs must be chunked.

Reference:

https://firebase.google.com/docs/firestore/query-data/queries

### Edge cases

Handle:

- zero assigned student IDs → return `[]`
- 1–30 IDs → one query
- 31–60 IDs → two queries
- more than 60 → additional chunks
- duplicate IDs across multiple classes → deduplicate first
- class membership changes → rebuild the student listeners cleanly
- student removed from all assigned classes → remove them from local state

## Expected effect

If an instructor has 25 students across their assigned classes, the instructor student reads should be approximately 25 document reads on a fresh query rather than the full school roster.

That number is illustrative; verify actual billed usage under realtime listeners.

---

# 6. Phase 3 — Keep Academy-Wide Class Visibility Deliberate

The original plan says the instructor should stop downloading the whole "student directory and class schedule".

The repository currently has a separate academy-wide classes listener in `InstructorDashboard`:

```js
onSnapshot(collection(db, "classes"), ...)
```

This feeds the "All Available Batches" experience.

That behavior appears to be intentional product functionality, because instructors are shown academy-wide available batches.

Therefore:

- **Optimize the student collection now.**
- **Do not silently scope the class collection to assigned classes.**
- Only change academy-wide class visibility if the product requirement changes.

This keeps the optimization from breaking the "All Available Batches" feature.

---

# 7. Phase 4 — `errorLogs` 38-Day Retention

## Goal

Delete `errorLogs` older than 38 days while leaving `shiftAuditEvents` untouched.

The current security rules explicitly make `shiftAuditEvents` append-only:

```text
allow update, delete: if false;
```

The cleanup must target only:

```text
/errorLogs/*
```

---

## 7.1 Important repository placement change

Do **not** create:

```text
src/utils/logRetention.js
```

Instead create:

```text
src/features/dashboard/logRetentionRepository.js
```

Reason:

- this code directly reads/writes Firestore;
- dashboard/admin owns the maintenance UI;
- the repository architecture says Firestore access belongs in the feature's repository layer.

---

## 7.2 Data field to use

Use the existing `errorLogs.timestamp` field for the retention query.

The current `reportError()` implementation writes:

```js
timestamp: new Date().toISOString()
```

and also stores:

```js
createdAt: serverTimestamp()
```

The retention query should use `timestamp` because:

- it is always written as a string;
- it is already required by the Firestore rules;
- ISO 8601 timestamps sort correctly when consistently generated in this form.

Reference:

`src/utils/reportError.js`

---

## 7.3 Count stale logs

Create:

```js
fetchStaleErrorLogsCount(cutoffDays = 38)
```

Use a Firestore aggregation query (`count()`), not a full document download.

Query conceptually:

```js
where("timestamp", "<", cutoffIsoString)
```

The function should return an integer count.

## Important

A `count()` query is cheaper than downloading all stale log documents, but it is still a billable Firestore operation.

Reference:

https://firebase.google.com/docs/firestore/pricing

---

## 7.4 Purge stale logs incrementally

Create:

```js
purgeStaleErrorLogs(cutoffDays = 38)
```

Do not load the entire stale-log collection into memory.

Instead:

1. query a limited page of stale documents;
2. create one write batch;
3. delete that page;
4. commit;
5. repeat.

Use a batch size of up to **500**, which is Firestore's hard `WriteBatch` limit.

Reference:

https://firebase.google.com/docs/reference/js/firestore

---

## 7.5 Add a per-run delete guard

The 500-write batch limit is **not** the same thing as the daily delete quota.

Firestore's free tier has a separate **20,000 document-delete/day** quota.

Therefore the purge must also impose an application-level safety limit.

Recommended default:

```js
const MAX_PURGE_DELETES_PER_RUN = 5000;
```

Return a structured result:

```js
{
  deletedCount,
  remainingStaleCount,
  reachedSafetyLimit,
}
```

This prevents one accidental button press from consuming a large fraction of the daily delete budget.

The admin can run the maintenance action again later.

---

# 8. Phase 5 — Admin Maintenance UI

## Modify

`src/features/dashboard/AdminDashboard.jsx`

Add a small:

**System Maintenance**

section.

Show:

- retention policy: `38 days`
- current stale log count
- last purge result
- deleted count
- remaining count
- warning when the safety limit stops the purge

Use the existing:

- `useConfirm`
- `useToast`

patterns.

The UI should make the destructive action explicit:

```text
Delete error logs older than 38 days
```

and then:

```text
Delete 1,284 stale logs?
```

After completion:

```text
Deleted 5,000 logs. 2,143 stale logs remain.
```

---

# 9. Phase 6 — Reconsider Dashboard User Loading

## Do not implement the original proposal as written

The original plan proposes:

> load `users` only when Students or Staff tabs are active.

The current architecture makes that too aggressive.

`users` are currently used in:

- Student roster
- Staff directory
- Class management
- Student applications
- enrollment workflows
- instructor name lookups
- available-batch widgets
- overview-related calculations

For example, `AvailableBatches` can use `users` for both student enrollment lists and instructor-name lookups, and `ClassManager` uses `users` for enrollment validation and roster operations.

Therefore blindly delaying the entire `users` listener to only Students/Staff tabs will break or complicate existing features.

References:

- `src/features/classes/AvailableBatches.jsx`
- `src/features/classes/ClassManager.jsx`
- `src/features/students/StudentApplications.jsx`
- `src/features/dashboard/useDashboardData.js`

---

## 9.1 Replace it with a two-stage optimization

### Stage A — lightweight overview data

Keep Overview lightweight by moving simple dashboard metrics toward:

- aggregation counts;
- classes data;
- small collections that are genuinely needed.

Examples:

- active student count → aggregation
- active instructor count → aggregation
- pending application count → aggregation
- pending invite count → aggregation, if useful

This avoids downloading 1,000 full student documents just to display one number.

### Stage B — full user dataset on feature entry

Load the full `users` dataset only when the currently active workflow actually needs it.

Candidate tabs/workflows:

- Students
- Staff
- Classes
- Applications

When one of those becomes active, start the required listener.

This is substantially safer than making the `users` listener available only to Students/Staff.

---

# 10. Recommended Implementation Order

Implement in this order:

### Step 1
Baseline measurements.

### Step 2
Multi-tab persistent cache.

### Step 3
Remove duplicate instructor roster hooks.

### Step 4
Scope instructor student reads to assigned student IDs.

### Step 5
Implement admin-only 38-day `errorLogs` retention.

### Step 6
Measure again at 1,000 students / 200 employees.

### Step 7
Only then introduce lightweight overview aggregations and active-tab user loading if the measured read budget still requires it.

This keeps each architectural change independently verifiable.

---

# 11. File Change List

| File | Change |
|---|---|
| `src/firebase.js` | `[MODIFY]` Initialize Firestore with persistent multi-tab local cache |
| `src/features/dashboard/InstructorDashboard.jsx` | `[MODIFY]` Own the single instructor roster hook and pass data down |
| `src/features/dashboard/useInstructorRoster.js` | `[MODIFY]` Query only assigned students, chunked by Firestore `in` limits |
| `src/features/dashboard/instructor/InstructorClasses.jsx` | `[MODIFY]` Consume parent roster props; remove duplicate hook |
| `src/features/dashboard/instructor/InstructorProgress.jsx` | `[MODIFY]` Consume parent roster props; remove duplicate hook |
| `src/features/dashboard/logRetentionRepository.js` | `[NEW]` Count and purge stale error logs |
| `src/features/dashboard/logRetentionRepository.test.js` | `[NEW]` Unit tests for cutoff, batching, safety cap, and empty-result behavior |
| `src/features/dashboard/AdminDashboard.jsx` | `[MODIFY]` Add System Maintenance UI |
| `src/features/dashboard/useDashboardData.js` | `[MODIFY LATER]` Only after measurement; introduce overview aggregations / active-workflow user loading |
| `firestore.indexes.json` | `[VERIFY ONLY]` Add indexes only if Firestore actually requires them |
| `package.json` | `[NO CHANGE REQUIRED]` `date-fns` is already present |

---

# 12. Testing Plan

## Automated

Run:

```bash
npm test
npm run lint
npm run build
```

The repository's package scripts currently provide those commands.

Do not hard-code a claim such as "all 32 test files" in the plan; use the actual test runner output.

Also run:

```bash
npm run typecheck
```

because the repository already defines the script.

## Instructor roster tests

Verify:

- one assigned class with 5 students → exactly those students appear;
- multiple classes with duplicate student IDs → no duplicate students;
- 31+ students → query chunking works;
- no classes → zero student queries;
- substitute-instructor classes are included;
- removing a student from the last assigned class removes them from the local roster;
- Classes tab does not create a second roster listener;
- Progress tab does not create a second roster listener.

## Log-retention tests

Verify:

- 37-day-old log is retained;
- 38-day boundary behavior is explicitly defined and tested;
- 39-day-old log is deleted;
- non-stale log is untouched;
- zero stale logs returns zero without a write;
- 500+ stale logs are processed in multiple batches;
- safety cap stops at 5,000 deletes;
- rerunning continues with remaining stale logs;
- only `errorLogs` are touched;
- `shiftAuditEvents` are never touched.

## Firebase cache tests

Manual/browser verification is more important than unit tests.

Verify:

- two tabs can remain open simultaneously;
- both tabs receive live updates;
- reload does not trigger the old persistence warning;
- offline cached data remains available where expected;
- unsupported environments degrade gracefully.

---

# 13. Manual Scale Test

Create a test dataset approximating:

```text
Students: 1,000
Employees: 200
Classes: realistic production count
```

Then record:

| Scenario | Cold reads | Subsequent reads | Listener changes |
|---|---:|---:|---:|
| Admin Overview | TBD | TBD | TBD |
| Admin Students | TBD | TBD | TBD |
| Admin Classes | TBD | TBD | TBD |
| Front Office Overview | TBD | TBD | TBD |
| Instructor Overview | TBD | TBD | TBD |
| Instructor Classes | TBD | TBD | TBD |
| Instructor Progress | TBD | TBD | TBD |

The implementation is considered successful when normal daily behavior remains comfortably below the 50,000-read Spark allowance with headroom.

---

# 14. Final Decision on the Original Four Changes

| Original item | Decision |
|---|---|
| Multi-tab persistence | **Keep, with trusted-device caveat and measurement** |
| Instructor scope optimization | **Keep, but also remove duplicate hook listeners** |
| 38-day log retention | **Keep, but move Firestore logic to a dashboard repository and add delete safety cap** |
| Dashboard tab-scoped `users` listener | **Revise; do not implement as originally written** |

---

# 15. References

## Repository

- https://github.com/aymira-git/mylibertyportal-origin
- `docs/ARCHITECTURE.md`
- `src/firebase.js`
- `src/features/dashboard/useInstructorRoster.js`
- `src/features/dashboard/useDashboardData.js`
- `src/features/dashboard/InstructorDashboard.jsx`
- `src/features/dashboard/instructor/InstructorClasses.jsx`
- `src/features/dashboard/instructor/InstructorProgress.jsx`
- `src/features/classes/AvailableBatches.jsx`
- `src/features/classes/ClassManager.jsx`
- `src/features/students/StudentApplications.jsx`
- `src/utils/reportError.js`
- `firestore.rules`

## Firebase documentation

- https://firebase.google.com/docs/firestore/quotas
- https://firebase.google.com/docs/firestore/pricing
- https://firebase.google.com/docs/firestore/query-data/queries
- https://firebase.google.com/docs/firestore/manage-data/enable-offline
- https://firebase.google.com/docs/reference/js/firestore
