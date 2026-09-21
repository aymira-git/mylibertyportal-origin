# Walkthrough: 4-Branch Multi-Campus Support

We have introduced canonical 4-branch multi-campus support across MY LIBERTY Portal for all 4 campuses:
1. **Kota Gorontalo** (Default & Central Branch; seamlessly maps legacy aliases like `"Cabang Utama"`)
2. **Bone Bolango**
3. **Pohuwato**
4. **Limboto**

---

## Key Changes Made

### 1. Canonical Constants & Normalization
- [src/constants/branches.js](file:///e:/myliberty-portal/src/constants/branches.js)
  - Canonical list of campuses: `BRANCHES = ["Kota Gorontalo", "Bone Bolango", "Pohuwato", "Limboto"]`.
  - Default campus fallback: `DEFAULT_BRANCH = "Kota Gorontalo"`.
  - `normalizeBranch(val)`: maps legacy aliases (such as `"Cabang Utama"`, `"cabang utama"`, `"utama"`, `"Main Branch"`) and whitespace/case variations to canonical campus names.
  - `matchesBranchFilter(itemBranch, filterBranch)`: unified branch matcher that respects legacy aliases and exact filtering.
- [src/constants/branches.test.js](file:///e:/myliberty-portal/src/constants/branches.test.js)
  - Vitest test suite covering canonical branches, legacy mappings, whitespace handling, and filter matching.

### 2. Admissions & Student Workflows
- [src/features/students/UserForm.jsx](file:///e:/myliberty-portal/src/features/students/UserForm.jsx)
  - Updated branch selection options to canonical `BRANCHES` for both student profiles and staff profiles.
- [src/features/students/admissionsUtils.js](file:///e:/myliberty-portal/src/features/students/admissionsUtils.js)
  - Seeded distinct branch filter options with canonical `BRANCHES`.
  - Filter logic updated to use `matchesBranchFilter()`.
- [src/features/students/ApplicationPlacementModal.jsx](file:///e:/myliberty-portal/src/features/students/ApplicationPlacementModal.jsx)
  - Renders normalized campus branch badge (`normalizeBranch(app.branch)`).

### 3. Classes & Batch Management
- [src/schemas/batchSchema.js](file:///e:/myliberty-portal/src/schemas/batchSchema.js)
  - Added normalized `branch` field to batch schema with `DEFAULT_BRANCH` default.
- [src/features/classes/BatchModal.jsx](file:///e:/myliberty-portal/src/features/classes/BatchModal.jsx)
  - Added **Campus Branch** selector dropdown populated with canonical `BRANCHES`.
  - Persists `branch` in creation/update payloads.
- [src/features/classes/AvailableBatches.jsx](file:///e:/myliberty-portal/src/features/classes/AvailableBatches.jsx)
  - Added branch filter dropdown with `All Branches` + canonical options.
  - Batches filtered according to `matchesBranchFilter(batch.branch, branchFilter)`.
- [src/features/classes/AvailableBatchCard.jsx](file:///e:/myliberty-portal/src/features/classes/AvailableBatchCard.jsx)
  - Displays campus badge alongside classroom information.

### 4. Staff Directory & Invitation Workflow
- [src/schemas/inviteSchema.js](file:///e:/myliberty-portal/src/schemas/inviteSchema.js)
  - Added branch normalization to invitation schema.
- [src/features/staff/InvitesPanel.jsx](file:///e:/myliberty-portal/src/features/staff/InvitesPanel.jsx)
  - Defaults new invites to `DEFAULT_BRANCH` ("Kota Gorontalo").
- [src/features/auth/StaffSignup.jsx](file:///e:/myliberty-portal/src/features/auth/StaffSignup.jsx)
  - Inherits and normalizes branch from invite token during registration.
- [src/features/staff/staffUtils.js](file:///e:/myliberty-portal/src/features/staff/staffUtils.js)
  - Seeded distinct staff branches with canonical list.
  - Staff filtering uses `matchesBranchFilter()`.
- [src/features/dashboard/useDashboardData.js](file:///e:/myliberty-portal/src/features/dashboard/useDashboardData.js)
  - `emptyFormData.branch` and invite creation default to `DEFAULT_BRANCH`.

### 5. Analytics & Reports Dashboard
- [src/features/reports/ReportsDashboard.jsx](file:///e:/myliberty-portal/src/features/reports/ReportsDashboard.jsx)
  - Global branch filter dropdown utilizes canonical `BRANCHES`.
  - Propagates `branchFilter` to all tabs, including `InstructorPunctualityTab`.
- [src/features/reports/tabs/TodayTab.jsx](file:///e:/myliberty-portal/src/features/reports/tabs/TodayTab.jsx)
  - Attendance shifts, classes, and roster entries filtered and badged by branch.
- [src/features/reports/tabs/LearnerProgressTab.jsx](file:///e:/myliberty-portal/src/features/reports/tabs/LearnerProgressTab.jsx)
  - Student progress metrics and cards filtered and badged by branch.
- [src/features/reports/tabs/StaffDutyTab.jsx](file:///e:/myliberty-portal/src/features/reports/tabs/StaffDutyTab.jsx)
  - Duty logs and staff members filtered and badged by branch.
- [src/features/attendance/punctuality.js](file:///e:/myliberty-portal/src/features/attendance/punctuality.js)
  - Attaches branch to instructor punctuality analytics.
- [src/features/reports/tabs/InstructorPunctualityTab.jsx](file:///e:/myliberty-portal/src/features/reports/tabs/InstructorPunctualityTab.jsx)
  - Filters analytics by branch, displays Campus badge in table, and includes Branch in CSV exports.

---

## Verification Results

### 1. TypeScript Validation
```bash
npm run typecheck
# Output: tsc --noEmit -> Exit code 0 (No type errors)
```

### 2. ESLint
```bash
npm run lint
# Output: eslint . -> Exit code 0 (Clean, 0 errors, 0 warnings)
```

### 3. Code Formatting
```bash
npm run format:check
# Output: All matched files use Prettier code style!
```

### 4. Automated Tests
```bash
npm test
# Output:
# Test Files  26 passed (26)
#      Tests  415 passed (415)
```

### 5. Production Build
```bash
npm run build
# Output: vite build -> built in 5.33s -> Exit code 0
```
