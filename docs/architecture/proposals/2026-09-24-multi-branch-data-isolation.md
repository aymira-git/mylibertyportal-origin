# Architecture Proposal: Multi-Branch Data Isolation (`branchId` Scoping)

> **Date:** 2026-09-24  
> **Status:** Proposal for Implementation (Item 8)  
> **Reference Standards:** `AGENTS.md`, `docs/ARCHITECTURE.md`, 2026-09-24 Execution Brief  
> **Affects:** `src/constants/branches.js`, `firestore.rules`, all repositories (`users`, `payments`, `shifts`, `applications`, `deskInquiries`, `schoolOutreach`, `classes`), and `approvalGates.js`.

---

## 1. Problem & Operational Context

1. **Organizational Hierarchy:**
   - **Global Tier (Cross-Branch):** Owner / Director / Vice Director (provisionally represented by the `admin` role). They oversee all campus branches and require aggregate cross-branch reporting.
   - **Branch Tier (Location-Isolated):** Branch Manager (`manager`), Operations / Front Office Lead (`frontoffice` / `opslead`), Instructor Leader (`instructorleader`), Marketing (`marketing`), and Instructors (`instructor`) operate strictly at their designated branch.
2. **Current Vulnerability / Gap:**
   - In `firestore.rules`, `isManager()` and `hasRole('marketing')` grant unrestricted global read/write access across all user profiles, payments, shift logs, and leads without checking the document's campus location.
   - A Branch Manager or Marketing officer at one branch (e.g. *Bone Bolango*) could technically query or view student tuition records and prospective walk-in leads from another branch (e.g. *Kota Gorontalo*).

---

## 2. Proposed Architecture & Data Contract

### A. Canonical Branch ID Mapping (`src/constants/branches.js`)
We introduce deterministic, slugified `branchId` constants paired with the existing human-readable `BRANCHES` list:

```js
export const BRANCH_MAP = {
  kota_gorontalo: "Kota Gorontalo",
  bone_bolango: "Bone Bolango",
  pohuwato: "Pohuwato",
  limboto: "Limboto",
};

export const DEFAULT_BRANCH_ID = "kota_gorontalo";
export const DEFAULT_BRANCH = "Kota Gorontalo";
```

Helper utilities:
- `branchToId(name)` → converts any canonical or legacy branch string into its slug (`"kota_gorontalo"`).
- `idToBranch(id)` → converts slug into canonical display name (`"Kota Gorontalo"`).
- Legacy fallback: Missing `branchId` on legacy documents automatically resolves to `DEFAULT_BRANCH_ID` (`"kota_gorontalo"`).

### B. Document Tagging Contract
All operational documents written to Firestore will include both `branchId` (for index and rule matching) and `branch` (for UI display):
- `users/{userId}`: `{ branchId: "kota_gorontalo", branch: "Kota Gorontalo", ... }`
- `deskInquiries/{inquiryId}`: `{ branchId: "kota_gorontalo", branch: "Kota Gorontalo", ... }`
- `payments/{paymentId}`: `{ branchId: "kota_gorontalo", branch: "Kota Gorontalo", ... }`
- `shifts/{shiftId}`: `{ branchId: "kota_gorontalo", branch: "Kota Gorontalo", ... }`
- `applications/{appId}`: `{ branchId: "kota_gorontalo", branch: "Kota Gorontalo", ... }`
- `schoolOutreach/{schoolId}`: `{ branchId: "kota_gorontalo", branch: "Kota Gorontalo", ... }`
- `classes/{classId}`: `{ branchId: "kota_gorontalo", branch: "Kota Gorontalo", ... }`

---

## 3. Firestore Security Rules Redesign

### Helper Functions in `firestore.rules`:
```text
function userBranch() {
  return signedIn()
    ? (userProfile().branchId != null ? userProfile().branchId : 'kota_gorontalo')
    : null;
}

function isSameBranch(targetBranchId) {
  let docBranch = targetBranchId != null ? targetBranchId : 'kota_gorontalo';
  return isAdmin() || (signedIn() && userBranch() == docBranch);
}
```

### Rule Scoping Matrix:
1. **`users` Collection:**
   - `admin`: Read/write all branches globally.
   - `manager`: Read users where `isSameBranch(resource.data.branchId)`.
   - `frontoffice`: Read/create students where `isSameBranch(request.resource.data.branchId)`.
2. **`deskInquiries` Collection:**
   - `admin`: Read/write all branches.
   - `frontoffice` / `manager` / `marketing`: Read/create/update where `isSameBranch(resource.data.branchId)`.
3. **`payments` Collection:**
   - `admin`: Full global access.
   - `manager` / `frontoffice`: Read/write restricted to `isSameBranch(resource.data.branchId)`.
4. **`shifts` Collection:**
   - `admin`: Full global access.
   - `manager`: Read shifts where `isSameBranch(resource.data.branchId)`.
   - `frontoffice` / `staff`: Own shift records, or branch kiosk station operations.
5. **`applications` Collection:**
   - `admin`: Full global access.
   - `frontoffice` / `manager` / `marketing`: Read/update restricted to `isSameBranch(resource.data.branchId)`.
6. **`schoolOutreach` Collection:**
   - `admin`: Full global access.
   - `marketing` / `manager`: Read/write restricted to `isSameBranch(resource.data.branchId)`.

---

## 4. Unlocking Dual-Control (Maker-Checker) Routing (Item 7)

With `branchId` guaranteed across all documents:
- When a gated action is created (e.g. `DISCOUNT_OR_REFUND`, `CASH_DISCREPANCY`, `TUITION_PLAN_CHANGE`), `createApprovalEnvelope(actionId, requester)` populates:
  ```js
  approverBranchId: requester.branchId || "kota_gorontalo"
  ```
- The **Branch Manager Approval Inbox** queries approvals matching:
  ```js
  where("approverRole", "==", "manager"),
  where("approverBranchId", "==", currentManager.branchId)
  ```
  This guarantees that Branch Manager A only receives and approves requests originated from Campus A.
- The **Admin Approval Inbox** queries approvals where `approverRole == "admin"`, displaying cross-branch staff authority actions.

---

## 5. Migration & Backward Compatibility Safety Plan

1. **Zero Downtime / Zero Orphaned Records:**
   - All repositories (`usersRepository`, `deskInquiriesRepository`, `paymentsRepository`, `shiftsRepository`, `schoolOutreachRepository`) apply `branchToId(record.branch || record.branchId)` on read and write.
   - Older documents lacking `branchId` default seamlessly to `"kota_gorontalo"`.
2. **Step-by-Step Implementation Sequence:**
   - **Step 1:** Enhance `src/constants/branches.js` with `BRANCH_MAP`, `branchToId`, and `idToBranch` + comprehensive unit tests.
   - **Step 2:** Update repositories to consistently stamp `branchId` and `branch` on all creates and updates.
   - **Step 3:** Update `useDashboardData.js` and role hooks to pass and filter by `branchId`.
   - **Step 4:** Build the **Maker-Checker Approval Inboxes** for Admin, Branch Manager, Instructor Leader, and Ops/Front Office Lead.
   - **Step 5:** Update `firestore.rules` with `isSameBranch(...)` boundary checks.
   - **Step 6:** Run full validation suite (`npm test`, `npm run lint`, `compile_applet`).
