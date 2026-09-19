# Payment Plans Implementation Plan (1, 3, 6, 12, 24 Months) — v3

> v2 fixed the legacy-status, pending/expiry conflict, date-math, missing start date, and duplicated-WhatsApp-logic issues found in the first review. v3 adds two things the user explicitly asked for: a flexible "Custom" payment mode, and a choice between stacking a renewal on top of remaining coverage or resetting it. Changes from v2 are marked 🔧v3.

## 1. Overview & Objectives

Currently, tuition payments in MyLiberty Portal are recorded on a one-off monthly basis (`lastPaymentPeriod: "September 2026"`, `amount: 350000`). Front Office staff must manually track month-to-month renewals, and students who pay for multiple months upfront (e.g. quarterly or annually) have to be manually noted in text fields.

This feature introduces **Multi-Duration Payment Plans** (1, 3, 6, 12, and 24 Months — plus a **Custom** fallback) into the financial workflow, student profiles, roster management, and WhatsApp receipts.

---

## 2. Core Architecture & Data Model

### 2.1 Single Source of Truth (`src/constants/paymentPlans.js`)

`PAYMENT_PLANS` holds only the 5 fixed-duration tiers — unchanged from v2 (`monthly`, `quarterly`, `semester`, `annual`, `biennial`, each with `months`, `discountPercent`, `badgeTone`, `description`).

🔧v3: **"Custom" is intentionally not a `PAYMENT_PLANS` entry.** It has no fixed months or discount rate, so it doesn't fit the same shape — it's handled as a separate mode in the Payment Modal (§3.1) rather than a 6th object in this constants file. Keeps the constants file as pure, uniform plan data.

### 2.2 Helper Functions

Unchanged from v2:
- `calculatePlanPricing(planId, baseMonthlyRate)`
- `calculateCoveragePeriod(startDate, months)`
- `calculateExpiryDate(startDate, months)` — uses `date-fns` `addMonths` for correct month-length clamping
- `getPaymentHealthStatus(paidUntil)` → `active` / `due_soon` / `expired` / `legacy` (gray, shown whenever `paidUntil` is missing)

🔧v3 note: `legacy` now covers two cases, not one — an old student record from before this feature existed, **and** a Custom payment where staff didn't set an end date. Both render identically as "No Plan Set," which is accurate in both cases: neither has a tracked expiry.

### 2.3 Firestore Schema Updates

#### `users/{studentId}` (Student Profile)
- `paymentPlan`: `"monthly" | "quarterly" | "semester" | "annual" | "biennial" | "custom"`
- `paidUntil`: ISO date string, or **absent** — for legacy records, or for a Custom payment where no end date was given
- `lastPaymentAmount`, `lastPaymentDate`, `lastPaymentPeriod`, `paymentStatus` — unchanged from v2

`markPaymentPending` still clears `paidUntil` when a payment is reversed (unchanged from v2).

#### `payments/{paymentId}` (Payment Record)
- `planId`: `"monthly" | "quarterly" | "semester" | "annual" | "biennial" | "custom"`
- `planMonths`, `baseRate`, `discountAmount` — **`null` when `planId` is `"custom"`**, since none of those apply
- `amount`: number (final paid nominal — manually entered for Custom, calculated for the 5 fixed plans)
- `coverageStart`: string (YYYY-MM-DD) — see §3.1 for how this is chosen when renewing early
- `coverageEnd`: string (YYYY-MM-DD), or **absent for Custom if staff leaves it blank**
- `period`: formatted description — for Custom, this is just whatever free text staff typed, same as today

---

## 3. UI & Flow Integration

### 3.1 Payment Modal (`src/features/finance/PaymentModal.jsx`)

**Plan selector** — 6 chips total: `1 Mo`, `3 Mo`, `6 Mo`, `12 Mo`, `24 Mo`, and 🔧v3 **`Custom`**.

**When a fixed-duration plan (1/3/6/12/24) is selected:**
- Automatic amount calculation via `calculatePlanPricing`, with the existing quick-amount chips still available as a manual override (unchanged from v2).
- 🔧v3 **Start Date Mode** — only shown when the student's current `paidUntil` is still in the future (i.e. `getPaymentHealthStatus` returns `active` or `due_soon`):
  - **"Extend from current plan"** *(default)* — coverage start is set to the day after the student's existing `paidUntil`. This is what most renewals should do: a student paying early for their next term shouldn't lose the days they already paid for.
  - **"Start today instead"** — explicit override; coverage starts from today, discarding whatever time was left on the old `paidUntil`. For deliberate resets (plan changes, correcting an error) — not the default, so it can't happen by accident.
  - If the student has no future `paidUntil` (expired or never set), there's nothing to extend from — the modal just shows a plain Coverage Start Date field defaulting to today, no toggle.
- **Coverage Preview** — start/end dates computed from whichever start date was resolved above, plus the plan's `months`.

**When Custom is selected:** 🔧v3
- Reverts to the original fields: free-text **Billing Period** label (e.g. "Term 1" or a one-off description) and a manually-entered **Amount** — no auto-calculation, no discount applied.
- An optional **Coverage End Date** field, left blank by default. If staff fill it in, `paidUntil` is set as normal and the roster tracks it like any other plan. If left blank, the student falls into the `legacy`/"No Plan Set" state until their next payment.

**WhatsApp Official Receipt & Print Receipt** — unchanged from v2, reflects whichever plan (including Custom) and coverage dates were actually recorded.

### 3.2 Student Profile & User Form (`UserForm.jsx` & `studentRecord.js`)
Unchanged from v2 — `paymentPlan` selector added to the existing "Academic & Enrollment Details" section. 🔧v3: the dropdown includes a `Custom` option alongside the 5 fixed plans, matching the modal.

### 3.3 Student Roster Table (`src/features/students/StudentRoster.jsx`)
Unchanged from v2 — plan/expiry pill driven by `getPaymentHealthStatus(paidUntil)`, with the gray "No Plan Set" fallback for anything without a tracked `paidUntil` (legacy records and undated Custom payments alike).

### 3.4 WhatsApp Renewal Reminder
Unchanged from v2 — shared `receiptMessages.js` builds both the receipt and the reminder text.

---

## 4. Proposed Changes

| File | Change Type | Description |
|---|---|---|
| `src/constants/paymentPlans.js` | `[NEW]` | Definitions for the 5 fixed-duration plans, discount rates, pricing calculations, and expiry date helpers (using `date-fns`). Does not include Custom — that's a Payment Modal mode, not a plan entry. |
| `src/features/shared/index.js` | `[MODIFY]` | Re-export payment plan constants and helpers (same pattern as `levels.js`). |
| `src/features/finance/receiptMessages.js` | `[NEW]` | Shared builder for the WhatsApp receipt message and the renewal reminder message. |
| `src/features/finance/paymentsRepository.js` | `[MODIFY]` | `recordPayment` writes plan fields (nullable for Custom) atomically; `markPaymentPending` clears `paidUntil`. |
| `src/features/finance/PaymentModal.jsx` | `[MODIFY]` | Add plan selector (incl. Custom mode), Start Date Mode toggle for early renewals, coverage preview, updated receipt generation. |
| `src/features/students/studentRecord.js` | `[MODIFY]` | Support `paymentPlan` (incl. `"custom"`) and `paidUntil` in canonical student records. |
| `src/features/students/UserForm.jsx` | `[MODIFY]` | Add Payment Plan selector (incl. Custom) in the Academic & Enrollment section. |
| `src/features/students/StudentRoster.jsx` | `[MODIFY]` | Plan/expiry pill with legacy fallback, renewal reminder button. |
| `package.json` | `[MODIFY]` | Add `date-fns` dependency. |

---

## 5. Verification Plan

### Automated Build & Lint Verification
- `npm run lint`
- `npm run build`

### Manual Verification
- Select 3 Month plan → amount updates to Rp 997.500, coverage period spans 3 months.
- Select 12 Month plan → coverage extends 1 full year.
- Select **Custom** → billing period free text + manual amount work as before, no discount applied, no Start Date Mode toggle shown.
- Record a Custom payment with no end date → student shows **"No Plan Set"** on the roster, not "Expired."
- A student with **no** `paidUntil` at all (legacy) → also shows "No Plan Set," not "Expired."
- Click "Reset to Pending" on an active-plan student → roster no longer shows them as Active afterward.
- 🔧v3: A student with 2 months left on a 6-month plan pays for another 6 months, choosing **"Extend from current plan"** → confirm new `paidUntil` = old `paidUntil` + 6 months (not today + 6 months).
- 🔧v3: Same student, choosing **"Start today instead"** → confirm `paidUntil` recalculates from today, and this only happens when explicitly chosen.
- Record a payment with a Jan 31 start date on a 1-month plan → `paidUntil` lands on Feb 28/29, not early March.
- Trigger the WhatsApp renewal reminder on a Due Soon / Expired student → message text is distinct from the receipt message.
