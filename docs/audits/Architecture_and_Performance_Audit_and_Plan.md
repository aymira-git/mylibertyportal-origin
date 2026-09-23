# Architecture & Performance — Audit and Plan

**Status:** Proposal, open for challenge
**Written by:** Claude (auditor), from a static read of `myliberty-portal.zip` (21 Sep 2026 upload)
**For:** the executing agent, with Kifry (no coding background, no budget for paid tools)

> Claude is AI and can make mistakes. This pass was reading-only — no `npm install`, no build, no
> Firebase console, no production data (this session's environment had no network access, unlike
> the audit behind `Reliability_and_Config_Hardening_Implementation_Plan.md`, which did run
> `npm ci`/`eslint`/`npm audit`). Everything below is [Read] evidence, not [Reproduced]. The
> executing agent should re-check anything before acting, and is free to disagree, re-scope, or
> reject any item below with a reason in "Agent notes."

---

## 0. The three questions this pass answers

1. Memory leaks, unclosed resources, or runaway loops that could cause degradation over time.
2. Architectural bottlenecks, tight coupling, or clean-code violations that threaten stability at scale.
3. Inefficient database queries, blocking synchronous code, or heavy computation under load.

## 1. Verdict per objective

1. **Memory leaks / unclosed resources — clean.** Every `onSnapshot` (19 across the app),
   `setInterval`/`setTimeout`, and `addEventListener` I could find has a matching cleanup in the
   `useEffect` return function, including the QR camera scanner in the attendance Kiosk
   (`scanner.clear()` runs both on a successful scan and on unmount). I did not find a runaway
   loop. This is a repeat of a "no news" verdict, and it's a real one, not a skipped check — see §3
   for exactly what was searched.
2. **Architectural bottlenecks / tight coupling — one concrete duplication, otherwise the
   `features/` domain structure holds up.** Dashboard data-fetching logic is implemented once in a
   shared hook and then re-implemented, slightly differently, inside `ManagerDashboard.jsx`. Detail
   in §2.1. Large-file size (a different axis of "clean code") is already its own doc
   (`Large_File_Splitting_Implementation_Plan.md`) and isn't repeated here.
3. **Database query efficiency — one clear over-fetch bug, plus one open question about a
   documented assumption.** `ManagerDashboard.jsx` subscribes to the *entire* `shifts` collection
   just to compute who's on duty right now (§2.2) — concrete, cheap to fix. Separately,
   `docs/ARCHITECTURE.md`'s existing "Data volume" section says only `shifts` and `attendance` grow
   without bound and everything else is "bounded by the size of the school." I think `applications`
   and `todos` may not fit that description either, since neither seems to delete finished records
   (§2.3) — flagging this as a question for the executing agent to confirm or refute, not asserting
   it as fact. No blocking synchronous code or O(n²) hot path was found; list-heavy screens
   (roster, staff directory, reports) already use `useMemo` and client-side pagination.

---

## 2. Findings

### 2.1 — Dashboard data-fetching is implemented twice [Read]

`src/features/dashboard/useDashboardData.js` is a shared hook that subscribes to `users`,
`classes`, `applications`, `todos`, `invites` with `onSnapshot`, with cleanup and per-listener
error handling. Other dashboards (`InstructorDashboard.jsx`, `useInstructorRoster.js`) use scoped,
purpose-built queries instead, which is a reasonable design choice.

`ManagerDashboard.jsx` (lines ~10–80) does neither — it hand-writes its own five `onSnapshot`
subscriptions (`users`, `classes`, `applications`, `shifts`, `todos`) with its own cleanup and its
own error handling, duplicating most of what `useDashboardData.js` already does. The two copies
have already started to drift: the `todos` permission-denied handling reads slightly differently in
each file.

**Why this matters at scale:** any future fix to listener error-handling, retry behavior, or
loading state (e.g. the kind of thing `Reliability_and_Config_Hardening_Implementation_Plan.md`
touches) has to be found and applied in two places, and it's easy to fix one and forget the other.

**Options, not a mandate:**
- Extend `useDashboardData.js` to take the small set of collections each dashboard actually needs,
  and have `ManagerDashboard.jsx` call it instead of hand-rolling its own.
- Or, if `ManagerDashboard` was deliberately kept separate for a reason I'm not seeing (timing,
  a subscription this hook shouldn't carry, historical accident) — leave it, and just bring the
  `todos` error-handling back in sync between the two copies so they don't silently diverge further.

### 2.2 — `ManagerDashboard.jsx` loads the whole `shifts` collection to answer "who's on duty" [Read]

```js
// ManagerDashboard.jsx
const unsubShifts = onSnapshot(collection(db, "shifts"), ...);   // no query, no limit
...
const onDutyStaff = useMemo(
  () => shifts.filter((s) => getShiftStatus(s) === "on_duty"),
  [shifts]
);
```

`docs/ARCHITECTURE.md` already states `shifts` is "one document per staff clock-in" and grows
without limit, and that Reports reads it through a date window for exactly this reason. This one
screen reads the same collection with no window at all, just to find the handful of currently-open
shifts. Every clock-in/out anyone has ever done, company-wide, is downloaded and held in memory on
this dashboard, and the whole listener re-fires on every single shift change anywhere in the
company, forever.

**This is the one finding in this pass I'd treat as a "just fix it," not a debate** — the read
matches an already-documented anti-pattern, and the fix is narrow and low-risk:

```js
const unsubShifts = onSnapshot(
  query(collection(db, "shifts"), where("clockOut", "==", null)),
  ...
);
```

That's the same shape of filter `fetchStaffShifts` already uses for "still-open shifts" in
`reportsRepository.js`, so it's not a new pattern for this codebase. Executing agent: please
double-check there's nothing else on this dashboard quietly relying on `shifts` holding closed
shifts too before narrowing it — I only traced the one `onDutyStaff` use.

### 2.3 — A question about `docs/ARCHITECTURE.md`'s own "Data volume" claim [Read, needs confirmation]

That section names `shifts` and `attendance` as the only two collections that grow without bound,
and says everything else is "bounded by the size of the school." From reading the repositories:

- `applications`: `deleteDoc` exists but is only wired to a "withdraw" action; approved/rejected
  applications stay in the collection with a `status` field, not removed.
- `todos`: `toggleTodoComplete` marks a todo done but doesn't delete it. I didn't find a scheduled
  cleanup or archival step for completed todos.

If that's right, both collections are closer in shape to "event log that accumulates for as long as
the school runs" than to "bounded by current headcount" — the same category `shifts` and
`attendance` are already in, just growing slower. Both are already fully subscribed with no filter
in `useDashboardData.js` and (for `applications`) again in `ManagerDashboard.jsx`.

**I'm not confident this is urgent** — a small school might produce a few hundred applications and
todos a year, which is nothing for Firestore or the browser for a long time. I'm flagging it because
it contradicts a stated architectural assumption, not because I've seen a symptom of it. Worth a
decision either way:
- Confirm the current volume is genuinely low and low-growth, and it's fine to leave as-is.
- Or add it to `ARCHITECTURE.md`'s "Data volume" section as a second-tier watch item, so a future
  session doesn't have to re-discover it.
- Or, if it's cheap, give `todos` the same treatment `shifts`/`attendance` got (only fetch open/recent ones on dashboards that don't need history), while leaving the full history readable from Reports if that's needed there.

### 2.4 — Minor, not worth a plan on its own

`ToastProvider.jsx`'s auto-dismiss `setTimeout` (line 25) is never cleared. In practice this is
harmless — the provider wraps the whole app for its entire lifetime, so the timer always fires
somewhere that still exists — but it's the one uncleared timer I found, for completeness.

---

## 3. What was checked and how [Read only, this session]

| Check | Method |
|---|---|
| All `onSnapshot` call sites (19) | grep, then read each one's `useEffect` for a `return () => unsub()` |
| All `setInterval`/`setTimeout` call sites | grep, checked each for a matching `clear*` |
| All `addEventListener` call sites | grep, checked each for a matching `removeEventListener` |
| Camera/QR resource use | traced `Html5QrcodeScanner` lifecycle in `Kiosk.jsx` |
| N+1 / per-item Firestore reads | grepped for `getDoc`/`getDocs` inside loops/`.map`/`.forEach` |
| Heavy computation without memoization | compared `useMemo` counts against `.filter`/`.map`/`.sort` counts in the largest list screens |
| Cross-file duplication | read `useDashboardData.js` against `ManagerDashboard.jsx`, `MarketingDashboard.jsx`, `InstructorDashboard.jsx`, `useInstructorRoster.js` |

Not done this session (no network access in this environment): running the app, a bundle/lint
pass, or checking real Firestore read counts in the Firebase console. If the executing agent has
console access, a cheap "reality check" for §2.2/§2.3 is the Firestore usage tab — it shows document
read counts per day and would confirm or quiet the concern in §2.3 without writing any code.

---

## Agent notes

**Status:** Resolved & Verified (21 Sep 2026)

1. **§2.2 (Manager Dashboard shifts over-fetching) — FIXED:**
   - Updated `ManagerDashboard.jsx` to query `where("clockOut", "==", null)` instead of the whole collection.
   - Verified that `ManagerDashboard` only consumes `shifts` to compute `activeShifts` (`on_duty` staff currently clocked in). Closed shifts were immediately discarded by `filter()` anyway. This change stops downloading unbounded historical records on the manager portal.

2. **§2.4 (Toast timer cleanup) — FIXED:**
   - Added active timer tracking using `useRef(new Set())` and an unmount cleanup in `ToastProvider.jsx`. Any in-flight dismiss timeouts are cleanly cancelled if the component unmounts.

3. **§2.1 (Dashboard data-fetching duplication) — CONFIRMED & RETAINED:**
   - Checked `useDashboardData.js` vs `ManagerDashboard.jsx`. `useDashboardData.js` couples Firestore subscriptions with form-editing state (`formData`, `emptyFormData`, `handleSave`, `handleEdit`, `deleteUserProfile`, `invites`), which are strictly needed for Admin and Front Office CRUD student/staff workflows. `ManagerDashboard` is an executive monitoring surface that does not manage user forms. Keeping `ManagerDashboard`'s lightweight query hook separate avoids bloating it with student form handlers. Error handling has been verified and harmonized.

4. **§2.3 (Data volume documentation) — DOCUMENTED:**
   - Updated `docs/ARCHITECTURE.md` to classify `applications` and `todos` as secondary accumulators. Documented that admins can permanently purge rejected applications, and noted archival strategies for completed todos if volume scales.

