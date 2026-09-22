# MyLiberty Portal — Documentation Index

Welcome to the central documentation directory for **MyLiberty Portal**. This folder contains architectural specifications, implementation plans, roadmaps, and operational runbooks for developers, maintainers, and AI agents.

---

## 📚 Table of Contents

### 1. Architecture & Design Standards
* **[`ARCHITECTURE.md`](./ARCHITECTURE.md)**
  * Core domain-driven design architecture under `src/features/`.
  * Public barrel boundary rules (`src/features/*/index.js`).
  * Repository patterns (`*Repository.js`) separating state/UI from Firestore database operations.
  * Protected infrastructure guidelines (`src/firebase.js`, security rules, authentication providers).

---

### 2. Feature Plans & Specifications
* **[`Payment Plans Implementation Plan.md`](./Payment%20Plans%20Implementation%20Plan.md)**
  * Multi-duration tuition plans: Monthly (1 Mo), Quarterly (3 Mo, 5%), Semester (6 Mo, 10%), Annual (12 Mo, 15%), Biennial (24 Mo, 20%), plus flexible **Custom** mode.
  * Single source of truth in `src/constants/paymentPlans.js`.
  * Early renewal start date modes: "Extend from current plan" vs "Start today instead".
  * Dynamic payment health evaluation (`Active`, `Due Soon`, `Expired`, and neutral `No Plan Set` for untracked legacy records).
  * Automated WhatsApp receipt generation and 1-click renewal reminders.

* **[`Academic Model, Batches & RBAC Implementation Plan.md`](./Academic%20Model%2C%20Batches%20%26%20RBAC%20Implementation%20Plan.md)**
  * Tier & academic placement levels (`warrior`, `elite`, `master`, `grandmaster`, `epic`).
  * Option B batch placement eligibility range (`minLevel` – `maxLevel`).
  * Admissions pipeline with 1-click WhatsApp applicant/parent outreach and automatic redirect to student profile setup.
  * Role-based access control (Admin-only batch authoring, Front Office enrollment capabilities).

* **[`Corporate Event Attendance — Implementation Plan (Audited).md`](./Corporate%20Event%20Attendance%20%E2%80%94%20Implementation%20Plan%20%28Audited%29.md)**
  * Corporate events as attendance reasons, not classes (`corporateEvents` collection).
  * Three audience scopes: students, staff roles, and managers across `all`, `branch`, `division`, and `role`.
  * Automatic kiosk check-in tagging and staff/manager General Duty fallback on ambiguous overlaps.
  * Dedicated event management panel for Admin and Front Office dashboards.

---

### 3. Product Roadmaps
* **[`myliberty_available_batches_roadmap.md`](./myliberty_available_batches_roadmap.md)**
  * Core architectural strategy for available batches and student enrollment.
  * Operational views vs database sources of truth.
  * Batch capacity, scheduling, and lifecycle states.

---

### 4. Operational & Migration Notes
* **[`READ-ME-FIRST.md`](./READ-ME-FIRST.md)**
  * Historical drop-in deployment notes.
  * Firestore compound index deployment (`firebase deploy --only firestore:indexes`).
  * Client-side pagination architectural rationale.
  * Lint and React hooks verification guidelines.

---

## 🤖 Guide for AI Agents

When implementing new features or making refactors in this codebase:
1. **Consult [`ARCHITECTURE.md`](./ARCHITECTURE.md) first** before changing any directory structures, adding new feature modules, or making cross-domain imports.
2. **Never break public barrel rules**: Import from `src/features/<domain>` (or `src/features/shared`), never reach into private domain internals across domain boundaries.
3. **Preserve repository separation**: Keep UI components focused on state, forms, and render logic. Direct Firestore reads/writes belong inside `*Repository.js`.
4. **Document major plans here**: When creating new implementation plans or architectural guides, place them in this `docs/` folder and link them in this index.
