# Full Architecture & Scalability Audit — 2026-09-25

> **Mode:** Audit only. No production code was modified.
> **Procedure:** `docs/audits/FULL_ARCHITECTURE_AUDIT.md`
> **Declared architecture:** `docs/ARCHITECTURE.md` (root `ARCHITECTURE.md` is a pointer file — verified)
> **Evidence:** All findings below were verified against source by the auditor (not only sub-reported). File:line references are to the state of `main` at audit time (HEAD `964575a`).

---

## 1. Executive Summary

**Strengths.** The repository is unusually disciplined for its size: a real repository/data-access layer (18 modules) with schema validation at the persistence boundary, transactions/batches on the genuinely risky writes (application approval, payment recording, class roster changes), idempotent attendance writes via deterministic document IDs, branch isolation enforced in Firestore rules with a branch-name fallback, and a documented architecture that mostly matches reality. Test coverage of repository logic is real, not cosmetic — several tests assert exact write payloads and batch atomicity.

**Weaknesses.** The four most security-/operations-sensitive rules/payload contracts are **broken in ways that silently disable features**:

1. The `payments` **get** rule makes every payment document world-readable (no `signedIn()`, no uid scoping).
2. The maker-checker approval flow — shipped two days ago per the architecture change log — **cannot complete**: approval decisions are field-rejected by Firestore rules for every non-admin approver, cash-discrepancy clock-outs write a field the rules forbid, and an approved shift self-correction is never applied to the shift record.
3. Front-office student status changes are rejected by the rules allow-list (two fields the code writes are not permitted).
4. Several multi-filter queries lack composite indexes in `firestore.indexes.json` and will fail at runtime unless created manually in the console (UNVERIFIED — needs runtime confirmation).

**Fitness at current scale.** For a single school with tens of staff, the data model and listener design are adequate. The architecture is **not** fit to grow without bounds discipline on `todos`/`applications` listeners and retention on operational logs.

**Biggest growth risks.** Unbounded full-collection realtime listeners on staff dashboards; `shiftAuditEvents` growing forever with no reader and no retention; PWA precache downloading every role dashboard chunk on install; the Google Apps Script pipeline writing applications with no `branchId`, which will silently drop them from branch-scoped views as branches are used.

---

## 2. Architecture Map

```text
Google Form ──(Apps Script, service acct)──▶ applications  (bypasses rules; no branchId)
                                                  │ transaction (approveApplication)
                                                  ▼
Browser SPA (React 19, Vite PWA, no router lib)   users + classes + deskInquiries
  src/App.jsx ── role router, lazy dashboards
  │
  ├─ features/* ── repositories (Firestore, zod-validated)
  │     ├─ attendance: shifts, attendance, staffLeave, corporateEvents, shiftAuditEvents
  │     ├─ finance: payments (batch w/ user doc)
  │     ├─ students: applications (txn), progressReports, parent portal
  │     ├─ classes: classes (txn), materials
  │     ├─ staff: todos, invites
  │     ├─ dashboard/*: manager/marketing/frontoffice/instructor/kids (+ direct Firestore exceptions)
  │     └─ shared: approvals (maker-checker), UI primitives
  │
  ├─ Firebase Auth (email/invite; roles from users/{uid}.role; no custom claims)
  ├─ Firestore Security Rules  ◀── THE security boundary
  └─ Cloudflare Worker "myliberty-ai-proxy" (Gemini API key server-side; CORS allow-list)
```

**Auth model:** role = `users/{uid}.role`, read client-side; session guard listens to the profile doc (kill switch) and enforces a 30-min idle timeout (`src/App.jsx:94-194`). Invite-based signup pins role/branch from the invite doc (`firestore.rules:76-99`) — self-elevation is properly blocked.

---

## 3. Architecture Drift

### Documented and accurate
- Repository boundary and the named "existing exceptions" list (`docs/ARCHITECTURE.md:168-181`) — verified complete; the only unnamed direct-access path is `src/App.jsx:126,177` (session guard), which the guide's prose covers.
- `App.jsx` owns role-level lazy loading (`docs/ARCHITECTURE.md:191`) — verified (`src/App.jsx:13-33,415-475`).
- Shared infrastructure locations (`src/constants`, `src/schemas`, `src/utils`, `src/firebase.js`) — verified.
- Schemas validated at repository boundary, not in forms — verified.
- Class A/B/C growth classification — consistent with code (see §8).

### Documented but stale
- `docs/ARCHITECTURE.md:396` warns `src/hooks/` and `src/components/` must not be assumed unused — **both directories no longer exist and have zero imports** (repository-wide sweep). Only `src/utils/` remains as active legacy location. The warning is harmless but stale.
- Feature domain list (`docs/ARCHITECTURE.md:33-81`) omits `features/pwa` (exists; `src/App.jsx:7` imports `InstallButton`) and `dashboard/frontoffice/` (exists, one of the largest dashboards).

### Implemented but undocumented
- `features/pwa` feature domain.
- `dashboard/frontoffice` subdomain.
- **Cloudflare Worker `myliberty-ai-proxy`** (`cloudflare-worker/worker.js`, `wrangler.toml`) — a whole edge component with a server-side Gemini key, absent from the guide. Not typechecked (`tsconfig.json` includes `src/**` only), not in knip scope.
- **`FormSync.gs`** — Google Apps Script → Firestore REST pipeline; the *only* writer of `applications` (rules `allow create: if false`). Undocumented, and its payloads lack `branchId`/`inquiryId`.
- The **approvals / maker-checker subsystem** is in the change log but has no design section in the guide (envelope shape, `mode: blocking|notify`, apply-after-approve semantics are nowhere specified).

### Contradictory
- Change log entry "Multi-Branch Isolation & Dual-Control Approvals" (2026-09-24) claims the approval registry is implemented. In reality the decision path is rejected by rules and the approved payload is never applied (Findings C2-C4). The feature exists as UI + collection, not as a working control.

### Unverified — requires runtime/production verification
- Whether composite indexes absent from `firestore.indexes.json` exist in the live console (affects approval inboxes and kiosk clock-in; Finding C7).
- Which hosting path serves production (Firebase Hosting config exists; the Worker has its own deployment; no CI config found).
- Actual Firestore read volume / cost.
- Whether the app currently errors in production on the rules mismatches (silent `console.warn` paths can hide this).

---

## 4. Critical Findings

### C1. `payments` documents are world-readable by ID
- **Evidence:** `firestore.rules:186` — `allow get: if isAdmin() || ((isManager() || isFrontOffice()) && isSameBranch(resource.data)) || (resource.data.studentId is string);` The third clause has **no `signedIn()` and no uid comparison**. Every payment doc stores `studentId` as a string, so any unauthenticated request can `get` any payment by ID; any signed-in user (student, officeboy, marketing) can read **everyone's** payments (amounts, method, dates).
- **Likely intent:** let students read their own payments — which would be `signedIn() && resource.data.studentId == request.auth.uid`.
- **Impact:** Financial data exposure; amounts + student linkage readable by anyone on the internet with a document ID (IDs leak via client logs, error reports, URLs, brute-force is not needed if any client code paths expose them).
- **Likelihood:** high. **Severity:** critical. **Confidence:** high.
- **Recommendation:** Replace the third clause with `|| (signedIn() && resource.data.studentId == request.auth.uid)`. Add a real rules test (see T-gap).

### C2. Approval decisions are permission-denied for every non-admin approver
- **Evidence:** `src/features/shared/approvalsRepository.js:94-103` (approve) writes `status, decidedBy, decidedByUid, decidedAt, decisionNotes, updatedAt`; `:117-126` (reject) writes `status, decidedBy, decidedByUid, decidedAt, rejectionReason, updatedAt`. `firestore.rules:211-212` allows only `['status','decision','reviewedAt','reviewedBy','reviewedByName','notes','rejectionReason','updatedAt']`. Non-admin approvers (manager, instructor leader, ops lead — `isApproverForDoc`, rules:55-62) fail on the four `decided*`/`decisionNotes` keys. Only admin bypasses (rules:207).
- **Impact:** The maker-checker queue can be approved only by admins. Manager/ops-lead/instructor-leader inboxes always show "Failed to approve: Missing or insufficient permissions." The 2026-09-24 feature is non-functional for its intended approvers.
- **Likelihood:** certain on first use. **Severity:** high (critical for the feature). **Confidence:** high.
- **Recommendation:** Pick one contract and align both sides. Either rules allow `decidedBy, decidedByUid, decidedAt, decisionNotes` (current writer) or repository writes `reviewedBy, reviewedByName, reviewedAt, decision` (current rules). Add rules-level tests.

### C3. Cash-discrepancy clock-out is rejected exactly when it matters
- **Evidence:** `clockOutShiftWithCashReconciliation` (`src/features/attendance/shiftsRepository.js:164-227`) adds `approval: envelope` to the shift update (`:216`) when the discrepancy exceeds threshold. The shifts update allow-list (`firestore.rules:240-250`) permits only `['clockOut','updatedAt','cashReconciliation','notes','status','verifiedBy','verifiedAt']` and requires `request.resource.data.clockOut is string`. `approval` is not allowed → the **front-office kiosk clock-out fails with permission-denied whenever a real discrepancy exists** — the exact case the flow was built for. Note the approval submission itself is best-effort (`console.warn` swallow, `:218-223`).
- **Impact:** Cashier cannot clock out with a large discrepancy; shift left open; discrepancy unrecorded on the shift.
- **Likelihood:** certain on first over-threshold event. **Severity:** high. **Confidence:** high.
- **Recommendation:** Remove `approval` from the shift payload (the approval envelope lives in `approvals` collection) or add it to the allow-list; make `submitApprovalRequest` failure surface to the user, not just the console.

### C4. An approved shift self-correction is never applied
- **Evidence:** Non-admin self-correction submits an envelope whose payload is `{ beforeShift, afterData, reasonCode }` (`src/features/attendance/ShiftAdjustmentModal.jsx:53-76`). `ApprovalInbox.jsx:51-70` approves by flipping status only. **Nothing in the codebase reads an approved approval and applies `afterData` to the shift.** Combined with C2, the whole self-correction chain is: submit ✓ → decide ✗ → apply (missing link).
- **Impact:** Staff self-corrections silently never happen; the immutable `shiftAuditEvents` trail that should record them is never written.
- **Likelihood:** certain. **Severity:** high. **Confidence:** high.
- **Recommendation:** Implement the apply step (a repository function executed on approve, wrapped in a batch with the approval status update), or scope the feature to admin-only `adjustShiftWithAudit` until apply exists.

---

## 5. High-Priority Findings

### H1. Front-office student status changes always fail
`updateStudentStatus` writes `status, statusUpdatedAt, statusUpdatedBy` (`src/features/dashboard/usersRepository.js:62-72`). The front-office allow-list (`firestore.rules:108-118`) includes `status` but **not** `statusUpdatedAt`/`statusUpdatedBy` → permission-denied. Daily-operations breakage. (Admin path unaffected.) Severity: high. Confidence: high.

### H2. `markShiftReviewed` writes a forbidden field
`src/features/attendance/shiftsRepository.js:229-231` writes `reviewStatus`, not in the shifts allow-list; caller `StaffDutyTab.jsx:74` is a front-office flow → review marking fails for non-admins. Severity: medium-high. Confidence: high on mismatch; medium on production impact (verify which roles use StaffDutyTab).

### H3. Branch isolation has three holes
- `todos`: `allow read: if isStaff()` (rules:160) — every staff member in every branch reads all directives.
- `staffLeave`: managers read **all branches'** leave (rules:277-279; no `isSameBranch`).
- `corporateEvents`: `allow read: if isStaff()` (rules:263), and events carry no `branchId` (`corporateEventsRepository.js:74-91`).
Severity: medium-high (cross-branch data visibility). Confidence: high.

### H4. Missing composite indexes (UNVERIFIED — runtime)
- Approval inbox listeners for non-admins: `status == pending` + `approverRole in [...]` + `approverBranchId ==` (`src/features/shared/approvalsRepository.js:53-65`) — **no `approvals` index** in `firestore.indexes.json`. Manager/instructor-leader/ops-lead inboxes likely throw `failed-precondition` unless an index was hand-created in the console.
- `fetchOpenShiftFor`: `userId ==` + `clockOut == null` (`shiftsRepository.js:58-63`) — no matching composite (indexes have `userId+clockIn`, `branchId+clockOut`, `branchId+clockIn`).
Severity: high if absent. Confidence: high on the analysis, runtime verification required.

### H5. "Blocking" approval gates never block
`isActionOperational` (`src/features/shared/approvalGates.js:265-269`) is **exported but never called**. `PaymentModal.jsx:191-216` records the payment first and fires `DISCOUNT_OR_REFUND` approval fire-and-forget; `WalkInquiryTab.jsx:91-118` applies the placement override regardless. Dual-control is currently advisory-only, including for actions labelled `mode: "blocking"` (rendered as a rose "blocking" badge in `ApprovalInbox.jsx:157-165`). Severity: high conceptually, medium in practice (consistent notify-first design elsewhere). Confidence: high.

### H6. E2E tests run against live production Firebase
No emulator anywhere; `src/firebase.js:11-17` falls back to hardcoded production config; `playwright.config.ts` boots `npm run dev`. Tests pollute real data and cannot run safely/CI. Severity: medium-high. Confidence: high.

### H7. PWA precache defeats role code-splitting for downloads
`vite.config.js:70-85` precaches `**/*.{js,css,...}` — the service worker downloads **all** role dashboard chunks on install. Code splitting still saves parse/execute, but initial install on a staff phone pulls the entire app. Severity: medium. Confidence: high.

### H8. `FormSync.gs` writes applications with no `branchId` (and no `inquiryId`)
Rules `allow create: if false` (rules:144) — the Apps Script service account bypasses rules entirely, so branch-scoped dashboards (`applications` queries filter `branchId`) will **not see FormSync-created applications**, and desk inquiries never link to their application. The approval transaction does normalize branch on approve, but intake views miss records before that. Severity: medium-high. Confidence: high on field absence; UNVERIFIED how the form data is actually branched operationally.

---

## 6. Medium / Low Findings

- **Unbounded realtime listeners** (growth watch): `todos` full-collection listeners on every staff dashboard (`useDashboardData.js:151`, `ManagerDashboard.jsx:112`, `useStaffDirectives.js:20`); `applications` full-collection listeners with client-side filtering (`MarketingDashboard.jsx:159`, `KidsManagerDashboard.jsx:42`); `users`+`classes` full-collection listeners on kids dashboards. Fine at school scale; linear read growth per connected dashboard.
- **`shiftAuditEvents`: zero readers, no retention.** Written only by admin `adjustShiftWithAudit` (`shiftsRepository.js:326`); readable by admin/manager per rules but surfaced in no UI; retention tooling purges only `errorLogs` (`logRetentionRepository.js:67-105`).
- **`errorLogs` create is open to any signed-in user** (rules:295-301, size-capped only) — free-tier write-spam vector. Low.
- **Client-provided timestamps**: `decidedAt: new Date().toISOString()` (approvalsRepository.js:98,121) and attendance `timestamp` (rules require `is string` only) — integrity, low.
- **`createStaffAccount` two-system write** (`usersRepository.js:141-157`): Auth user created, then Firestore write may fail — handled with a clear manual-recovery error message. Acceptable; documented here per procedure.
- **Non-transactional merge** in `addPlacementTestToInquiry` (`deskInquiriesRepository.js:116-172`) — lost updates under concurrent edits. Medium-low.
- **Deep feature→feature imports bypass barrels** across dashboard/frontoffice/finance/students/classes (~20 sites, e.g. `ManagerCashSummary.jsx:2-3`, `StudentRoster.jsx:1-2`). Violates the guide's stated boundary (`docs/ARCHITECTURE.md:116`) in practice; no functional impact. Low.
- **`useDashboardData.js` is 565 lines** — orchestration concentration; largest hook. Low.
- **`firebase.js` hardcoded client config fallback** — client config is not a secret; but env overrides silently never apply without rebuild, and the key is public in git history. Low. App Check debug token force-enabled in dev (fine).
- **tsconfig `strict: false`; `cloudflare-worker/` and `tests/` excluded from typecheck.** Low.
- **Approvals repository test is thin** (`src/features/shared/approvalsRepository.test.js` — hand-mocked firestore, asserts return mapping only); a broken write path would pass.
- **Root `ARCHITECTURE.md` contains duplicated pointer paragraphs** (cosmetic).

---

## 7. Missing Links

```text
Staff self-correction ──▶ approvals (created ✓)
      ✗ decide  (rules reject non-admin decision fields — C2)
      ✗ apply   (no code applies afterData to the shift — C4)
      ✗ audit   (shiftAuditEvents only written on admin path)

Cashier clock-out w/ discrepancy ──▶ shift update REJECTED (C3)
      ~ approval envelope created (best-effort, may also fail silently)

Google Form ──▶ applications (no branchId) ──✗──▶ branch-scoped intake views (H8)
      ✗ deskInquiry link (inquiryId never set)

Payment "blocking" approval ──✗── never blocks execution (H5)

shiftAuditEvents ── written, readable by admin/manager rules, ──✗── no UI reader, no retention
```

---

## 8. Data Model Assessment

| Collection | Class | Growth | Notes |
|---|---|---|---|
| `attendance` | A | unbounded | Idempotent deterministic IDs (`${uid}_${dateKey}`, `shiftsRepository.js:296-298`) — good. Reads date-bounded. |
| `shifts` | A | unbounded | Open-shift listeners bounded by `clockOut==null`; history read via reports. |
| `shiftAuditEvents` | A | unbounded | **No reader, no retention** — see §6. |
| `errorLogs` | A | unbounded | Write-only + 38-day manual purge. Purge is manual — retention is a dashboard action, not scheduled. |
| `schoolOutreach/{id}/visits` | A | unbounded | Per-school listener unbounded (`schoolOutreachRepository.js:106-119`); collectionGroup feed bounded (date window + limit). |
| `applications`, `deskInquiries`, `corporateEvents`, `todos` | B | moderate | `todos` treated operationally but listened collection-wide. |
| `users`, `classes` | C | school-bounded | Full-collection reads acceptable at scale; branch filter present on manager path. |
| `approvals` | B | moderate | Contract mismatch with rules (C2); indexes missing (H4). |

No unbounded arrays or growing-single-document patterns were found. No orphaned-child risk on delete: `deleteUserProfile` scrubs class rosters in a batch (`usersRepository.js:164-187`), with fail-closed history checks before deletion.

---

## 9. Security Assessment

**Boundaries that hold:** invite-pinned signup (role/branch from invite doc, unguessable token, `firestore.rules:76-137`); applications create fully blocked to clients (`allow create: if false`); attendance creation restricted to staff roles for student IDs with double-scan idempotency; progress reports bound to the class instructor; materials owner-scoped; shift audit trail immutable (admin-only create, no update/delete); catch-all deny (`rules:334-336`); manager branch scoping on users/payments/shifts/outreach queries verified consistent with query filters ("rules are not filters" is respected on the manager path — `ManagerDashboard.jsx:78` matches `isSameBranch`).

**Boundaries that fail:**
- C1 payments world-readable (critical).
- C2/C3/C4/H1/H2 rules-vs-writer allow-list mismatches (features broken; in the C1 case data leaks).
- H3 branch isolation holes (todos, staffLeave, corporateEvents).
- UI role checks are understood to be non-authoritative — good — but note role comes from `users/{uid}.role` readable/writable per the self-update allow-list limited to display fields (rules:119-122) — no elevation path found.
- Client-provided `branchId` on create is constrained by `isSameBranch(request.resource.data)` — correct pattern.

---

## 10. Scalability Assessment

| Subsystem | Current Design | Growth Risk | Bottleneck | Recommended Direction |
|---|---|---|---|---|
| Staff dashboards (todos/apps listeners) | Full-collection `onSnapshot` per dashboard | Reads grow linearly with collection size × connected dashboards | Firestore reads on `todos`/`applications` | Add `limit()` + status/date bounds; revisit at >100 staff |
| Open-shift dashboards | `branchId+clockOut==null` listener | Bounded by open shifts — low | — | Monitor |
| Reports (`reportsRepository`) | One-shot date-windowed reads | Low | — | Fine |
| Outreach feed | collectionGroup + date window + limit | Low | — | Fine; per-school visit listener needs a limit eventually |
| Operational logs | `errorLogs` (manual purge), `shiftAuditEvents` (none) | Storage growth unbounded | Storage, not reads | Scheduled retention for both |
| PWA delivery | Precaches all chunks | Install payload grows with app | Bandwidth on first install | Narrow `globPatterns` to shell + current-role chunks is non-trivial — defer, monitor bundle size |
| FormSync pipeline | One write per form submission | Serializes at scale; free tier fine at intake volumes | Apps Script quotas | Acceptable; add `branchId` (H8) |

**Traffic scenarios (§8 of procedure).** *Busy:* N staff dashboards × unbounded listeners — reads = N × collection sizes; at school scale (todos ~10³/yr) this stays in free tier but grows linearly. *Peak:* kiosk scan bursts are single writes with deterministic IDs — no contention. *Growth:* the first real bottleneck is **dashboard listener fan-out on `todos`/`applications`**, then **log storage**; both degrade gracefully (slow dashboards, not corruption).

---

## 11. Failure Mode Assessment

- **Firestore write fails mid-flow:** batch commit failures are retried for invites (`authRepository.js:17-27`) and surfaced elsewhere via toasts; `clockOutShiftWithCashReconciliation` swallows approval-submission errors (C3).
- **UI thinks it failed but succeeded / double submit:** attendance idempotent by design; kiosk clears the scanner before processing (`useKioskScanner.js:207-225`); no other mutation has an idempotency key (payments double-submit = two payments — rely on UI disabled state).
- **Race conditions:** status transitions are plain `updateDoc` without read-check (`approvalsRepository.js:103,126`, `todosRepository.js:57,68`, `deskInquiriesRepository.js:101,194`, `paymentsRepository.js:160`) — last-write-wins; acceptable at current scale except the placement-test merge (lost updates).
- **Auth expiry / kill switch:** profile-doc listener logs out + blocks UI (`App.jsx:175-194`) — good.
- **Legacy documents:** code defends with `|| null`/`|| []` in most reads; the rules carry branch-name fallbacks for pre-branchId docs (`rules:41-53`) — thoughtful.
- **Offline/PWA:** SW active in dev (`devOptions.enabled`) can serve stale builds during development — minor developer footgun.

---

## 12. Testing Gaps

- **`firestore.rules` has zero automated coverage.** No rules-unit-testing/emulator. `securityRulesMatrix.test.js` hand-duplicates rule logic in JS — it would not have caught any of C1-C4/H1/H2 (and demonstrably didn't). This is the single highest-leverage test investment.
- **No auth-flow unit tests** (login, invite signup, guards) — only e2e login-page rendering.
- **Approvals repository test is shallow** (hand-mocked; no write assertions).
- **No concurrency tests** (firestoreFake is single-player).
- **No dashboard-aggregation tests** (`useDashboardData.js` untested).
- E2E requires production Firebase (H6) — cannot be run safely; therefore "e2e passes" is not currently verifiable without risk.
- Positive: repository tests for shifts/payments/outreach/applications are genuinely strong (payload + batch-rollback assertions).

---

## 13. Technical Debt (engineering-risk only)

1. Rules/payload contract drift — the four allow-list mismatches are the debt that keeps producing incidents; the hand-copied matrix test enables it.
2. Undocumented Worker + FormSync pipeline — two production writers invisible to the architecture guide.
3. Unbounded listeners and log retention — deferred-cost debt.
4. Barrel-bypass imports — cosmetic; do not mass-fix.
5. 565-line dashboard hook — monitor, don't refactor yet.

---

## 14. Recommended Roadmap

### Fix Now (before any feature work)
1. **C1** — scope `payments` get to `signedIn() && studentId == auth.uid`; redeploy rules.
2. **C2** — align approval decision fields (rules ↔ `approvalsRepository`).
3. **C3** — stop writing `approval` onto shifts (or allow-list it); surface approval-submission failures.
4. **C4** — implement apply-after-approve for self-correction, or hide the flow for non-admins.
5. **H1/H2** — extend `users`/`shifts` allow-lists (or stop writing the extra fields).
6. **H4** — verify in console; add the two composite indexes to `firestore.indexes.json` and deploy.
7. **Add rules-level tests** (firebase emulator suite covering each collection's allow/deny matrix) so this class of bug cannot ship silently again.

### Fix Before Growth
- Branch isolation for `todos`/`staffLeave`/`corporateEvents` (H3).
- `branchId` (and `inquiryId`) in `FormSync.gs` payloads (H8).
- Retention job for `shiftAuditEvents`; automate `errorLogs` purge.
- Bound `todos`/`applications` dashboard listeners.
- PWA precache scope; e2e emulator.

### Monitor
- Firestore read counts vs dashboard listener count; bundle size; `shiftAuditEvents` size; approval-inbox error rates after H4.

### Do Not Change Yet
- Repository-exception direct Firestore paths (documented, working).
- Barrel import discipline (no functional gain worth the churn).
- `createStaffAccount` two-step write (well-handled).
- Hardcoded client Firebase config fallback (client config is public by design; document the env rebuild caveat).

---

## 15. Required Final Questions

1. **Architectural flaw causing data corruption or security failure?** Yes — C1 (public payment reads) is a live security failure; C2-C4/H1/H2 are integrity failures (controls that silently do nothing).
2. **Missing business/data logic link?** Yes — the self-correction chain (submit→decide→apply) is broken at decide and missing at apply (C2+C4); FormSync→branch views link is broken (H8).
3. **First bottleneck under heavy traffic?** Dashboard realtime-listener fan-out: reads = connected dashboards × `todos`/`applications` collection sizes.
4. **First bottleneck as the database grows?** Unbounded listeners (same collections), then log storage (`shiftAuditEvents` never purged).
5. **Safe now but risky at 10×?** Full-collection listeners; manual-only log retention; advisory-only "blocking" gates; Apps Script intake without branch scoping.
6. **Must be fixed before adding more features?** C1-C4, H1, H2, H4 — the rules-contract discipline; otherwise every new dual-control feature inherits the same silent-failure mode.
7. **Safe technical debt?** Documented repository exceptions, barrel bypasses, the 565-line hook, two-step staff creation.
8. **Load-test rather than guess?** Dashboard listener fan-out at ~50 concurrent staff; kiosk scan burst; approval-inbox latency once indexes exist. (Firestore usage data from console is the real evidence.)
9. **Unverified assumptions?** Console-created indexes; production hosting path; live Firestore behavior for the failing rules (silent warns may be hiding prod errors); FormSync's operational branching; Worker deployment status.
10. **Does `docs/ARCHITECTURE.md` describe reality?** Mostly yes (refresh is recent), with the drift listed in §3 — stale legacy warning, missing `pwa`/`frontoffice`/Worker/FormSync/approvals design sections.
11. **Architecture changes to document after this audit?** Only after fixes are approved and implemented: the approval-apply mechanism, Worker + FormSync as documented infrastructure, corrected legacy-status section. Per `AGENTS.md`, doc updates wait for explicit approval.
12. **Smallest practical roadmap to stronger production readiness?** The 7 "Fix Now" items in §14 — they are small, localized changes (one rules file + two repositories + one inbox + one script field) that close every confirmed security/reliability hole, plus one emulator test suite to lock the boundary.
