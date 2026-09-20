# Large File Splitting — Implementation Plan

**Status:** Proposal, open for challenge
**Written by:** Claude (auditor), from one pass over `myliberty-portal.zip`
**For:** the executing agent, with Kifry (no coding background, no budget for paid tools)

> Claude is AI and can make mistakes. Every number, seam, and risk below comes from a quick read, not a full trace. The executing agent is invited to re-check, disagree, and counter-propose. Kifry is accountable for the final call and the auditor for the quality of this plan. Anything that looks wrong once the code is open should win over what is written here.

---

## 1. Why this is worth doing (current stance)

Kifry is uneasy about files with 1,000+ lines. The concern seems reasonable:

- A large file makes every edit riskier and every agent session more expensive, because the whole file is read each time.
- Bugs are slower to locate.
- Upcoming plans (Reports, Staff, Attendance) keep adding features to the same big files, so the problem grows if it waits.

The goal is **the same app behaving the same way, in smaller pieces**. No new features, no visual changes. If the agent thinks a split would change behavior somewhere, flagging it is more useful than working around it.

## 2. Snapshot (auditor's count, please re-run to confirm)

Counted with `wc -l` on `src/`. `dev-dist/workbox-*.js` (4,446 lines) is auto-generated and is left out of this plan; the agent may want to check whether `dev-dist/` belongs in the zip/repo at all.

| Lines | File | Rough shape |
|---|---|---|
| 1,629 | `reports/ReportsDashboard.jsx` | One component holding 5 sub-tabs (today, staff, students, admissions, instructors), each with its own state and fetch |
| 1,170 | `classes/ClassManager.jsx` | Batch card view + cohort roster table (desktop table + mobile cards) + many handlers, all in one component |
| 1,144 | `dashboard/ManagerDashboard.jsx` | Already has 4 inner components (`ManagerOverview`, `MyTeachingCohortsView`, `ClassesAndCoverageTab`, `StaffDirectivesTab`) sitting in the same file |
| 1,135 | `students/StudentRoster.jsx` | Mobile card list (~120 lines) + desktop table (~300 lines) + filters + handlers |
| 876 | `classes/AvailableBatches.jsx` | Widget mode + full page mode + batch card grid |
| 819 | `finance/PaymentModal.jsx` | 3 tabs (record / history / receipt) in one modal |
| 778 | `dashboard/InstructorDashboard.jsx` | 3 inner components (`InstructorOverview`, `InstructorClasses`, `InstructorProgress`) |
| 713 | `students/StudentApplications.jsx` | Not inspected, listed for completeness |

**Suggested size target (soft):** roughly 300–500 lines per file. This is a rule of thumb, not a law. A 600-line file that reads as one clear idea is a better result than three 200-line files that pass 12 props between them.

## 3. Ground rules the auditor believes matter (all open to debate)

1. **Behavior stays identical.** Reason: Kifry has no coding background and may find it hard to spot regressions by reading code, so "looks the same, works the same" is the most practical check available.
2. **One file per pass, one commit per pass.** Reason: if something breaks, only one change needs undoing. The agent may prefer a different grouping (for example, all three dashboards together).
3. **Keep import paths that `App.jsx` uses.** `App.jsx` lazy-loads each dashboard by path (`./features/dashboard/ManagerDashboard`, etc.), and `docs/ARCHITECTURE.md` explains this protects role-by-role code splitting. Splitting inside the same feature folder should not disturb that. If the agent sees a reason to touch it, that is worth raising with Kifry first.
4. **Follow the existing domain layout** in `docs/ARCHITECTURE.md` (feature folders, `index.js` as the public entry, `*Repository.js` for Firestore). New sub-folders such as `reports/tabs/` seem to fit, but the agent may know a better convention.
5. **No new libraries.** Reason: no budget, and fewer moving parts for a solo non-coder owner.

## 4. Safety net

There is no test script in `package.json`, only `build` and `lint`. Proposed checks after each pass:

1. `npm run lint` (or `bun run lint`) — no new warnings compared with before the pass.
2. `npm run build` — succeeds, and the bundle for the touched role dashboard does not balloon (a quick comparison of build output sizes before and after).
3. **Manual smoke check by Kifry (5 minutes per pass).** The agent writes a short click-through list for the screen it just touched, in plain language, for example "Open Reports → Staff tab → filter by role → open a shift → close it". Kifry runs it and replies "same" or "different: …".
4. Optional, agent's call: if the agent thinks a couple of tiny automated tests on the pure helper files (dates, at-risk logic) are cheap and useful, that is welcome. It is only worth it if it does not cost Kifry money or setup effort.

## 5. Per-file proposals

These are the auditor's guesses about where the natural seams are. The agent has the actual code open and is better placed to choose.

### 5.1 `ReportsDashboard.jsx` (1,629) — biggest, and the Reports plan is about to add to it

**Seams seen:** the JSX is already sliced by `subTab` blocks (today ≈ L807, staff ≈ L945, students ≈ L1250, admissions ≈ L1411, instructors ≈ L1514). Helpers at the top (`uniqueClasses`, `getStartOfTodayWitaIso`, `getTodayWitaString`) are pure functions.

**Proposal:**
- `reports/tabs/TodayTab.jsx`, `StaffDutyTab.jsx`, `StudentsTab.jsx`, `AdmissionsTab.jsx`, `InstructorsTab.jsx`
- `reports/reportsDates.js` for the WITA date helpers (the school timezone matters here, so moving them without changing them is the point)
- Parent keeps: `subTab`, `rangeDays`, `branchFilter`, the tab switcher, and the shared header/filters.

**Open question for the agent:** where should each tab's data state live?
- *Option A — state moves into each tab.* Simplest, smallest parent. Risk: switching tabs may now refetch (the tab remounts), which changes behavior and Firestore read counts.
- *Option B — small hooks per tab* (for example `useTodayScans()`), called from the parent, with the tab receiving data as props. Keeps current behavior, a bit more plumbing.
- *Option C — something else.* The agent may see a cleaner path.

Auditor leans B for behavior safety, with low confidence.

**Sequencing question:** the Reports plan in `docs/` will keep editing this file. Auditor's current stance is to split first so the new work lands in smaller files. The counter-argument (do the feature work first, split after) is also reasonable if the plan is close to done.

### 5.2 `ClassManager.jsx` (1,170)

**Seams seen:** `renderBatchCard` (≈ L386–L660) is an inner render function that could become a `BatchCard` component. The roster view has a desktop table (≈ L904) and mobile cards (≈ L1062). The KPI/grouping `useMemo` blocks (≈ L92–L210) are logic that could live in a helper or hook.

**Proposal:** `BatchCard.jsx`, `CohortRosterTable.jsx` (with desktop and mobile parts), `classManagerStats.js` (or a hook) for the grouping/KPI math. Handlers that call repositories (`handleDeleteClass`, `handleAddStudentToClass`, …) could stay in the parent at first.

**Possible duplicates for the agent to verify:**
- `openWhatsAppParentChat` exists in both `ClassManager.jsx` and `StudentRoster.jsx`, and the **argument order differs** between them. A shared helper is tempting, but the merge needs care with that difference.
- `ManagerDashboard.jsx` has `ClassesAndCoverageTab` with the same `viewMode` "batches"/"roster" idea. It might overlap with `ClassManager`, or it might be intentionally read-only. Not verified.

### 5.3 `ManagerDashboard.jsx` (1,144) and `InstructorDashboard.jsx` (778)

**Seams seen:** both already contain named inner components, so the split is mostly moving each into its own file.

**Proposal:** a per-dashboard folder, for example `dashboard/manager/` and `dashboard/instructor/`, with the main dashboard file keeping only the tab state and data loading. `formatTime` / `formatPunctuality` at the top of `ManagerDashboard.jsx` may already exist in `attendance/punctuality.js`; worth a look before copying anything.

**Open question:** `useDashboardData.js` already exists. Should Manager's data loading (`useEffect` at ≈ L917) move into that pattern, or is a Manager-specific hook better? The agent knows the data shapes better.

### 5.4 `StudentRoster.jsx` (1,135)

**Seams seen:** clear JSX regions: header, search, filter bar, mobile card list (≈ L552), desktop table (≈ L798), pagination, modals. Badge helpers at the top (`getHealthBadgeClasses`, `getStatusBadge`, …).

**Proposal:** `StudentRosterMobileList.jsx`, `StudentRosterTable.jsx`, `StudentRosterFilters.jsx`, and `studentRosterBadges.js` for the helpers. Handlers such as `handleStatusChange` and `handleDeleteStudent` touch the status-lifecycle rules (see the status audit), so keeping them in the parent until the rest is stable may be the calmer choice. Agent's call.

### 5.5 `AvailableBatches.jsx` (876) and `PaymentModal.jsx` (819)

- **AvailableBatches:** widget mode (≈ L331–L457) and full-page mode (≈ L459+) could be two components with a shared `BatchCard`. Worth checking whether this card and the `ClassManager` card should share a base.
- **PaymentModal:** three tabs map naturally to `RecordPaymentTab`, `PaymentHistoryTab`, `ReceiptTab`. This file handles money and receipts, so the auditor suggests extra care and a longer smoke checklist (record → history → receipt → print/share). Suggested to go later in the order, after the pattern is proven on safer screens.

### 5.6 Everything under ~700 lines

Not proposed for now. Revisit once the top files are done and the agent has a feel for what "small enough" looks like in this codebase.

## 6. Suggested order (one option among several)

1. `PaymentModal.jsx` **or** `InstructorDashboard.jsx` as a warm-up (the seams are obvious, so the pattern gets tested on a low-risk target). Agent may prefer another warm-up.
2. `ReportsDashboard.jsx`
3. `ManagerDashboard.jsx`
4. `ClassManager.jsx` + `AvailableBatches.jsx` (share a card, so they pair well)
5. `StudentRoster.jsx`
6. `PaymentModal.jsx` (if not used as the warm-up)

Reason for the ordering: prove the method cheaply, then hit the biggest file before more features pile onto it. If the agent sees a better order, that is welcome.

## 7. Definition of done (per pass)

- Lint and build results are equal or better than before.
- The touched file is smaller, and each new file reads as one idea.
- Kifry's smoke check came back "same".
- The agent leaves a 3–5 line note at the bottom of this file: what moved where, anything surprising, anything that should be double-checked later.

## 8. Things the auditor might have gotten wrong

- Line numbers are approximate and may shift.
- "Same behavior" is assumed to be achievable everywhere, but some inline closures over parent state may make certain splits noisier than they look.
- Duplicate-code suspicions (WhatsApp helper, Manager vs ClassManager views, punctuality helpers) come from names and a quick grep, not from reading both sides.
- Only the top ~6 files were opened for structure. `StudentApplications.jsx`, `StaffDirectory.jsx`, `UserForm.jsx` and `Kiosk.jsx` (all 580–710 lines) were not looked at.

Corrections, better ideas, and reasoned disagreement are all welcome. A short note back to Kifry explaining the counter-proposal is enough.
