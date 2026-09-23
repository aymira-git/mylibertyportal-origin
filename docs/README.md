# MyLiberty Portal — Documentation Index

Welcome to the central documentation directory for **MyLiberty Portal**.

This directory is organized by document purpose in accordance with the guidelines in [`README.md`](../README.md):

```text
docs/
├── ARCHITECTURE.md    # Protected authoritative architecture guide
├── README.md          # Documentation index (this file)
├── audits/            # Audit procedures and completed audit findings
├── proposals/         # Architectural proposals, option analyses, and roadmaps
└── plans/             # Feature, modernization, and operational implementation plans
```

---

## 📚 Table of Contents

### 1. Architecture & Core Guidelines
* **[`ARCHITECTURE.md`](./ARCHITECTURE.md)**
  * Protected, canonical application architecture specification.
  * Domain boundaries under `src/features/` (`auth`, `students`, `attendance`, `classes`, `finance`, `staff`, `reports`, `shared`, `dashboard`).
  * Public barrel rules (`src/features/*/index.js`) and repository patterns (`*Repository.js`).
  * Firestore data growth classes (Class A unbounded, Class B slowly growing, Class C bounded).
  * Protected infrastructure rules and safe refactoring protocol.

---

### 2. Audits & Scalability Assessments (`docs/audits/`)
Procedures, diagnostic checklists, and historical system review findings:

* **[`audits/FULL_ARCHITECTURE_AUDIT.md`](./audits/FULL_ARCHITECTURE_AUDIT.md)** — Canonical full-system architecture and scalability audit procedure.
* **[`audits/Architecture_and_Performance_Audit_and_Plan.md`](./audits/Architecture_and_Performance_Audit_and_Plan.md)** — Architectural health and performance baseline audit.
* **[`audits/Test_Coverage_Audit_and_Plan.md`](./audits/Test_Coverage_Audit_and_Plan.md)** — Test coverage audit across critical business modules.
* **[`audits/audit-findings-2026-09-22-spark-scale-1000-students.md`](./audits/audit-findings-2026-09-22-spark-scale-1000-students.md)** — Scalability analysis for 1,000+ student milestone on free/Spark tiers.
* **[`audits/audit-findings-2026-09-22-log-retention.md`](./audits/audit-findings-2026-09-22-log-retention.md)** — Diagnostic findings on Firestore log growth and retention limits.
* **[`audits/audit-findings-2026-09-22.md`](./audits/audit-findings-2026-09-22.md)** — Comprehensive security and architectural audit findings.
* **[`audits/audit-2026-09-21-multi-campus-branch.md`](./audits/audit-2026-09-21-multi-campus-branch.md)** — Multi-campus branch architecture audit.
* **[`audits/Cloudflare Pages build failing (2026-09-21).md`](./audits/Cloudflare%20Pages%20build%20failing%20%282026-09-21%29.md)** — Investigation into Cloudflare Pages deployment configuration vs Firebase Hosting.
* **[`audits/implementation_plan audit findings 2026 09 22.md`](./audits/implementation_plan%20audit%20findings%202026%2009%2022.md)** — Implementation plan derived from September 22 audit findings.

---

### 3. Proposals & Roadmaps (`docs/proposals/`)
Forward-looking architecture proposals and option analyses:

* **[`proposals/myliberty_available_batches_roadmap.md`](./proposals/myliberty_available_batches_roadmap.md)** — Strategic product roadmap for available batches, scheduling, and capacity planning.
* **[`proposals/Private-TOEFL vs Corporate Event Clock-in — Plan.md`](./proposals/Private-TOEFL%20vs%20Corporate%20Event%20Clock-in%20%E2%80%94%20Plan.md)** — Architectural options analysis for resolving instructor kiosk clock-in conflicts between private batches and corporate events.

---

### 4. Implementation Plans (`docs/plans/`)
Detailed execution specs for features, workflows, and modernizations:

#### Academic, Classes & Batches
* **[`plans/Academic Model, Batches & RBAC Implementation Plan.md`](./plans/Academic%20Model%2C%20Batches%20%26%20RBAC%20Implementation%20Plan.md)**
* **[`plans/Admin Classes & Real-World Operations Implementation Plan.md`](./plans/Admin%20Classes%20%26%20Real-World%20Operations%20Implementation%20Plan.md)**
* **[`plans/Batch_Types_Implementation_Plan_Revised.md`](./plans/Batch_Types_Implementation_Plan_Revised.md)** *(Original: [`plans/Batch_Types_Implementation_Plan.md`](./plans/Batch_Types_Implementation_Plan.md))*
* **[`plans/Kindergarten_Division_Implementation_Plan.md`](./plans/Kindergarten_Division_Implementation_Plan.md)**
* **[`plans/Multi-Program & Academic Scheduling Implementation Plan.md`](./plans/Multi-Program%20%26%20Academic%20Scheduling%20Implementation%20Plan.md)**

#### Attendance & Kiosk Operations
* **[`plans/Admin Attendance & Staff Kiosk Implementation Plan.md`](./plans/Admin%20Attendance%20%26%20Staff%20Kiosk%20Implementation%20Plan.md)**
* **[`plans/Corporate Event Attendance — Implementation Plan (Audited).md`](./plans/Corporate%20Event%20Attendance%20%E2%80%94%20Implementation%20Plan%20%28Audited%29.md)** *(Revisions: [`Revised`](./plans/Corporate%20Event%20Attendance%20%E2%80%94%20Implementation%20Plan%20%28Revised%29.md), [`Initial`](./plans/Corporate%20Event%20Attendance%20%E2%80%94%20Implementation%20Plan.md))*

#### Admissions, Students & Payments
* **[`plans/Payment Plans Implementation Plan.md`](./plans/Payment%20Plans%20Implementation%20Plan.md)**
* **[`plans/Student Applications & Admissions Implementation Plan.md`](./plans/Student%20Applications%20%26%20Admissions%20Implementation%20Plan.md)**
* **[`plans/Student Roster & Real-World Operations Implementation Plan.md`](./plans/Student%20Roster%20%26%20Real-World%20Operations%20Implementation%20Plan.md)**

#### Marketing & School Outreach
* **[`plans/Gorontalo City School Outreach Map — Implementation Plan (Revised, Audited).md`](./plans/Gorontalo%20City%20School%20Outreach%20Map%20%E2%80%94%20Implementation%20Plan%20%28Revised%2C%20Audited%29.md)** *(Revisions: [`Revised`](./plans/Gorontalo%20City%20School%20Outreach%20Map%20%E2%80%94%20Implementation%20Plan%20%28Revised%29.md), [`Audited`](./plans/Gorontalo%20City%20School%20Outreach%20Map%20%E2%80%94%20Implementation%20Plan%20%28Audited%29.md), [`Initial`](./plans/Gorontalo%20School%20Outreach%20Map%20%26%20Progression%20Tracker.md))*

#### Staff Operations & Directives
* **[`plans/Staff_Directives_and_Task_Modernization_Implementation_Plan.md`](./plans/Staff_Directives_and_Task_Modernization_Implementation_Plan.md)** *(Summary: [`plans/Staff Directives & Task System Modernization.md`](./plans/Staff%20Directives%20%26%20Task%20System%20Modernization.md))*
* **[`plans/Staff_Directory_Real-World_Operations_Implementation_Plan.md`](./plans/Staff_Directory_Real-World_Operations_Implementation_Plan.md)** *(Summary: [`plans/Staff Directory & Real-World Operations Implementation Plan.md`](./plans/Staff%20Directory%20%26%20Real-World%20Operations%20Implementation%20Plan.md))*
* **[`plans/Staff Invitation System Modernization - Implementation Plan.md`](./plans/Staff%20Invitation%20System%20Modernization%20-%20Implementation%20Plan.md)**

#### Governance, Reliability & Platform Engineering
* **[`plans/Manager Badge Policy — Revised Implementation Plan.md`](./plans/Manager%20Badge%20Policy%20%E2%80%94%20Revised%20Implementation%20Plan.md)** *(Revisions: [`Audited`](./plans/Manager%20Badge%20Policy%20%E2%80%94%20Implementation%20Plan%20%28Audited%29.md), [`Initial`](./plans/Manager%20Badge%20Policy%20%E2%80%94%20Implementation%20Plan.md))*
* **[`plans/Modern Native PWA — Implementation Plan.md`](./plans/Modern%20Native%20PWA%20%E2%80%94%20Implementation%20Plan.md)**
* **[`plans/Implementation Plan — Spark Scale & Log Retention — Revised.md`](./plans/Implementation%20Plan%20%E2%80%94%20Spark%20Scale%20%26%20Log%20Retention%20%E2%80%94%20Revised.md)** *(Initial: [`plans/Implementation Plan — Spark Scale & Log Retention.md`](./plans/Implementation%20Plan%20%E2%80%94%20Spark%20Scale%20%26%20Log%20Retention.md))*
* **[`plans/Reports & Attendance System Modernization.md`](./plans/Reports%20%26%20Attendance%20System%20Modernization.md)**
* **[`plans/Reliability_and_Config_Hardening_Implementation_Plan.md`](./plans/Reliability_and_Config_Hardening_Implementation_Plan.md)**
* **[`plans/Large_File_Splitting_Implementation_Plan.md`](./plans/Large_File_Splitting_Implementation_Plan.md)**
* **[`plans/Walkthrough 4-Branch Multi-Campus Support.md`](./plans/Walkthrough%204-Branch%20Multi-Campus%20Support.md)**

---

## 🤖 Guide for Developers & AI Agents

When working on this codebase:
1. **Start with [`README.md`](../README.md) and [`AGENTS.md`](../AGENTS.md)** for developer instructions, safety rules, and coding standards.
2. **Consult [`ARCHITECTURE.md`](./ARCHITECTURE.md)** before modifying architecture, directory structures, data models, or cross-domain boundaries.
3. **Follow the Documentation Schema**:
   - Audit findings and checklists belong in `docs/audits/`.
   - Architectural proposals belong in `docs/proposals/`.
   - Implementation plans belong in `docs/plans/`.
   - Keep `docs/` root clean (containing only `ARCHITECTURE.md` and this `README.md`).
4. **Update documentation**: When an approved change alters implementation plans or architecture, update the corresponding document and reflect changes in this index.
