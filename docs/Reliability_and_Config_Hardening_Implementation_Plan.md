# Reliability & Config Hardening — Implementation Plan

**Source:** code-health audit of `myliberty-portal.zip` (snapshot of 21 Sep 2026)
**Auditor:** Claude (reviewing on behalf of Kifry) — **Executor:** the implementing agent
**Purpose:** answer three questions — (1) missing error handling, (2) crash / null edge cases, (3) secrets and fragile config — and give the executor a ready list to work from.

> **How to read this plan.** Claude is AI and can make mistakes, so every finding here is a claim to be checked, not a verdict. The executor is encouraged to re-test each item, challenge the suggested direction, propose something better, or reject a finding with a reason. Kifry (no coding background, no budget) relies on both the auditor and the executor double-checking each other. Where a "suggested direction" appears, it is one option among several. Where a "current stance" appears, it is Kifry's present preference plus the reason, and it is open to challenge.

---

## 0. What was checked and how

| Check | Result |
|---|---|
| `npm ci` on Node 22, `eslint src` | 0 lint problems |
| `vite build` with **no** `.env` (mimics GitHub Actions) | succeeds |
| `npm audit --omit=dev` | 0 known vulnerabilities |
| Babel AST scan of every file in `src/` | empty catch blocks, catch blocks without `console`, awaits outside `try`, `onSnapshot` without error callback, `.then` without `.catch`, unguarded `JSON.parse` |
| Secret-pattern grep over the whole zip | only the Firebase web key (public by design, see C1) |
| Date/timezone behaviour | reproduced in Node with `TZ=Asia/Makassar`, `TZ=UTC`, `TZ=America/New_York` |
| Rules vs. code | every collection the code touches has a matching rule block; no query needing an unlisted composite index was found by reading |

Evidence tags used below: **[Reproduced]** = ran it and saw the result; **[Read]** = from reading code only; **[Console]** = needs someone to look at a dashboard (Firebase, GitHub, Cloudflare, Cloudinary).

## 1. Verdict per objective

1. **Error handling — mostly healthy.** Roughly 100 `catch` sites, every Firestore write reachable from a UI handler is wrapped, 18 of 19 snapshot listeners have error callbacks, each dashboard sits inside an `ErrorBoundary`. Remaining gaps are narrow (section B): no root-level boundary, four un-caught `signOut().then()` calls, un-awaited clipboard writes that show a false "Copied!", and about 50 catch blocks that toast the raw message but never log it.
2. **Crash / null risk — the bigger finding is date and timezone logic, not missing null checks.** Three reproduced defects (A1–A3) affect attendance audit data, "Today" report windows, and the payment modal. Plain null-pointer risk is low; two `className.toLowerCase()` spots are the only unguarded field accesses found.
3. **Secrets and config — no real secrets in the repo.** The fragility is elsewhere: every Firebase setting silently falls back to the production project, the CI build ships without `VITE_AI_WORKER_URL`, Node is not pinned in CI, the AI Worker allows any origin, and the Cloudinary upload preset is public by nature.

---

## 2. Findings

### A. Reproduced defects (highest value)

**A1 — Shift adjustment modal shifts times by the UTC offset** · Severity: High (audit-trail data) · [Reproduced]
- **Where:** `src/features/attendance/ShiftAdjustmentModal.jsx` lines 22, 25, 71 (and the `new Date(clockIn)` parse at lines 45–46).
- **What happens:** the modal fills `<input type="datetime-local">` with `toISOString().slice(0,16)`, which is **UTC**. The input treats it as **local** time, and on save `new Date(clockIn)` reads it as local again. Under `TZ=Asia/Makassar`: stored `2026-09-20T01:00Z` (09:00 WITA) → input shows `01:00` → saving with no edits writes `2026-09-19T17:00Z`, i.e. 8 hours earlier. The "Force clock-out now" button (line 71) has the same offset problem. The change is also recorded in `shiftAuditEvents`, so the audit trail stores the wrong values.
- **Suggested direction:** format to local wall-clock for the input (for example date-fns `format(new Date(iso), "yyyy-MM-dd'T'HH:mm")`) and confirm `Number.isFinite(date.getTime())` before calling `toISOString()`.
- **Open for the executor:** whether to treat already-adjusted shifts as needing a data review. Kifry can look at `shifts` where `corrected == true`.

**A2 — "Today" window helpers are correct only when the browser runs in UTC** · Severity: Medium-High · [Reproduced]
- **Where:** `src/features/reports/reportsUtils.js` — `getStartOfTodayWitaIso()` (lines 16–22) and `getTodayWitaString()` (lines 24–29).
- **What happens:** the code shifts the timestamp by `getTimezoneOffset()` and then calls `setHours(0,0,0,0)` (local) and `toISOString()` (UTC). On a device already in WITA, "start of today" comes out as `2026-09-20T08:00Z` (16:00 WITA **yesterday**); expected `2026-09-20T16:00Z`. In UTC it is right; in New York it is off by 4 hours. `getTodayWitaString()` returns yesterday's date between 00:00 and 08:00 WITA. Effect: the "Today" tab and anything built on it can include the previous afternoon's scans.
- **Suggested direction:** WITA has no daylight-saving, so a constant +8h offset applied with UTC getters is sufficient; `Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Makassar" })` is an alternative. One shared helper module keeps A1, A2 and A5 consistent.
- **Open for the executor:** whether other report code (`TodayTab`, `atRisk.js`, `punctuality.js`) relies on the buggy boundary in a way that changes numbers users have already seen.

**A3 — Payment dates: malformed data shows "Active", blank custom date crashes the modal** · Severity: Medium · [Reproduced with date-fns 4]
- **Where:** `src/constants/paymentPlans.js` (`getPaymentHealthStatus`, `calculateExpiryDate`, `calculateCoveragePeriod`), `src/features/finance/PaymentModal.jsx` lines 36–38 and 62, `src/features/finance/RecordPaymentTab.jsx` lines 214 and 222.
- **What happens:** `parseISO()` does not throw on bad input, it returns an Invalid Date. Therefore (a) the `try/catch` in `getPaymentHealthStatus` never triggers; a malformed `paidUntil` (`""`, `"2026-13-45"`, `"October 2026"`) produces `remainingDays = NaN`, and because `NaN < 0` and `NaN <= 14` are both false, the student is labelled **Active**; (b) `format()` on an Invalid Date throws `RangeError`, so a malformed `paidUntil` crashes `PaymentModal` at render (line 37), and choosing the Custom plan then clearing the start-date input crashes `RecordPaymentTab` at render (lines 214/222). The dashboard's `ErrorBoundary` catches it, but the modal state is lost.
- **Suggested direction:** guard with date-fns `isValid()` in the three helpers (return `null` or a "—" label), and make `getPaymentHealthStatus` return the "No Plan Set" state when the date is invalid.
- **Open for the executor:** whether "invalid" should be a distinct status (for example "Check date") so front office notices bad data.

**A4 — Malformed class `startTime` blocks instructor clock-in** · Severity: Low-Medium (needs bad data) · [Reproduced]
- **Where:** `src/features/attendance/punctuality.js` lines 53–61 (`getInstantPunctuality`) and 157 (monthly stats).
- **What happens:** `"9am".split(":").map(Number)` gives `NaN`, `setHours(NaN)` gives an Invalid Date, and `toISOString()` throws `RangeError: Invalid time value`. The kiosk shows "Clock-in Error" for that class and the instructor cannot clock in against it. Likelihood depends on whether `startTime` can ever be non-`HH:mm` (legacy documents, console edits).
- **Suggested direction:** validate `hours/minutes` with `Number.isFinite` and fall back to the "Unscheduled" result.

**A5 — Default "today" dates use the UTC date** · Severity: Low · [Read + reproduced pattern]
- About 20 sites use `new Date().toISOString().slice(0, 10)` as today's date: `StaffLeaveModal.jsx:20`, `classesRepository.js:76`, `BatchCard.jsx:39/55/60`, `BatchModal.jsx:37`, `EnrollModal.jsx:24/89`, `TransferModal.jsx:32/119/129`, `ClassManager.jsx:124`, `applicationsRepository.js:61`, `StudentProgressForm.jsx:24` (plus two export file names). Between 00:00 and 08:00 WITA they give yesterday's date.
- **Suggested direction:** one shared `todayWita()` helper, adopted gradually. Low urgency because front office hours rarely reach those times.
- Related assumption for the executor to confirm: punctuality and the `setHours(0,0,0,0)` calls in `TasksPanel`, `StaffDirectivesWidget`, `OfficeBoyDashboard` assume the **device** timezone is WITA. That holds for staff phones in Manado; a phone set to another timezone would shift results.

### B. Error-handling gaps

**B1 — No root `ErrorBoundary`, no global error hooks, no visibility** · [Read]
- `src/main.jsx` renders `<App />` bare; an exception in the top bar or in `refreshProfile` rendering would show a white page. `/register` and `/join/*` and each dashboard are wrapped, so exposure is limited to the shell.
- `ErrorBoundary.componentDidCatch` logs to the console only, so Kifry never learns what staff hit. No `window` `error` / `unhandledrejection` listeners exist.
- **Suggested direction:** wrap the root; add one small `reportError(error, context)` helper. For a zero-budget setup the options include console-only, a tiny Firestore `clientErrors` collection (needs a rule and a retention idea), or a free-tier error service. The executor is invited to weigh cost, privacy and complexity.

**B2 — `signOut(auth).then(...)` without `.catch`, four places** · [Read]
- `App.jsx` lines 64 (idle timeout), 137 (deactivation listener), 242 and 342 (Logout buttons). If `signOut` rejects, the idle logout silently fails and the Logout button appears dead.
- **Suggested direction:** one `handleLogout` with `try/catch/finally` that clears local state either way.

**B3 — Auth listener hides profile-load failures** · [Read]
- `App.jsx` lines 107–123: if `refreshProfile` throws (offline, permission), the catch only logs, `user` stays `null`, `checkingAuth` becomes `false`, and a person with a valid session sees the **login page** with no explanation.
- Signed-out branch resets `role` and `nickname` but not `displayName` / `photoURL`, so a previous user's name or photo can linger on a shared device until the next profile load overwrites it.
- **Suggested direction:** a small "couldn't load your profile — retry / sign out" state, and reset all profile state together.

**B4 — Clipboard writes are not awaited, success toast is shown regardless** · [Read]
- `AIAssistant.jsx:72`, `StaffDirectory.jsx:109`, `InvitesPanel.jsx:121`, `BatchOutreachPanel.jsx:81`, plus the guarded-but-unawaited `AvailableBatches.jsx:202` and `MarketingDashboard.jsx:26`. `navigator.clipboard.writeText` rejects in some in-app browsers and non-secure contexts, giving a false "copied" message and an unhandled rejection. The invite link (`InvitesPanel`) matters most.
- **Suggested direction:** one shared `copyText(text)` helper (await, fallback, error result) used by all six.

**B5 — One listener without an error callback** · [Read]
- `InstructorDashboard.jsx:51` subscribes to the whole `classes` collection with no error handler; the other 18 listeners have one. It also downloads every class for every instructor (see D1).

**B6 — About 50 catch blocks toast raw `err.message` without logging** · [Read]
- Pattern: `toast("Error saving payment: " + err.message)`. Staff see text like "Firebase: Error (auth/invalid-credential)." and Kifry has no trace. `handleLogin` in `App.jsx:180` is the most visible case.
- **Suggested direction:** extend the B1 helper to log with context and map common Firebase codes to plain sentences; adopt file by file rather than one large sweep.
- The four empty catches (`Kiosk.jsx:307`, `soundEffects.js:47/73`, `mobileUtils.js:20`) are intentional and reviewed as acceptable. One nuance: `Html5QrcodeScanner.clear()` returns a Promise, so the synchronous `try/catch` around it does not catch a rejection.

**B7 — AI assistant client parsing** · [Read]
- `AIAssistant.jsx:57` calls `res.json()` before checking `res.ok`; a non-JSON error page (for example from Cloudflare) surfaces as a raw `SyntaxError` message. Worker `worker.js:102` returns `200` with empty text when Gemini blocks a response; the client already shows a fallback line for that.

**B8 — Kiosk QR content goes straight into `doc(db, "users", value)`** · [Read]
- `Kiosk.jsx:158–162`: a QR that is not a badge (a URL contains `/`) makes `doc()` throw "Invalid document reference", shown as "Scanner Error" with a raw SDK message. Caught, but unfriendly. Suggested: check the scanned value looks like a user id before the lookup and show "Not a MY LIBERTY badge".

**B9 — Two `className.toLowerCase()` calls without a guard** · [Read]
- `CohortRosterTable.jsx:92` and `LearnerProgressTab.jsx:160`. A class document missing `className` crashes the render while typing in search. Suggested: `(x.className || "")`.

**B10 — Staff signup can leave an Auth account without a profile** · [Read, already documented in code]
- `StaffSignup.jsx` and `usersRepository.createStaffAccount` explain the Auth/Firestore gap and show a clear message. Open idea for the executor: on `auth/email-already-in-use` during an unused invite, offer "sign in and finish profile" so an admin does not need the Firebase console.

### C. Secrets and configuration

**C1 — What is and is not a secret** · [Read + grep]
- No private keys, service-account JSON, Gemini key, or tokens found in the zip. The Gemini key lives only as a Cloudflare secret; the Apps Script reads its service-account key from Script Properties. Both are the right pattern.
- `src/firebase.js` contains the Firebase web config, including the `AIza…` API key. That key identifies the project and is designed to be public; protection comes from Firestore rules and, ideally, HTTP-referrer restrictions on the key (see section 4, item 2). It is listed here so the executor need not spend time on it.

**C2 — Every Firebase setting silently falls back to production** · Severity: Medium · [Read]
- `src/firebase.js` lines 6–11: `import.meta.env.X || "<production literal>"` for all six values. A developer or agent running `npm run dev` without `.env` connects to the **live** database and can write test data into it. It also makes `.env.example` misleading, since the values look required but are not.
- **Suggested direction (options, all open):** (a) keep the public values in a documented `config.js` and drop the `.env` pretence; (b) require env and show a readable "Configuration problem — missing VITE_…" screen at startup; (c) add a second free Firebase project for development and point `.env` at it. Current stance from Kifry: no budget, so free tiers only; a second Spark-plan project fits that.

**C3 — CI builds ship without `VITE_AI_WORKER_URL`** · Severity: Medium · [Reproduced build, deployment path needs a check]
- Neither workflow (`.github/workflows/firebase-hosting-*.yml`) sets any `VITE_*` variable. A build with no env compiles fine and bakes the AI Worker URL in as an empty string, so the AI Assistant tab shows "isn't configured yet" for every role. That would only be avoided if production is deployed from a machine that has a `.env`.
- **Question for Kifry (section 4, item 6):** is production deployed by GitHub Actions or by hand?
- **Suggested direction:** pass the URL through a GitHub repository *variable* (it is a URL, not a secret) into the build step with `env:`.

**C4 — No startup validation of configuration** · [Read]
- The only env check is inside the AI Assistant click handler (`AIAssistant.jsx:39`). The Worker does not check that `GEMINI_API_KEY` exists (`worker.js:89`); a missing secret reaches Google as `undefined` and returns an unclear 502.
- **Suggested direction:** a single `src/config.js` that reads, validates and exports settings; a Worker check that returns a clear "server not configured" error.

**C5 — Build toolchain not pinned** · [Read]
- Workflows call `actions/checkout` then `npm ci` with no `actions/setup-node`, and `package.json` has no `engines`. Vite 8 and ESLint 10 need a recent Node; a runner image change could break deploys. The audit build succeeded on Node 22.
- The repo has both `package-lock.json` and `bun.lock`; CI uses npm, so `bun.lock` can drift. Suggested: choose one lockfile and pin Node to the tested major.

**C6 — Cloudflare AI Worker** · [Read]
- `wrangler.toml`: `ALLOWED_ORIGIN = "*"` (its own comment marks it as temporary). The Firebase token check does protect Gemini spend, but the Worker accepts **any** signed-in user of the project regardless of role and has no rate limit. It is worth Kifry confirming whether student accounts can sign in at all.
- **Suggested direction:** set the origin to the production domain(s) plus localhost, consider a role claim or allow-list, and consider a per-user daily cap using free Cloudflare features. Privacy note for Kifry to weigh: instructor notes sent to the assistant leave the school's systems for Google's Gemini service.

**C7 — Cloudinary unsigned upload preset** · [Read; settings need a console check]
- `cloudinaryUpload.js` hardcodes `CLOUD_NAME` and `UPLOAD_PRESET`. An unsigned preset is usable by anyone who reads the bundle, so anyone can upload to the school's Cloudinary account and consume free-tier storage or bandwidth. Student photos are served from public URLs.
- **Suggested direction:** restrict the preset in the Cloudinary dashboard (allowed formats, maximum size, target folder); move the two values to env/config for consistency; consider signed uploads through the Worker later if abuse appears.

**C8 — Firestore rules worth a second look** · [Read; test with the emulator or a staging project before deploying]
- `firestore.rules` lines 81–83: `invites` `allow update: if true && …` lets an unauthenticated caller who knows a token mark it used. The app never calls `updateDoc` on invites (signup deletes them), so the rule looks like dead surface.
- Line 115: `todos` `allow update: if isStaff()` has no field restriction, so any staff role can edit any directive's text, assignee or priority; the comment says the intent is completion toggles. `toggleTodoComplete` touches four known keys, so an `affectedKeys().hasOnly([...])` branch for non-issuers looks feasible while admin/manager/frontoffice keep full update.
- Verified as sound: every collection used in code has a rule block; the catch-all denies the rest; `attendance`/`shifts` creates check the target user's role.

**C9 — Repository hygiene** · [Read; visibility needs a console check]
- `.gitconfig` (contains a personal email and name) sits in the project root and is not in `.gitignore` (unlike `.idea/`, `.vscode/`, `*.code-workspace`). The footer links to `github.com/aymira-git/mylibertyportal-public`; if that repository is public, `docs/`, `firestore.rules`, the Worker code and any committed `.gitconfig` are readable by anyone.
- `docs/` contains duplicate plan names (`Staff_Directory_…` next to `Staff Directory & …`, same for Directives) and a filename with an em dash that unzipped with a name mismatch on Linux. ASCII-only names would avoid CI or tooling surprises.
- Hardcoded external references worth moving into one constants file: the Google Sheet link (`StudentApplications.jsx:206`), the Google Form URL (`RegistrationPage.jsx:13`), `https://myliberty.id/register` fallback (`AvailableBatches.jsx:184`, `MarketingDashboard.jsx:22`).

**C10 — Optional hosting headers** · [Read]
- `firebase.json` sets no security headers (CSP, `frame-ancestors`, Referrer-Policy). A strict CSP would need to allow Cloudinary, Google Fonts and the Google Forms iframe; the executor can judge whether the benefit is worth the tuning effort.

### D. Watch list (not defects today)

- **D1 — Free-plan read quota.** Reports and some dashboards read entire collections (`fetchStaffShifts` reads all shifts and all users; `InstructorDashboard` reads all classes; `fetchInstructorAnalyticsData` reads all shifts for admins). The Firebase free plan has a daily read allowance (Kifry to confirm the current figure in the Usage tab); once exceeded, Firestore returns `resource-exhausted` and the app looks broken to everyone. Growth in students and shifts moves toward that limit. Suggested: watch Usage, then consider date-bounded queries or caching for the heaviest tabs.
- **D2 — Idle logout at kiosk stations.** `App.jsx` signs out after 30 minutes without mouse/keyboard/touch events. A reception device waiting for scans may reach that between scans. Worth checking with the people using it.
- **D3 — `crypto.randomUUID()` in `invitesRepository.js:13`** needs a secure context; a phone opening the dev server over plain `http://<LAN-ip>` will fail to create invites (production HTTPS is fine).
- **D4 — `enableIndexedDbPersistence`** is a legacy API (still present in the installed Firebase); errors other than the two handled codes are swallowed silently.

---

## 3. Suggested batching (open to reordering)

| Batch | Contents | Notes |
|---|---|---|
| 1. Time helpers | A1, A2, A4, A5 | One shared date helper module; A1 and A2 first because they touch stored and reported data |
| 2. Payment date guards | A3 | Small, self-contained |
| 3. Error plumbing | B1, B2, B3, B4, B6 (start with a few files), B8, B9 | Shared `reportError` and `copyText` helpers, then adopt |
| 4. Config | C2, C3, C4, C5 (and C6 Worker checks) | Depends on Kifry's answer about how production is deployed |
| 5. Rules | C8 | Test before `firebase deploy --only firestore:rules` |
| 6. Kifry-side checks | Section 4 | Independent of code; can run in parallel |

The executor may merge, split, or reorder these, and is welcome to add items this audit missed.

## 4. Kifry-side checks (dashboards only, no code)

1. **GitHub repo visibility:** repository → Settings → General → bottom "Danger Zone" shows Public or Private. If Public, tell the executor (affects C9).
2. **Firebase API key restriction:** Google Cloud Console → APIs & Services → Credentials → the browser API key → Application restrictions: HTTP referrers → the production domain(s) and `localhost`. Share what is currently set.
3. **Cloudinary preset:** Settings → Upload → Upload presets → `mylibertyies-f2f38`: note allowed formats, maximum file size, and folder.
4. **Cloudflare Worker:** Workers → `myliberty-ai-proxy` → Settings → Variables: confirm the `GEMINI_API_KEY` secret exists and read out the `ALLOWED_ORIGIN` value.
5. **Firebase usage:** Firestore → Usage tab: reads per day compared with the free allowance.
6. **How is production deployed?** GitHub Actions on merge to `main`, or `firebase deploy` from a computer? If Actions, where does `VITE_AI_WORKER_URL` come from today?
7. **Apps Script service account:** in Google Cloud → IAM, note the role given to the `FormSync.gs` service account (a narrow Firestore role is preferable to a broad one).
8. **Existing adjusted shifts (A1):** in Firestore, filter `shifts` by `corrected == true` and see whether any times look 8 hours off.

## 5. Verification recipes for the executor

- **A1:** run `TZ=Asia/Makassar node -e` with an ISO value through the old and new input formatting; the round trip with no edits should return the original instant. Repeat under `TZ=UTC`.
- **A2:** fake `Date` to `2026-09-21T02:00:00Z` and assert the start-of-day ISO equals `2026-09-20T16:00:00.000Z` under `TZ=Asia/Makassar`, `TZ=UTC` and `TZ=America/New_York`; assert the date string is `2026-09-21` at `2026-09-20T20:00:00Z`.
- **A3:** call the three payment helpers with `""`, `"2026-13-45"`, `"October 2026"`, `undefined`, `"2026-10-05"`; none should throw and the first four should not report "Active".
- **B-items:** simulate `signOut` rejecting and `navigator.clipboard.writeText` rejecting; confirm the UI tells the truth.
- **C3:** after the workflow change, open the deployed AI Assistant tab; it should no longer show "isn't configured yet".
- **C8:** exercise the changed rules with the Firebase emulator (needs Java) or a scratch Firebase project, using an officeboy account against `todos` and an unauthenticated request against `invites`.
- Always finish with `npm run lint` and `npm run build`; both pass on the current snapshot.

## 6. Where the auditor may be wrong (please challenge)

- A2 and A5 assume staff devices run in WITA. If the real setup differs, the impact analysis changes.
- A4 assumes `startTime` can reach the database in a non-`HH:mm` form; the input in `BatchModal` may already prevent that.
- C6 assumes student accounts might authenticate; if students never sign in, the Worker exposure is smaller than described.
- C8 is based on reading the rules only; a behaviour test may show a rule already behaves differently from how it reads.
- The "about 50 catch blocks" count comes from the AST scan's heuristics; the exact number is less important than the pattern.
- Anything listed under "Verified as sound" was checked by reading, not by an exhaustive test.
