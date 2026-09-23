# Full System Architecture & Scalability Audit

> **Purpose:** This is the deep audit procedure for MYLIBERTY.
>
> **Declared architecture:** `docs/ARCHITECTURE.md`
>
> **Agent working rules:** `CLAUDE.md`
>
> The audit is specifically designed to detect not only code defects, but also **architecture drift**: places where the documented architecture, implemented architecture, and real operational behavior no longer agree.

## Audit Mode

This is an **audit**, not a feature-development task.

Unless explicitly instructed otherwise:

- do not modify production code;
- do not “fix” findings during the audit;
- do not rewrite architecture merely to make it look cleaner;
- do not suppress inconvenient findings because they are old;
- do not treat documentation as proof that implementation matches it.

Produce the evidence and findings first.

---

# 1. Audit Principles

## Read the whole system before judging it

Inspect the repository broadly enough to understand:

- frontend structure;
- routing;
- authentication;
- authorization;
- Firestore collections and document relationships;
- repositories/data access;
- schemas/validation;
- shared infrastructure;
- hooks/state;
- dashboards;
- Workers/Cloud Functions if present;
- Firebase configuration;
- Firestore rules;
- Firestore indexes;
- environment/configuration;
- tests;
- build tooling;
- PWA/service worker behavior;
- logging;
- retention mechanisms;
- deployment paths.

Follow important flows end-to-end:

```text
user action
  ↓
UI
  ↓
state/hook
  ↓
validation
  ↓
repository/data-access
  ↓
Firestore/API/Worker
  ↓
response/subscription
  ↓
UI state
```

Identify where assumptions, validation, authorization, concurrency handling, or error handling disappear.

---

# 2. Architecture Drift Audit

This is mandatory.

Compare:

### A. Declared architecture

What `docs/ARCHITECTURE.md` says the system is.

### B. Implemented architecture

What the source code actually does.

### C. Runtime/configuration architecture

What deployment/configuration/test setup implies.

Report findings under these categories:

- **Documented and accurate**
- **Documented but stale**
- **Implemented but undocumented**
- **Contradictory**
- **Unverified — requires runtime/load/production verification**

Examples of drift to look for:

- architecture says all Firestore access is in repositories, but components bypass them;
- architecture says a legacy directory is unused, but current imports still reference it;
- a new feature/domain exists but is absent from architecture documentation;
- manager/reporting workflows depend on data contracts not described in the guide;
- security rules changed but the architecture guide still describes older role semantics.

Do not silently reconcile these differences.

---

# 3. Architecture Integrity Audit

Determine whether the architecture is internally coherent.

Look for:

- duplicated business logic;
- UI components containing persistence logic that should be centralized;
- repositories bypassed by new direct Firestore access;
- duplicated schemas;
- multiple sources of truth;
- derived state stored unnecessarily;
- state synchronization assumptions;
- circular dependencies;
- hidden coupling;
- undocumented side effects;
- role dashboards duplicating business logic;
- shared utilities that have become hidden domain owners;
- abstractions that are declared but not respected.

For every significant finding:

```text
Assumption
→ Actual behavior
→ Failure mode
→ Impact
→ Recommendation
```

---

# 4. Business / Logic Flow Audit

Trace important business workflows from beginning to end.

At minimum inspect:

- authentication/onboarding;
- student application/intake;
- student/class relationships;
- attendance and shifts;
- leave;
- payments;
- staff directives/tasks;
- corporate event attendance;
- school outreach;
- manager outreach tracking;
- reporting/analytics;
- error/audit logging.

For each workflow ask:

1. What starts it?
2. Where is the authoritative record created?
3. What updates related records?
4. What closes/completes the workflow?
5. What happens if the workflow is interrupted?
6. What happens if the same action is submitted twice?
7. What happens if another user changes the same data at the same time?
8. What can the user see that the database does not actually contain?
9. What database state can exist that the UI does not know how to represent?

---

# 5. Missing-Link Audit

Explicitly look for broken chains.

Example:

```text
School
  ↓
Visit
  ↓
Progress
  ↓
Manager Dashboard
```

For each link verify:

- the writer exists;
- the reader exists;
- the schema agrees;
- field names agree;
- IDs/relationships agree;
- permissions allow the intended operation;
- indexes support the query;
- failure states are handled.

Also look for:

- created-but-never-updated data;
- updated-but-never-displayed data;
- deleted parents with orphaned children;
- historical records overwritten instead of appended;
- dashboard aggregates based on data that a workflow never persists.

---

# 6. Data Model / Schema Audit

For each important collection/document type determine:

- purpose;
- ownership;
- required fields;
- optional fields;
- related entities;
- IDs;
- timestamps;
- audit fields;
- read patterns;
- write patterns;
- query patterns;
- indexes;
- expected growth;
- retention.

Look for:

- unbounded arrays;
- indefinitely growing documents;
- hot documents;
- write contention;
- fan-out writes;
- unnecessary denormalization;
- insufficient denormalization;
- duplicated fields without synchronization rules;
- current state mixed with unbounded history;
- orphanable references;
- stale derived values.

---

# 7. Firestore Scalability Audit

For important queries and listeners, determine:

- expected document reads;
- result-set size;
- frequency;
- listener scope;
- repeated reads;
- pagination/limits;
- date windows;
- index requirements;
- write contention;
- hot documents;
- fan-out;
- transactions/batches;
- retry behavior.

Pay special attention to:

- dashboard-wide listeners;
- historical collections;
- collection-group queries;
- manager reporting;
- real-time operational dashboards;
- anything that reads an entire collection.

Evaluate how behavior changes at:

```text
10 users
100 users
1,000 users
10,000 users
```

Do not invent exact Firebase limits/prices.

When current platform limits/pricing are required, mark the issue:

> UNVERIFIED — requires confirmation against current Firebase documentation/usage data.

---

# 8. Heavy-Traffic Audit

Model at least these scenarios.

## Scenario A — Normal

Ordinary school usage.

## Scenario B — Busy

Multiple staff members simultaneously:

- logging attendance;
- logging visits;
- updating tasks;
- viewing dashboards;
- searching data.

## Scenario C — Peak

A concentrated burst of reads/writes.

## Scenario D — Growth

The dataset becomes substantially larger while the architecture remains mostly unchanged.

For every scenario identify:

- bottleneck;
- failure mechanism;
- likely symptom;
- whether degradation is graceful;
- whether Firestore reads grow acceptably;
- whether realtime listeners amplify reads;
- whether a hot document appears;
- whether the frontend remains usable.

Never write only:

> “This may become slow.”

Explain why.

---

# 9. Concurrency / Race-Condition Audit

Check:

- counters;
- statuses;
- assignment changes;
- attendance;
- visit logging;
- shared documents;
- aggregates;
- sequential values;
- last-write-wins behavior;
- optimistic UI;
- double submissions.

Look for:

- lost updates;
- duplicate writes;
- stale writes overwriting newer state;
- inconsistent summaries;
- race conditions between UI and server.

Identify where transactions/batches/server-side logic may be required.

---

# 10. Security / Authorization Audit

Audit:

- Firebase Auth;
- route guards;
- UI role checks;
- Firestore rules;
- repository behavior;
- document-level ownership;
- manager/admin boundaries;
- direct Firestore access.

Assume the client is malicious.

Ask:

> “Can a user bypass this UI and call Firestore directly?”

If yes, determine whether Firestore rules still prevent unauthorized actions.

Pay particular attention to client-provided:

- role;
- user ID;
- ownership;
- branch;
- manager/admin flags;
- timestamps.

Also check for overbroad reads where a user can technically retrieve more data than the UI displays.

---

# 11. Failure / Recovery Audit

Determine behavior when:

- Firestore is unavailable;
- a write fails;
- a listener disconnects;
- a write succeeds but UI thinks it failed;
- UI thinks a write succeeded but it did not;
- browser closes mid-operation;
- auth expires;
- permissions change;
- a document is malformed;
- a legacy document is missing new fields;
- offline/cache behavior returns stale state.

Look for silent inconsistency.

---

# 12. Performance Audit

Inspect:

- initial bundle size;
- lazy loading;
- duplicated fetches;
- unnecessary rerenders;
- expensive client-side filtering;
- large Firestore reads;
- map/list rendering;
- large component files;
- image/assets;
- PWA caching;
- code splitting.

Use evidence, not aesthetic preference.

---

# 13. Observability Audit

Determine whether production failures are diagnosable.

Review:

- frontend error reporting;
- Firestore error context;
- log retention;
- timestamps;
- action context;
- user context where appropriate;
- error boundaries;
- audit events;
- deployment visibility.

Ask:

> “When a user reports that something disappeared or failed, what evidence can the engineer actually inspect?”

---

# 14. Testing Audit

Do not count test files.

Determine whether important behavior is protected.

Look for missing tests around:

- authorization;
- repositories;
- validation;
- state transitions;
- concurrency;
- historical queries;
- dashboard aggregation;
- manager tracking;
- error/failure cases;
- empty/legacy data;
- retention behavior;
- deployment-sensitive configuration.

Identify shallow tests that would pass while the feature is still logically broken.

---

# 15. Deployment / Operations Audit

Verify:

- actual production hosting path;
- Firebase configuration;
- Cloudflare configuration if used;
- environment variables;
- build commands;
- Firestore rules deployment;
- Firestore index deployment;
- migration requirements;
- rollback strategy;
- service worker/PWA cache behavior;
- staging vs production separation.

Identify “works locally but fails in production” risks.

---

# 16. Dependency / Technical-Debt Audit

Review:

- obsolete packages;
- unnecessary dependencies;
- duplicate capabilities;
- dead code;
- unused modules;
- inconsistent patterns from different development periods;
- custom implementations replacing existing utilities;
- upgrade risks.

Do not recommend upgrades merely because versions are old.

Flag them only when they create meaningful:

- security;
- compatibility;
- maintenance;
- performance

risk.

---

# 17. Architecture Evolution Test

Ask:

> If this application became 10× larger, which subsystem fails first?

Then:

> If it became 100× larger, which architectural assumption becomes invalid?

Separate findings into:

- must fix now;
- fix before significant growth;
- monitor;
- acceptable technical debt.

---

# 18. Evidence Standard

Do not make significant findings from style preferences.

Every significant finding must contain:

**Evidence**
- file/path;
- relevant code/query/rule behavior.

**Impact**
- what can actually go wrong.

**Likelihood**
- low / medium / high;
- explain why.

**Severity**
- low / medium / high / critical.

**Confidence**
- low / medium / high.

**Recommendation**
- concrete correction, experiment, or follow-up investigation.

If runtime/load/production configuration is required:

> **UNVERIFIED — requires runtime/load/production verification.**

Do not present assumptions as facts.

---

# 19. Required Final Report

Produce the final report in this order.

## Executive Summary

Explain:

- major strengths;
- major weaknesses;
- current architectural fitness for present scale;
- major risks for future growth.

Do not reduce this to “good/bad.”

## Architecture Map

Show the main components and data flow.

Use a simple text diagram where helpful.

## Architecture Drift

Split findings into:

- documented and accurate;
- documented but stale;
- implemented but undocumented;
- contradictory;
- unverified.

## Critical Findings

Only issues that could cause:

- security failure;
- data corruption;
- severe reliability failure;
- major scalability/performance failure;
- architectural dead ends.

## High-Priority Findings

Important issues that should be resolved before significant feature expansion or growth.

## Medium / Low Findings

Maintainability, consistency, and non-critical technical debt.

## Missing Links

Show broken/incomplete business/data chains.

## Data Model Assessment

Explain collection ownership, relationships, history handling, duplication, aggregation, and growth risk.

## Security Assessment

Explain the actual authorization boundaries and concrete weaknesses.

## Scalability Assessment

Use:

| Subsystem | Current Design | Growth Risk | Bottleneck | Recommended Direction |
|---|---|---|---|---|

## Failure Mode Assessment

Explain what happens when dependencies or assumptions fail.

## Testing Gaps

Identify important behavior that lacks meaningful protection.

## Technical Debt

Separate cosmetic issues from debt that creates future engineering risk.

## Recommended Roadmap

### Fix Now

Issues that should be addressed before major feature expansion.

### Fix Before Growth

Issues that are acceptable today but should be addressed before usage/data grows materially.

### Monitor

Things that should be measured or reviewed later.

### Do Not Change Yet

Things that may look imperfect but are currently reasonable and do not justify unnecessary refactoring.

---

# 20. Required Final Questions

Answer these explicitly:

1. **Is there an architectural flaw that could cause data corruption or security failure?**
2. **Is there a missing link in the business/data logic?**
3. **What becomes the first bottleneck under heavy traffic?**
4. **What becomes the first bottleneck as the database grows?**
5. **Which current decisions are safe now but risky at 10× scale?**
6. **What must be fixed before adding more features?**
7. **What can safely remain technical debt?**
8. **What should be load-tested rather than guessed?**
9. **What assumptions could not be verified from the repository?**
10. **Does `docs/ARCHITECTURE.md` still describe reality?**
11. **What architecture changes should be documented after this audit?**
12. **What is the smallest practical roadmap toward stronger production readiness and scalability?**

---

# 21. Audit Output Rule

Do not modify code until the audit report is complete.

After the report, implementation should be a separate task so that:

```text
Audit
  ↓
Findings
  ↓
Prioritization
  ↓
Implementation plan
  ↓
Controlled changes
  ↓
Verification
  ↓
Architecture documentation update
```

This separation prevents the audit from becoming biased toward whatever fix the agent happens to prefer.
