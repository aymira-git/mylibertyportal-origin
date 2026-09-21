# Test Coverage Audit & Test Suite Plan — MyLiberties

> **Read this first — everyone can be wrong.**
> Claude (the auditor) can make mistakes, and so can the executing agent and Kifry. Every finding below is a
> hypothesis backed by the evidence listed next to it. Please double-check anything before acting on it, and
> feel free to challenge, reword or replace any proposal — if you disagree, write your reasoning in the
> "Agent notes" section at the bottom so the next session can see it.

## 0. Facts and stance from Kifry (current, open to challenge)

- **Friday is always off in this app.** Only the kindergarten opens on Fridays, and Kifry plans that as a separate app. Working week here: Saturday to Thursday.
- **The company is in Gorontalo province, not Manado.** Gorontalo is also on WITA (UTC+8), so the fixed +8 hour offset in `utils/dateWita.js` stays correct. Only wording is out of date: the header comment in `utils/dateWita.js` (line 4) and one line in `docs/Reliability_and_Config_Hardening_Implementation_Plan.md` still say Manado. Sample data in the new tests now says Gorontalo.
- **"Everyday" batches run Saturday to Thursday (confirmed by Kifry).** The code currently maps "Everyday" to Monday–Friday (F10).
- **Kifry is open to every change that makes the app more stable.** Current reading: the executing agent can act on any finding below without a separate approval step, and can record reasoning (including disagreement) in "Agent notes". That stance is Kifry's today and can be revisited.

**Audited from:** `myliberty-portal.zip` (21 Sep 2026 upload)
**Objectives covered:** (1) find the critical flows, edge cases and modules with no tests; (2) write a comprehensive
first set of unit tests for the most complex / most frequently changed logic.

---

## 1. Where the project stood

- **No tests existed.** No test files, no test runner in `package.json`. The only safety nets were `npm run lint` and `npm run build`.
- The code is well separated (pure helpers, `*Repository.js` files for Firestore, thin React components), which made
  a first suite cheap to add without touching any source file.

## 2. What was added (drop-in, no source file changed)

| Item | Purpose |
|---|---|
| `vitest` (dev dependency) + scripts `npm test`, `npm run test:watch` | Runs on the same toolchain as Vite; free; no extra config for Kifry. |
| `vitest.config.js` | Node environment, finds `src/**/*.test.js`, pins the test process to `Asia/Makassar` so results match on every machine. |
| `src/test/firestoreFake.js` | A tiny in-memory stand-in for `firebase/firestore`. Tests stay away from the real database. Batches and transactions only "write" when they commit, so all-or-nothing behaviour can be checked. |
| 23 `*.test.js` files next to the code they cover | 387 tests. |

**How to run:** `npm install` then `npm test` (takes ~8 seconds).

**Verification log (what was actually run, so it can be re-checked):**
- Fresh `npm ci`, vitest 5.0.1, Node 22: 23 files, 387 tests → 368 pass, 19 marked expected-fail (see §5).
- `npm run lint` clean; `vite build` succeeds.
- Every expected-fail test was temporarily switched to a normal test and confirmed to fail for the stated reason.
- 7 deliberate breakages were tried (cutoff minutes, overlap edge, filling-fast threshold, payment status, delete guard,
  due-soon threshold, batch-capacity check); each was caught by at least one test, then reverted.
- Source diff against the uploaded zip: only `package.json` / `package-lock.json` changed; everything else is new files.

## 3. Coverage map

| Area | Files covered | Risk if wrong | Notes |
|---|---|---|---|
| Timezone core | `utils/dateWita.js` | High — every report and shift depends on it | Midnight boundaries, new-year, leap day, and "same answer on any device timezone". |
| Attendance / punctuality | `punctuality.js`, `shiftStatus.js`, `shiftAutoClose.js`, `shiftsRepository.js` | High — affects staff records | Monthly stats scenarios (on time / late / absent / private / legacy / auto-closed); clock-in, class switch, audited adjustment, leave. |
| Scheduling | `scheduleConflict.js`, `batchAvailability.js` | High — double-booking, enrolment limits | Back-to-back classes, room-name normalisation, capacity defaults, filling-fast, full, in-progress late joiners. |
| Enrolment / transfer | `classesRepository.js`, `classesUtils.js` | High — moves students between classes | Atomic batch contents, level fallback chain, failure leaves nothing written. |
| Money | `constants/paymentPlans.js`, `paymentsRepository.js`, `receiptMessages.js` | High | Every plan's price and discount, month-end clamping, 14-day due-soon boundary, atomic payment + student update. |
| Admissions | `admissionsUtils.js`, `applicationsRepository.js`, `studentRecord.js` | Medium-High | Duplicate detection strengths, approve/reject transaction rules ("already processed", full batch), canonical student record. |
| Staff | `staffUtils.js`, `usersRepository.js`, `invitesRepository.js` | Medium | Delete guardrails, workload, invite expiry/normalisation, half-created account message. |
| Reports / misc | `atRisk.js`, `levels.js`, `csvExport.js`, `managerUtils.js`, `tabUtils.js` | Low-Medium | 14-day at-risk rule, level compatibility, CSV quoting + BOM. |

## 4. What is still not covered (proposed priorities — open to debate)

| # | Gap | Why it may matter | Suggested approach | Cost |
|---|---|---|---|---|
| G1 | **`firestore.rules`** | These rules are the real security boundary (who can create shifts, edit users, read payments). A wrong line here is invisible to every test above. | `@firebase/rules-unit-testing` against the Firestore emulator. Needs Java + `firebase-tools` locally. I could not run the emulator in my environment, so I did not write unverified rule tests. | Free, medium effort |
| G2 | **React hooks and screens**: `useDashboardData` (333 lines), `Kiosk.jsx` (600), `StaffDirectory.jsx`, `StudentRoster.jsx`, `PaymentModal`, `App.jsx` role routing | The user-facing flows (clock in/out, delete-guard toasts, role → dashboard) are wired here. | `jsdom` + `@testing-library/react`, starting with the Kiosk clock-in/switch/auto-close flow and role routing. | Free, medium-high |
| G3 | **Files I did not read in depth**: `authRepository.js`, `todosRepository.js`, `progressReportsRepository.js`, `materialsRepository.js`, `copyText.js`, `reportError.js`, `cloudinaryUpload.js`, `printTable.js`, `useStaffDirectives.js`, `useInstructorRoster.js`, `cloudflare-worker/worker.js`, `FormSync.gs` | Not audited — could hide gaps or bugs. | Executing agent could pick these up using the same fake-Firestore pattern. | Free, low-medium |
| G4 | **CI** | Tests only help if they run automatically. `.github/workflows/` currently deploys hosting. | Consider adding a `npm test` step before the build step in the PR and merge workflows (workflow files were listed but not read closely). | Free, small |
| G5 | **End-to-end browser test** | Catches wiring problems the unit tests cannot. | Optional later (Playwright). Probably worth it only after G1–G2. | Free, higher effort |

**Cross-check I did by reading (not by running):** the Firestore writes in `approveApplication`, `transferStudentBetweenClasses`,
`recordPayment` and `syncStudentsCurrentLevel` appear to match what `firestore.rules` allows for Front Office (classes limited to
`studentIds / enrollments / updatedAt`, users limited to students). Only an emulator run (G1) can confirm this.

## 5. Findings surfaced while writing tests

Each item below is backed by a test marked `it.fails(...)`. That marker means: "this expectation is a **proposal**; today the
code does not meet it, and the test suite stays green." When a proposal is adopted and the code changes, vitest will report that
the test now passes unexpectedly — at that moment change `it.fails(` to `it(`. If the executing agent disagrees with an
expectation, edit or remove that test and record why in "Agent notes".

Severity is Claude's rough guess and may be off.

| ID | Severity | What was seen | Evidence (test name) | Direction to consider |
|---|---|---|---|---|
| **F1** | Medium-High | `punctuality.js` only understands day names separated by `/` or `,`. Three of the six values `BatchModal` can save — **"Fri Only", "Sat Only", "Everyday"** — are not recognised. Effects: those classes are missing from the instructor's kiosk "today" list, and in monthly stats they are handled like Private lessons (absences are not counted, every attended shift counts as on time). The code comment also says spaces are supported, but the pattern only splits on `/` and `,`. | `getTodaysClasses › values that BatchModal can actually save`; `computeMonthlyPunctuality › schedules sessions for a 'Fri Only' class` | Reuse the `DAY_MAP` already in `scheduleConflict.js` (one shared day parser), or normalise in one place. See F10 for what "Everyday" should mean now that Friday is known to be the day off; "Fri Only" matters mainly for old data. |
| **F2** | Medium | The kiosk saves `punctualityStatus` as `"On time" / "Late" / "Unscheduled" / "Present"`, but `managerUtils.formatPunctuality` (Manager overview) checks `"LATE" / "EARLY" / "ON_TIME"`, so a late shift shows as a green "On Time". Also `minutesEarlyOrLate` is positive when early and negative when late, while the label prints the raw number. `StaffDutyTab` already accepts both spellings. | `formatPunctuality › shows a shift the kiosk saved as 'Late' as late` | One shared status helper used by both tabs; agree one spelling for stored values. |
| **F3** | Medium | `checkDraftConflicts` returns clashes among *all* existing classes, not only those involving the draft. If two saved classes already overlap, every new batch shows a conflict warning that is not about it. | `checkDraftConflicts › only reports clashes that involve the draft itself` | Keep only pairs where one side is the draft. |
| **F4** | Medium (security, low likelihood) | CSV export writes cell text as-is. Names come from a public registration form, so a name beginning with `=` could run as a formula when a staff member opens the CSV in Excel/Sheets. | `exportTableCSV › does not let a cell that starts with '=' become a spreadsheet formula` | Common defence: prefix such cells with `'`. Trade-off to weigh: phone numbers starting with `+` and negative numbers would also be prefixed, so it may suit text columns only. |
| **F5** | Low-Medium | Punctuality uses the *device's* timezone (`setHours`, `getDay`, `new Date(y, m, d)`) while the rest of the app uses WITA helpers. Fine while every kiosk device is set to WITA; wrong on a device set elsewhere. | `getInstantPunctuality › device timezone` | Route through `utils/dateWita.js`. |
| **F6** | Low | Dates built with `new Date().toISOString().slice(0, 10)` are UTC dates: `lastPaymentDate`, student `joinedDate` on approval, default `dateTransferred`. Between 00:00 and 08:00 WITA they record the previous day. | `recordPayment › stamps lastPaymentDate with the WITA calendar day`; `approveApplication › records joinedDate as the WITA calendar day` | `todayWita()` already exists. Related: `getPaymentHealthStatus`, `getDuration`, `calculateExpiryDate` use the device's local date. |
| **F7** | Low | Receipt/reminder text prints date-only values (e.g. `2026-12-21`) through `toLocaleDateString`, which shows the previous day on a device west of UTC. | `buildWhatsAppReceiptMessage › on a device set behind UTC` | Format with an explicit timezone (WITA). |
| **F8** | Low-Medium | `transferStudentBetweenClasses` has no repository-level checks (student really in source, source ≠ target, target has seats). `TransferModal` checks capacity itself with its own copy of `Number(maxCapacity) || 15`, which duplicates `getBatchAvailability`. Transfer and remove also write whole arrays taken from the caller's snapshot, so a concurrent change by another user could be overwritten. | `transferStudentBetweenClasses › guards the repository could add` | Decide whether guards belong in the repository or only in the UI; reuse `getBatchAvailability` in `TransferModal`; consider a transaction if concurrent edits are realistic. |
| **F9** | Low (latent) | `getTabIcon`/`getTabCategory` fall back to `label.includes("ai")`, which also matches words like "Available". No current tab reaches this rule. | `getTabIcon › does not give a tab the AI sparkle…` | Match whole words, or rely on ids only. |
| **F10** | Medium | **The school week is Saturday to Thursday and Friday is always off (Kifry).** The schedule code assumes Monday–Friday: in `scheduleConflict.js`, `"Everyday"` = Mon–Fri, so an "Everyday" batch counts as running on Friday and as *not* running on Saturday or Sunday. Effect: an "Everyday" batch and a "Sat Only" / "Sat/Sun" batch with the same instructor or room and overlapping times are not flagged as a clash. The dropdown also offers **"Fri Only"** and labels the intensive option **"Mon - Fri (Intensive)"**, both out of step with a Friday off. | `scheduleConflict` proposals: Everyday overlaps a Saturday class, overlaps a Sunday class, does not overlap a Friday-only class; `getTodaysClasses › shows 'Everyday' on a Sunday`; current Mon–Fri behaviour is pinned by `currently treats 'Everyday' as Monday to Friday` | Kifry confirmed "Everyday" = Saturday to Thursday. Define the school week (Sat–Thu; in JavaScript day numbers Sat=6, Sun=0, Mon=1 … Thu=4) once in a shared place used by `scheduleConflict.js`, `punctuality.js` (F1) and `BatchModal`. Suggest retiring the "Fri Only" option and relabelling "Everyday" (for example "Sat – Thu (Intensive)"; existing batches saved as "Everyday" need no data change, they simply take the corrected meaning), after checking whether any saved batch already uses "Fri Only" so old data still displays. The parser can keep recognising "Fri Only" for old records. Update the two tests above together with the map. |

**Observations that are documented by passing tests rather than marked as issues** (the executing agent may see them differently):
- `getDobKey` sorts the numbers so `3 May 2010` and `5 March 2010` produce the same key. That is intentional for Google Form locale differences, but it can flag two different birthdays as "strong" duplicates.
- `checkStaffHasAttendanceHistory` / `checkStudentHasHistory` return `false` flags plus an `error` string on failure; the "fail closed" behaviour depends on callers reading `error`. Both current callers do.
- The kiosk stores `classId: "general"` when no class is chosen, while monthly stats treat shifts *without* a `classId` as legacy. A `"general"` shift therefore does not match any class session. Not tested — possibly intended, worth a quick look.

## 6. Proposed sequence (each step is a suggestion)

1. **Adopt the drop-in.** Copy the files, run `npm install`, `npm test`, `npm run lint`, `npm run build`. Current stance: all four should pass unchanged. *Reason:* proves the suite works on the real machine before anything else changes.
2. **Correctness batch: F1, F2, F3, F10 (and F8's shared capacity helper).** Current stance: these change what staff see or which classes get scheduled, each has a test waiting, and F1 + F10 share one fix (one shared school-week/day parser). *Open to challenge* on ordering.
3. **Consistency batch: F6, F5, F7.** Route dates through `utils/dateWita.js` (`todayWita()` already exists). Low individual impact, but it removes a whole class of "off by one day" surprises. Gorontalo is WITA, so the existing helpers are the right base.
4. **Safety batch: F4 (CSV), F9, F8 guards.** Small, contained changes; F4 is the only one with a security angle.
5. **Then G1 rules tests, G2 hooks/screens (Kiosk flow first), G4 CI** (adding `npm test` before deploy is welcome per Kifry's stance). Current stance: rules before screens because a rules mistake is silent. *Open to challenge.*
6. **Habit going forward:** when a session adds or changes logic in a pure helper or a repository, add or update its `*.test.js` in the same change and run `npm test` alongside lint and build. When a proposal above is adopted, switch its `it.fails(` to `it(`.

## 7. Notes on the test setup (for whoever maintains it)

- Tests import real source files; only `firebase/firestore`, `firebase/auth` and `src/firebase.js` are replaced (see the `vi.mock` lines at the top of each repository test).
- `fake.seed("collection", [{ id, ...fields }])` prepares data; `fake.ops` / `fake.find("classes/A")` show what would have been written; `fake.failCommit` and `fake.failWhen` simulate failures.
- The fake supports `==`, `>=`, `<=` and `in` filters only. If a new query needs another operator, extend `runQuery` in `firestoreFake.js`.
- Time-dependent code is tested with `vi.useFakeTimers()` + `vi.setSystemTime(...)`; WITA wall-clock times are built with a `+08:00` suffix.

## 8. Questions for Kifry (plain language, only what is still open)

1. Are the office computers, phones and the kiosk device set to automatic time zone (Gorontalo = WITA)? (affects how urgent F5–F7 are)

_Answered already: Friday is always off (kindergarten will be a separate app); "Everyday" batches run Saturday to Thursday; the company is in Gorontalo; stability-improving changes are welcome, including an automatic `npm test` check before deploy._

## 9. Agent notes (executing agent: please fill in)

_Accepted / adjusted / declined items, with reasons. Anything in this document that turned out to be wrong._

-
