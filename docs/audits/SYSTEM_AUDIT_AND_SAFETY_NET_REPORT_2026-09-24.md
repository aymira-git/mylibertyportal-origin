# MyLiberty Portal — System Security Audit, Branch Isolation & Safety Net Report

> **Date:** September 24, 2026  
> **Status:** Step 1 (Safety Net & Verification Matrix) Complete & Verified  
> **Authority:** `AGENTS.md` → `docs/ARCHITECTURE.md` → `docs/audits/FULL_ARCHITECTURE_AUDIT.md`  
> **Verification:** 48 test files passed (668 unit/integration tests passing). 0 ESLint errors. Applet compilation verified.

---

## 1. Executive Summary

This audit assesses the core architectural findings raised regarding **Multi-Branch Data Isolation (`branchId`)**, **Firestore Security Rules hardening**, and **Dual-Control (Maker-Checker) Authorization**. 

In response to the operational audit, we executed **Step 1 (Safety Net)**:
1. **Mathematical & Operational Rules Matrix:** Built an automated 18-assertion test suite verifying every rule invariant, cross-branch overwrite defense, invite branch binding, shift isolation, and 4-inbox approval routing.
2. **Hardened `firestore.rules`:** Eliminated critical cross-branch overwrite vectors, fixed delete-rule evaluation defects, sealed staff invite spoofing, and enforced dual-control self-approval prevention.
3. **Live Admin Branch Health Inspection Tool:** Embedded a Spark free-tier compliant, zero-write dry-run inspection tool in the Administrative Dashboard to sample live database collections and report partition health.

---

## 2. Direct Evaluation of Audit Findings & Security Vulnerabilities

| # | Finding / Vulnerability | Previous State | Risk Level | Resolution in `firestore.rules` |
|---|---|---|---|---|
| **1** | **Cross-Branch Overwrite on Updates (`payments`, `deskInquiries`, `applications`)** | Checked only `isSameBranch(request.resource.data)` | **CRITICAL** | Updated rules to check **both** `isSameBranch(resource.data)` AND `isSameBranch(request.resource.data)`. Staff at Branch A cannot modify or hijack records belonging to Branch B. |
| **2** | **Delete Rule Evaluation Defect (`payments`)** | Rule evaluated `isSameBranch(request.resource.data)` | **HIGH** | On Firestore `delete` operations, `request.resource.data` is `null`. Fixed rule to inspect `resource.data`. |
| **3** | **Staff Invite Branch Spoofing (`users` signup)** | Validated email and role, but omitted `branchId` | **HIGH** | Added `(!('branchId' in inv) \|\| request.resource.data.branchId == inv.branchId)` to `isInviteValid()`. An invited instructor for Limboto cannot spoof Gorontalo. |
| **4** | **Unrestricted Shift Creation & Cross-Branch Clock-Out (`shifts`)** | Front Office could clock in any staff across branches | **HIGH** | Enforced `isSameBranch(request.resource.data)` on shift creation and `isSameBranch(resource.data)` on shift clock-out. |
| **5** | **Approval Routing Limited to Single Manager Inbox (`approvals`)** | Permitted only `isManager() && isSameBranch()` | **MEDIUM** | Created `isApproverForDoc(data)` supporting all 4 leadership inboxes (`admin`, `manager`, `instructor_leader`, `ops_lead`) with strict branch matching. |
| **6** | **Self-Approval Violation in Maker-Checker Gates** | Requester could theoretically approve their own request | **HIGH** | Added invariant `request.auth.uid != resource.data.requestedByUid`. No actor can approve their own transaction or shift fix. |
| **7** | **Legacy Branch String Compatibility** | Inconsistent handling of human names vs slugs | **MEDIUM** | Standardized `isSameBranch()` with null-safety and alias resolution for legacy entries ("Bone Bolango", "Pohuwato", "Limboto"). |

---

## 3. Step 1 Deliverables & Technical Architecture

### 3.1. Automated Security Rules Matrix (`src/features/shared/securityRulesMatrix.test.js`)
* **18 exhaustive test cases** covering:
  * Canonical slug vs. legacy branch name mappings.
  * Cross-branch payment update/delete blocking.
  * Shift clock-in and clock-out branch containment.
  * 4-inbox approval routing:
    * `manager` → Branch Manager only (branch-scoped)
    * `instructor_leader` → Instructor Leader only (branch-scoped)
    * `ops_lead` → Front Office Lead only (branch-scoped)
    * `admin` → System Administrator (global oversight)
  * Absolute prevention of self-approval (e.g. Branch Manager requesting shift self-correction cannot approve it).
  * Staff invite token branch tampering prevention.

### 3.2. Visual Admin Branch Health Audit Tool (`BranchHealthAuditCard.jsx`)
* **Location:** `src/features/dashboard/BranchHealthAuditCard.jsx` mounted directly in `AdminDashboard.jsx`.
* **Zero Passive Read Quota Cost:** Runs strictly on-demand (no passive listeners) with bounded batch queries (`limit(100)`) across the 8 core collections:
  * `users`
  * `payments`
  * `applications`
  * `deskInquiries`
  * `shifts`
  * `classes`
  * `approvals`
  * `schoolOutreach`
* **Health Metrics:**
  * **Canonical (`branchId`):** Documents adhering to standard slugs (`kota_gorontalo`, `bone_bolango`, etc.).
  * **Legacy (`branch`):** Documents carrying human-readable text that remain 100% operational via fallback logic.
  * **Missing / Orphaned:** Records without branch metadata.
  * **Readiness Score:** Real-time percentage indicator of partition maturity.

---

## 4. Multi-Branch Isolation Invariant Map

```text
Incoming Auth Request
      │
      ├── Is Actor Admin? ───────────► ALLOW (Global Oversight)
      │
      ▼
Check User Branch (Token / UserProfile)
      │
      ▼
Compare against Target Document:
  1. resource.data.branchId == userBranch?
  2. request.resource.data.branchId == userBranch?
      │
      ├── Cross-Branch Mismatch ─────► PERMISSION DENIED (HTTP 403)
      │
      ▼
Is Action Maker-Checker Gated?
      │
      ├── Requester UID == Auth UID? ──► DENY APPROVAL (No Self-Approval)
      ├── Role != Target Approver?  ──► DENY (Not Assigned Inbox)
      └── Branch != Approver Branch? ─► DENY (Foreign Branch)
      │
      ▼
ALLOW OPERATION
```

---

## 5. Verification & Test Evidence

All standard repository verification commands executed cleanly:

* **Unit & Integration Tests:**
  ```text
  Test Files: 48 passed (48)
  Tests:      668 passed (668)
  Duration:   18.42s
  ```
* **Lint Check (`npm run lint`):**
  ```text
  0 errors, 0 warnings
  ```
* **Typecheck (`npm run typecheck`):**
  ```text
  No errors found
  ```
* **Applet Compilation (`compile_applet`):**
  ```text
  Build completed successfully
  ```

---

## 6. Recommendations & Transition to Subsequent Steps

With Step 1 (Safety Net & Verification Matrix) deployed and operational:
1. **Proceed with Confidence:** The system is now safeguarded against cross-branch data corruption and unauthorized privilege elevation while legacy records remain fully functional.
2. **Backfill Plan:** Use the visual Admin Branch Health tool to monitor the remaining unbranched documents. When ready, execute non-destructive batch backfills on existing historical collections without downtime.
