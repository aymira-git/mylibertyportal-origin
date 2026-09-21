# MYLIBERTY Portal — Kindergarten Division Implementation Plan (separate dashboards)

**Status note for everyone reading:** Written by the auditor (Claude) after reading `myliberty-portal.zip` statically. Claude is an AI and can be wrong. Kifry, the executing agent and the auditor are all invited to check, challenge or replace any part. "Suggested" and "current stance" mean the best reading right now, with a reason, and stay open to a counter-proposal.

**Why this plan exists:** Kifry would like Kindergarten (Kids School) to have its own dashboards: **Kids Manager, Kids Instructor, Kids Front Office**, with **no marketing** role. This was split out of the Multi-Program plan so the two can be built and reviewed separately.

**Relationship to other plans:** This plan builds on Phases 0–1 of `Multi-Program & Academic Scheduling Implementation Plan.md` (shared day helper, program registry with `programId`). The `kids_school` program stays hidden (`enabled: false` style flag) until this plan's early phases are ready.

---

## 1. Current Stance: a "division" tag, not new roles

Three ways to give Kindergarten its own dashboards were compared:

| Option | Idea | Fit |
|---|---|---|
| **1. New roles** | `kids_manager`, `kids_instructor`, `kids_frontoffice` | Cleanest separation, but the role names are written into many files. `"frontoffice"` alone appears in 12 source files (App router, StaffDirectory, TasksPanel, InvitesPanel, staffUtils, ClassManager, AvailableBatches, UserForm, StaffDutyTab, useStaffDirectives, inviteSchema, FrontOfficeDashboard) plus several role lists in `firestore.rules`. Three new roles means touching all of those three times, and one missed spot fails silently. |
| **2. Division tag (suggested)** | Keep the existing roles. Add a `division` value (`courses` / `kindergarten`) on staff accounts. App router picks the dashboard from **role + division**. | Copies a pattern already proven in this repo: `branch` is normalized and filtered in about 23 files through `constants/branches.js` (`normalizeBranch`, `matchesBranchFilter`). Legacy accounts default to `courses`, so nothing changes for them. |
| **3. Separate app** | Second front-end on the same Firebase project | Hardest wall between the two sides, more setup and a second codebase to maintain. Worth revisiting if Kindergarten grows a lot or needs parent-facing features. |

Counter-proposals welcome. Option 1 or 3 would win if Kifry wants a hard wall between the two sides *and* is happy to pay the extra work. The executing agent is asked to check the claim that a second app can share this project's Firebase login and database before relying on it.

---

## 2. Data Model

- **`division` on staff (users, invites):** values `courses` (default) and `kindergarten`. Admin sees both. A helper module, e.g. `src/constants/divisions.js`, mirroring `branches.js`: `DIVISIONS`, `DEFAULT_DIVISION`, `normalizeDivision()`, `matchesDivisionFilter()`, `divisionOfProgram(programId)` (kids_school → kindergarten, everything else → courses), plus tests.
- **Batches and students:** division follows `programId` (a `kids_school` batch or student belongs to kindergarten). Suggestion: derive it on read in the UI; **store a copy on the document too**, because Firestore rules cannot call JavaScript helpers (see §5). The executing agent may prefer another way to keep the two in sync.
- **Legacy records** with no division are read as `courses`.
- **One person in both divisions?** Current stance: one division per staff account (simplest). If a teacher works in both, `divisions` as a list is a possible alternative. See K1.

## 3. Dashboards

Existing dashboards are 130–310 lines each and are built from shared panels on `DashboardShell` with `useDashboardData`. That same pattern is suggested here (separate components sharing hooks, as the earlier refactor concluded), rather than a boolean flag inside one big component.

| Dashboard | Chosen when | Suggested first version (reuse, filtered to kindergarten) | Later, kindergarten-specific |
|---|---|---|---|
| **Kids Front Office** | role `frontoffice` + division `kindergarten` | Student roster, applications, class list, kiosk, tasks, reports, all filtered to kindergarten | Daily roll call, parent contacts and pick-up list |
| **Kids Manager** | role `manager` + division `kindergarten` | Manager overview, classes & coverage, staff directives, filtered to kindergarten | Weekly attendance summary |
| **Kids Instructor** | role `instructor` + division `kindergarten` | Instructor overview, classes, progress, filtered to kindergarten | Morning attendance, per-child notes |
| Marketing | no kindergarten version | Invites for the kindergarten division hide the marketing role | — |

- `App.jsx` role switch: `role + division` picks the dashboard. An account with a role but an unknown division falls back to the courses dashboard.
- A first version that only reuses panels gives Kifry something usable early. Kindergarten-specific screens can follow once the base works.

## 4. Work Week and Attendance

- Kindergarten staff and classes run Mon–Fri; the courses side runs Sat–Thu (Friday off). The kiosk, `getTodaysClasses` and shift logic use day sets, so a **work-week per division** helper is suggested, built on the shared day helper from Multi-Program Phase 0.
- Today tab: kindergarten dashboards show Mon–Fri cohorts; a closed-day message on Sat/Sun.
- Admin reports show both divisions, with a split filter.

## 5. Security (the part that decides how strong the separation is)

The current rules decide by role only. As far as the auditor saw, `users`, `classes` and `attendance` reads are not narrowed by branch or program. A division tag by itself changes what people *see*, and a determined staff member could still read the other side's data through the database.

Suggested steps, open to argument:
- Add a `myDivision()` helper in `firestore.rules`, and narrow reads of students and classes to the same division (admin exempt), treating a missing division as `courses`.
- Firestore rules allow a limited number of document lookups per request, and `userProfile()` already costs one. The executing agent is asked to check this budget before adding more lookups.
- Roll rules out **after** existing documents carry a division (a small backfill), and test with the free Firebase emulator or with a test account per role, so no one loses access by accident.
- Children's medical, allergy and authorized pick-up details are the most sensitive data in the app. Suggestion: collect them only once this step is in place (this ties to finding A10 in the Multi-Program plan).

## 6. Invites and Signup

- `inviteSchema.js` gets `division` (normalized, same pattern as `branch`); `InvitesPanel.jsx` lets admin pick it; `StaffSignup.jsx` carries it into the new user record.
- With division = kindergarten, the role choice shows manager, frontoffice and instructor only (marketing hidden).
- Staff Directory and Staff Duty tabs get a division filter next to the branch filter.

---

## 7. Suggested Phases (order can be argued)

### Phase 0 — Prerequisites
- [ ] Multi-Program Phase 0–1 done (shared day helper, `programId`, level lookup).

### Phase 1 — Division foundation
- [ ] `constants/divisions.js` with tests.
- [ ] `division` on invite and user schemas; invites/signup carry it.
- [ ] Legacy default to `courses`; `division` stored on kindergarten batches and students.

### Phase 2 — Routing and first dashboards
- [ ] `App.jsx` picks the dashboard from role + division.
- [ ] Kids Front Office, Kids Manager, Kids Instructor as reuse-first dashboards filtered to kindergarten.
- [ ] Division filter in Staff Directory and reports.

### Phase 3 — Work week and attendance
- [ ] Work-week per division in kiosk, Today tab and shifts.

### Phase 4 — Rules hardening
- [ ] Backfill, `myDivision()` rules, test per role (kids manager sees no course students, courses manager sees no kindergarten students, admin sees both).

### Phase 5 — Kindergarten-specific screens
- [ ] Roll call, parent contacts and pick-up, gated behind Phase 4.

### Phase 6 — Revisit (optional)
- [ ] If the division tag feels too weak or too heavy, reconsider Option 1 or 3 with real usage in hand.

---

## 8. Questions for Kifry (defaults given so work can start; answers welcome any time)

- **K1:** Does any teacher or staff member work in both Kindergarten and Courses? *Default: no, one division each.*
- **K2:** Does Kindergarten have an office boy / cleaner account? *Default: the existing officeboy role, no division needed.*
- **K3:** Should parents get their own login or view later? *Default: not part of this plan; can be a later plan.*
- **K4:** Does Kindergarten run at all four branches or only some? *Default: any branch; division and branch are independent tags.*

## 9. Verification Ideas

- Unit: `divisions.js` helpers; division default for legacy records; invite schema; work-week per division.
- Walkthrough with test accounts: kids manager, kids instructor, kids front office, courses manager, admin. Confirm each sees the right dashboard, the right students and classes, and (after Phase 4) cannot read the other side's data.
- Regression: existing courses accounts behave exactly as before with no division set.
- Run `npm test`, `npm run lint` and a production build after each phase.

## 10. Open Room for the Executing Agent

Everything here is a proposal. If a different structure is safer or simpler for this codebase (for example a `divisions` list instead of a single value, or storing division only on the user and looking it up in rules), please argue for it in your reply and Kifry can decide. The claims in §1 and §5 about role usage and rule limits are the auditor's static reading and deserve a quick check before being relied upon.
