# Front Office Operations Enhancement Plan — Revised

> **Date:** 2026-09-23  
> **Status:** Approved & Adopted  
> **Target Dashboard:** `FrontOfficeDashboard.jsx` & `KidsFrontOfficeDashboard.jsx`  
> **Reference Standards:** `AGENTS.md`, `docs/ARCHITECTURE.md`

## 0. Revision Summary

The audited plan has been revised and strengthened to ensure complete financial accuracy, minimal Firestore read consumption, and seamless UI integration.

### Core Architectural Decisions & Guardrails:

1. **Separation of Concerns:**
   - **Recent Payment History:** Bounded query (`limit(50)`, ordered by `recordedAt desc`). Used solely for viewing, receipt lookup, and search.
   - **Today's Financial Reconciliation:** Uncapped query for the current WITA calendar day (`recordedAt >= dayStartUtc` and `recordedAt < dayEndUtc`). Guarantees that even with >50 payments in a day, every transaction is accounted for.
2. **Branch Scoping Realism:**
   - As per repository audit, front-desk staff accounts do not currently have an isolated per-branch Firestore tenancy filter.
   - Cash reconciliation totals and cashier views are explicitly presented with clear dashboard-wide labeling (or authenticated branch if specified in profile) rather than fabricating fake branch filters.
3. **Single Source of Truth for Finance:**
   - `PaymentCashierTab` and `TuitionDueWidget` invoke the existing, battle-tested `PaymentModal`. No duplicate payment-entry forms or fragmented calculation logic.
4. **Shared Status & Timezone Helpers:**
   - Uses `getPaymentHealthStatus(student.paidUntil)` from `src/features/shared/` for due/expired classification.
   - Uses `dateWita.js` (`startOfTodayWitaIso`, `todayWita`, `getTodayWitaWeekday`, `WITA_OFFSET_MS`) for mathematically exact WITA day boundaries.
   - Uses `doDaysOverlap(...)` from `src/constants/scheduleDays.js` for room and class schedule detection.
5. **Mobile Navigation Discipline:**
   - `Cashier` is placed in the primary tabs for immediate receptionist access.
   - `Walk-ins` (Buku Tamu) is cleanly nested or placed in secondary/more navigation so mobile viewport and shell remain clean and uncrowded.

---

## 1. Feature Specifications

### Feature 1: Front Desk Cashier & Payment History (`PaymentCashierTab.jsx`)
- **Direct Desk Payment Entry:** Fast "Record Payment" button opening a student search picker, which then launches the canonical `PaymentModal`.
- **Recent Payments Table:**
  - Bounded query (`limit(50)`), ordered by `recordedAt desc`.
  - Displays: Date/Time (WITA), Student Name, Program, Plan & Period, Method (Cash, Transfer, QRIS), Amount (IDR via `formatIDR`).
  - Action buttons: View Digital Receipt, Send WhatsApp Receipt.
  - Client-side search (student name) and method filter.

### Feature 2: Daily Cash Reconciliation & Shift Closing (`FrontDeskCashReconcile.jsx`)
- Computes complete totals for current WITA calendar day:
  - Total Cash (Tunai)
  - Total Transfer
  - Total QRIS
  - Overall Total Payments & Count
- **Shift Handover Report:** Generates a clean WhatsApp/clipboard message summarizing the shift's financial intake for the manager.

### Feature 3: Walk-in Inquiries & Prospect Log (`WalkInInquiryTab.jsx`)
- Stores prospective students/parents in `/deskInquiries/{inquiryId}`.
- Validated via Zod (`deskInquirySchema.js`).
- `createdBy` stamped from current authenticated user (`auth.currentUser`).
- Status flow: `inquired`, `follow_up_sent`, `enrolled`, `closed`.
- WhatsApp quick follow-up trigger with program details and registration link.

### Feature 4: Tuition Due & Expiry Alert Widget (`TuitionDueWidget.jsx`)
- Rendered on the Front Office **Overview** screen.
- Scans students already in memory from `useDashboardData` (0 extra Firestore reads).
- Flags `expired` and `due_soon` students.
- Direct "Record Payment" (opens `PaymentModal`) or "WhatsApp Reminder" button.

### Feature 5: Today's Live Class & Room Board (`TodayScheduleBoard.jsx`)
- Rendered on the Front Office Overview.
- Reuses in-memory `classes` from `useDashboardData` (0 extra Firestore reads).
- Matches classes using `doDaysOverlap` with today's WITA day.
- Displays Room, Time slot, Class name, Instructor name, and enrolled student count.

---

## 2. Security Rules (`firestore.rules`)
Add access rule for `/deskInquiries/{inquiryId}`:
```javascript
match /deskInquiries/{inquiryId} {
  allow read: if isAdmin() || isManager() || isFrontOffice();
  allow create, update: if isAdmin() || isFrontOffice();
  allow delete: if isAdmin();
}
```

---

## 3. Implementation Plan & File Checklist
1. `src/schemas/deskInquirySchema.js` & unit test.
2. `src/features/dashboard/frontoffice/deskInquiriesRepository.js` & unit test.
3. `firestore.rules` update for `/deskInquiries`.
4. `src/features/finance/paymentsRepository.js` (add `getRecentPayments` and `getPaymentsForWitaDay`).
5. Build widgets: `TodayScheduleBoard.jsx`, `TuitionDueWidget.jsx`, `FrontDeskCashReconcile.jsx`.
6. Build tabs: `PaymentCashierTab.jsx`, `WalkInInquiryTab.jsx`.
7. Integrate into `FrontOfficeDashboard.jsx` and `KidsFrontOfficeDashboard.jsx`.
8. Run tests, linter, typechecker, and compilation verification.
