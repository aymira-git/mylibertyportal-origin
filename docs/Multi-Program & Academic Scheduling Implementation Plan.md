# MYLIBERTY Portal — Multi-Program & Academic Scheduling Implementation Plan (Revised after audit)

**Status note for everyone reading:** The auditor (Claude) read this plan against the uploaded `myliberty-portal.zip` by static review plus a few small Node probes. Claude is an AI and can be wrong. The executing agent, Kifry and the auditor are all invited to check, challenge or replace anything below. Where the plan says "current stance", it means the best reading right now, with a reason, and it stays open to a counter-proposal.

**Scope:** Program-aware batches, levels, admissions, schedule conflicts and attendance for the academy's programs.

---

## 0. Audit Summary (what the zip actually contains)

Test status is unverified: an attempt to run `programs.test.js` produced no readable result, so the executing agent may want to run `npm test` first to get a baseline.

| # | Finding | Evidence in zip | Suggested direction (open to argument) |
|---|---|---|---|
| A1 | **Phase 1 is partly done already; the plan is out of date.** `src/constants/programs.js` and `programs.test.js` exist, but nothing in `src/` imports `programs.js` yet. | `grep constants/programs src` returns only the test | Tick off what exists, then treat the code as the reference for §3.1 |
| A2 | **Plan §3.1 and the real file disagree.** Plan: `levels` is a string array with ids like `kids_phonics`; `weekendActive`; TOEFL tone `rose`. Code: `levels` is an array of objects with ids like `phonics`, fields `weekendAllowed`/`weekendOff`, TOEFL tone `amber`. | `programs.js` | Pick one shape (the code's is richer and already tested) and update the plan text to match |
| A3 | **`normalizeProgram()` misclassifies plausible legacy strings** (verified by running it): `"Kids School"` → english_course, `"TOEFL iBT"` → english_course, `"Young learners"` → english_course. The `includes("tk")` check can also match unrelated words. `"IELTS"` → toefl, while Rule 4 says legacy values such as IELTS default to english_course. | Node probe against `programs.js` | An alias table with exact matches first, then a small set of safe keyword checks; decide the IELTS question explicitly (see Q2); add these strings to `programs.test.js` |
| A4 | **`isValidScheduleForProgram()` only guards Kids School.** Every other program returns `true` for any day, so `allowedDays` is never enforced (e.g. Kids Course + "Everyday" passes). | `programs.js` bottom | Check `allowedDays` for all programs, while tolerating legacy batches so editing an old batch does not get blocked |
| A5 | **There are two day parsers, and the plan mentions one.** `scheduleConflict.js` (`DAY_MAP` + `parseDayString`) and `attendance/punctuality.js` (`KNOWN_CLASS_DAYS` + `parseClassDays`). With `"Mon - Fri"`, both fall through to a split on `/` or `,` and read the string as **Monday only**. Effect: the staff kiosk / Today tab would show a Kids School class only on Mondays, and conflicts would be checked only on Mondays. | Both files, fallback branches | One shared day-set helper imported by both, so a new frequency is added in one place |
| A6 | **The level system only knows the 5 English levels.** `LEVELS` in `constants/levels.js` has 5 keys. `isCompatible()` returns `true` whenever the student level is unknown, so a Kids School or TOEFL student would count as "compatible" with any batch. `LevelBadge` shows a grey raw id for non-English levels. `minLevel/maxLevel` fall back to a 1–5 range. | `levels.js`, `LevelBadge.jsx` | Adding `batch.programId === student.programId` to `isCompatible` (Rule 3) covers only part of it. Level lookup and badges need to resolve through the program registry too |
| A7 | **No `programId` exists on batches, students or applications yet.** Applications and students hold a free-text `program` string (`UserForm.jsx` ~line 304, `studentRecord.js` line 36). `batchSchema` has no program field. Legacy Firestore docs read without going through Zod will not receive the schema default. | schemas, forms | Normalize on read with a small helper (e.g. `getBatchProgram(batch)`), write the canonical id going forward; a one-time migration is optional |
| A8 | **Admissions grouping and messages use the raw string.** `admissionsUtils.js` ~line 163 filters by exact lowercase string; the WhatsApp template prints the raw text. Program analytics (§3.7) would split "IELTS", "ielts", "TOEFL iBT" into separate groups. | `admissionsUtils.js` | Normalize before grouping; print the canonical label in messages |
| A9 | **Kids School and the Friday-off school week.** The company week is Sat–Thu, and existing code treats Friday as off (`Everyday` = Sat–Thu, `punctuality.js` comment). Kids School on Mon–Fri adds a Friday working day for teachers, kiosk and Today tab. | `punctuality.js`, memory of school schedule | See Q1 |
| A10 | **Sensitive data on a public form.** Phase 3 adds medical/allergy notes and authorized pick-up contacts to `RegistrationPage.jsx`, a public page, for children. | Plan §3.5 | Review who can read those fields in `firestore.rules` before collecting them; consider collecting them at the front-desk stage instead of the public form |
| A11 | **Firestore rules for `classes`** do not mention program. Adding `programId` to a batch is an admin write, so it fits the current rule. The rules for applications were not reviewed. | `firestore.rules` line ~97 | Confirm the applications rule accepts the new field |

---

## 0.1 Decisions (Kifry asked the auditor to suggest; these are current stances, open to challenge by anyone)

**Q1 — Where does Kindergarten (Kids School) live? Current stance: Option A.**
- **Option A (suggested):** Build Programs 1–4 now. Keep `kids_school` in the registry but hidden from dropdowns behind a simple flag (e.g. `enabled: false`), so nothing half-built shows to staff. Handle its Mon–Fri behavior later in Phase 5 if it is wanted in this portal.
- **Option B:** Build Kids School in this portal now. Needs the Friday handling in A9 (kiosk, Today tab, shifts) and the parser work in A5 first.
- **Option C:** Separate app. Then the registry entry can be removed or kept dormant.

**Follow-up:** Kifry would like Kindergarten to have its own Manager / Instructor / Front Office dashboards (no marketing). That work is described in the separate file `Kindergarten_Division_Implementation_Plan.md`, which builds on Phases 0–1 here.

Reasons for A: the kindergarten works on Fridays while the rest of the school does not, and that touches the kiosk, Today tab and shifts, so it is the riskiest part. A separate app also means double the setup for someone with no coding time or budget. Option A keeps both B and C possible later. As far as the auditor knows, a second app could still share this project's Firebase login and database at no extra cost, but the executing agent is asked to double-check that before relying on it.

**Q2 — Legacy "IELTS" records. Current stance:** map to `toefl` (the closest program, exam preparation), with the label text kept on the record so nothing is lost. The plan's old text said english_course; either is fine if tested and documented.

**Q3 — Field name. Current stance:** keep the existing `program` (raw label) and add `programId` (canonical). The executing agent may propose something simpler.

---

## 1. Program Architecture

| # | Program Key | Display Name | Target Learner | Levels | Schedule options | Weekend |
|---|---|---|---|---|---|---|
| 1 | `english_course` | English Course | Teens & Adults | Warrior, Elite, Master, Grandmaster, Epic | Mon/Wed, Tue/Thu, Sat Only, Sat/Sun, Everyday | Sat & Sun open |
| 2 | `kids_course` | Kids Course | Ages 5–12 | Phonics, Starters, Movers, Flyers | Mon/Wed, Tue/Thu, Sat Only, Sat/Sun | Sat & Sun open |
| 3 | `professional_school` | Professional School | Career / job seekers | Business Foundations, Workplace Communication, Executive Leadership | Mon/Wed, Tue/Thu, Sat Only, Everyday | Sat open |
| 4 | `toefl` | TOEFL Preparation | Exam candidates | Foundation (400–450), Intermediate (450–500), Advanced (500–550), High Scorer (550+) | Mon/Wed, Tue/Thu, Sat Only, Sat/Sun, Everyday | Sat & Sun open |
| 5 | `kids_school` | Kids School (Kindergarten) | Ages 2–6 | Playgroup/Nursery, TK-A, TK-B | Mon – Fri, mornings (e.g. 08:00–11:30) | Current stance: closed Sat & Sun, because it follows a normal school week. Depends on Q1 |

"Everyday" in this school means Saturday to Thursday.

---

## 2. Business Rules (current stance, each open to challenge)

1. **Kids School runs a 5-day school week (Mon–Fri) and is closed on weekends.** Reason: it is formal daily schooling rather than session-based courses. Depends on Q1.
2. **Programs 1–4 are session-based courses** (2–3 days a week). Program 5 is a daily track.
3. **Levels belong to a program.** A TK-A student and an English "Grandmaster" batch should not be matched. Reason: the level ladders are unrelated. This needs the level lookup work in A6, not only a `programId` comparison.
4. **Legacy free-text programs resolve to a canonical id** with a documented default (english_course unless Q2 says otherwise), so old records keep working.
5. **Existing batches and students without a program keep working unchanged** and are treated as english_course on read.

---

## 3. Technical Design

### 3.1 Program registry — `src/constants/programs.js` (already exists)
Reference is the file in the repo (see A2). Suggested follow-ups:
- Rework `normalizeProgram()` (A3): exact aliases first, safe keywords after; add tests for `"Kids School"`, `"TOEFL iBT"`, `"Young learners"`, `"IELTS"`, `""`, `null`.
- Make `isValidScheduleForProgram()` consult `allowedDays` for every program, with tolerance for legacy values (A4).
- Add `getBatchProgram(batch)` / `getStudentProgram(student)` helpers (A7).
- Possible addition: a way to look up a level by `(programId, levelId)` so badges and compatibility can work for all programs (A6).

### 3.2 Schedule engine — one shared day helper
- Create one helper (e.g. `src/constants/scheduleDays.js`) exporting the weekday sets for all frequency labels, including `"Mon - Fri"`.
- Point both `scheduleConflict.js` and `attendance/punctuality.js` at it (A5); keep the current fallback for unknown labels.
- Tests: `"Mon - Fri"` conflicts with Mon/Wed, Tue/Thu and Fri Only; no overlap with Sat Only / Sat/Sun; `getTodaysClasses` returns a `"Mon - Fri"` class on each weekday Mon–Fri and none on Sat/Sun.
- Conflict behavior example: Kids School Mon–Fri 08:30–11:00 sharing a room or teacher with a Mon/Wed 10:00–11:30 class raises the existing live conflict alert.

### 3.3 Batch schema & `BatchModal.jsx`
- `batchSchema.js`: add `programId` with a default of `english_course`, normalized through the registry (same pattern as the `branch` transform).
- `BatchModal.jsx` (596 lines already; the refactor plan in `docs/Large_File_Splitting_Implementation_Plan.md` may prefer a small extracted piece, e.g. a program/level selector component):
  - Program selector; frequency options come from the chosen program's `allowedDays`.
  - Level dropdown comes from the chosen program's levels.
  - Kids School (if Q1 = B): frequency set to Mon – Fri with an inline note that weekends are closed.
  - Editing a legacy batch whose frequency is no longer in the list keeps its value visible (as the existing `Fri Only (Legacy)` option does).

### 3.4 Available Batches (`AvailableBatches.jsx`, `AvailableBatchCard.jsx`, `batchAvailability.js`)
- Program filter bar and a colored badge per card using the registry's `badgeBg`.
- Placement defaults to batches of the student's program (via `getStudentProgram`).
- Tests for filtering by program, including legacy batches with no `programId`.

### 3.5 Admissions & Student Profile (`UserForm.jsx`, `RegistrationPage.jsx`, `ApplicationPlacementModal.jsx`)
- Program select from the registry (values are canonical ids), saved alongside the existing label.
- Conditional fields, suggested in two tiers:
  - **Low sensitivity, fine on the public form:** parent/guardian name and phone (kids programs), TOEFL target score and exam date, employment/goal (Professional School).
  - **Sensitive (A10):** medical/allergy notes and authorized pick-up contact — confirm read access in `firestore.rules` first, or collect at the front desk.
- Placement modal shows the canonical program label.

### 3.6 Today tab & kiosk (`TodayTab.jsx`, `attendance/`)
- Works through `getTodaysClasses`, so it benefits from the shared day helper (§3.2).
- Weekend message for Kids School: "Kids School is closed for the weekend. Showing weekend course cohorts only." (only if Q1 = B).
- Friday handling for Kids School staff (shifts, kiosk) follows the Q1 answer (A9).

### 3.7 Reports (`AdmissionsTab.jsx`, `LearnerProgressTab.jsx`)
- Group by canonical program id (A8), display the canonical label.
- Room utilization by program is a nice-to-have and can wait until batches carry `programId`.

---

## 4. Suggested Phases (order can be argued)

### Phase 0 — Reconcile & harden (small, stability first)
- [x] Run `npm test` for a baseline (449 tests passing).
- [x] Update this plan's checklist to reflect what already exists (A1, A2).
- [x] Fix `normalizeProgram()` and `isValidScheduleForProgram()` with tests (A3, A4).
- [x] Shared day helper (`scheduleDays.js`) wired into both parsers with tests (A5).

### Phase 1 — Data shape
- [x] `programId` on batches and applications; helpers for legacy read (`getBatchProgram`, `getStudentProgram`) (A7).
- [x] Program-aware level lookup, badge and `isCompatible` (A6).
- [x] Schema tests in `schemas.test.js`.

### Phase 2 — Batch management & Available Batches
- [x] BatchModal program + level + frequency behavior.
- [x] Program filter and badges in Available Batches and AvailableBatchCard.

### Phase 3 — Admissions
- [x] Program select and canonical id on applications/students (`UserForm.jsx`).
- [x] Placement modal with program matching and program level selection (`ApplicationPlacementModal.jsx`).
- [x] Normalized grouping and WhatsApp messages (`admissionsUtils.js`, `StudentApplications.jsx`) (A8).

### Phase 4 — Attendance & reports
- [x] Shared scheduleDays engine wired into Today tab & punctuality. Canonical program labels in Admissions Tab.
- [ ] Dedicated program analytics breakdown tab (follow-up).

### Phase 5 (only if Q1 = B) — Kids School specifics
- [ ] Mon–Fri behavior end to end, Friday staff shifts, weekend message (tracked under dedicated Kindergarten plan).

---

## 5. Verification Ideas

- `npm test`, `npm run lint` and a production build after each phase (the auditor did not run the build).
- Unit: registry normalization table, allowed-day checks, shared day helper (including `"Mon - Fri"` on every weekday), `isCompatible` across programs, batch/student program helpers with legacy records.
- Walkthrough: create an English batch (Mon/Wed) and a TOEFL batch (Sat/Sun); open an old batch with no program and confirm it edits and saves; place a TOEFL applicant and confirm only TOEFL batches are suggested; check that "TOEFL iBT" and "IELTS" applications group as intended in Admissions.
- If Q1 = B: create a Kids School batch, confirm conflict detection against a Wednesday-morning English class in the same room, and confirm the kiosk lists it on each weekday.

---

## 6. Open Room for the Executing Agent

Every item above is a proposal. If a different structure is safer or simpler for this codebase (for example normalizing at the repository layer instead of read helpers, or splitting the registry into two files), please argue for it in your reply and Kifry can decide. Findings A1–A11 are also fallible; a quick check of each against the code before acting on it is welcome.
