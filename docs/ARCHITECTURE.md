# MYLIBERTY Architecture Guide

## Goal

MYLIBERTY uses a domain-centered structure. Every screen, hook, and Firestore
call lives inside the feature domain it belongs to, under `src/features/`.

Existing behavior, Firestore schema, authentication behavior, and security
rules are treated as protected infrastructure unless a change is explicitly
required.

## Current domains

- `features/auth` — login, registration, staff onboarding, profiles
- `features/students` — student applications, rosters, progress, student forms
- `features/attendance` — kiosk and clock-in/out workflows
- `features/classes` — class management, class photos, teaching materials
- `features/finance` — payments
- `features/staff` — staff operations, invites, tasks
- `features/reports` — reporting and analytics
- `features/shared` — UI and helpers used across multiple domains
- `features/dashboard` — role-based dashboard entry points

## Import rule

`src/features/*/index.js` files are the public entry point for their domain.
Cross-domain imports go through these entry points rather than reaching
directly into another domain's implementation files.

Inside a domain, files may import each other directly — the barrel is a
boundary between domains, not within one.

### Repositories

Each domain owns a `*Repository.js` file holding its direct Firestore reads
and writes. Components handle state, forms, and toasts; repositories handle
what actually happens in the database. Repository files never import React.

### Lazy-loaded application routes

`src/App.jsx` keeps direct lazy imports for login, onboarding, and role
dashboards. Importing those screens through a shared feature `index.js` would
merge them into larger downloads and remove the current role-by-role code
splitting. Add route-specific feature modules before changing those imports.

## Protected infrastructure

Do not change these during ordinary refactors:

- `src/firebase.js`
- Firestore collection/document schema
- `firestore.rules`
- Authentication and role semantics
- Environment variable names
- Firebase project configuration
- PWA configuration
- CI workflow secrets and build-time environment variables

Any change to protected infrastructure requires an explicit reason and a
separate verification pass.

## Safe-refactor protocol

1. Establish a working checkpoint.
2. Change one architectural boundary at a time.
3. Do not change behavior while moving code.
4. Verify imports and build/lint after each step.
5. Keep old paths working until the new path is proven.
6. Remove compatibility layers only after the new structure has been used
   successfully.

## Data volume

Only two collections grow rapidly without limit: `shifts` (one document per staff
clock-in) and `attendance` (one per student scan). Both are read through a
date window, chosen by the "Period" control on the Reports dashboard and
defaulting to the last 90 days. The window is a visible setting rather than
a silent cap, so missing older records read as a filter rather than as data
loss. Still-open shifts are always fetched outside the window (`where("clockOut", "==", null)`)
so real-time dashboards (such as Manager Dashboard) and auto-close passes never download
unbounded historical records.

Secondary accumulators: `applications` (intake records retained for audit) and `todos`
(staff directives retained for tracking) grow slowly over time. Because the school operates
with a manageable yearly intake, reading these collections directly remains performant.
However, rejected applications can be permanently purged by admins, and completed todos
may be archived in future releases if volume expands.

Every other collection is bounded by the size of the school and is read
whole. `users` in particular is NOT paginated at the database level, and
shouldn't be: the roster's search and sort, the unenrolled-students list and
the per-student class lookups all need the full set in memory to be correct.
Fetching 25 users at a time would mean search only finding the ones already
on screen. Long lists are paginated in the browser instead, via
`features/shared/usePagination.js`, which addresses render cost rather than
read cost.

If the user count ever gets large enough for read cost to matter, the fix is
a server-side search index, not `limit()` on the roster query.

## Migration history

The original structure kept every screen in a flat `src/components/` folder,
with `src/hooks/` and `src/utils/` alongside it. The move to `features/` was
done incrementally: feature entry points were introduced first, then
implementations were moved domain by domain, with one-line re-export files
left behind at the old paths so nothing broke mid-migration.

Those compatibility files — `src/components/`, `src/components/ui/`,
`src/hooks/`, and `src/utils/` — are no longer referenced by anything: every
import in the app resolves through `src/features/`. They are safe to delete
in full, and should be, so there is only ever one valid path to a module.
