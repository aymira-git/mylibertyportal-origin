# MyLiberty Portal

Operational and academic management portal for Liberty English Course, built with React, Vite, Tailwind CSS, and Firebase (Firestore, Authentication, and Storage).

---

## 📖 Documentation & Guides

All project documentation, engineering specifications, implementation plans, and roadmaps are organized in the [`docs/`](./docs/) directory:

* **[Master Documentation Index](docs/README.md)** — central directory of all guides and plans.
* **[Architecture Guide](docs/ARCHITECTURE.md)** — domain directory structure (`src/features/*`), barrel boundary rules, repository patterns, and protected infrastructure.
* **[Payment Plans Implementation Plan](docs/Payment%20Plans%20Implementation%20Plan.md)** — multi-duration tuition plans (1, 3, 6, 12, 24 Mo + Custom), payment health status, renewal logic, and WhatsApp receipts.
* **[Academic Model, Batches & RBAC Implementation Plan](docs/Academic%20Model%2C%20Batches%20%26%20RBAC%20Implementation%20Plan.md)** — fluency tiers, Option B placement range compatibility, admissions pipeline, and role-based permissions.
* **[Available Batches Integration Roadmap](docs/myliberty_available_batches_roadmap.md)** — batch lifecycle, scheduling, capacity, and enrollment architecture.
* **[Operations & Migration Runbook](docs/READ-ME-FIRST.md)** — Firestore composite index deployments and pagination notes.

---

## 🛠️ Tech Stack & Architecture

* **Frontend**: React (v19) + Vite
* **Styling**: Tailwind CSS
* **Backend / Database**: Google Firebase (Firestore, Auth, Storage)
* **Architecture**: Domain-driven feature layout (`src/features/<domain>/`), separated repository layer for Firestore calls (`*Repository.js`), and strict public barrel boundaries (`index.js`).
* **PWA**: `vite-plugin-pwa` with offline caching and service worker support.

---

## 🚀 Development Scripts

```bash
# Install dependencies
npm install

# Start local Vite development server
npm run dev

# Run ESLint validation
npm run lint

# Build production bundle with Vite & PWA generation
npm run build

# Deploy Firestore composite indexes
firebase deploy --only firestore:indexes
```
