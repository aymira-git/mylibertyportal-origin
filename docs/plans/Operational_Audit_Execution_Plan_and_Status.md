# MyLiberty Portal — Operational Audit Execution Plan & Implementation Status

> **Document Date:** September 24, 2026  
> **Authority:** `AGENTS.md` → `docs/ARCHITECTURE.md` → Execution Brief (2026-09-24)  
> **Test Status:** 45 test files passed (643 tests passing). 0 ESLint errors. Applet compiled.

---

## 1. Executive Summary & Item-by-Item Status

This document records the exact status and architectural compliance of all 8 work items defined in the 2026-09-24 Operational Audit Review and Execution Brief.

| # | Item | Status | Key Deliverables & Codebase Locations |
|---|---|---|---|
| **1** | **Front Office Dashboard** | **COMPLETED & LOCKED** | `src/features/dashboard/frontoffice/FrontOfficeDashboard.jsx`, `FrontDeskCashReconcile.jsx`, `ShiftReconciliationModal.jsx`. Isolated scope (Kiosk, Today's Inquiries, Cashier, Personal Shifts, Daily Cash Reconcile). Embeds `cashReconciliation` on shift documents with dynamic tolerance calculation (`Math.min(25000, 1%)`). Manager financials strictly excluded. |
| **2** | **Placement Test History** | **COMPLETED & LOCKED** | `src/schemas/deskInquirySchema.js`, `studentRecord.js`, `PlacementTestModal.jsx`. Stores test records inside `placementTests: []` array (`score`, `assessedLevel`, `testedBy`, `testedAt`, `notes`) across leads, applications, and student profiles without creating a new collection. |
| **3** | **Lead → Student Conversion Pipeline** | **COMPLETED & LOCKED** | `WalkInInquiryTab.jsx`, `WalkInTable.jsx`, `UserForm.jsx`. Non-destructive "Convert to Student" flow preserves lead document with `status: "converted"` and `convertedTo: <studentId>`, carrying forward contact info and `placementTests: []`. Standard catalog plans route to Cashier; custom plans route to Branch Manager gate. |
| **4** | **Parent & Student Information Portal** | **COMPLETED & LOCKED** | `ParentPortalPage.jsx`, `parentPortalRepository.js`. Public read-only routes (`/parent`, `/portal`, `/parent-portal`) with bounded student lookups (NIS / phone), level progression, and tuition status. Zero-cost direct WhatsApp integration (`wa.me/`) with no third-party SMS/messaging fees. |
| **5** | **School Outreach Map vs. Digital Leads** | **ON HOLD (Untouched)** | Retained existing `/schoolOutreach` as-is. No code deleted or deprioritized, awaiting owner's lead-source data. Multi-branch scoping will be applied in Item 8. |
| **6** | **Station Kiosk Split** | **COMPLETED & LOCKED** | `StandaloneKioskPage.jsx`, `src/App.jsx`. Route split into `/kiosk/staff` and `/kiosk/students` to eliminate lobby congestion on reception tablets. Backend Firestore schema unchanged. |
| **8** | **Multi-Branch Data Isolation (`branchId`)** | **NEEDS DESIGN (Foundational)** | Requires formal architectural proposal and `firestore.rules` rewrite for branch-scoped roles (`manager`, `opslead`, `instructorleader`, `marketing`, `frontoffice`, `instructor`, `student`) across `users`, `payments`, `shifts`, `applications`, `deskInquiries`, and `schoolOutreach`. |
| **7** | **Maker-Checker Dual-Control Approval Engine** | **FOUNDATION LOCKED (Blocked on #8)** | `src/features/shared/approvalGates.js`, `approvalGates.test.js`. Implements canonical registry, `blocking` vs. `logged` modes, Admin exemption, Admin staff-authority escalations, and the 3-tier self-correction ladder (`staff < opslead < manager < admin`). End-to-end `approverBranchId` routing and Firestore write-blocking will activate once Item 8 is deployed. |

---

## 2. Locked Specifications & Principles

### Dual-Control (Maker-Checker) Registry Table (`approvalGates.js`)

| Approver | Gated Action | Mode | Domain | Note |
|---|---|---|---|---|
| **Admin (Owner / Director)** | `STAFF_ROLE_ELEVATION` | **Blocking** | `staff` | Hardcoded, non-reassignable in config |
| **Admin (Owner / Director)** | `NEW_STAFF_ACCOUNT` | **Blocking** | `staff` | Hardcoded, non-reassignable in config |
| **Admin (Owner / Director)** | `STAFF_DEACTIVATION` | **Blocking** | `staff` | Hardcoded, non-reassignable in config |
| **Branch Manager** | `DISCOUNT_OR_REFUND` | **Blocking** | `finance` | Confirmed |
| **Branch Manager** | `CASH_DISCREPANCY` | **Blocking** | `finance` via `attendance` | Auto-created when discrepancy > threshold |
| **Branch Manager** | `TUITION_PLAN_CHANGE` | **Blocking** | `finance` | Custom / non-standard plan modifications |
| **Branch Manager** | `STUDENT_WITHDRAWAL_OR_FREEZE` | **Logged** | `students` | Immediate for student, reviewed async |
| **Instructor Leader** | `PLACEMENT_LEVEL_OVERRIDE` | **Blocking** | `students` | Confirmed |
| **Instructor Leader** | `SUBSTITUTE_INSTRUCTOR` | **Logged** | `staff` | Immediate to prevent uncovered classes |
| **Ops / Front Office Lead** | `CLASS_CANCELLATION_OR_RESCHEDULE` | **Logged** | `classes` | Immediate for operations |
| **Ops / Front Office Lead** | `RETROACTIVE_STUDENT_ATTENDANCE` | **Blocking** | `attendance` | Confirmed |
| **Ops / Front Office Lead** | `STUDENT_CLASS_TRANSFER` | **Blocking** | `classes` | Confirmed |
| **Dynamic Hierarchy (Self-Correction)** | `STAFF_SHIFT_SELF_CORRECTION` | **Blocking** | `attendance` | See Principle 5 below |
| *Exempt* | Any action by `admin`-role actor | *n/a* | *all* | Admin actions are never gated |

### Core Architectural Principles
1. **Admin Escalation**: Any action granting/modifying someone's access or authority escalates to **Admin (Owner / Director)**, preventing Branch Managers from approving their own staffing/promotion decisions.
2. **Domain Routing**: Specialized domain actions route directly to their respective leads (`Instructor Leader` for pedagogy, `Ops / Front Office Lead` for class scheduling).
3. **Blocking vs. Logged**: Default is `blocking`. `logged` is reserved strictly for time-critical operational actions (substitutions, class cancellations, student freezes) where delay would harm operations. Logged rejection is informational and does not auto-rollback.
4. **Admin Exemption**: Users with the `admin` role are never requesters subject to gating.
5. **Self-Correction Escalation Ladder**:
   - `instructor`, `marketing`, `officeboy`, `instructorleader` self-correct shift → **Ops / Front Office Lead** approves.
   - `frontoffice` / `opslead` self-correct shift → **Branch Manager** approves.
   - `manager` self-corrects shift → **Admin** approves.
   - `admin` self-corrects shift → **Exempt** (`null`).

---

## 3. Plan for Multi-Branch Isolation (Item 8)

Before activating `approverBranchId` and updating Firestore rules:
1. **User Schema**: Standardize `branchId` field on `/users/{uid}` and in Auth token claims.
2. **Document Partitioning**: Tag new records in `deskInquiries`, `applications`, `payments`, `shifts`, and `schoolOutreach` with `branchId`.
3. **Firestore Security Rules**: Scope read/write permissions for `manager`, `opslead`, `instructorleader`, `marketing`, and `frontoffice` to `request.auth.token.branchId == resource.data.branchId`.
4. **Admin Global View**: Ensure `isAdmin()` maintains cross-branch oversight without partition limits.

---

## 4. Verification Record
- `compile_applet`: **Build succeeded**
- `npm run lint`: **0 errors, 0 warnings**
- `npm test`: **45 test suites passed (643 unit/integration tests passing)**
