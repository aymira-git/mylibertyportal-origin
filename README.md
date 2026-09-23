# MyLiberty Portal

Operational and academic management portal for **Liberty English Course**, built with React, Vite, Tailwind CSS, and Firebase (Firestore, Authentication, and Storage).

## What this repository contains

MYLIBERTY is a role-based school operations portal covering areas such as:

- student applications and academic progress
- classes, batches, and teaching materials
- attendance and staff clock-in/out
- staff operations and directives
- finance and payment workflows
- reports and analytics
- corporate event attendance
- marketing / school outreach
- role-specific dashboards

The application is organized primarily under `src/features/` by domain and role-specific dashboard workflow.

## Start here

### For a developer or coding agent

Read these in order:

1. **[`AGENTS.md`](./AGENTS.md)** — how agents should work on this repository.
2. **[`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)** — the current architecture and protected boundaries.
3. **[`docs/README.md`](./docs/README.md)** — the documentation index.
4. **[`docs/audits/FULL_ARCHITECTURE_AUDIT.md`](./docs/audits/FULL_ARCHITECTURE_AUDIT.md)** — use this when performing a full architecture/scalability audit.

### For a new human developer

Start with this README, then read:

- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)
- [`docs/README.md`](./docs/README.md)

Do not assume that an old plan, migration note, or handoff document still describes the current repository. Verify important claims against the code.

## Architecture at a glance

```text
src/
└── features/
    ├── auth/
    ├── students/
    ├── attendance/
    ├── classes/
    ├── finance/
    ├── staff/
    ├── reports/
    ├── shared/
    └── dashboard/
        ├── manager/
        ├── marketing/
        ├── instructor/
        └── kids/
```

The main architectural principles are:

- domain-centered feature organization;
- public feature entry points for cross-domain imports;
- repository/data-access modules for new Firestore access;
- shared infrastructure for genuinely cross-domain helpers;
- role dashboards as orchestration/entry layers rather than replacements for domain ownership;
- incremental refactoring instead of broad rewrites.

See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for the authoritative version.

## Tech stack

- **Frontend:** React + Vite
- **Styling:** Tailwind CSS
- **Data/backend:** Firebase Authentication + Firestore + Storage
- **Validation:** Zod
- **Testing:** Vitest and Playwright
- **Quality:** ESLint, Prettier, Knip
- **PWA:** `vite-plugin-pwa`
- **Timezone:** WITA (`Asia/Makassar`)

Always verify the current versions and available scripts in `package.json` before relying on these assumptions.

## Development

Install dependencies:

```bash
npm install
```

Start the local development server:

```bash
npm run dev
```

Run linting:

```bash
npm run lint
```

Run tests:

```bash
npm test
```

Run a production build:

```bash
npm run build
```

Run type checking:

```bash
npm run typecheck
```

Run end-to-end tests when configured:

```bash
npm run test:e2e
```

Check `package.json` before running a command because the available scripts may change over time.

## Firebase / Firestore

This project uses Firebase for authentication and persistence.

When changing Firestore queries, data models, rules, or indexes:

- review `firestore.rules`;
- review `firestore.indexes.json`;
- consider read/write/listener cost;
- consider historical data growth;
- preserve least-privilege authorization;
- test the affected workflow.

If indexes need deployment:

```bash
firebase deploy --only firestore:indexes
```

Do not assume that local success means the production Firebase configuration is correct.

## Documentation

The documentation is intentionally split by purpose:

```text
docs/
├── ARCHITECTURE.md
├── README.md
├── audits/
├── proposals/
└── plans/
```

### Documentation rules

- `README.md` — project entry point.
- `docs/README.md` — documentation index.
- `docs/ARCHITECTURE.md` — current architectural source of truth.
- `docs/audits/` — audit procedures and completed audit reports.
- `docs/proposals/` — proposed architectural changes.
- `docs/plans/` — implementation plans that remain relevant.

Do not create a new Markdown file when an existing document can be updated cleanly.

Retire or archive obsolete plans instead of allowing `docs/` to become a historical dump.

## Security and architecture

Authentication and Firestore Security Rules are the primary security boundaries.

UI role checks are for navigation and user experience; they are not authorization by themselves.

New architecture or data-model changes should not be introduced silently. Follow the architecture change-control process in [`AGENTS.md`](./AGENTS.md) and update [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) when an approved architectural change is actually implemented.

## Repository hygiene

Avoid committing:

- secrets;
- credentials;
- local environment files containing sensitive values;
- generated build output unless intentionally required;
- obsolete migration notes that no longer describe current behavior.

Before deleting old paths or compatibility files, verify repository-wide references rather than relying on historical documentation.

## Production / deployment note

The repository contains configuration related to Firebase hosting and Cloudflare/Worker infrastructure. Do not assume which path currently serves production.

Before changing deployment behavior, verify the production path and required environment variables.

## Keeping this README useful

This README is intentionally an overview, not a complete architecture manual.

When a technical detail becomes important enough to govern future development, put it in the appropriate documentation file rather than making this README longer.

The goal is for a new developer or agent to understand:

**what the project is → where the important rules live → how to start working safely.**
