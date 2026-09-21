# Audit — 4-Branch Multi-Campus Support
**Scope:** `Walkthrough_4-Branch_Multi-Campus_Support.md` vs. uploaded `myliberty-portal.zip`
**Method:** Static code review (grep + read) of every file the walkthrough named, plus a repo-wide search for the legacy alias string. No `npm install`/network in this environment, so `typecheck`/`lint`/`test`/`build` were **not re-run** — the walkthrough's green results are taken at face value, not independently verified.
**Note to executing agent:** nothing below is a mandate. Pick, reject, or counter-propose freely — these are flags for discussion, not a locked plan.

---

## Confirmed accurate
- `src/constants/branches.js` implements `BRANCHES`, `DEFAULT_BRANCH`, `normalizeBranch()`, `matchesBranchFilter()` as described.
- Every file the walkthrough lists exists and does reference these helpers, with two exceptions noted in Finding 1/2 below.
- `batchSchema.js` and `inviteSchema.js` both normalize `branch` at the schema layer via a Zod `.transform(normalizeBranch)` — this is the strongest pattern in the codebase; worth using as the template for the fixes below.

## Findings

### 1. Legacy alias `"Cabang Utama"` is still hardcoded outside the walkthrough's file list
The walkthrough doesn't mention these three files, but they all reference the old alias directly:
- `src/features/staff/invitesRepository.js` — `createInvite(email, role, branch = "Cabang Utama")`. Low risk in practice: the value passes through `inviteSchema.parse()` before writing, which normalizes it to `"Kota Gorontalo"`.
- `src/features/staff/todosRepository.js` — `createTodo({ ..., branch = "Cabang Utama" })`, and `branch: branch || "Cabang Utama"` written straight to Firestore with **no schema/normalization step**.
- `src/features/reports/reportsRepository.js` — `branch: user?.branch || data.branch || "Cabang Utama"`, a read-time fallback, also unnormalized.
- `src/features/staff/InvitesPanel.jsx` line ~332 — display fallback `{inv.branch || "Cabang Utama"}` instead of the canonical name.

**Why it matters:** `normalizeBranch()` happens to map this exact alias correctly, so nothing is visibly broken today. But any future code that does a strict string comparison instead of going through `matchesBranchFilter`/`normalizeBranch` will silently mismatch against these raw values.

**Options:**
- (a) Route `todosRepository.js` and `reportsRepository.js` through `normalizeBranch()`/`DEFAULT_BRANCH` the same way `batchSchema.js` does.
- (b) Leave as-is if these are slated for deprecation — worth confirming with the user first.
- (c) Add a grep-based CI/lint check that fails on new hardcoded `"Cabang Utama"` outside `branches.js` and its test file.

### 2. Instructor punctuality: missing-branch fallback is `""`, not normalized
`src/features/attendance/punctuality.js` line 303: `branch: inst?.branch || ""`.

**Why it matters:** `matchesBranchFilter()` returns `false` for an empty `itemBranch` against any specific branch filter (only `"all"` matches). An instructor record with a blank/unset branch will silently disappear from every per-branch view in `InstructorPunctualityTab` — no error, just a missing row.

**Options:**
- (a) Fall back to `DEFAULT_BRANCH` here for consistency with the rest of the app.
- (b) Keep `""` but surface an explicit "Unassigned branch" option in the filter so these rows stay visible.
- (c) Skip if current instructor data is already known to always have a branch set.

### 3. Test coverage gap lines up exactly with Findings 1–2
Every other repository file has a matching test (`shiftsRepository`, `paymentsRepository`, `invitesRepository`, `classesRepository`, `usersRepository`), but `todosRepository.js` and `reportsRepository.js` have none. The walkthrough's "415/415 tests passed" is accurate — it just never exercises the two files above.

**Options:**
- (a) Add minimal tests asserting these two files always persist/emit a canonical branch value.
- (b) Deprioritize if these are low-traffic paths.

### 4. Verification claims unconfirmed by this audit
`typecheck` / `lint` / `format:check` / `test` / `build` results in the walkthrough were not independently reproduced (no `node_modules`, no network in this environment). Treat that section as self-reported until re-run in an environment that has them.

---

## Not flagged
`branches.js` core logic, `batchSchema.js`, `inviteSchema.js`, and all reports/classes/staff/admissions UI files the walkthrough listed check out as described.
