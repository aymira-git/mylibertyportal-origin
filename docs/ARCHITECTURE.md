# MYLIBERTY Architecture Guide — V2

> **Status:** Current architecture reference.
>
> **Purpose:** This document describes the architecture that the repository currently implements or intentionally protects. It is not a coding-assistant prompt.
>
> **Agent behavior:** `AGENTS.md`
>
> **Deep audit procedure:** `docs/audits/FULL_ARCHITECTURE_AUDIT.md`
>
> This guide was refreshed against the current repository snapshot on **2026-09-23**. When code and documentation disagree, the discrepancy must be investigated rather than silently ignored.

## 1. Architecture Goals

MYLIBERTY uses a **domain-centered, feature-oriented architecture**.

The intended priorities are:

1. correctness;
2. security;
3. reliability;
4. scalability;
5. maintainability.

The architecture should evolve incrementally. A cleaner-looking structure is not, by itself, a sufficient reason for a rewrite.

Existing production behavior, authentication semantics, Firestore rules, and data contracts are treated as protected by default, but they may change when a feature or verified architectural improvement requires it.

---

## 2. Current Feature Domains

The main domain areas currently live under `src/features/`:

- `features/auth`
  - login;
  - registration;
  - staff onboarding;
  - profiles.

- `features/students`
  - applications;
  - rosters;
  - progress;
  - student-facing forms.

- `features/attendance`
  - kiosk;
  - clock-in/out;
  - shifts;
  - attendance;
  - corporate event attendance.

- `features/classes`
  - class management;
  - class photos;
  - teaching materials;
  - related class workflows.

- `features/finance`
  - payments and finance workflows.

- `features/staff`
  - staff operations;
  - invites;
  - directives/tasks;
  - staff-related workflows.

- `features/reports`
  - reporting and analytics.

- `features/shared`
  - reusable UI;
  - common helpers;
  - shared cross-domain presentation utilities.

- `features/dashboard`
  - role-based dashboard entry points;
  - dashboard-specific orchestration;
  - role-specific dashboard workflows.

### Dashboard subdomains

The dashboard area currently contains role/workflow-specific modules, including:

- `dashboard/manager`
- `dashboard/marketing`
- `dashboard/instructor`
- `dashboard/kids`

The dashboard area is an orchestration and role-entry layer. It should not become a substitute for domain ownership when logic clearly belongs to another domain.

For example, marketing school-outreach persistence belongs with the marketing outreach workflow, while the Manager Dashboard provides read-oriented oversight/tracking.

---

## 3. Shared Infrastructure Outside Features

Not all reusable infrastructure belongs under a feature directory.

The current repository also uses shared locations such as:

- `src/constants/`
- `src/schemas/`
- `src/utils/`
- `src/firebase.js`

These are approved shared infrastructure locations when the code is genuinely cross-domain.

The existence of these shared locations means the rule is not:

> “all imports must go through a feature barrel.”

The real boundary is:

### Feature → Feature

Cross-domain feature imports should go through the target feature's public `index.js` when that domain exposes one.

### Feature → Shared infrastructure

Direct imports are appropriate for approved shared infrastructure such as:

- `features/shared`;
- constants;
- schemas;
- utility modules;
- Firebase infrastructure.

### Within a feature

Files may import each other directly.

---

## 4. Repository / Data-Access Boundary

Repositories/data-access modules are the preferred home for direct Firestore reads and writes.

Examples currently present include:

- `authRepository.js`
- `applicationsRepository.js`
- `progressReportsRepository.js`
- `classesRepository.js`
- `materialsRepository.js`
- `paymentsRepository.js`
- `shiftsRepository.js`
- `corporateEventsRepository.js`
- `deskInquiriesRepository.js`
- `usersRepository.js`
- `todosRepository.js`
- `invitesRepository.js`
- `schoolOutreachRepository.js`
- `logRetentionRepository.js`
- other feature-specific data-access modules.

Repositories should:

- construct Firestore queries;
- perform reads/writes;
- handle persistence behavior;
- own transactions/batches where appropriate;
- validate persistence payloads using project conventions.

Repositories should not import React.

### Existing exceptions

The repository is not yet perfectly repository-pure.

There are current direct Firestore calls in some dashboard/shared flows and utility paths, including parts of:

- `ManagerDashboard`;
- `MarketingDashboard`;
- dashboard data hooks;
- instructor/kids dashboard workflows;
- shared error/reporting infrastructure;
- selected attendance/shared UI modules.

These are **existing architectural exceptions**, not a reason to pretend the architecture is already perfect.

New code should prefer the repository boundary.

Migration of existing direct-access paths should be incremental and should happen when there is a concrete benefit, relevant feature work, or an explicit refactor.

---

## 5. Application Routing and Lazy Loading

`src/App.jsx` owns application-level lazy loading for login/onboarding and role dashboards.

Keep role/application-level code splitting intact.

Do not replace lazy-loaded route-level imports with broad feature barrel imports if doing so would merge large role dashboards into larger initial downloads.

Structural changes to routing should verify:

- bundle impact;
- role-level code splitting;
- startup behavior;
- authentication flow.

---

## 6. Firestore Data Architecture

MYLIBERTY uses Firestore as the main application data store.

Data should be understood by **growth class**, not only by today's collection names.

### Class A — Unbounded / historical event data

Examples currently include:

- `attendance`;
- `shifts`;
- `schoolOutreach/{schoolId}/visits`;
- `errorLogs`;
- `shiftAuditEvents`.

Expected controls:

- bounded queries;
- explicit date windows where appropriate;
- limits/pagination where appropriate;
- index review;
- retention policy for operational logs where appropriate;
- no accidental collection-wide realtime listeners.

### Class B — Slowly growing operational records

Examples include:

- `applications`;
- `deskInquiries`;
- `corporateEvents`;
- `todos`;
- other business/operational history where yearly growth is moderate.

These may be read more broadly at the current operating scale, but the growth assumption should remain documented and revisited if usage expands materially.

### Class C — Bounded school-sized datasets

Examples include datasets such as:

- `users`;
- `classes`;
- other records whose size is primarily bounded by the current school population.

Reading these collections more broadly can be reasonable at current scale when the feature genuinely needs the full set.

If the dataset becomes large enough that read cost matters, the solution should be driven by the actual query need rather than blindly adding a small `limit()` that produces incomplete search behavior.

---

## 7. Important Data-Model Rules

When adding a feature, classify the data as:

- long-lived entity;
- historical/event record;
- current/derived state.

Do not place unbounded history inside a single document.

Separate:

- durable entities;
- event/history records;
- summaries/aggregates

when doing so improves auditability, reporting, or concurrency behavior.

For each significant historical dataset, identify:

- ownership;
- expected growth;
- query shape;
- retention;
- indexes;
- listener scope.

---

## 8. Firestore Scalability Rules

New or changed Firestore queries should be reviewed for:

- document reads per operation;
- result size;
- frequency;
- listener scope;
- repeated reads;
- N+1 behavior;
- limits;
- pagination;
- indexes;
- hot documents;
- write contention;
- fan-out.

Prefer bounded queries over whole-history reads.

Prefer explicit date windows for historical reporting.

Avoid collection-wide realtime listeners for datasets that grow indefinitely.

Do not introduce a client-side aggregate that requires every user to repeatedly reread a large collection unless the cost has been considered.

---

## 9. Security Boundaries

Authentication and Firestore Security Rules are the primary security boundary.

UI role checks are useful for:

- navigation;
- user experience;
- hiding controls.

They are not sufficient authorization.

For each protected collection/operation, define:

- read;
- create;
- update;
- delete

permissions.

Never weaken Firestore rules simply to make the UI work.

When role semantics or collection permissions change:

1. update the rules;
2. update the UI behavior;
3. update relevant tests;
4. perform a separate verification pass.

---

## 10. Protected Infrastructure

The following are **protected by default**:

- `src/firebase.js`;
- Firestore schema/data contracts;
- `firestore.rules`;
- authentication and role semantics;
- environment variable conventions;
- Firebase project configuration;
- PWA configuration;
- deployment/CI secrets and build-time environment configuration.

Protected does **not** mean immutable.

Changes are allowed when there is a clear reason, but should include:

1. explicit rationale;
2. impact review;
3. verification;
4. architecture/documentation update when the architecture changes.

---

## 11. Safe Refactoring Protocol

1. Establish a working checkpoint.
2. Change one architectural boundary at a time.
3. Do not change behavior while moving code.
4. Verify imports, tests, lint, and build after each meaningful step.
5. Keep compatibility paths until the new path is proven.
6. Remove compatibility layers only after repository-wide search confirms they are unused.

Never delete an old path because a historical migration note says it is obsolete.

---

## 12. Legacy / Migration Status

The project has migrated from an older flat structure toward `src/features/`.

However, shared legacy-style locations such as `src/utils/` are still actively referenced by current code.

Examples currently include:

- WITA date utilities;
- error reporting;
- copy-to-clipboard helpers.

Therefore:

> **Do not delete `src/utils/`, `src/hooks/`, `src/components/`, or any compatibility path merely because a historical migration document says it is unused.**

Before deleting any migration path:

- search repository-wide;
- check static imports;
- check dynamic imports;
- check tests;
- check scripts/configuration;
- check deployment/build references.

Migration status must describe the repository as it exists now, not as it existed at the start of the migration.

---

## 13. Current Outreach Architecture

The School Outreach workflow currently uses the dashboard marketing area:

`src/features/dashboard/marketing/`

Current responsibilities include:

- school/outreach UI;
- map display;
- school visit modal;
- outreach progress;
- list/add-school workflows;
- school-outreach repository;
- seed data;
- tests.

The Manager Dashboard contains read-oriented outreach tracking:

`src/features/dashboard/manager/MarketingOutreachTracker.jsx`

with supporting utilities/tests.

The intended separation is:

```text
Marketing
  ↓
creates/updates outreach activity
  ↓
school + visit history
  ↓
Manager Dashboard
  ↓
read-oriented progress/oversight
```

The Manager Dashboard should not become the owner of marketing write workflows merely because it displays their results.

---

## 14. Current Operational Logging

The repository currently contains operational error/audit mechanisms including:

- `errorLogs`;
- `shiftAuditEvents`;
- dashboard log-retention functionality.

These should be treated as growth-sensitive operational history.

Retention and querying should remain bounded enough for the current scale and should be revisited before operational logs become a major source of cost or storage growth.

---

## 15. Dashboard Architecture

The role dashboards are separate application experiences, including:

- Manager;
- Marketing;
- Instructor;
- Kids;
- and other role-specific dashboard entry points already present in the repository.

Shared dashboard layout/presentation should use existing shared shell/primitives where appropriate.

Business logic should not be duplicated merely because two role dashboards need to display related information.

Prefer shared repository/query utilities or shared domain functions when the underlying data contract is genuinely the same.

---

## 16. Known Architectural Risks / Review Areas

The following are areas to keep under active review:

- direct Firestore access still exists in some dashboard/shared flows;
- some domain logic is still spread between repositories, hooks, and dashboard components;
- historical/event datasets require continued query/retention discipline;
- dashboard-wide realtime listeners must be watched for read amplification as usage grows;
- the architecture guide must be kept synchronized with the repository;
- migration cleanup must be based on current import evidence, not historical assumptions.

These are not automatically failures. They are areas where future work should be evidence-driven.

---

## 17. Architecture Change Procedure

When a feature intentionally changes architecture:

1. identify the affected domain/boundary;
2. explain why the existing structure is insufficient;
3. implement incrementally;
4. verify tests/build/lint/typecheck;
5. review security and Firestore indexes/rules;
6. update this document;
7. add the decision to the change log.

---

## 18. Change Log

| Date | Change | Reason |
|---|---|---|
| 2026-09-23 | Architecture V2 refresh | Reconciled documentation with the current feature layout, outreach/manager tracking, repository patterns, shared utilities, and current migration state |
| 2026-09-23 | Audit Roadmap Implementation | Classified `deskInquiries` & `corporateEvents` in Class B; documented `deskInquiriesRepository.js` & `usersRepository.js`; aligned agent instructions reference with `AGENTS.md` |
| 2026-09-24 | Multi-Branch Isolation & Dual-Control Approvals | Implemented branchId normalization across admissions, payments, shifts, outreach, and inquiries with Firestore rule scoping; added Maker-Checker Approval Registry, repository, and dashboard inboxes |
