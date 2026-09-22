# MYLIBERTY Portal — Audit Finding: Scale & Capacity on Spark Plan (Session: 2026-09-22)

**Scope:** Evaluating system stability and Firebase Spark (free tier) quota limits for a workload of **1,000 students and 200 employees**.

---

## Executive Summary: Does the Spark Plan Hold?

* **Short Answer:** **NO, not under the current frontend architecture.**
* **The Failure Point:** Daily Document Reads (**50,000 reads/day** limit on Spark).
* **Safe Resources:** Total Database Storage (**1 GiB** limit) and Daily Writes (**20,000 writes/day**) are completely safe and will hold comfortably.
* **Can it be fixed without upgrading to Blaze?** **YES.** If query patterns are updated from unbounded full-collection downloads to paginated, scoped queries with multi-tab caching, daily reads drop by ~95%, allowing the system to run comfortably on the free plan.

---

## 1. Spark Plan Quota Evaluation (1,000 Students + 200 Staff)

| Resource | Spark Free Tier Quota | Estimated Daily Usage | Status |
| :--- | :--- | :--- | :--- |
| **Firestore Storage** | 1 GiB (1,024 MB) | ~60 – 150 MB total after 1 year | **PASS ✅** |
| **Document Writes** | 20,000 / day | ~1,500 – 3,000 / day | **PASS ✅** |
| **Document Deletes** | 20,000 / day | < 100 / day | **PASS ✅** |
| **Document Reads** | **50,000 / day** | **60,000 – 120,000+ / day** | **CRITICAL FAILURE ❌** |
| **Network Egress** | 10 GiB / month | ~6 – 9 GiB / month | **MARGINAL / AT RISK ⚠️** |

---

## 2. Why Daily Attendance Does NOT Protect the Read Quota

A common operational assumption is: *"Not all 1,000 students and 200 staff come to the center every day, so usage will stay low."*

While true for physical attendance, **Firestore bills on how code queries data, not who is physically present in the building:**

1. **Kiosk Check-Ins (Physical attendance) — Lightweight:**
   * Only people who show up scan their badges at the kiosk.
   * 300 attending students + 50 staff clocking in/out = ~700 reads and ~400 writes per day. This is well within limits.
2. **Staff & Admin Dashboards (The Real Problem) — Full Collection Dumps:**
   * Every time an admin, receptionist, or manager opens or refreshes the portal, the code queries `collection(db, "users")`.
   * Firestore must evaluate the query against all enrolled students and registered staff. Even if 700 students are at home, **all 1,200 user records are downloaded and billed as 1,200 document reads per dashboard load**.
3. **The Daily Math:**
   * 1 Admin / Front Office dashboard load = **~1,500 reads** (`users` + `classes` + `applications` + `todos`).
   * If **10 staff members** (front office, manager, admin, coordinators) each open or refresh their dashboard 3 to 4 times a day:
     $$10 \text{ staff} \times 4 \text{ sessions} \times 1,500 \text{ reads} = \mathbf{60,000 \text{ reads/day}}$$
   * **Result:** The 50,000 daily read limit is exceeded. Firestore triggers `RESOURCE_EXHAUSTED` (HTTP 429 / Code 8), and the portal stops functioning for everyone until midnight Pacific Time.

---

## 3. Code Hotspots Causing the Read Blowout

### A. Unbounded `onSnapshot` on the entire `users` collection
* **File:** `src/features/dashboard/useDashboardData.js` (Lines 104–125)
* **Problem:** 
  ```javascript
  const usersQuery = restrictedRead
    ? query(collection(db, "users"), where("role", "in", ["student", "instructor"]))
    : collection(db, "users");

  const unsubUsers = onSnapshot(usersQuery, (snap) => setUsers(...));
  ```
  This downloads all 1,200 users into memory on mount, doing client-side filtering via JavaScript (`users.filter(...)`) rather than server-side pagination.

### B. Full `classes` collection read on all instructor screens
* **Files:** 
  * `src/features/dashboard/InstructorDashboard.jsx` (Line 51)
  * `src/features/dashboard/kids/KidsInstructorDashboard.jsx` (Line 69)
* **Problem:**
  `onSnapshot(collection(db, "classes"), ...)`
  Every instructor dashboard listens to *every* class in the school rather than only the classes assigned to that specific instructor (`where("instructorId", "==", auth.currentUser.uid)`).

### C. Deprecated Single-Tab Persistence Crashing Multi-Tab Sessions
* **File:** `src/firebase.js` (Lines 90–99)
* **Problem:**
  ```javascript
  enableIndexedDbPersistence(db).catch(...)
  ```
  `enableIndexedDbPersistence` only works for **one browser tab**. When staff open multiple tabs (e.g. Kiosk + Admin Dashboard), persistence fails with `failed-precondition`, forcing subsequent tabs to bypass offline cache and perform raw network reads for every record.

---

## 4. Architectural Fix Plan to Stay Safely on Spark

To run 1,000 students and 200 staff on the free tier with 90%+ quota buffer remaining:

### Step 1: Paginate the Student & Staff Directories (Highest Impact)
* Do not fetch `users` on dashboard mount.
* Only query `users` when the user navigates directly to the "Students" or "Staff Directory" tabs.
* Replace the full collection query with server-side pagination (`limit(25)` + `startAfter(lastDoc)`).
* **Impact:** Drops directory load from **1,200 reads** to **25 reads**.

### Step 2: Restrict Instructor Queries to Assigned Classes
* Update `InstructorDashboard.jsx` and `KidsInstructorDashboard.jsx` queries:
  ```javascript
  query(
    collection(db, "classes"),
    where("instructorId", "==", auth.currentUser.uid),
    where("status", "==", "active")
  )
  ```
* **Impact:** Instructors read only their 2–4 classes instead of 100+ classes.

### Step 3: Replace `onSnapshot` with One-Time `getDocs` for Static Data
* Reserve real-time listeners (`onSnapshot`) strictly for live-updating screens:
  * Reception Kiosk active queue.
  * Today's open shifts.
* Use standard `getDocs()` for static or reference lists:
  * Student directory.
  * Staff directory.
  * Historical reports.
  Provide a manual "Refresh" button for staff to pull new updates on demand.

### Step 4: Upgrade to Modern Multi-Tab Offline Persistence
* In `src/firebase.js`, update Firestore initialization to use `persistentMultipleTabManager()`:
  ```javascript
  import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";

  export const db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
  });
  ```
  This allows all tabs on a staff computer to share the local IndexedDB cache, serving unchanged documents with **0 billable reads**.

---

## 5. Before vs. After Projections

| Metric | Current Implementation | Optimized Architecture |
| :--- | :--- | :--- |
| **Reads per Dashboard Session** | ~1,500 reads | **~30 – 50 reads** |
| **Estimated Daily Reads (50 sessions)** | ~75,000 reads *(Exceeds 50k)* | **~1,500 – 2,500 reads** |
| **Spark Plan Feasibility** | **Fails (Quota Exceeded)** | **Succeeds (Uses only ~5% of quota)** |
