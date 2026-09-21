# Batch Types Implementation Plan — Revised

**Feature:** Batch Types (`Reguler`, `Private`, `The Three Rs`)  
**Repository:** `aymira-git/mylibertyportal-origin`  
**Target branch:** `main`  
**Revision basis:** repository audit against the current public codebase and the original `Batch_Types_Implementation_Plan.md`

---

## 1. Executive Summary

This revision keeps the original goal — introduce a first-class Batch Type with:

- `reguler`
- `private`
- `the_three_rs`

—but tightens the implementation around the repository's actual architecture and existing data flows.

The most important change is this:

> **`batchType` becomes the canonical internal field. `classType` remains a legacy/external compatibility field during migration.**

The existing Google Form + `FormSync.gs` pipeline still writes `classType`, and the existing student/application records still use that field. Therefore, renaming `classType` outright would unnecessarily break the intake pipeline. New code should read/write `batchType`, while normalizing legacy `classType` wherever it is encountered.

This is a **non-destructive compatibility migration**:

```text
Existing batch without batchType
        ↓
read as "reguler"

Existing application with classType = "Private"
        ↓
canonical batchType = "private"

New batch
        ↓
batchType = "private" | "reguler" | "the_three_rs"

New student record
        ↓
batchType = canonical value
classType  = retained for compatibility
```

No destructive Firestore migration is required for Phase 1.

---

# 2. What the Original Plan Got Right

The original plan correctly identified the need for:

1. A canonical registry for the three batch types.
2. Backward-compatible handling of existing batches.
3. Structured Batch Type selection in `BatchModal`.
4. Batch Type visibility in Available Batches and roster views.
5. Admissions placement preference based on the applicant's requested type.
6. Explicit Private-class attendance/punctuality handling.
7. Unit tests around normalization, schemas, filtering, admissions, and punctuality.

Those goals remain in scope.

The original plan's backward-compatibility intent is especially important: existing batches should safely behave as `reguler` rather than requiring a destructive migration.

---

# 3. Repository Audit — Important Findings

## 3.1 The project architecture already has the right domain boundary

The repository uses a domain-centered structure under `src/features/*`, with repositories owning direct Firestore writes. Components own UI/state, while `*Repository.js` files own persistence.

Relevant architecture rules:

- `src/features/classes` owns class/batch behavior.
- `src/features/students` owns admissions/student behavior.
- Direct Firestore writes belong in repositories.
- Existing Firestore schema and security rules are treated as protected infrastructure unless a change is explicitly required.

**Implication:** Batch Type implementation should stay inside the existing `classes`, `students`, `attendance`, and `constants` domains. Do not create a separate batch-types feature/domain.

Source: [`docs/ARCHITECTURE.md`](https://github.com/aymira-git/mylibertyportal-origin/blob/main/docs/ARCHITECTURE.md)

---

## 3.2 `batchSchema` only protects batch creation today

`createClass()` runs `batchSchema.parse(classData)`, but `updateClass()` currently calls `updateDoc()` directly.

That means:

```text
create batch
   -> schema normalization

edit batch
   -> direct Firestore update
   -> no schema normalization
```

Therefore, adding `batchType` normalization only to `batchSchema` is **not sufficient**.

### Required correction

Normalize/canonicalize `batchType` on both:

- create
- update

Prefer doing this at the classes repository boundary so UI callers cannot accidentally write aliases such as `"regular"`, `"Private "`, or `"3Rs"`.

Do not rely on `BatchModal` alone for data integrity.

Source: [`src/features/classes/classesRepository.js`](https://github.com/aymira-git/mylibertyportal-origin/blob/main/src/features/classes/classesRepository.js)

---

## 3.3 The intake pipeline still uses `classType`

`FormSync.gs` maps the Google Form question `JENIS KELAS` to Firestore field `classType`.

Therefore:

**Do not rename the Google Form field or remove `classType` in this implementation.**

Keep:

```text
External / legacy:
classType

Canonical internal field:
batchType
```

The application schema should derive `batchType` from:

```text
batchType if explicitly supplied
otherwise classType
otherwise "reguler"
```

The raw `classType` value should remain available during the migration so existing admissions records and the current Google Form workflow continue to work.

Source: [`FormSync.gs`](https://github.com/aymira-git/mylibertyportal-origin/blob/main/FormSync.gs)

---

## 3.4 Student records currently preserve `classType`

`buildStudentRecord()` currently writes `classType` into the canonical student document.

Approval currently passes:

```js
classType: app.classType
```

into `buildStudentRecord()`.

Therefore, the student record also needs a canonical `batchType` field while retaining `classType` for compatibility.

Source:

- [`src/features/students/studentRecord.js`](https://github.com/aymira-git/mylibertyportal-origin/blob/main/src/features/students/studentRecord.js)
- [`src/features/students/applicationsRepository.js`](https://github.com/aymira-git/mylibertyportal-origin/blob/main/src/features/students/applicationsRepository.js)

---

## 3.5 Current program defaults must not be overwritten blindly

The existing Programs registry already has different capacity defaults:

| Program | Current Capacity |
|---|---:|
| English Course | 15 |
| Kids Course | 12 |
| Professional School | 20 |
| TOEFL | 15 |
| Kids School | 12 |

The original Batch Type proposal says:

- Reguler = 15
- Private = 1
- The Three Rs = 8

Blindly applying `15` whenever Batch Type is `reguler` would silently break existing program-specific defaults, particularly Kids Course and Professional School.

### Revised rule

For new batches:

```text
REGULER
  -> keep the current program's capacity/quorum defaults

PRIVATE
  -> default capacity 1
  -> default quorum 1

THE THREE RS
  -> default capacity 8
  -> default quorum 3
```

This preserves existing program behavior while giving the new cohort types their specific operating defaults.

Source: [`src/constants/programs.js`](https://github.com/aymira-git/mylibertyportal-origin/blob/main/src/constants/programs.js)

---

## 3.6 Roster grouping currently omits Batch Type

`CohortRosterTable` groups classes by:

```text
className
schedule
instructorId
classLevel
```

It does **not** include `batchType`.

Therefore, two cohorts such as:

```text
English Warrior
Mon/Wed
Mr. A
Warrior
Reguler

English Warrior
Mon/Wed
Mr. A
Warrior
Private
```

could be grouped together.

### Required correction

Add canonical `batchType` to the grouping key.

Also include it in the group metadata used by the UI.

Source: [`src/features/classes/CohortRosterTable.jsx`](https://github.com/aymira-git/mylibertyportal-origin/blob/main/src/features/classes/CohortRosterTable.jsx)

---

## 3.7 Private attendance behavior already exists — formalize it

The current punctuality implementation already treats Private classes specially, based primarily on the inability to parse a recurring `classDay` and legacy `"private"` text detection.

The new implementation should make this explicit:

```text
canonical batchType === "private"
        OR
legacy classDay contains "private"
        ↓
Private attendance semantics
```

This preserves old records while making the new model authoritative.

Do not redesign the entire attendance scheduling system in this feature.

Source: [`src/features/attendance/punctuality.js`](https://github.com/aymira-git/mylibertyportal-origin/blob/main/src/features/attendance/punctuality.js)

---

# 4. Canonical Data Model

## 4.1 Batch document

Add:

```js
batchType: "reguler" | "private" | "the_three_rs"
```

### Legacy behavior

If a batch has no `batchType`:

```js
getBatchType(batch) === "reguler"
```

Do not perform a mandatory Firestore backfill before release.

### New writes

Every newly created/updated batch should write the canonical ID.

---

## 4.2 Application document

Keep:

```js
classType
```

for compatibility with the Google Form and existing application records.

Add:

```js
batchType
```

as the canonical field.

Normalization rule:

```text
batchType present
    -> normalize batchType

else classType present
    -> normalize classType

else
    -> reguler
```

The application schema should output a canonical `batchType`.

---

## 4.3 Student document

Add:

```js
batchType
```

to the canonical student record.

Keep:

```js
classType
```

for compatibility during migration.

New application approvals should propagate:

```text
application.batchType
        ↓
student.batchType
```

with fallback to:

```text
application.classType
```

for legacy applications.

---

# 5. Phase 0 — Create the Batch Type Registry

## New file

`src/constants/batchTypes.js`

Define:

```js
export const BATCH_TYPE_KEYS = [
  "reguler",
  "private",
  "the_three_rs",
];
```

And a configuration map containing:

```text
id
label
shortLabel
badgeBg
defaultCapacity
defaultQuorum
description
```

Suggested values:

| ID | Label | Short Label | Capacity | Quorum |
|---|---|---|---:|---:|
| `reguler` | Reguler | Reguler | program-defined | program-defined |
| `private` | Private | Private | 1 | 1 |
| `the_three_rs` | The Three Rs | 3Rs | 8 | 3 |

### Important refinement

`defaultCapacity` and `defaultQuorum` for `reguler` should be treated as fallback/reference values, not as permission to override existing program-level defaults.

### Required helpers

```js
normalizeBatchType(value)
getBatchType(value)
getBatchTypeList()
getBatchTypeLabel(value)
getBatchTypeDefaults({ batchType, programId })
matchesBatchTypeFilter(batchType, filter)
```

### Aliases

At minimum:

```text
regular        -> reguler
reguler        -> reguler
private        -> private
privat         -> private
3r             -> the_three_rs
3rs            -> the_three_rs
the three rs   -> the_three_rs
three rs       -> the_three_rs
```

Unknown/empty values:

```text
-> reguler
```

This mirrors the project's existing constant/alias pattern used for programs and branches.

Source pattern: [`src/constants/programs.js`](https://github.com/aymira-git/mylibertyportal-origin/blob/main/src/constants/programs.js)

---

# 6. Phase 1 — Schema and Repository Canonicalization

## 6.1 `batchSchema.js`

Modify:

`src/schemas/batchSchema.js`

Add:

```js
batchType: z.string().trim().optional(),
```

Then normalize it in the schema transform.

### Do not use a simple independent default

Avoid:

```js
batchType: z.string().optional().default("reguler")
```

followed by logic that reads `classType`.

The Batch schema does not have `classType`, so its normalization can simply default missing values to `reguler`.

---

## 6.2 `applicationSchema.js`

Modify:

`src/schemas/applicationSchema.js`

Add:

```js
batchType: z.string().trim().optional(),
```

Then in the existing object transform:

```text
batchType = normalizeBatchType(
  data.batchType || data.classType
)
```

This preserves the current `classType` contract while introducing the canonical field.

---

## 6.3 `studentRecord.js`

Modify:

`src/features/students/studentRecord.js`

Extend `buildStudentRecord()`:

```text
batchType:
  normalizeBatchType(fields.batchType || fields.classType)

classType:
  clean(fields.classType)
```

This gives student records a canonical value without destroying the legacy value.

---

## 6.4 `classesRepository.js`

Modify:

`src/features/classes/classesRepository.js`

### `createClass()`

Continue using `batchSchema.parse()`.

### `updateClass()`

Do not continue writing arbitrary batch data directly.

Before `updateDoc()`:

```text
normalize/canonicalize updateData.batchType
```

At minimum:

```js
const normalized = {
  ...updateData,
  ...(Object.prototype.hasOwnProperty.call(updateData, "batchType")
    ? { batchType: normalizeBatchType(updateData.batchType) }
    : {}),
};
```

The goal is that a UI mistake cannot write:

```text
batchType = "Private "
```

to Firestore.

### Important scope constraint

Do not refactor unrelated `classesRepository` behavior in this task.

---

# 7. Phase 2 — Batch Creation & Editing

## File

`src/features/classes/BatchModal.jsx`

Add Batch Type selection next to the existing Program/Level setup.

Recommended UI:

```text
Batch Type

[ Reguler ] [ Private ] [ The Three Rs ]
```

Each option should have:

- label
- short description
- visual badge/icon

---

## 7.1 New-batch defaults

When creating a new batch:

### Reguler

Use the current program defaults.

Examples:

```text
English Course -> 15 / 4
Kids Course -> 12 / 4
Professional School -> 20 / 4
TOEFL -> 15 / 4
Kids School -> 12 / 3
```

### Private

Suggest:

```text
capacity = 1
quorum = 1
```

Admin may increase capacity for semi-private delivery.

### The Three Rs

Suggest:

```text
capacity = 8
quorum = 3
```

---

## 7.2 Preserve admin overrides

The UI must distinguish:

```text
suggested default
```

from:

```text
explicit admin value
```

When Batch Type changes:

- If capacity/quorum still equal the previous suggestion, update them to the new type's suggestion.
- If the admin already customized them, preserve the custom values.

Example:

```text
Start:
Reguler
capacity 15
quorum 4

Change -> Private:
capacity becomes 1
quorum becomes 1
```

But:

```text
Start:
Reguler
capacity 20   <-- custom
quorum 4

Change -> Private:
DO NOT silently overwrite 20
```

The UI may display a small "Suggested" hint instead.

---

## 7.3 Edit behavior

When editing an existing batch:

- preserve existing capacity
- preserve existing quorum
- normalize the displayed Batch Type
- do not silently rewrite unrelated fields

Legacy batch:

```text
missing batchType
```

should appear as:

```text
Reguler
```

and only receive a persisted `batchType: "reguler"` when the record is explicitly saved.

---

# 8. Phase 3 — Available Batches

## 8.1 `AvailableBatches.jsx`

Add:

```js
const [batchTypeFilter, setBatchTypeFilter] = useState("all");
```

Apply it with:

```js
matchesBatchTypeFilter(b.batchType, batchTypeFilter)
```

Because the helper normalizes missing values, legacy batches remain visible under `Reguler`.

---

## 8.2 Search

Extend the existing search matcher to include:

```text
canonical batch type ID
label
short label
```

Examples:

```text
private
3rs
the three rs
reguler
```

should find the appropriate batches.

Do not replace the existing search fields.

---

## 8.3 Marketing blurb

Extend `handleCopyMarketingBlurb()` with:

```text
🏷️ Batch Type: Private
```

or:

```text
🏷️ Batch Type: Reguler
```

This is useful because the current blurb already serves WhatsApp/social outreach.

Do not redesign the existing marketing copy.

Source: [`src/features/classes/AvailableBatches.jsx`](https://github.com/aymira-git/mylibertyportal/blob/main/src/features/classes/AvailableBatches.jsx)

---

# 9. Phase 4 — Batch Cards and Roster

## 9.1 `AvailableBatchCard.jsx`

Add Batch Type to the existing badge row.

Recommended order:

```text
Program badge
Batch Type badge
Level badge
Status badge
```

Use `getBatchType()` rather than inline string logic.

---

## 9.2 `BatchCard.jsx`

Add a Batch Type badge alongside the existing status/quorum information.

Example:

```text
PRIVATE
Under Quorum (1/1)
Open
```

Do not replace the current status or capacity information.

---

## 9.3 `CohortRosterTable.jsx`

### Add filter

Add a Batch Type filter to the existing quick/filter controls.

### Fix grouping

Change:

```js
[cls.className, cls.schedule, cls.instructorId, cls.classLevel]
```

to include:

```js
batchType
```

with normalization applied:

```js
[
  cls.className,
  cls.schedule,
  cls.instructorId,
  cls.classLevel || "unset",
  normalizeBatchType(cls.batchType),
]
```

This is required to prevent different batch types from collapsing into one cohort group.

### Group display

Show Batch Type in the group header or the contained `BatchCard`.

---

# 10. Phase 5 — Batch Availability Utility

## File

`src/features/classes/batchAvailability.js`

Add:

```js
filterBatchesByType(batches, typeFilter)
```

Behavior:

```text
all -> return all
missing batchType -> treated as reguler
alias -> normalized
canonical -> exact match
```

Keep the existing `getBatchAvailability()` behavior unchanged.

Do not introduce a second "availability" source of truth.

Source: [`src/features/classes/batchAvailability.js`](https://github.com/aymira-git/mylibertyportal/blob/main/src/features/classes/batchAvailability.js)

---

# 11. Phase 6 — Admissions / Student Intake

## 11.1 `UserForm.jsx`

### Replace the editable class type control

The current student form has:

```text
Class Type (Jenis Kelas)
free text
```

Replace the admin-facing control with a structured selector based on:

```js
getBatchTypeList()
```

The UI field should now represent the canonical `batchType`.

### Compatibility behavior

When editing a legacy student who has only:

```js
classType: "Private"
```

the selector should display:

```text
Private
```

by resolving:

```js
batchType || classType
```

When the profile is saved, write canonical `batchType`.

Keep the underlying `classType` field during migration.

Source: [`src/features/students/UserForm.jsx`](https://github.com/aymira-git/mylibertyportal/blob/main/src/features/students/UserForm.jsx)

---

## 11.2 `StudentApplications.jsx`

Continue displaying the requested batch type.

Use:

```text
getBatchType(app.batchType || app.classType)
```

instead of directly rendering raw `app.classType`.

This means:

```text
"Privat"
"PRIVATE"
"private"
```

all display consistently as:

```text
Private
```

---

## 11.3 `ApplicationPlacementModal.jsx`

Show the applicant's requested Batch Type prominently.

For the available batch dropdown, include:

```text
[Branch] Batch Name · Batch Type · Level · Seats
```

Example:

```text
[Kota Gorontalo] Private B1 · Private · Warrior · 1/1
```

Also provide a subtle mismatch indicator when:

```text
Applicant requests Private
but selected batch is Reguler
```

Do not prevent the selection solely because of a type mismatch unless a future business rule explicitly makes Batch Type a hard eligibility constraint.

Reason:

> The current requirement is a placement preference, not a new hard enrollment rule.

---

# 12. Phase 7 — Admissions Placement Sorting

## File

`src/features/students/admissionsUtils.js`

Extend:

```js
sortPlacementBatches(
  classes,
  {
    selectedLevel,
    appBranch,
    appProgram,
    appBatchType
  }
)
```

Recommended order:

```text
1. program match
2. branch match
3. batchType match
4. level compatibility
5. className
```

This preserves the existing placement logic while adding Batch Type as another preference.

### Important

Batch Type should not become a hard filter in this phase.

A Private applicant may still be placed into a Reguler batch if no appropriate Private batch exists and staff explicitly selects it.

Source: [`src/features/students/admissionsUtils.js`](https://github.com/aymira-git/mylibertyportal/blob/main/src/features/students/admissionsUtils.js)

---

# 13. Phase 8 — Application Approval → Student Record

## File

`src/features/students/applicationsRepository.js`

During `approveApplication()`:

Current flow:

```text
application.classType
    ↓
buildStudentRecord()
    ↓
student.classType
```

Revised flow:

```text
application.batchType
       ↓
fallback to application.classType
       ↓
buildStudentRecord()
       ↓
student.batchType
```

Keep `student.classType` for compatibility.

### No extra batch mutation

Do not copy Batch Type from the selected batch into the student's profile automatically unless that is explicitly the intended business meaning.

These are different concepts:

```text
Applicant requested batch type
```

vs.

```text
Student's selected/desired delivery type
```

vs.

```text
Selected cohort's batch type
```

The student should not acquire a new type merely because they were temporarily placed into a cohort.

For this first implementation, the canonical student `batchType` should represent the student's class-type preference already captured in the student/application workflow.

---

# 14. Phase 9 — Attendance / Punctuality

## File

`src/features/attendance/punctuality.js`

Introduce a helper concept:

```js
isPrivateBatch(cls)
```

Resolution:

```text
1. normalizeBatchType(cls.batchType)
2. if that is private -> true
3. otherwise preserve legacy fallback:
   cls.classDay contains "private"
```

Use this helper in:

- `getTodaysClasses()`
- `computeMonthlyPunctuality()`

### Private behavior

Private batches retain current semantics:

```text
No recurring weekday session generation
Only actual attended/private shifts are counted
Punctuality marked as limited-accuracy
```

Do not introduce a new private scheduling document model in this task.

Source: [`src/features/attendance/punctuality.js`](https://github.com/aymira-git/mylibertyportal/blob/main/src/features/attendance/punctuality.js)

---

# 15. Phase 10 — Legacy Compatibility Strategy

This feature should use **read-time normalization + write-forward canonicalization**.

## Read

```text
batch.batchType missing
    -> reguler
```

```text
student.batchType missing
    -> normalize(student.classType)
```

```text
application.batchType missing
    -> normalize(application.classType)
```

## Write

All new/edited batch records:

```text
batchType = canonical ID
```

All new/edited student records:

```text
batchType = canonical ID
```

Newly approved applications:

```text
batchType = canonical ID
```

## No bulk migration in Phase 1

Do not run a destructive or broad Firestore backfill just to populate missing `batchType`.

After the feature has been stable in production, a separate optional migration can backfill old documents.

That migration should be a separate task.

---

# 16. Phase 11 — Testing

The project uses Vitest through:

```bash
npm test
```

Do not hard-code an expected test count such as "495+" because the suite can change over time.

---

## 16.1 New unit test

### `src/constants/batchTypes.test.js`

Cover:

```text
normalizeBatchType("reguler") -> reguler
normalizeBatchType("regular") -> reguler
normalizeBatchType("PRIVATE") -> private
normalizeBatchType("Privat") -> private
normalizeBatchType("3R") -> the_three_rs
normalizeBatchType("The Three Rs") -> the_three_rs
normalizeBatchType("") -> reguler
normalizeBatchType(undefined) -> reguler
normalizeBatchType("unknown") -> reguler
```

Also test:

```text
getBatchType()
getBatchTypeList()
matchesBatchTypeFilter()
getBatchTypeDefaults()
```

---

## 16.2 `schemas.test.js`

Add:

### Batch

```text
missing batchType -> reguler
private -> private
the_three_rs -> the_three_rs
regular -> reguler
```

### Application

```text
classType = "Private"
batchType -> private
```

```text
batchType = "3Rs"
batchType -> the_three_rs
```

```text
neither field
batchType -> reguler
```

Also verify the legacy `classType` value remains present.

---

## 16.3 `batchAvailability.test.js`

Add:

```text
filter by private
filter by reguler
filter by the_three_rs
filter all
legacy missing batchType behaves as reguler
aliases normalize correctly
```

---

## 16.4 `admissionsUtils.test.js`

Extend sorting tests:

```text
same program + same branch:
private applicant
    -> private batches before reguler batches
```

But also verify:

```text
type mismatch does NOT remove the batch
```

because Batch Type remains a preference rather than a hard constraint.

---

## 16.5 `punctuality.test.js`

Add tests using canonical fields:

```js
{
  batchType: "private",
  classDay: "Mon/Wed"
}
```

Expected:

```text
private semantics still apply
```

Also test:

```js
{
  classDay: "Private"
}
```

with no `batchType`.

Expected:

```text
legacy private fallback still works
```

---

## 16.6 Repository-level manual verification

Because Firestore transaction behavior is harder to cover with the existing pure-unit test style, manually verify:

```text
create batch -> canonical batchType saved
edit batch -> canonical batchType saved
legacy batch -> displays as Reguler
application approval -> student.batchType populated
```

---

# 17. Phase 12 — Validation Commands

Run:

```bash
npm test
npm run lint
npm run build
npm run typecheck
```

Also run targeted tests during development:

```bash
npm test -- src/constants/batchTypes.test.js
npm test -- src/schemas/schemas.test.js
npm test -- src/features/classes/batchAvailability.test.js
npm test -- src/features/students/admissionsUtils.test.js
npm test -- src/features/attendance/punctuality.test.js
```

---

# 18. Manual QA Matrix

## Batch creation

### Reguler

```text
Select Reguler
Save
-> batchType = reguler
-> program default capacity preserved
```

### Private

```text
Select Private
-> suggested capacity = 1
-> suggested quorum = 1
Save
-> batchType = private
```

### The Three Rs

```text
Select The Three Rs
-> suggested capacity = 8
-> suggested quorum = 3
Save
-> batchType = the_three_rs
```

---

## Editing legacy batch

Given:

```text
batchType is missing
```

Verify:

```text
UI shows Reguler
```

Save and verify:

```text
batchType = reguler
```

---

## Capacity customization

```text
Set capacity manually to 20
Change type
```

Verify:

```text
custom capacity is not silently destroyed
```

---

## Available Batches

Verify:

```text
filter Reguler
filter Private
filter The Three Rs
search "private"
search "3rs"
```

Legacy records without Batch Type must remain visible under Reguler.

---

## Roster grouping

Create two otherwise identical batches:

```text
same name
same schedule
same instructor
same level
different batchType
```

Verify:

```text
they appear as two distinct groups
```

---

## Admissions

Applicant requests:

```text
Private
```

Verify:

```text
Private batches appear first among otherwise equivalent options
```

but:

```text
Reguler batches remain selectable
```

---

## Approval

Approve a legacy application containing:

```text
classType = Private
batchType absent
```

Verify created student:

```text
batchType = private
classType still retained
```

---

## Attendance

Verify:

```text
batchType = private
```

behaves as a private class for kiosk/punctuality handling.

Also verify legacy:

```text
classDay = "Private"
batchType absent
```

continues to behave correctly.

---

# 19. Firestore Security Rules

## Expected result

**No Firestore rule change should be required for this feature solely because of adding the `batchType` field.**

Current class rules already distinguish:

```text
Admin
Front Office enrollment updates
other staff reads
```

and current user rules allow the existing student/admin workflows.

The new field does not introduce a new role or new collection.

Source: [`firestore.rules`](https://github.com/aymira-git/mylibertyportal/blob/main/firestore.rules)

### However

Do a regression check that:

```text
Admin -> can create/edit batches
Front Office -> cannot change batch configuration
Manager -> remains unable to mutate batch configuration
```

Do not broaden permissions merely to support Batch Type.

---

# 20. Explicit Non-Goals

Do **not** include these in this implementation:

### 1. New Enrollment collection

The current system already uses the existing `classes.studentIds` + `classes.enrollments` model. This feature should not replace that model.

### 2. New scheduling engine

Do not create a separate Private scheduling system.

### 3. Mandatory Firestore migration

No bulk backfill is necessary for launch.

### 4. Hard Batch Type eligibility

Do not make:

```text
Private applicant -> Private batch only
```

a mandatory rule yet.

Batch Type is initially a placement preference.

### 5. WhatsApp API

Continue using the existing copy/link workflow. Batch Type is simply additional message context.

---

# 21. Recommended Implementation Order

Use this order:

```text
1. Add batchTypes.js registry + tests
        ↓
2. Add batchType normalization to batch/application schemas
        ↓
3. Canonicalize batchType in classesRepository create/update
        ↓
4. Add Batch Type selector to BatchModal
        ↓
5. Add badges + filters to AvailableBatches/cards
        ↓
6. Fix CohortRosterTable grouping + Batch Type display/filter
        ↓
7. Add application/student compatibility fields
        ↓
8. Add admissions display + placement sorting preference
        ↓
9. Formalize Private attendance detection
        ↓
10. Run targeted tests
        ↓
11. Run full test/lint/build/typecheck suite
        ↓
12. Perform manual QA against legacy records
```

This order deliberately places **data normalization before UI expansion**.

---

# 22. Definition of Done

The feature is complete when:

- [ ] `src/constants/batchTypes.js` is the single canonical Batch Type registry.
- [ ] `reguler`, `private`, and `the_three_rs` are normalized consistently.
- [ ] Missing legacy batch types behave as `reguler`.
- [ ] New batches persist canonical `batchType`.
- [ ] Batch updates cannot write unnormalized Batch Type values.
- [ ] Existing program capacity defaults remain intact for Reguler batches.
- [ ] Private defaults are 1 capacity / 1 quorum.
- [ ] The Three Rs defaults are 8 capacity / 3 quorum.
- [ ] Custom admin capacity/quorum values are preserved when Batch Type changes.
- [ ] Available Batches can filter/search by Batch Type.
- [ ] Available Batch cards show Batch Type.
- [ ] Roster cards show Batch Type.
- [ ] Roster grouping includes Batch Type.
- [ ] Applications display canonical Batch Type.
- [ ] Legacy `classType` values are converted to canonical `batchType`.
- [ ] Student records receive canonical `batchType`.
- [ ] `classType` remains available for compatibility.
- [ ] Placement sorting prefers the applicant's requested Batch Type without making it a hard constraint.
- [ ] Private attendance/punctuality logic recognizes canonical `batchType`.
- [ ] Legacy Private attendance behavior still works.
- [ ] No unnecessary Firestore schema/rules migration is introduced.
- [ ] `npm test` passes.
- [ ] `npm run lint` passes.
- [ ] `npm run build` passes.
- [ ] `npm run typecheck` passes.
- [ ] Manual legacy-data QA passes.

---

# 23. Key Design Principle

The feature should follow this model:

```text
                 BATCH TYPE REGISTRY
                         │
             ┌───────────┴───────────┐
             ▼                       ▼
          BATCHES                 PEOPLE
             │                       │
             │                       ├── Application
             │                       │       │
             │                       │       └── classType (legacy)
             │                       │
             │                       └── Student
             │
             ├── Reguler
             ├── Private
             └── The Three Rs
```

The central rule is:

> **Canonicalize new data; tolerate old data; do not destroy old data merely to introduce a cleaner model.**

And specifically:

> **`batchType` is the canonical operational field. `classType` is the compatibility bridge until the external intake pipeline is migrated separately.**

---

# 24. Repository References Used for This Revision

- [`docs/ARCHITECTURE.md`](https://github.com/aymira-git/mylibertyportal-origin/blob/main/docs/ARCHITECTURE.md)
- [`src/constants/programs.js`](https://github.com/aymira-git/mylibertyportal-origin/blob/main/src/constants/programs.js)
- [`src/schemas/batchSchema.js`](https://github.com/aymira-git/mylibertyportal-origin/blob/main/src/schemas/batchSchema.js)
- [`src/schemas/applicationSchema.js`](https://github.com/aymira-git/mylibertyportal-origin/blob/main/src/schemas/applicationSchema.js)
- [`src/features/classes/BatchModal.jsx`](https://github.com/aymira-git/mylibertyportal-origin/blob/main/src/features/classes/BatchModal.jsx)
- [`src/features/classes/classesRepository.js`](https://github.com/aymira-git/mylibertyportal-origin/blob/main/src/features/classes/classesRepository.js)
- [`src/features/classes/AvailableBatches.jsx`](https://github.com/aymira-git/mylibertyportal-origin/blob/main/src/features/classes/AvailableBatches.jsx)
- [`src/features/classes/AvailableBatchCard.jsx`](https://github.com/aymira-git/mylibertyportal-origin/blob/main/src/features/classes/AvailableBatchCard.jsx)
- [`src/features/classes/BatchCard.jsx`](https://github.com/aymira-git/mylibertyportal-origin/blob/main/src/features/classes/BatchCard.jsx)
- [`src/features/classes/CohortRosterTable.jsx`](https://github.com/aymira-git/mylibertyportal-origin/blob/main/src/features/classes/CohortRosterTable.jsx)
- [`src/features/classes/batchAvailability.js`](https://github.com/aymira-git/mylibertyportal-origin/blob/main/src/features/classes/batchAvailability.js)
- [`src/features/students/UserForm.jsx`](https://github.com/aymira-git/mylibertyportal-origin/blob/main/src/features/students/UserForm.jsx)
- [`src/features/students/StudentApplications.jsx`](https://github.com/aymira-git/mylibertyportal-origin/blob/main/src/features/students/StudentApplications.jsx)
- [`src/features/students/ApplicationPlacementModal.jsx`](https://github.com/aymira-git/mylibertyportal-origin/blob/main/src/features/students/ApplicationPlacementModal.jsx)
- [`src/features/students/admissionsUtils.js`](https://github.com/aymira-git/mylibertyportal-origin/blob/main/src/features/students/admissionsUtils.js)
- [`src/features/students/studentRecord.js`](https://github.com/aymira-git/mylibertyportal-origin/blob/main/src/features/students/studentRecord.js)
- [`src/features/students/applicationsRepository.js`](https://github.com/aymira-git/mylibertyportal-origin/blob/main/src/features/students/applicationsRepository.js)
- [`src/features/attendance/punctuality.js`](https://github.com/aymira-git/mylibertyportal-origin/blob/main/src/features/attendance/punctuality.js)
- [`FormSync.gs`](https://github.com/aymira-git/mylibertyportal-origin/blob/main/FormSync.gs)
- [`firestore.rules`](https://github.com/aymira-git/mylibertyportal-origin/blob/main/firestore.rules)
