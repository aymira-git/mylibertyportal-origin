# MyLiberty Portal — Operational Audit Execution Plan & Implementation Status

> **Document Date:** September 24, 2026  
> **Authority:** `AGENTS.md` → `docs/ARCHITECTURE.md` → Execution Brief (2026-09-24)  
> **Test Status:** 48 test files passed (673 tests passing). 0 ESLint errors. Applet compiled.

---

## 1. Executive Summary & Item-by-Item Status

This document records the exact status and architectural compliance of all 8 work items defined in the 2026-09-24 Operational Audit Review and Execution Brief.

| # | Item | Status | Key Deliverables & Codebase Locations |
|---|---|---|---|
| **1** | **Front Office Dashboard** | **COMPLETED & LOCKED** | `src/features/dashboard/frontoffice/FrontOfficeDashboard.jsx`, `FrontDeskCashReconcile.jsx`, `ShiftReconciliationModal.jsx`. Isolated scope (Kiosk, Today's Inquiries, Cashier, Personal Shifts, Daily Cash Reconcile). Embeds `cashReconciliation` on shift documents with dynamic tolerance calculation (`Math.min(25000, 1%)`). Manager financials strictly excluded. |
| **2** | **Placement Test History** | **COMPLETED & LOCKED** | `src/schemas/deskInquirySchema.js`, `studentRecord.js`, `PlacementTestModal.jsx`. Stores test records inside `placementTests: []` array (`score`, `assessedLevel`, `testedBy`, `testedAt`, `notes`) across leads, applications, and student profiles without creating a new collection. |
| **3** | **Lead → Student Conversion Pipeline** | **COMPLETED & LOCKED** | `WalkInInquiryTab.jsx`, `WalkInTable.jsx`, `UserForm.jsx`. Non-destructive "Convert to Student" flow preserves lead document with `status: "converted"` and `convertedTo: <studentId>`, carrying forward contact info and `placementTests: []`. Per owner's business directive (2026-09-24), manual tuition plan entry is intentionally retained without blocking gates to accommodate frequent price fluctuations, with complete audit logging and balance tracking in the tuition system. |
| **4** | **Parent & Student Information Portal** | **COMPLETED & LOCKED** | `ParentPortalPage.jsx`, `parentPortalRepository.js`. Public read-only routes (`/parent`, `/portal`, `/parent-portal`) with bounded student lookups (NIS / phone), level progression, and tuition status. Zero-cost direct WhatsApp integration (`wa.me/`) with no third-party SMS/messaging fees. |
| **5** | **School Outreach Map vs. Digital Leads** | **ON HOLD (Untouched)** | Retained existing `/schoolOutreach` as-is. No code deleted or deprioritized, awaiting owner's lead-source data. Multi-branch scoping will be applied in Item 8. |
| **6** | **Station Kiosk Split** | **COMPLETED & LOCKED** | `StandaloneKioskPage.jsx`, `src/App.jsx`. Route split into `/kiosk/staff` and `/kiosk/students` to eliminate lobby congestion on reception tablets. Backend Firestore schema unchanged. |
| **8** | **Multi-Branch Data Isolation (`branchId`)** | **COMPLETED & FULLY WIRED** | Phase 1 & 2 complete: Automated test matrix (`securityRulesMatrix.test.js`), hardened `firestore.rules` (cross-branch overwrite prevention, delete null-safety, invite spoofing prevention, shift branch isolation, class update isolation, 4-inbox approvals), schema & repository canonicalization across `batchSchema`, `applicationSchema`, `studentRecord`, `invitesRepository`, and bounded backfill migration tool in `BranchHealthAuditCard.jsx` / `branchAuditRepository.js`. |
| **7** | **Maker-Checker Dual-Control Approval Engine** | **COMPLETED & FULLY WIRED** | `src/features/shared/approvalGates.js`, `approvalGates.test.js`, and `firestore.rules` operational with 4 inboxes (`admin`, `manager`, `instructor_leader`, `ops_lead`). Live dual-control inboxes wired into `AdminDashboard`, `ManagerDashboard`, `InstructorDashboard`, and `FrontOfficeDashboard`. Endpoints wired in `PaymentModal`, `shiftsRepository`, `ShiftAdjustmentModal`, `PlacementTestModal`, and `BatchModal`. |

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

## 3. Implementation Details: Multi-Branch Isolation (Item 8)
 
Both phases of Multi-Branch Data Isolation are fully delivered and verified:
1. **User Schema & Profiles**:
   - `studentRecord.js` and `usersRepository.js` populate both `branchId` (canonical slug, e.g. `kota_gorontalo`, `limboto`) and `branch` (display name, e.g. `Kota Gorontalo`, `Limboto`).
   - `StaffSignup.jsx` derives `branchId: branchToId(...)` when new staff register.
   - `invitesRepository.js` writes canonical `branchId` to invite documents.
2. **Document Partitioning & Schemas**:
   - `batchSchema.js` normalizes `branchId: branchToId(data.branchId || data.branch)`.
   - `applicationSchema.js` normalizes `branchId: branchToId(data.branchId || data.branch)`.
   - `paymentSchema.js`, `deskInquirySchema.js`, and `schoolOutreachSchema.js` enforce both `branch` and `branchId`.
3. **Firestore Security Rules**:
   - Scoped `read`, `create`, `update`, `delete` permissions across `users`, `applications`, `payments`, `deskInquiries`, `classes`, `shifts`, and `schoolOutreach` via `isSameBranch(resource.data)` and `isSameBranch(request.resource.data)`.
   - Hardened cross-branch move prevention: updating existing records requires both the current state and requested state to match the user's branch.
   - Admin exemption: `isAdmin()` maintains cross-branch oversight without partition limits.
4. **Bounded Backfill Migration Tooling**:
   - `branchAuditRepository.js`: Implemented `migrateLegacyBranchBatch(collectionId, batchSize)` and `migrateAllLegacyCollections(batchSizePerCollection)`.
   - `BranchHealthAuditCard.jsx`: Interactive UI allowing admins to trigger single-collection or all-collection bounded backfills with 1-click, real-time audit re-scan, and zero disruption to production operations.

---

## 4. Verification Record
- `compile_applet`: **Build succeeded**
- `npm run lint`: **0 errors, 0 warnings**
- `npm test`: **45 test suites passed (643 unit/integration tests passing)**
