# MyLiberty Portal — Audit Revision & Security Corrections

**Document Version:** 1.1  
**Revision Date:** September 25, 2026  
**Repository Reviewed:** `aymira-git/mylibertyportal-origin` (`main`)  
**Base Document:** `kiosk-security-and-audit-summary.md` v1.0

## Executive Assessment

The v1.0 audit has a strong structure and a useful central idea: separate **account-bound dashboard access** from the narrower **action-bound clock-in operation**. The Tri-State Drift approach is also appropriate for this project because the repository explicitly requires architectural claims to be checked against the implementation rather than treated as proof of reality.

The main revision needed is to distinguish **design intent** from **server-enforced security**. The current repository still contains important gaps between the audit's description of the kiosk solution and what `firestore.rules` actually enforce.

The most important conclusion is:

> **The kiosk security problem is not fully solved yet. The current Firestore rules authorize Front Office shift creation by role and branch, but they do not currently require a kiosk-specific proof such as `kioskDeviceId`, a QR challenge, or another server-verifiable physical-presence signal.**

That means the audit should not describe physical kiosk anchoring as an implemented control until the proof is enforced at the trust boundary.

---

## 1. Findings From v1.0 That Should Be Kept

### 1.1 Tri-State Drift Analysis

Keep the separation between:

1. Declared architecture
2. Implemented architecture
3. Runtime / infrastructure enforcement

This is consistent with the repository's own audit procedure and should remain the core audit method.

### 1.2 Account-Bound vs Action-Bound Access

Keep the distinction between normal Front Office access and the much narrower clock-in operation.

This is the right conceptual model, but the second half must be implemented as a server-side authorization condition rather than only as a UI behavior.

### 1.3 Maker-Checker for Shift Corrections

Keep the dual-control model for forgotten clock-ins and manual corrections. The current rules already contain an approval-linked correction path through `approvals` and prevent the requester from approving their own request.

---

## 2. Critical Corrections to v1.0

## CRITICAL-01 — Kiosk Presence Is Not Yet Enforced by Firestore Rules

**v1.0 claim:** the clock-in action is physically anchored to the lobby kiosk through QR scanning or `kioskDeviceId`.

**Current repository evidence:** `firestore.rules` allows `/shifts` creation when the caller is Admin or Front Office and the requested shift belongs to the caller's branch. The rule does not require `kioskDeviceId`, a kiosk challenge, QR proof, a device claim, or any other physical-presence signal.

Current rule shape:

```text
allow create: if (isAdmin() || (isFrontOffice() && isSameBranch(request.resource.data)))
              && request.resource.data.userId is string
              && request.resource.data.clockOut == null
              && isTrackedShiftRole(roleOf(request.resource.data.userId));
```

### Impact

An authenticated Front Office client that can construct a valid Firestore request can attempt to create an on-site shift without demonstrating that the request originated from the physical kiosk.

### Revision

Move the kiosk proof into the actual trust boundary. A UI check is not sufficient because the audit procedure explicitly assumes a malicious client.

The kiosk protocol should preferably include:

- a kiosk-specific identity or rotating challenge;
- a short expiration window;
- one-time use / replay protection;
- branch binding;
- server-side validation;
- explicit rejection when the proof is missing or invalid.

A static browser-stored token should not be treated as a strong hardware identity because a browser client can be inspected and copied.

**Severity:** Critical  
**Likelihood:** High until the server-side proof is enforced  
**Confidence:** High

---

## CRITICAL-02 — Shift Timestamps Are Client-Controlled

The `/shifts` rules validate that `userId` is a string and that `clockOut` is initially null, but they do not require `clockIn` to be generated from server time. Clock-out updates accept a client-supplied string timestamp.

### Impact

A malicious or buggy client can potentially submit implausible historical or future times even when the user is otherwise authorized to write the shift.

### Revision

Use Firestore `Timestamp` / server-generated timestamps for authoritative clock events, or otherwise enforce a server-derived time value with an explicit skew policy.

The audit should treat time integrity as a separate control from kiosk presence:

```text
Physical-presence proof
        +
Server-authoritative timestamp
        +
Replay prevention
        =
Stronger clock-in integrity
```

**Severity:** Critical for payroll/timekeeping integrity  
**Likelihood:** Medium–High  
**Confidence:** High

---

## HIGH-01 — Multiple Open Shifts Are Not Clearly Prevented

The current `/shifts` create rule requires `clockOut == null`, but it does not itself guarantee that a staff member has only one open shift.

The v1.0 audit focuses on attendance idempotency, but the same question must be answered for shifts.

### Revision

Define and enforce one authoritative open-shift invariant per staff member. Possible implementations include:

- deterministic active-shift document IDs;
- a transaction against an authoritative active-shift record;
- or a trusted server-side operation.

Add a security test that attempts to create two open shifts concurrently.

**Severity:** High  
**Confidence:** Medium–High

---

## HIGH-02 — Branch Isolation Is Strong in Some Collections, But the v1.0 Wording Is Too Broad

The repository contains both `isSameBranch()` and `isSameBranchStrict()` because the project itself recognizes that list-query authorization needs special treatment.

However, the current rules do not apply strict branch checks uniformly.

Examples that require explicit verification:

- `/users` list uses the general `isSameBranch()` helper rather than the strict helper.
- `/classes` read access is granted to `isStaff()` without a branch predicate.
- `/attendance` read access is granted to `isStaff()` without a branch predicate.

This may be intentional for some operational workflows, but it contradicts any blanket statement that all of these collections are strictly branch-isolated.

### Revision

Change the audit wording from:

> “strict branch boundary matching across ...”

to:

> “branch isolation is enforced for several operational collections, but branch scope is intentionally/global for some collections and requires targeted verification for list/read paths.”

Then add Firestore rules tests for cross-branch reads and writes.

**Severity:** High where cross-branch confidentiality is expected  
**Confidence:** High that the rules differ; runtime exposure requires rules-test confirmation

---

## HIGH-03 — Client Transactions Are Not the Security Boundary for Class Capacity

The v1.0 audit says class enrollment is protected by `runTransaction`.

A client transaction helps with concurrent normal clients, but it does not prevent a malicious client from bypassing the repository and issuing its own Firestore update.

The current `/classes` update rule limits which fields Front Office can modify, but it does not by itself demonstrate that capacity cannot be exceeded.

### Revision

Treat capacity as a database invariant, not merely a repository behavior.

Preferred order:

1. encode the capacity invariant in Firestore rules where practical;
2. keep the client transaction for normal concurrency handling;
3. use a trusted backend operation when the invariant cannot be safely represented in rules.

Add tests for:

- two simultaneous enrollments into the final available seat;
- duplicate enrollment;
- direct malicious Firestore update;
- enrollment after capacity is reached.

**Severity:** High  
**Confidence:** Medium–High

---

## HIGH-04 — Offline PWA Behavior Must Explicitly Exclude Clock-In Writes

The v1.0 audit describes offline mutation queuing as a resilience feature.

That is useful for many business workflows, but attendance/shift clock-in has a different threat model. A queued clock-in mutation could be replayed after the device reconnects unless the kiosk operation is deliberately excluded or contains a server-verifiable challenge with expiry.

### Revision

Define the clock-in policy explicitly:

> **Clock-in must fail closed when the kiosk cannot obtain the authoritative physical-presence proof and server time.**

Offline support can remain enabled for lower-risk workflows, but clock-in should not silently queue as a normal offline mutation.

**Severity:** High  
**Confidence:** Medium — requires inspection/test of the actual PWA mutation queue

---

## 3. Corrections to the v1.0 Roadmap

The following v1.0 items should be reclassified.

### Remove as stale

**“Update `firestore.rules` to allow `isFrontOffice()` shift creation.”**

The current rules already allow Front Office shift creation when the branch condition is satisfied. The remaining problem is not basic write permission; it is the missing physical-presence control.

**“Restrict `/errorLogs` creation rule to authenticated sessions.”**

The current rule already requires `signedIn()` and validates message/timestamp fields. This should not remain a “fix now” item. A future hardening pass can consider abuse volume, PII minimization, and retention instead.

### Replace with

**“Enforce the kiosk proof at the Firestore/server trust boundary.”**

**“Make shift timestamps server-authoritative.”**

**“Prevent multiple simultaneous open shifts.”**

**“Prove branch isolation with automated Firestore rule tests.”**

**“Verify that offline mutation queues cannot replay clock-ins.”**

---

## 4. Scalability Revision — Do Not Automatically Replace the Full Users Read

The v1.0 audit identifies the full `/users` listener as an `O(N)` read-amplification risk and suggests filtering to active users.

That recommendation should be softened.

The current architecture guide explicitly documents that the full `users` collection is intentionally read in memory because roster search/sort and related student lookups depend on the complete set. The same guide says browser pagination reduces render cost, not database read cost, and that a future scale solution should be a server-side search index rather than simply applying `limit()`.

### Revised position

**Monitor now; redesign only when measurements justify it.**

Do not replace the current user query with `status == active` merely to reduce reads, because that can silently break:

- alumni/student search;
- historical staff/student lookup;
- unenrolled-student workflows;
- any feature that expects the complete roster.

The correct growth path is closer to:

```text
Current
  ↓
Measure actual user-read cost
  ↓
Identify which screens truly need the full roster
  ↓
Split operational lookup from roster search
  ↓
Introduce server-side search/indexing only when justified
```

**Severity:** Medium growth concern, not an automatic “fix now” issue  
**Confidence:** High

---

## 5. Audit Evidence Quality Revision

The v1.0 report includes point-in-time claims such as:

- 48 test files;
- 673 passing tests;
- zero lint errors/warnings;
- clean Vite builds;
- working offline mutation queues.

These are useful results, but the audit format should record the evidence source for each claim.

For every execution-based finding, record:

```text
Commit SHA:
Command:
Date/time:
Environment:
Result:
CI artifact / log:
```

Without that evidence, classify the claim as:

> **UNVERIFIED — requires runtime/CI verification.**

This follows the repository's own audit standard.

---

## 6. Revised Security Model

The security model should now be documented as four layers rather than three:

```text
ACCOUNT AUTHENTICATION
    ↓
ROLE + BRANCH AUTHORIZATION
    ↓
ACTION-SPECIFIC TRUST PROOF
    ↓
DATA INTEGRITY / REPLAY CONTROLS
```

For clock-in specifically:

```text
Authenticated staff account
        +
Correct branch
        +
Valid kiosk challenge / kiosk proof
        +
Server-authoritative timestamp
        +
No replay / no duplicate open shift
        ↓
Create authoritative shift
```

A UI-only kiosk flag should not be considered part of this trust chain.

---

## 7. Revised Roadmap

### Fix Now — Security and Data Integrity

1. Enforce the kiosk proof at the actual server trust boundary.
2. Make `clockIn` / `clockOut` authoritative server timestamps.
3. Prevent duplicate open shifts.
4. Add Firestore rules tests for direct malicious writes.
5. Verify cross-branch access for `users`, `classes`, `attendance`, `payments`, `shifts`, `deskInquiries`, and `schoolOutreach` according to their intended policy.
6. Ensure clock-in fails closed while offline or while the physical-presence proof is unavailable.

### Fix Before Growth

1. Measure full-roster reads and dashboard listener scope.
2. Add load tests for simultaneous attendance/shift activity.
3. Add capacity invariants for class enrollment.
4. Review large-list search paths before the school population grows substantially.

### Monitor

1. Firestore read/write volume by dashboard and workflow.
2. Kiosk proof failures and replay attempts.
3. Duplicate-open-shift rejection events.
4. Offline/reconnect clock-in failures.
5. Cross-branch authorization test results after every rules change.

### Do Not Change Yet

1. Domain-centered feature layout.
2. Repository ownership of Firestore access.
3. Direct lazy-loaded role routes in `App.jsx`.
4. Browser-side pagination for rendering long lists.
5. Existing date-windowed reads for rapidly growing `shifts` and `attendance`, subject to load testing.

---

## 8. Revised Required Questions

### 1. Is there an architectural flaw that could cause data corruption or security failure?

**Yes.** The current kiosk design is not fully represented in the Firestore trust boundary, and shift time values are not currently demonstrated to be server-authoritative.

### 2. Is there a missing link in the business/data logic?

**Yes.** The missing link is the chain from “physical kiosk interaction” to a server-verifiable authorization condition for creating a shift.

### 3. What is the first traffic bottleneck under heavy usage?

**Candidate:** broad real-time reads and dashboard fan-out. This should be load-tested rather than declared from architecture alone.

### 4. What becomes the first bottleneck as the database grows?

**Candidate:** full-roster reads/search coupled to client-side filtering. The architecture guide already identifies this as the eventual point where server-side search becomes preferable.

### 5. Which decisions are safe now but potentially risky at 10× scale?

The full `users` read, broad dashboard listeners, and client-side filtering are the clearest candidates.

### 6. What must be fixed before adding more features?

The kiosk trust boundary, server-authoritative shift times, duplicate-open-shift prevention, and cross-branch authorization tests.

### 7. What can safely remain technical debt?

The current domain layout and browser-side pagination can remain until measured usage proves otherwise.

### 8. What should be load-tested instead of guessed?

Kiosk bursts, concurrent shift creation, attendance bursts, dashboard listeners, report queries, and reconnect behavior after offline periods.

### 9. What assumptions remain unverified?

Production deployment behavior, exact CI test counts/results for the audited commit, Cloudflare Worker behavior, actual PWA mutation-queue semantics, and the effectiveness of the proposed kiosk proof.

### 10. Does `docs/ARCHITECTURE.md` still describe reality?

**Partially.** It accurately describes the domain structure and the intentional full-roster read, but security details and runtime behavior should be rechecked after the kiosk controls are actually implemented.

### 11. What should be documented after implementation?

The final kiosk trust protocol, timestamp authority, replay protection, branch policy per collection, offline policy for clock-in, and the corresponding rules/test matrix.

### 12. What is the smallest practical roadmap toward stronger production readiness?

```text
Server-enforced kiosk proof
        ↓
Server timestamps + duplicate-shift guard
        ↓
Firestore rules security matrix
        ↓
Offline clock-in fail-closed test
        ↓
Concurrency/load tests
        ↓
Measured scalability changes only where needed
```

---

## 9. Bottom Line

The v1.0 audit is directionally strong, but it is currently **ahead of the implementation in a few security claims**.

The biggest revision is not a new architecture. It is a stricter evidence standard:

> **If a control is not enforced by the actual trust boundary, label it as designed/proposed rather than implemented.**

That single distinction will make the audit much more reliable and will prevent the implementation roadmap from spending effort on already-fixed items while missing the remaining kiosk, timestamp, duplicate-shift, and branch-authorization risks.
