/**
 * Utility functions for payment analysis and cash drawer reconciliation.
 */

/**
 * Aggregates a list of payment records by payment method (Cash, Transfer, QRIS, Other).
 * Handles alternate naming conventions (e.g. 'tunai', 'bank', 'bank transfer').
 *
 * @param {Array<{ amount?: number | string, method?: string }>} payments
 * @returns {{
 *   cashTotal: number,
 *   transferTotal: number,
 *   qrisTotal: number,
 *   otherTotal: number,
 *   grandTotal: number,
 *   count: number
 * }}
 */
export function summarizePaymentsByMethod(payments = []) {
  let cashTotal = 0;
  let transferTotal = 0;
  let qrisTotal = 0;
  let otherTotal = 0;

  if (!Array.isArray(payments)) {
    return {
      cashTotal: 0,
      transferTotal: 0,
      qrisTotal: 0,
      otherTotal: 0,
      grandTotal: 0,
      count: 0,
    };
  }

  for (const p of payments) {
    const amt = Number(p?.amount) || 0;
    const m = (p?.method || "").trim().toLowerCase();

    if (m === "cash" || m === "tunai") {
      cashTotal += amt;
    } else if (m === "transfer" || m === "bank transfer" || m === "bank") {
      transferTotal += amt;
    } else if (m === "qris") {
      qrisTotal += amt;
    } else {
      otherTotal += amt;
    }
  }

  const grandTotal = cashTotal + transferTotal + qrisTotal + otherTotal;

  return {
    cashTotal,
    transferTotal,
    qrisTotal,
    otherTotal,
    grandTotal,
    count: payments.length,
  };
}
