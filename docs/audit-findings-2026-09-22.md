# MYLIBERTY Portal — Audit Findings (Session: 2026-09-22)

Notes for the executing agent: these are findings and framing, not locked decisions.
Where more than one fix direction is listed, pick based on what's consistent with the
rest of the codebase — don't treat the order as a recommendation ranking.

---

## 1. "Student Lifecycle Status" dropdown appears on Add New Student

**File:** `src/features/students/UserForm.jsx`

**What's happening:** Add New Student and Edit Student Profile render the exact same
component (`UserForm`). The only thing distinguishing "add" from "edit" is the `editId`
prop, which is only used to (a) disable the email field and (b) hide the password field
when editing. The Lifecycle Status field (and the rest of the student section) has no
`editId` check at all — it's shown identically in both modes, defaulting to `"active"`.

**Not a logic bug** — it won't break anything — but it's an unreviewed side effect of
sharing one form, not a deliberate choice for that specific field.

**Open question for the agent:** does Lifecycle Status belong on Add at all? The only
legitimate "add" use case is one-time historical backfill (entering a student who
already graduated/left before this system existed) — normal day-to-day new-student
entry is always "active." Options, not mutually exclusive:
- Hide the field on Add, default silently to `"active"`.
- Keep it on Add but visually de-emphasize/collapse it (e.g. under "Advanced").
- Leave as-is if backfill is common enough to matter.

---

## 2. Program dropdown shows a duplicate raw-id entry ("english_course")

**Files:** `src/features/dashboard/useDashboardData.js` (`handleAddStudent`),
`src/features/students/UserForm.jsx` (Program `<select>`)

**Root cause:** `handleAddStudent()` initializes a new student's blank form with
`program: "english_course"` — the raw **id**, not the display **label**
(`"English Course"`) — and never sets `programId` at all.

The Program `<select>` in `UserForm.jsx` has fallback logic: if `formData.program`
doesn't match any known program's `id` *or* `label`, it injects it as an extra manual
`<option>`. Because `"english_course"` (id, underscore) ≠ `"English Course"` (label,
space), the check fails and a redundant `<option>english_course</option>` appears at
the bottom of the list — visible, selectable junk.

**Fix directions** (pick one, don't need to do both):
- Set `programId` in `handleAddStudent()` instead of `program`, so the form is driven
  by id consistently.
- Or store the proper label in `program` instead of the raw id.
Check how `program` vs `programId` is read elsewhere before choosing — they're both
used in multiple places (see `divisionOfProgram(user.programId || user.program)` in
`useDashboardData.js` for one example of the two being treated as interchangeable).

**Confirmed in production data (2026-09-22):** the user checked the `users` collection
in Firestore directly and found existing student docs with `program: "english_course"`
(raw id) alongside others correctly holding `program: "English Course"` (label) —
`programId` was correctly `"english_course"` on both, only `program` was inconsistent.
This means the form-side fix alone won't repair records created before the fix ships.
**Data cleanup needed:** manually check the `users` collection for any `role: "student"`
doc where `program` is a raw id (`english_course`, `kids_school`, etc. — lowercase,
underscored) instead of a proper label, and correct that field's value directly in the
Firebase Console. Check the kindergarten path too — `handleAddStudent()` has the same
raw-id pattern for `kids_school`, not just `english_course`. Small number of records
expected — a manual console edit per doc is fine, no script needed.

---

## 3. "Fluency Tier (Evaluated)" dropdown only offers 3 of 5 levels

**File:** `src/features/students/UserForm.jsx` (~line 585)

**Root cause:** There are **two separate controls writing to the same field**
(`currentLevel`, via `setAcademicLevel`):
- "Fluency Tier & Placement Level" (~line 259) — the complete, correct control. Lists
  all 5 levels from the program's real level list (Warrior/Elite/Master/
  Grandmaster/Epic for English Course).
- "Fluency Tier (Evaluated)" (~line 585) — a second, separate dropdown hardcoded to
  only 3 stars (1★→warrior, 2★→master, 3★→epic), silently skipping Elite and
  Grandmaster entirely.

**Why this matters more than a cosmetic gap:** since both write the same underlying
field, using the "(Evaluated)" dropdown on a student currently at Elite or Grandmaster
collapses their placement down to the nearest of only 3 possible values — silent data
loss, not just a missing option.

**Open question for the agent:** is "(Evaluated)" meant to be a genuinely distinct
field (e.g. "assessed level at intake" vs "enrolled track"), or is it leftover/stale
duplicate UI from before the 5-level system existed? That determines whether the fix
is "give it its own field" or "delete the duplicate control."

---

## 4. Admissions Desk "Program" filter has no options

**Files:** `src/features/students/StudentApplications.jsx`,
`src/features/students/admissionsUtils.js` (`getDistinctValues`)

**Root cause:** The Program filter's options come from `getDistinctValues(applications,
"program")`, which derives options purely from whatever `program` values already exist
in the currently loaded applications — not from the master 5-program list
(`getEnabledPrograms()` in `constants/programs.js`, the source of truth used
everywhere else). With no submitted applications yet (or a field-name mismatch), the
dropdown has nothing to show beyond "All Programs."

**Notable inconsistency:** `getDistinctValues()` already special-cases this exact
problem for the **Branch** filter — it pre-seeds the set with the fixed `BRANCHES`
list so Branch always has options even with zero data. No equivalent seed exists for
Program. Same problem, solved once, not applied consistently.

**Fix direction:** seed the Program set with `getEnabledPrograms()` the same way
Branch is seeded with `BRANCHES`.

---

## 5. Payment status is tracked per-student, not per-enrollment (architecture-level)

**Files:** `src/schemas/paymentSchema.js`, `src/features/finance/paymentsRepository.js`,
`src/features/classes/StudentPaymentBadge.jsx`, `src/features/classes/classesRepository.js`

**What's happening:**
- `paymentRecordSchema` has no `batchId`, `classId`, or `programId` field — a payment
  is just `{studentId, amount, period, method, planId, ...}`.
- `recordPayment()` writes a single global `paymentStatus` / `paidUntil` /
  `lastPaymentPeriod` onto the student's own doc (`users/{studentId}`).
- `StudentPaymentBadge` (rendered inside batch rosters) reads that same global field —
  it has no way to know which batch/program it's actually being displayed next to.
- `addStudentToClass()` has no check preventing the same student from being added to
  more than one batch/program at once — multi-enrollment is already possible in the
  data model as it stands today.

**Why this is the highest-priority finding of the five:** the other four are visible
immediately (a stray option, a missing filter). This one only surfaces once a student
has two active enrollments — paying for one program silently marks them "paid" for
all of them, with no way in the current schema to ask "is this student current on
*this specific* batch." It will look completely fine in single-program testing and
misreport quietly in real multi-program use.

**This is a genuine architecture decision, not a quick patch** — left fully open for
you + the executing agent:
- Should payment records key off `(studentId, programId)` or `(studentId, batchId)`
  instead of just `studentId`?
- If multi-program enrollment isn't actually meant to be supported, should
  `addStudentToClass()` instead enforce single-batch-at-a-time and this whole issue
  becomes moot?
- Is per-program payment tracking overkill for current company operations, in which
  case this gets documented as a known limitation instead of fixed?

---

## Suggested first pass for the executing agent: automated checks

Before touching any of the findings above, worth running these — cheap, fast, and may
surface dead code or broken imports this session's manual spot-checks didn't cover.
None of these will catch the semantic/architecture issues above (id-vs-label
mismatches, duplicate controls, the payment-linkage gap) — those need actual reading
of the logic, not just static analysis. But they're a good sanity pass first:

```
npx eslint .     # broken imports, unused variables, obvious mistakes
npx knip         # unused files / unused exports / orphaned components —
                 # already listed in package.json devDependencies, seemingly unused so far
```

`madge --circular src` is also worth a run if available, to catch tangled/circular
imports between features (not currently in devDependencies, so would need adding).

---

## Not covered this session
Only the files touched by the five spot-checks above were reviewed in depth. The rest
of the batches/payment code paths (batch capacity/quorum logic, transfer-between-
classes, payment plan discount math) were not audited this pass — worth a dedicated
session if you want that coverage.
