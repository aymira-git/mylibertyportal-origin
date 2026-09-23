# MyLiberties Portal — Coding Assistant Instructions

> **Purpose:** This file defines how the coding assistant should work on MYLIBERTY.
> It describes agent behavior, engineering workflow, safety rules, and completion standards.
>
> The current application architecture is documented separately in
> [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).
>
> The deep architecture/scalability audit procedure is documented separately in
> [`docs/audits/FULL_ARCHITECTURE_AUDIT.md`](./docs/audits/FULL_ARCHITECTURE_AUDIT.md).

## About the person you are helping

- Kifry has no coding experience and no budget. The agent should do the heavy lifting: inspect the code, implement changes, test them, and explain only what Kifry needs to know.
- Free tiers matter. Before adding a paid service, new infrastructure, a heavy dependency, or a design that may materially increase Firestore reads/writes, explicitly mention the cost/risk and propose a lower-cost alternative when practical.
- Prefer the smallest change that solves the problem.
- Do not introduce a framework, service, dependency, abstraction, or architectural pattern unless there is a clear benefit.
- Deliverables should be drop-in and usable.

## Authority Chain

MYLIBERTY uses three related documents:

```text
CLAUDE.md
  ↓
How the coding assistant should behave

docs/ARCHITECTURE.md
  ↓
What the current application architecture is

docs/audits/FULL_ARCHITECTURE_AUDIT.md
  ↓
How to challenge and verify that architecture
```

These documents have different responsibilities and should not be merged.

### Architecture authority

`docs/ARCHITECTURE.md` is the canonical description of the current application architecture.

Before making structural, data-model, Firestore, repository, routing, or cross-domain changes:

1. Read `docs/ARCHITECTURE.md`.
2. Verify important architectural claims against the current repository.
3. If the repository and the architecture guide disagree, report the discrepancy instead of silently choosing one.
4. When an architectural change is intentionally introduced, update the architecture guide as part of the change.
5. Never treat historical migration notes as proof that a path or pattern is currently unused.

## Architecture Change Control

`docs/ARCHITECTURE.md` is a protected project artifact.

An agent may:
- read it;
- identify inconsistencies;
- explain that the current architecture is insufficient;
- propose an architectural change;
- prepare an implementation/proposal document for review.

An agent must **not silently modify the architecture** because:
- a feature would be easier with a different structure;
- the existing architecture is inconvenient;
- a cleaner structure seems preferable;
- the implementation naturally drifted away from the documented design.

### Explicit approval required

Changing `docs/ARCHITECTURE.md` to record a genuine architecture change requires explicit human authorization.

Examples of explicit authorization:
- “Update the architecture.”
- “Approve this architecture change.”
- “Revise `docs/ARCHITECTURE.md` according to the audit findings.”

A normal feature request does **not** automatically authorize an architecture change.

### Before an approved architecture change

The agent must state:
1. the architectural decision being changed;
2. why the existing decision is insufficient;
3. which code, data, security, deployment, or domain boundaries are affected;
4. migration and compatibility concerns;
5. how the change will be verified.

### After an approved architecture change

The agent should:
1. implement the approved change;
2. update `docs/ARCHITECTURE.md`;
3. add/update the architecture change log;
4. identify affected implementation files;
5. verify tests/build/lint/typecheck and relevant runtime behavior;
6. report the architectural change explicitly in the final summary.

### Do not rewrite documentation to hide drift

Never silently rewrite `docs/ARCHITECTURE.md` simply to make it match an implementation that was changed without architectural approval.

If implementation and architecture diverge, report the divergence as a finding and stop short of declaring the architecture changed unless Kifry explicitly approves it.

### Architecture proposals

When an architecture change appears necessary but has not been approved, prefer a proposal over editing the canonical architecture guide.

Recommended location:

```text
docs/architecture/proposals/YYYY-MM-DD-short-description.md
```

A proposal should include:
- problem/evidence;
- current architecture;
- proposed architecture;
- affected boundaries;
- risks;
- migration plan;
- verification plan;
- approval status.

The proposal is not the architecture itself. `docs/ARCHITECTURE.md` remains authoritative until the change is explicitly approved and implemented.

### Repository protection

Agent instructions are not a security boundary. Where possible, protect architecture and security-sensitive files through repository controls such as branch protection and code-owner review.

Recommended protected paths include:

```text
docs/ARCHITECTURE.md
CLAUDE.md
docs/audits/
firestore.rules
firestore.indexes.json
```

The agent must not claim that a repository control exists unless it has verified the repository configuration.

### Audit trigger

When Kifry says:

- “full audit”
- “architecture audit”
- “audit the whole project”
- “audit the architecture”
- or an equivalent request

switch from feature-development mode to **audit mode**.

In audit mode:

- do not modify production code unless explicitly instructed;
- read `docs/audits/FULL_ARCHITECTURE_AUDIT.md`;
- read `docs/ARCHITECTURE.md`;
- inspect the whole repository;
- compare declared architecture with actual implementation;
- produce an evidence-based report before proposing implementation changes.

## Actual Tech Stack

Verify these assumptions against the current repository before relying on them; they are the expected baseline.

- **Frontend:** React + Vite + Tailwind CSS + `lucide-react` + `vite-plugin-pwa`.
- **Data:** Firebase Authentication + Firestore.
- **Validation:** Zod schemas under `src/schemas/`.
- **Language:** JavaScript (`.js` / `.jsx`) with TypeScript checking via `tsc` / `checkJs`.
- **Testing:** Vitest and Playwright.
- **Quality:** ESLint, Prettier, Knip.
- **Hosting/edge:** repository contains Firebase Hosting configuration and a Cloudflare Worker setup; do not assume which path currently serves production.
- **Timezone:** WITA (`Asia/Makassar`) conventions are part of the project behavior and must be preserved.

If the repository contradicts any of the above, trust the repository and report the discrepancy.

## Working Style

### 1. Start with a concise plan

Before making changes, state:

- what will change;
- the likely files involved;
- the important risk(s);
- how the change will be verified.

Do not expose private chain-of-thought. Give only useful implementation reasoning and decisions.

### 2. Read before writing

Inspect the existing helper, repository, schema, component, hook, rule, configuration, or UI pattern before introducing a new one.

Prefer existing shared pieces such as:

- `Card`
- `Badge`
- `useToast`
- `useConfirm`
- `DashboardShell`
- `ResponsiveTable`
- existing normalization/date helpers
- existing repository patterns

### 3. Plans are proposals

Implementation plans are not authority.

If the plan conflicts with the repository, explain what should change and why.

### 4. Prefer incremental changes

- Avoid unrelated refactors.
- Change one architectural boundary at a time.
- Keep changes easy to review and revert.
- Do not rewrite architecture merely to make the code look cleaner.

### 5. Report honestly

Never claim something was tested, deployed, or verified unless it actually was.

Always report:

- commands run;
- results;
- commands not run;
- things requiring manual verification;
- known limitations.

## Coding Rules

### Errors

- Surface meaningful errors with existing toast/inline-error patterns.
- Use the existing `ErrorBoundary` architecture.
- Avoid empty `catch` blocks.
- Log enough to debug without exposing sensitive information.

### Loading / empty / failure states

Every data-driven screen should handle:

- loading;
- empty/no-results;
- failure;
- permission denied;
- missing/legacy fields.

Older Firestore documents may not contain newer fields. Do not assume every field exists.

### Legacy data

- Normalize old records on read where practical.
- Keep older records working when adding fields.
- Do not perform bulk/destructive migrations without identifying the migration, risks, and rollback approach first.

### React

- Prefer immutable state updates.
- Clean up timers, listeners, subscriptions, and Firestore listeners.
- Keep effects focused.
- Avoid effect patterns that conflict with the repository's lint rules.
- Use refs for DOM/library integration where appropriate.

### File layout

- Hooks/constants/utilities stay in `.js`.
- Components stay in `.jsx`.
- Follow `react-refresh/only-export-components`.
- Consider splitting files that approach roughly 1000 lines.
- Prefer domain/feature grouping over arbitrary abstraction layers.

### UI

- Reuse existing UI primitives and dashboard layout patterns.
- Use `useToast` / `useConfirm` rather than `alert()` / `confirm()`.
- Preserve responsive behavior.
- Preserve accessibility basics:
  - labels;
  - keyboard access;
  - understandable status indicators;
  - meaning that does not depend only on color.

### Environment and secrets

- Use `import.meta.env.VITE_*` in browser-side code.
- Never hard-code secrets, credentials, API keys, or tokens.
- Keep sensitive server-side values in the appropriate environment/Worker configuration.
- Do not leak sensitive information through logs or error messages.

## Firebase / Firestore Rules

- Prefer repository/data-access modules for new Firestore access.
- Do not introduce new direct Firestore access inside presentational components when an appropriate repository exists.
- Existing direct-access code may remain temporarily when it is legacy or tightly coupled to a current dashboard flow; do not silently pretend it does not exist.
- Review new or changed queries for:
  - read volume;
  - result size;
  - pagination/limits;
  - listener scope;
  - repeated reads;
  - N+1 behavior;
  - index requirements;
  - hot documents;
  - write contention.
- Avoid collection-wide realtime listeners for unbounded historical datasets.
- Prefer bounded/time-windowed queries for growing history.
- Never weaken Firestore rules merely to make the UI work.
- Client-side role checks are not the security boundary.
- Firestore rules remain authoritative.
- Any role/permission change must be reviewed together with the UI behavior and the rules.
- Any new collection must have intended read/create/update/delete permissions defined.

## Data Design

When adding a feature, classify its data as one or more of:

- long-lived entity;
- event/history record;
- current/derived state.

Do not put unbounded history into a single document.

For historical/event data, consider:

- date windows;
- limits;
- pagination;
- indexes;
- retention;
- reporting cost;
- realtime listener scope.

For derived/summary data, define the source of truth and how the summary can become stale.

## Tests and Quality

Use the narrowest relevant validation first, then broader checks where practical.

Expected repository commands include:

```bash
npm test
npm run lint
npm run build
npm run typecheck
npm run test:e2e
```

Do not assume every command is present forever; check `package.json`.

New logic with meaningful branching should get a test.

Test critical flows, not just component rendering.

When a change affects:

- authorization;
- Firestore repositories;
- schemas;
- business rules;
- status transitions;
- concurrency;
- reports/aggregation

add or update meaningful tests.

## Cost Awareness

Before introducing a design that may increase Firestore usage, estimate its behavior.

Think in terms of:

```text
10 users
100 users
1,000 users
10,000 users
```

Ask whether reads/writes/listeners scale:

- linearly;
- super-linearly;
- unexpectedly because of fan-out;
- unexpectedly because of repeated listeners.

Do not invent exact current Firebase prices or limits. Identify assumptions that require verification.

## Deployment Rules

Before changing deployment-related files:

1. verify which hosting path is currently production;
2. identify affected systems:
   - Firebase Hosting;
   - Firestore;
   - Cloudflare Worker/Pages;
   - environment variables;
   - indexes/rules;
3. identify the required deployment command(s);
4. distinguish local verification from production verification.

Never assume that “build succeeds locally” means production is correct.

## Definition of Done

A feature is not complete merely because code was written.

Unless the task explicitly narrows the scope, completion means:

1. implementation exists;
2. loading/empty/error/permission states are handled;
3. relevant schemas/validation are updated;
4. security rules are updated or reviewed when needed;
5. Firestore indexes are reviewed when needed;
6. relevant tests pass;
7. lint/typecheck/build results are reported;
8. changed files are listed;
9. deployment requirements are listed;
10. known limitations/unverified areas are stated;
11. architecture documentation is updated when the change alters the architecture.

## When Something Is Unclear

Ask one concise question only when the missing information materially affects the implementation.

When a safe default exists, state the default and continue.

If the choice affects:

- cost;
- security;
- destructive data changes;
- production behavior;
- migration strategy

explain the tradeoff and leave the final decision to Kifry.

## Final Work Summary

For completed implementation work, finish with:

### Changed
- `path/to/file`

### Verified
- `command` → result

### Needs from Kifry
- only actual actions Kifry needs to perform

### Notes
- limitations;
- migration concerns;
- cost implications;
- remaining verification
