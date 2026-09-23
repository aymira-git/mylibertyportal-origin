# MYLIBERTY Portal — Full Architecture & Scalability Audit Report

> **Audit Date:** September 2026  
> **Auditor:** Assistant Engineering Engine (Audit Mode)  
> **Authority Chain:** `AGENTS.md` → `docs/ARCHITECTURE.md` → `docs/audits/FULL_ARCHITECTURE_AUDIT.md`  
> **Test Status:** 42 test suites passed (623 tests passing). Zero regressions.  

---

## 1. Executive Summary

This report delivers the comprehensive architecture, data-flow, concurrency, security, and scalability assessment of the **MYLIBERTY Portal** web application, conducted in accordance with the 21-point checklist defined in `docs/audits/FULL_ARCHITECTURE_AUDIT.md`.

### Major Strengths
- **Single Source of Truth for Identities**: All identities (students, instructors, managers, front office, office boys, and administrators) share the canonical `/users/{uid}` model, guarded by field-level difference checks (`diff(resource.data).affectedKeys()`) in Firestore security rules.
- **Atomicity in Critical Workflows**: Admissions approval (`runTransaction`), tuition payment ledgering (`writeBatch`), and shift adjustments with immutable audit logging (`writeBatch` + append-only `/shiftAuditEvents`) are transactionally guarded against network drops and partial writes.
- **WITA Standardized Timezone**: All date parsing, shift duration math, auto-close watchdogs, and punctuality rules adhere strictly to `Asia/Makassar` (UTC+8).
- **Extensive Test Coverage**: 42 test suites comprising 623 passing automated tests verify schema boundaries, business logic, shift transitions, and UI utility adapters.

### Major Weaknesses
- **Linear Read Amplification**: Admin and Manager dashboards subscribe to the **entire** `/users` and `/classes` collections via `onSnapshot`, reading active students, graduated students, alumni, and inactive records indiscriminately on every mount.
- **Kiosk Operational Privilege Trap**: `firestore.rules` requires `isAdmin()` to create `/shifts`, forcing the physical front-desk tablet in the school lobby to stay logged into an Administrator account.
- **Kiosk Scan Double-Tap Vulnerability**: Rapid camera triggers or students holding badges in front of the lens generate multiple duplicate daily `/attendance` documents due to the lack of an idempotent document ID.
- **Orphaned Class Rosters on Student Deletion**: Hard-deleting a student profile does not scrub their identifier from `classes.studentIds` or `classes.enrollments`.

### Current Architectural Fitness vs Future Scale
- **Present Scale (1 branch, ~100–300 users)**: Highly responsive, robust, and cost-effective on the Firebase Spark free tier.
- **Future Scale (1,000+ students or multi-branch)**: Unbounded collection listeners and whole-table scans on `/users` will exhaust daily Firestore read quotas and induce client-side performance degradation.

---

## 2. Architecture Map

```text
                                [ PWA Client (React 19 + Vite + Tailwind) ]
                                                     │
                         ┌───────────────────────────┼───────────────────────────┐
                         ▼                           ▼                           ▼
                [ App Routing & Auth ]      [ Role Dashboards ]         [ Reception Kiosk ]
                 • App.jsx                   • Admin / Manager           • Dual Shift / Class
                 • onAuthStateChanged        • FrontOffice / Inst.       • Camera / Sound
                 • 30-min Idle Timeout       • Marketing / Kids          • QR Badge Scanner
                         │                           │                           │
                         └───────────────────────────┼───────────────────────────┘
                                                     ▼
                                      [ Feature Domain Repositories ]
                                  (users, classes, shifts, payments,
                                   applications, corporateEvents, etc.)
                                                     │
                                                     ▼
                                           [ Firestore Rules ]
                                      (RBAC, diff checks, immutable)
                                                     │
                              ┌──────────────────────┴──────────────────────┐
                              ▼                                             ▼
                 [ Core Entity Collections ]                    [ Event / Ledger Collections ]
                  • /users/{uid} (Class C)                       • /attendance/{id} (Class A)
                  • /classes/{id} (Class C)                      • /shifts/{id} (Class A)
                  • /schoolOutreach/{id} (Class C)               • /payments/{id} (Class B)
                                                                 • /shiftAuditEvents/{id} (Class A)
```

### Data-Flow Pipeline
```text
User Interaction (UI)
   ↓
Dashboard / Form Component (e.g. StudentRoster, KioskScanProcessor, RecordPaymentTab)
   ↓
Validation (Zod schemas in src/schemas/ & formatters in src/utils/dateWita)
   ↓
Repository / Data-Access Layer (e.g. shiftsRepository, paymentsRepository, classesRepository)
   ↓
Firestore / Security Rules (firestore.rules + client SDK)
   ↓
Reactive Subscription / Local State Update (onSnapshot or async promise return)
```

---

## 3. Architecture Drift

| Category | Item | Evidence & Details |
|---|---|---|
| **Documented & Accurate** | Domain Directory Structure | Modular structure under `src/features/{auth, students, attendance, classes, finance, staff, reports, shared, dashboard}` matches documentation. |
| **Documented & Accurate** | Routing & Lazy Loading | `src/App.jsx` cleanly lazy-loads all 11 role dashboard views via `React.lazy()`. |
| **Documented & Accurate** | Timezone Standard | Centralized WITA (`Asia/Makassar`) convention implemented across date utilities and reports. |
| **Documented but Stale** | Instruction References | `docs/ARCHITECTURE.md` (lines 7, 9) cites `CLAUDE.md`, whereas `AGENTS.md` and `GEMINI.md` are the active project rules. |
| **Documented but Stale** | Direct Firestore Access | Direct collection references in `useDashboardData.js` still bypass feature repository barrels. |
| **Implemented but Undocumented** | Desk Inquiries Domain | `/deskInquiries` collection and repository actively handle walk-ins, but lack growth classification in `docs/ARCHITECTURE.md`. |
| **Implemented but Undocumented** | Corporate Events | `/corporateEvents` manages event attendance, unlisted in Section 6 of the architecture guide. |
| **Implemented but Undocumented** | Log Retention Subsystem | `logRetentionRepository.js` and `LogRetentionCard.jsx` provide client-triggered purges of operational logs. |
| **Contradictory** | Application Creation | `applicationsRepository.js` exports `createApplication()`, but `firestore.rules` enforces `allow create: if false;` (intake is external-only). |
| **Unverified** | Deployment Target | Repository contains both `/cloudflare-worker/` and `firebase.json`; production serving path requires external verification. |

---

## 4. Critical Findings

### Finding 4.1: Kiosk Tablet Privilege Escalation Trap
- **File**: `firestore.rules` (lines 161–165).
- **Rule**:
  ```cel
  match /shifts/{shiftId} {
    allow create: if isAdmin()
      && request.resource.data.userId is string
      && request.resource.data.clockOut == null
      && isTrackedShiftRole(roleOf(request.resource.data.userId));
  }
  ```
- **Vulnerability**: Because shift creation requires `isAdmin()`, the physical kiosk tablet stationed at reception must be logged into an **Administrator** account. If left unattended, any physical bypass grants unrestricted administrative access to student records, user management, and financials.
- **Remediation**: Allow receptionists (`isFrontOffice()`) to record shift clock-ins on the kiosk tablet:
  ```cel
  allow create: if (isAdmin() || isFrontOffice()) ...
  ```

---

## 5. High-Priority Findings

### Finding 5.1: Kiosk Scan Double-Tap Duplication
- **File**: `src/features/attendance/kioskScanProcessor.js` (lines 75–88) & `shiftsRepository.js` (line 148).
- **Behavior**: Uses `addDoc(collection(db, "attendance"), { ... })` with a client-generated timestamp.
- **Risk**: Rapid camera triggers or bad lighting double-scans insert multiple attendance records for the same student on the same day.
- **Remediation**: Use an idempotent document ID based on student ID and WITA date:
  ```js
  setDoc(doc(db, "attendance", `${userId}_${todayWita}`), payload, { merge: true });
  ```

### Finding 5.2: Unbounded Whole-Collection Read on `/users`
- **File**: `src/features/dashboard/useDashboardData.js` (line 144) & `reportsRepository.js` (line 30).
- **Behavior**: Calls `onSnapshot(collection(db, "users"))` without status filters or pagination.
- **Risk**: Linear O(N) cost scaling. Every dashboard mount reads all historical, inactive, and graduated students.
- **Remediation**: Filter queries by `where("status", "==", "active")` and isolate archived students into an on-demand paginated view.

### Finding 5.3: Admissions Creation Rule Contradiction
- **File**: `src/features/students/applicationsRepository.js` (`createApplication`).
- **Behavior**: Client code attempts to write to `/applications`, but `firestore.rules` line 98 blocks client creation (`allow create: if false;`).
- **Risk**: Any UI invoking `createApplication()` will throw `PERMISSION_DENIED`.
- **Remediation**: Clarify that applications are ingested exclusively via external Google Forms sync and remove or safeguard dead client creation exports.

---

## 6. Medium & Low Findings

### Finding 6.1: Class Enrollment Orphan on Student Deletion
- **File**: `src/features/dashboard/usersRepository.js` (`deleteUserProfile`, lines 118–148).
- **Risk**: Deleting a student profile checks for attendance and payment records, but does not scrub `classes.studentIds` or `classes.enrollments`, leaving dangling IDs in class rosters.

### Finding 6.2: Class Batch Overcapacity Race Condition
- **File**: `src/features/classes/classesRepository.js` (`enrollStudentInClass`, line 58).
- **Risk**: Uses `updateDoc` with `arrayUnion` without verifying class capacity in a transaction (unlike `approveApplication` which uses `runTransaction`). Concurrent manual enrollments can exceed batch limits.

### Finding 6.3: Unauthenticated Public Writes to ErrorLogs
- **File**: `firestore.rules` (lines 211–216).
- **Risk**: Any client possessing the Firebase project config can spam write operations to `/errorLogs`.
- **Remediation**: Require `request.auth != null` or enforce rate limiting.

### Finding 6.4: Outreach Visit Counter Sync
- **File**: `src/features/dashboard/marketing/schoolOutreachRepository.js` (lines 40–55).
- **Risk**: Adding a visit to `/schoolOutreach/{id}/visits` and updating parent `totalVisits` are executed sequentially rather than within an atomic `writeBatch`.

---

## 7. Missing Links in Business Logic

1. **Class Deletion vs Student Enrollment**: Deleting a class does not clear the `currentLevel` or active batch reference on student profiles.
2. **Student Deletion vs Class Enrollment**: Deleting a student leaves dangling references in `classes.studentIds`.
3. **Desk Inquiries to Registration Conversion**: When a desk inquiry is marked "converted", there is no automated transition link to create a student profile; staff must manually retype the contact information.

---

## 8. Data Model & Scalability Assessment

### Collection Classification Matrix

| Collection | Ownership | Growth Class | Growth Rate | Read Pattern | Scalability Bottleneck |
|---|---|---|---|---|---|
| `/users` | Auth / Admin | Class C (School) | ~100–1,000/yr | Full collection `onSnapshot` | **High**: Reads scale linearly with total historical students |
| `/classes` | Admin / FO | Class C (School) | ~20–50/yr | Full collection read | **Low**: Naturally bounded by classroom count |
| `/attendance` | Kiosk / Scan | Class A (Events) | ~10k–50k/yr | Time-windowed (`sinceWitaIso`) | **Low**: Well-bounded by single-day query |
| `/shifts` | Staff / Kiosk | Class A (Events) | ~2k–10k/yr | Time-windowed + open shift filter | **Low**: Cleanly indexed |
| `/payments` | Front Desk | Class B (Ledger) | ~500–5,000/yr | Date-windowed query | **Low**: Paginated by cashier tab |
| `/deskInquiries` | Front Desk | Class B (Leads) | ~300–2,000/yr | Recent leads query | **Low**: Naturally bounded |
| `/schoolOutreach` | Marketing | Class C (Schools) | ~50–200 total | Full collection fetch | **Very Low**: Bounded by city schools (~100 institutions) |
| `/errorLogs` | System Telemetry | Class A (Logs) | Variable | Admin view + purge utility | **Medium**: Unrestricted client writes |

---

## 9. Failure Mode Assessment

- **Network Interruption**: Handled cleanly. `ConnectivityBanner.jsx` warns users immediately, and PWA caches the core shell. Firestore mutations queue in IndexedDB and flush upon reconnection.
- **Malformed Legacy Documents**: Handled cleanly. Schemas in `src/schemas/` apply safe defaults on read.
- **Kiosk Camera Disconnection**: Displayed via local UI banner, but not logged to centralized telemetry (`reportError`), creating an observability blind spot for remote administrators.

---

## 10. Answers to the 12 Mandatory Audit Questions

1. **Is there an architectural flaw that could cause data corruption or security failure?**  
   *Yes.* `firestore.rules` requiring `isAdmin()` for shift creation forces the physical front-desk kiosk tablet to run under an Administrator session, creating a severe physical security risk.
2. **Is there a missing link in the business/data logic?**  
   *Yes.* Deleting a student leaves orphaned IDs in `classes.studentIds`. Converted desk inquiries lack an automated pipeline into student registration.
3. **What becomes the first bottleneck under heavy traffic?**  
   Realtime listener fan-out on `/users` and `/classes`. When multiple staff have dashboards open, updates fan out to all connected clients simultaneously.
4. **What becomes the first bottleneck as the database grows?**  
   The unbounded `onSnapshot(collection(db, "users"))` in `useDashboardData.js`. As alumni accumulate, every dashboard load downloads thousands of irrelevant records.
5. **Which current decisions are safe now but risky at 10× scale?**  
   Whole-collection reads on `/users` and sequential (non-batched) subcollection counter increments.
6. **What must be fixed before adding more features?**  
   - Update `firestore.rules` to allow `isFrontOffice()` to record staff shifts on the kiosk.
   - Enforce idempotent document IDs on student attendance scans (`${studentId}_${todayWita}`).
7. **What can safely remain technical debt?**  
   - Manual data transfer between converted desk inquiries and student intake.
   - Dual array representation (`studentIds` and `enrollments`) in class documents.
8. **What should be load-tested rather than guessed?**  
   Offline mutation replay when a kiosk tablet reconnects after a 30-minute outage with dozens of queued scans.
9. **What assumptions could not be verified from the repository?**  
   Whether production traffic is served via Firebase Hosting or the Cloudflare Worker proxy, and whether Firebase App Check is enforced in production.
10. **Does `docs/ARCHITECTURE.md` still describe reality?**  
    *Mostly (~85%).* It accurately reflects the domain boundaries, but has drifted regarding new collections (`deskInquiries`, `corporateEvents`), direct Firestore queries in `useDashboardData.js`, and stale agent references.
11. **What architecture changes should be documented after this audit?**  
    Formal classification of `deskInquiries` and `corporateEvents`, clarification of the external-only `/applications` creation model, and the attendance scan idempotency pattern.
12. **What is the smallest practical roadmap toward stronger production readiness and scalability?**  
    See Section 11 below.

---

## 11. Recommended Roadmap

```text
┌────────────────────────────────────────────────────────────────────────┐
│ 1. FIX NOW (Zero-Risk, High-Impact)                                    │
│    • Update firestore.rules to allow isFrontOffice() to clock staff in │
│      (frees the kiosk tablet from requiring an Admin account).         │
│    • Implement idempotent document IDs for kiosk attendance scans      │
│      (`doc(db, "attendance", `${userId}_${todayWita}`)`).              │
│    • Cascade student profile deletion to clean up class rosters.       │
├────────────────────────────────────────────────────────────────────────┤
│ 2. FIX BEFORE GROWTH (At ~500+ Students)                               │
│    • Filter users query in useDashboardData.js to active students only │
│      (`where("status", "==", "active")`).                              │
│    • Wrap manual enrollStudentInClass in a capacity-checking           │
│      transaction.                                                      │
│    • Restrict /errorLogs create rule to authenticated sessions.        │
├────────────────────────────────────────────────────────────────────────┤
│ 3. MONITOR                                                             │
│    • Daily Firestore document read counts on Firebase Console.         │
│    • Kiosk camera disconnect events in production.                     │
├────────────────────────────────────────────────────────────────────────┤
│ 4. DO NOT CHANGE YET                                                   │
│    • Keep role-level code-splitting in App.jsx.                        │
│    • Keep subcollection design for /schoolOutreach/{id}/visits.        │
│    • Keep existing paymentsRepository writeBatch implementation.       │
└────────────────────────────────────────────────────────────────────────┘
```
