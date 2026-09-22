# Implementation Plan — Spark Scale & Log Retention

Optimize Firestore query architecture to support **1,000 students and 200 employees** comfortably within the Firebase Spark free plan (50,000 reads/day limit), and implement the 38-day `errorLogs` retention housekeeping.

## User Review Required

> [!IMPORTANT]
> **Audit Finding Consistency:**
> 1. `shiftAuditEvents` will **not** be purged, respecting [`firestore.rules#L165`](file:///E:/myliberty-portal/firestore.rules#L165) which enforces an append-only immutable audit trail (`allow update, delete: if false;`). Retention cleanup strictly targets `errorLogs`.
> 2. No paid dependencies or external services are added, keeping the project 100% free with no credit card required.

---

## Proposed Changes

### 1. Multi-Tab Local Persistence
Enable Firestore multi-tab cache so all browser tabs on a workstation share IndexedDB cache, eliminating duplicate reads across open tabs.

#### [MODIFY] [firebase.js](file:///E:/myliberty-portal/src/firebase.js)
* Replace deprecated single-tab `enableIndexedDbPersistence(db)` with `initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })`.
* Resolves `failed-precondition` warnings when staff open multiple tabs.

---

### 2. Instructor Scope Optimization
Prevent instructors from downloading the entire school's student directory and class schedule.

#### [MODIFY] [useInstructorRoster.js](file:///E:/myliberty-portal/src/features/dashboard/useInstructorRoster.js)
* Instead of downloading all 1,000 students with `where("role", "==", "student")`, gather `studentIds` from the instructor's assigned classes and query only those students.
* If an instructor has 25 students across 2 classes, reads drop from **1,000 reads down to 25 reads**.

---

### 3. Log Retention Housekeeping (38-Day Cutoff)
Implement the cleanup utility and UI for stale error logs.

#### [NEW] [logRetention.js](file:///E:/myliberty-portal/src/utils/logRetention.js)
* Utility function `fetchStaleErrorLogsCount(cutoffDays = 38)`: counts error logs older than 38 days.
* Utility function `purgeStaleErrorLogs(cutoffDays = 38)`: batch deletes stale logs in chunks of up to 500 (conforming to Firestore's batch write limit).

#### [NEW] [logRetention.test.js](file:///E:/myliberty-portal/src/utils/logRetention.test.js)
* Unit tests verifying timestamp filtering and chunked deletion logic.

#### [MODIFY] [AdminDashboard.jsx](file:///E:/myliberty-portal/src/features/dashboard/AdminDashboard.jsx)
* Add a "System Maintenance" section or button in Admin settings to view stale log count and trigger 38-day purge with `useConfirm` and `useToast`.

---

### 4. Lazy-Loading & Tab Scoping in Dashboard Data

#### [MODIFY] [useDashboardData.js](file:///E:/myliberty-portal/src/features/dashboard/useDashboardData.js)
* Separate the global `unsubUsers` listener so that it only loads when relevant tabs (Students or Staff) are active, rather than loading 1,200 records on initial dashboard mount.

---

## Verification Plan

### Automated Tests
* `npm test`: Run complete test suite (all 32 test files) to ensure zero regressions.
* `npm run lint`: Verify compliance with ESLint and React hooks rules.
* `npm run build`: Ensure production bundle builds without errors.

### Manual Verification
* Inspect console for clean multi-tab Firestore initialization without `failed-precondition` warnings.
* Test Admin Log Retention button with test logs to verify batch deletion and toast notifications.
