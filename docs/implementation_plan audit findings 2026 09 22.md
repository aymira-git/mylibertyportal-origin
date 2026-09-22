# Implementation Plan — 2026-09-22 Audit Review & Fixes

Review of audit findings from `E:\myliberty-portal\docs\audit-findings-2026-09-22.md`, strictly following `instructions.md` working agreements and architectural guidelines.

## Audit Assessment Summary

| # | Finding | Verified Root Cause | Impact | Recommended Action |
|---|---|---|---|---|
| **1** | "Student Lifecycle Status" dropdown appears on Add New Student | `UserForm.jsx` shares the same form for Add and Edit without checking `editId` on the Lifecycle Status field. | Minor / UX clarity | Only render the Lifecycle Status dropdown when editing (`editId`). On Add, default cleanly to `"active"` (or keep visible if backfilling is needed). |
| **2** | Program dropdown shows duplicate raw-id entry (`"english_course"`) | `handleAddStudent()` in `useDashboardData.js` initializes `program: "english_course"` (id instead of label) and omits `programId`. `UserForm.jsx` fallback `<option>` check fails and injects the raw id. | High visibility / UI clutter | Initialize both `programId: "english_course"` and `program: "English Course"`, and make `UserForm.jsx` option fallback resilient to id matches. |
| **3** | "Fluency Tier (Evaluated)" dropdown only offers 3 of 5 levels | Duplicate stale 3-star control at bottom of `UserForm.jsx` (lines 585-601) writes directly to `currentLevel`, silently downgrading Elite (lvl 2) and Grandmaster (lvl 4) students. | **Critical / Data Loss Risk** | Remove the duplicate/stale 3-star dropdown in Section 5. Section 2 already provides the authoritative 5-level selector with tier shortcuts. |
| **4** | Admissions Desk "Program" filter has no options | `getDistinctValues(apps, "program")` only pulls from loaded applications with no seed, unlike `branch` which seeds with `BRANCHES`. | Moderate / Filter usability | Seed `getDistinctValues` with `getEnabledPrograms().map(p => p.label)` so all programs are selectable even with zero applications. |
| **5** | Payment status tracked per-student, not per-enrollment | Data model keys payment status and `paidUntil` on `users/{studentId}` rather than `(studentId, batchId)`. | High / Architectural | **Do not perform a heavy, breaking database overhaul right now.** Document this as a known business limitation or optionally add an enrollment guard/notice in `EnrollModal.jsx`. |

---

## User Review Required

> [!IMPORTANT]
> **Finding 5 (Per-Student Payment Tracking):**
> Overhauling payment tracking from per-student to per-batch/per-enrollment would require modifying Firestore data schemas, security rules, receipt generators, financial reports, and existing records. Per `instructions.md` (no budget, keep Firestore reads low, protect existing data), we recommend **keeping payment tracking per-student for now** and documenting it as a known operational convention (students belong to one primary course at a time).

> [!NOTE]
> **Finding 1 (Lifecycle Status on Add):**
> We recommend showing the **Lifecycle Status** selector only when editing an existing student (`editId ? (...) : null`). On Add, students are automatically initialized with `status: "active"`. If an admin ever needs to backfill an inactive/graduated student, they can create the student and update their status in Edit Profile.

---

## Proposed Changes

### Component 1: Fix Program Initialization & Select Deduplication (Finding 2)

#### [MODIFY] [useDashboardData.js](file:///E:/myliberty-portal/src/features/dashboard/useDashboardData.js)
- In `handleAddStudent`, retrieve the program label from `getProgram(...)` and set both `programId` and `program` (e.g. `programId: "english_course"`, `program: "English Course"`).

#### [MODIFY] [UserForm.jsx](file:///E:/myliberty-portal/src/features/students/UserForm.jsx)
- In the Program `<select>` fallback check, ensure it also tests `p.id === formData.program` so raw IDs from legacy documents do not spawn a duplicate option.

---

### Component 2: Remove Dangerous Duplicate Fluency Control (Finding 3)

#### [MODIFY] [UserForm.jsx](file:///E:/myliberty-portal/src/features/students/UserForm.jsx)
- Remove the hardcoded 3-star "Fluency Tier (Evaluated)" dropdown in lines 583-601.
- Make "Information Source" span the full row (`md:col-span-3`) above "Notes / Evaluation".
- Retain the complete, authoritative 5-level placement system in Section 2 ("Academic & Enrollment Details").

---

### Component 3: Conditional Lifecycle Status on Student Form (Finding 1)

#### [MODIFY] [UserForm.jsx](file:///E:/myliberty-portal/src/features/students/UserForm.jsx)
- Wrap the Student Lifecycle Status dropdown in `editId ? (...) : null` (or display as a locked "Active (New Student)" badge when adding), while maintaining `formData.status: "active"` default.

---

### Component 4: Pre-seed Admissions Program Filter (Finding 4)

#### [MODIFY] [admissionsUtils.js](file:///E:/myliberty-portal/src/features/students/admissionsUtils.js)
- Update `getDistinctValues(apps, field)`:
  - If `field === "program"`, pre-seed the set with `getEnabledPrograms().map((p) => p.label)`.
  - Normalize any application program values so labels match the canonical program labels.

#### [MODIFY] [admissionsUtils.test.js](file:///E:/myliberty-portal/src/features/students/admissionsUtils.test.js)
- Update unit tests for `getDistinctValues` to verify that enabled program labels are included in the options.

---

## Verification Plan

### Automated Tests
1. Run Vitest suite:
   ```bash
   npm test
   ```
2. Run ESLint:
   ```bash
   npm run lint
   ```
3. Run Vite production build:
   ```bash
   npm run build
   ```

### Manual Verification
- Verify `handleAddStudent`: Click "Add New Student", verify Program dropdown only shows the 5 enabled programs without any `"english_course"` duplicate.
- Verify Lifecycle Status: Confirm Add New Student has a clean form without redundant status selection, while Edit Student retains full lifecycle status options.
- Verify Placement Level: Confirm that changing student levels in Section 2 works for all 5 tiers (Warrior, Elite, Master, Grandmaster, Epic) and no duplicate control overwrites it.
- Verify Admissions Desk: Navigate to Admissions Desk and verify the Program dropdown contains all enabled programs even with 0 applications.
