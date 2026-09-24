# MYLIBERTY Portal — Front Office Dashboard Local Audit Report

> **Document Date:** September 24, 2026  
> **Target Dashboards:** `src/features/dashboard/FrontOfficeDashboard.jsx` & `src/features/dashboard/kids/KidsFrontOfficeDashboard.jsx`  
> **Audited Modules:** `src/features/dashboard/frontoffice/*`, `src/features/finance/*`, `src/features/attendance/*`  
> **Reference Guidelines:** `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/audits/FULL_ARCHITECTURE_AUDIT.md`  
> **Status:** Local Audit Complete — Awaiting Approval  

---

## 1. Executive Summary

This local audit examines the **Front Office Dashboard** domain across both Main (Courses) and Kids (Kindergarten) divisions. It compares the documented operational responsibilities of front-desk personnel against the actual codebase implementation to identify:
1. Features that exist in Front Office but do **not** belong there (over-entitlements, misplaced tabs, domain bleed).
2. Features that are **missing** or disconnected from Front Office but are essential to daily desk operations (unwired cash drawer reconciliation, lack of active shift tracking, missing approvals in Kids).
3. Inconsistencies between Main Front Office and Kids School Front Office.

---

## 2. Core Operational Scope of Front Office

At MYLIBERTY, the Front Desk receptionist manages daily walk-in reception, immediate cashiering, and student service:

1. **Reception & Walk-in Visitors (Buku Tamu):** Greeting visitors/parents, recording inquiries, administering placement tests, and converting prospects to students.
2. **Desk Cashiering & Shift Reconciliation:** Recording tuition payments (Cash, Transfer, QRIS), issuing digital/printed WhatsApp receipts, and performing physical cash drawer counts at shift end.
3. **Student Service & Inquiries:** Fast lookups for student NIS, contact info, attendance history, and badge printing.
4. **Class & Room Awareness:** Live schedule board for today's active classes, rooms, and available batch capacity to direct arriving students and advise prospective parents.
5. **Reception Kiosk Management:** Operating the student QR scan station and managing their own shift check-in.
6. **Dual-Control Operational Approvals (Ops / Front Office Lead):** Authorizing class cancellations/reschedules and reviewing non-management staff shift self-corrections.

---

## 3. Findings: What IS There, but DOES NOT Belong

| # | Item | Location | Evidence & Architectural Analysis |
|---|---|---|---|
| **3.1** | **Corporate Events Management Panel** | `FrontOfficeDashboard.jsx` (Tab: `events`) | `<CorporateEventsPanel />` provides complete management of B2B corporate contracts (creation, audience targeting, contract cancellation). Front Desk staff do not negotiate or manage corporate partnership programs; that belongs to **Branch Managers, Marketing, or Admin**. (Front desk only requires attendance scanning for corporate attendees, which is already handled inside the Kiosk scanner). |
| **3.2** | **Student Profile Hard-Deletion Privilege** | `FrontOfficeDashboard.jsx` (Line 338: `handleDelete={handleDelete}`) | Front Office passes `handleDelete` into `<StudentRoster />`, which triggers `deleteUserProfile(uid)` in `usersRepository.js`. This permanently deletes student documents and strips enrollments across all classes. Under Maker-Checker governance, student withdrawal/freezing requires review (`STUDENT_WITHDRAWAL_OR_FREEZE`). Front desk staff should register, edit contact details, and update active status, but **permanent deletion must be restricted to Admin**. |
| **3.3** | **AI Assistant Panel** | `FrontOfficeDashboard.jsx` & `KidsFrontOfficeDashboard.jsx` (Tab: `aiAssistant`) | Mounted on the primary reception shell. Receptionists handling face-to-face parents, phone inquiries, and cash transactions have no defined operational requirement for an AI chatbot panel on their core operational desk. |
| **3.4** | **Institutional Analytics Bleed in Kids Division** | `KidsFrontOfficeDashboard.jsx` (Line 338: `<ReportsDashboard />`) | The Kids Front Office mounts the full institutional reporting cockpit (`ReportsDashboard`) instead of the privacy-isolated `FrontOfficeReportsTab`. This exposes instructor punctuality ratings, school-wide staff duty rosters, and institutional admission data to front desk personnel, violating the privacy isolation defined in the architecture. |

---

## 4. Findings: What IS NOT There, but SUPPOSED to Be

| # | Item | Target Location | Evidence & Operational Impact |
|---|---|---|---|
| **4.1** | **Unwired Shift Closing & Drawer Count Trigger** | `FrontDeskCashReconcile.jsx` & `PaymentCashierTab.jsx` | **Critical Operational Break:** `ShiftReconciliationModal.jsx` was developed to allow receptionists to enter physical cash/QRIS drawer counts and compute variance against recorded collections. In `FrontDeskCashReconcile.jsx` (lines 178–186), the trigger button (`End Shift & Count Drawer`) is rendered conditionally on `activeShift`. However, neither `FrontOfficeDashboard` nor `PaymentCashierTab` passes `activeShift`. As a result, **the shift-closing and cash drawer reconciliation flow is completely inaccessible in production**. |
| **4.2** | **Desk Staff Active Shift & Clock-In/Clock-Out Status** | `FrontOfficeDashboard.jsx` (Overview Tab) | Front desk staff on duty have no direct widget or banner on their Overview showing whether their shift is currently open, their clock-in time, or a 1-click action to initiate shift closing and drawer reconciliation. They currently must open the full kiosk modal or navigate deep into reports. |
| **4.3** | **Approvals Queue Missing in Kids Division** | `KidsFrontOfficeDashboard.jsx` | `FrontOfficeDashboard` includes the `approvals` tab (`ApprovalInbox`) allowing the Ops / Front Office Lead to approve class schedule changes and instructor shift corrections. `KidsFrontOfficeDashboard` **omits this tab entirely**, leaving Kids desk leads unable to act on operational escalations. |
| **4.4** | **Front Desk Student Quick Search (by NIS / Parent Phone)** | `FrontOfficeDashboard.jsx` (Overview / Cashier) | When parents arrive at the desk asking for their child's schedule, fee balance, or registration status, there is no quick-lookup search bar on the Overview. Receptionists are forced to switch to the full Student Roster tab and wait for all students to load. |
| **4.5** | **Digital Receipt Modal Viewer in Cashier Log** | `PaymentCashierTab.jsx` | The recent payments table provides a direct WhatsApp receipt trigger (`MessageCircle`), but lacks a "View / Print Receipt" button connecting to the existing `DigitalReceiptTab.jsx` component for on-premise physical or PDF receipts. |

---

## 5. Division Alignment: Main Front Office vs. Kids Front Office

| Feature / Screen | Main Front Office (`FrontOfficeDashboard.jsx`) | Kids Front Office (`KidsFrontOfficeDashboard.jsx`) | Recommended Target |
|---|---|---|---|
| **Reporting Scope** | `FrontOfficeReportsTab` (Cash reconcile, daily inquiries, personal shift log) | `ReportsDashboard` (Full institutional reports & punctuality) | **Standardize on `FrontOfficeReportsTab`** |
| **Maker-Checker Approvals** | Has `ApprovalInbox` (`userRole="frontoffice"`) | **Missing** | **Add `ApprovalInbox` to Kids** |
| **Available Batches Widget** | Has `AvailableBatches` capacity widget on Overview | **Missing** | **Add capacity awareness to Kids** |
| **Corporate Events Panel** | Present (Misplaced) | Not Present | **Remove from Main Front Office** |
| **Student Hard-Delete** | Present (Risk) | Present (Risk) | **Remove `handleDelete` from both** |

---

## 6. Proposed Remediation Plan

### Step 1: Remove Misplaced & Risky Features
1. Remove `events` tab (`CorporateEventsPanel`) from `FrontOfficeDashboard.jsx`.
2. Remove `aiAssistant` tab from both Main and Kids Front Office dashboards.
3. Remove `handleDelete` prop passed to `<StudentRoster />` in both dashboards (retaining editing and status management, but restricting deletion to Admin).
4. Replace `ReportsDashboard` in `KidsFrontOfficeDashboard.jsx` with `FrontOfficeReportsTab`.

### Step 2: Restore Missing Shift Reconciliation & Drawer Count Workflow
1. In `useDashboardData.js` or `FrontOfficeDashboard.jsx`, resolve the logged-in staff member's current open shift document via `shiftsRepository.js`.
2. Pass `activeShift`, `currentUser`, and `onShiftClosed` into `PaymentCashierTab` and `FrontDeskCashReconcile`.
3. Ensure the **"End Shift & Count Drawer"** button renders reliably, enabling front desk staff to execute the dual-control cash reconciliation at clock-out.

### Step 3: Add Missing Dashboards & UI Capabilities
1. Add `ApprovalInbox` to `KidsFrontOfficeDashboard.jsx` (`userRole="frontoffice"`).
2. Add digital receipt view/print button alongside WhatsApp share in `PaymentCashierTab.jsx`.
3. Add a quick NIS / student phone lookup widget on the Front Office Overview.
