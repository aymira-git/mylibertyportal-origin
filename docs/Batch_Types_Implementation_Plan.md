# Batch Types Implementation Plan (Reguler, Private, The Three Rs)

## Overview
This plan introduces a first-class **Batch Type** concept into My Liberty Portal to distinguish different operational cohort formats:
1. **Reguler** (Standard interactive group class cohorts)
2. **Private** (Intensive 1-on-1 or semi-private customized cohorts)
3. **The Three Rs** (Foundational literacy & numeracy cohorts — Reading, 'Riting, 'Rithmetic / Calistung)

Currently, cohorts only specify `programId` and `classLevel`. Batch types were either implicit, buried inside freeform notes, or loosely tracked via freeform text strings (`classType`) in student admissions. This implementation introduces a single source of truth for batch types with safe backward compatibility for legacy cohorts.

---

## User Review Required

> [!IMPORTANT]
> **Default Behavior for Existing Batches**:
> All existing batches without an explicit `batchType` field will gracefully default to `"reguler"`. No existing cohort data will break or require destructive database migration.

> [!IMPORTANT]
> **Admissions & Student Profile Harmonization**:
> Student records and applications already have a freeform `classType` field (`"e.g. Reguler / Private"`). We will normalize and map this to the new canonical `batchType` registry so applicants requesting "Private", "Reguler", or "The Three Rs" automatically align with the corresponding available batches during admission placement.

---

## Open Questions & Proposed Defaults

1. **Default Capacity and Minimum Quorum**:
   - **Reguler**: Default `maxCapacity: 15`, `minQuorum: 4` (standard academy default).
   - **Private**: Default `maxCapacity: 1` (configurable up to 2-3 for semi-private), `minQuorum: 1`.
   - **The Three Rs**: Default `maxCapacity: 8`, `minQuorum: 3` (small group focus).
   *Do these initial default capacities and quorums match your operational preferences? (Admins can still edit the numbers per batch).*

2. **Private Batch Schedule Flexibility**:
   - In existing punctuality tracking (`punctuality.js`), private classes are exempt from rigid weekday recurring checks. We propose formalizing this so that when `batchType === "private"`, kiosk and attendance systems continue to treat attendance flexibly without false late/missed shift flags.

---

## Proposed Changes

### 1. Core Constants & Domain Registry

#### [NEW] [batchTypes.js](file:///e:/myliberty-portal/src/constants/batchTypes.js)
- Define canonical batch types: `reguler`, `private`, `the_three_rs`.
- Configuration map `BATCH_TYPES`:
  - `id`: Unique identifier (`reguler`, `private`, `the_three_rs`).
  - `label`: Human-readable name (`Reguler`, `Private`, `The Three Rs`).
  - `shortLabel`: Compact label for pills (`Reguler`, `Private`, `3Rs`).
  - `badgeBg`: Tailored Tailwind styling (Slate/Indigo for Reguler, Purple/VIP for Private, Teal/Emerald for The Three Rs).
  - `defaultCapacity`: (15 for Reguler, 1 for Private, 8 for The Three Rs).
  - `defaultQuorum`: (4 for Reguler, 1 for Private, 3 for The Three Rs).
  - `description`: Operational description.
- Helper functions:
  - `normalizeBatchType(val)`: Normalizes inputs (`"regular"`, `"reguler"`, `"private"`, `"privat"`, `"3r"`, `"the three rs"`, `"three rs"`) to canonical ID, defaulting safely to `"reguler"`.
  - `getBatchType(id)`: Returns type configuration object.
  - `getBatchTypeList()`: Array of all available types.
  - `matchesBatchTypeFilter(batchType, filter)`: Filter matcher supporting `"all"`.

#### [NEW] [batchTypes.test.js](file:///e:/myliberty-portal/src/constants/batchTypes.test.js)
- Unit tests covering normalization, alias mapping, fallback handling, badge lookups, and filter matching.

---

### 2. Validation & Schemas

#### [MODIFY] [batchSchema.js](file:///e:/myliberty-portal/src/schemas/batchSchema.js)
- Add `batchType: z.string().trim().optional().default("reguler").transform((t) => normalizeBatchType(t))`.
- Update schema transform so `batchType` is always normalized.

#### [MODIFY] [applicationSchema.js](file:///e:/myliberty-portal/src/schemas/applicationSchema.js)
- Update `classType` to normalize via `normalizeBatchType(t)`.

#### [MODIFY] [schemas.test.js](file:///e:/myliberty-portal/src/schemas/schemas.test.js)
- Add test assertions verifying `batchSchema` assigns `batchType: "reguler"` by default and preserves `"private"` / `"the_three_rs"`.

---

### 3. Batch Creation & Editing (Admin Portal)

#### [MODIFY] [BatchModal.jsx](file:///e:/myliberty-portal/src/features/classes/BatchModal.jsx)
- Add a segmented control / radio button group for **Batch Type** in the batch creation/edit form:
  - Options: **Reguler**, **Private**, **The Three Rs**.
  - Includes badges, descriptions, and icon indicators.
- When creating a *new* batch:
  - Switching batch type dynamically updates the suggested `maxCapacity` and `minQuorum` fields (e.g. switching to "Private" updates capacity to 1 and quorum to 1; switching back to "Reguler" restores 15 / 4).
- In edit mode:
  - Preserves custom capacities already configured by admin.
- Includes `batchType` in the payload passed to `createClass` and `updateClass`.

---

### 4. Available Batches & Roster Views

#### [MODIFY] [AvailableBatches.jsx](file:///e:/myliberty-portal/src/features/classes/AvailableBatches.jsx)
- Add **Batch Type Filter** to the filter toolbar alongside Program, Branch, Tier, and Status.
- Include `batchType` in the search matcher (searching for "private" or "3rs" finds matching cohorts).
- Include batch type in WhatsApp marketing blurb generator (`handleCopyMarketingBlurb`).

#### [MODIFY] [AvailableBatchCard.jsx](file:///e:/myliberty-portal/src/features/classes/AvailableBatchCard.jsx)
- Display a distinct Batch Type pill badge (e.g. `Private`, `Reguler`, `The Three Rs`) at the top of the card alongside the Program badge and Level badge.

#### [MODIFY] [BatchCard.jsx](file:///e:/myliberty-portal/src/features/classes/BatchCard.jsx)
- Display the Batch Type badge in the cohort card header in roster and manager views.

#### [MODIFY] [CohortRosterTable.jsx](file:///e:/myliberty-portal/src/features/classes/CohortRosterTable.jsx)
- Add Batch Type filter and visual column badge so teachers and managers see cohort types at a glance.

#### [MODIFY] [batchAvailability.js](file:///e:/myliberty-portal/src/features/classes/batchAvailability.js)
- Export `filterBatchesByType(batches, typeFilter)` utility.
- Add unit tests in `batchAvailability.test.js`.

---

### 5. Student Admissions & Intake Placement

#### [MODIFY] [UserForm.jsx](file:///e:/myliberty-portal/src/features/students/UserForm.jsx)
- Replace the raw freeform text input for `Class Type (Jenis Kelas)` with a structured dropdown/button selector utilizing `getBatchTypeList()`.

#### [MODIFY] [StudentApplications.jsx](file:///e:/myliberty-portal/src/features/students/StudentApplications.jsx)
- Display formatted batch type badge for applicants.

#### [MODIFY] [ApplicationPlacementModal.jsx](file:///e:/myliberty-portal/src/features/students/ApplicationPlacementModal.jsx)
- Display the applicant's preferred batch type clearly during review.
- Prioritize batches in the placement dropdown that match the applicant's requested `batchType`.

#### [MODIFY] [admissionsUtils.js](file:///e:/myliberty-portal/src/features/students/admissionsUtils.js)
- Enhance `sortPlacementBatches` to consider applicant's requested `batchType` as a sorting preference after branch and program.

---

### 6. Punctuality & Attendance Compatibility

#### [MODIFY] [punctuality.js](file:///e:/myliberty-portal/src/features/attendance/punctuality.js)
- Update private class detection to check both `cls.batchType === "private"` and legacy `classDay.includes("private")`.

---

## Verification Plan

### Automated Tests
1. **Unit Tests**:
   - `npm test -- src/constants/batchTypes.test.js`
   - `npm test -- src/schemas/schemas.test.js`
   - `npm test -- src/features/classes/batchAvailability.test.js`
   - `npm test -- src/features/students/admissionsUtils.test.js`
   - `npm test -- src/features/attendance/punctuality.test.js`
2. **Full Test Suite Run**:
   - `npm test -- --run` to ensure all 495+ tests remain green.

### Manual / Visual Verification
1. **Batch Creation**:
   - Open Classes -> Add Available Batch modal.
   - Verify Batch Type selector displays `Reguler`, `Private`, and `The Three Rs`.
   - Verify selecting `Private` sets suggested capacity to 1 and quorum to 1.
   - Save batch and verify correct badge appears on Available Batches card.
2. **Filtering**:
   - Filter by `Private`, `Reguler`, and `The Three Rs` in Available Batches and verify filtering behaves accurately.
3. **Student Placement**:
   - Open Admissions / Placement Modal and verify batch type tags appear on cohort options.
