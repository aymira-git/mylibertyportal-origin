# MYLIBERTY Portal — Audit Finding: Log Retention (Session: 2026-09-22)

Note for the executing agent: this is a separate item from
`audit-findings-2026-09-22.md` (findings 1–5, already implemented). Raised later in
the same session, kept in its own file since it's an infrastructure/housekeeping
concern rather than a form/UI bug.

---

## `errorLogs` and `shiftAuditEvents` grow forever — no cleanup exists

**Collections:** `errorLogs`, `shiftAuditEvents` (also worth the same treatment:
anything else logged over time, if more collections like this get added later)

**What's happening:** Checked the codebase for any TTL policy, Cloud Function, or
cleanup/purge logic — there is none. No `functions/` folder exists at all. Every
error log and shift audit event written to Firestore stays there permanently unless
someone manually deletes it in the console.

**Why this matters on this project specifically:** the app runs on Firebase's free
Spark plan (1 GiB storage, 20,000 deletes/day free). Log-type collections are exactly
the kind of data that grows quietly and unboundedly over time compared to normal
business data (students, classes), since every error and every shift action adds a
new document indefinitely.

**Constraint that shapes the fix:** Firestore's native TTL (automatic expiration)
policies and Cloud Functions (the normal way to run a scheduled "delete old docs"
job) **both require the Blaze plan** — i.e. a billing account on file — even if usage
stays entirely within the free quota. Given the whole point of this project is
staying on Spark with zero budget and zero card on file, a Blaze-dependent solution
defeats the purpose even if it wouldn't actually cost anything.

**Fix direction — stays on Spark, no billing account needed:** a client-side cleanup
control that queries these collections for documents older than a chosen cutoff and
deletes them via normal Firestore calls (manual deletes are a standard free-tier
operation — it's only the *automatic/managed* TTL deletion that requires billing).
Options, left open:
- A manual "Clear logs older than X days" button in an admin/settings screen.
- A semi-automatic version: check once a day (e.g. on admin login, against a stored
  "last cleanup" timestamp in a settings doc) and run the same deletion quietly in
  the background — still no server, no cron, no card, just app code checking a date.

**Retention window — decided:** 38 days (31 days + a 7-day grace period), so an admin
who checks monthly still has roughly a week's buffer to notice and physically archive
something before it's permanently deleted. Simplest implementation is a single cutoff
— delete anything older than 38 days — rather than a two-phase "flag at 31, delete at
38" system; the latter would need extra UI work (an "expiring soon" marker) for
little real benefit, and isn't needed unless the user specifically wants logs visibly
flagged before deletion.

**Still left open for the agent + user:** manual button vs. semi-automatic daily
check (the two options above).
