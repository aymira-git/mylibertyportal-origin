/**
 * Shared WhatsApp Message Builders for Receipts & Renewal Reminders
 */

export function formatIDR(value) {
  const num = Number(value) || 0;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(num);
}

export function normalizeWhatsAppNumber(phone) {
  if (!phone) return "";
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("0")) {
    return "62" + cleaned.slice(1);
  }
  if (cleaned.startsWith("62")) {
    return cleaned;
  }
  if (cleaned.startsWith("8")) {
    return "62" + cleaned;
  }
  return cleaned;
}

function formatReceiptDate(val, fallback = null) {
  if (!val) return fallback;
  if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}$/.test(val.trim())) {
    const [y, m, d] = val.trim().split("-").map(Number);
    const dateObj = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    return dateObj.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  }
  const d = new Date(val);
  if (isNaN(d.getTime())) return fallback;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "Asia/Makassar",
  });
}

/**
 * Builds the text for the official electronic payment receipt.
 */
export function buildWhatsAppReceiptMessage(rcp) {
  const dateStr = formatReceiptDate(rcp.recordedAt, "N/A");
  const validThroughStr = formatReceiptDate(rcp.coverageEnd || rcp.paidUntil, null);

  const lines = [
    `*MY LIBERTY INTERNATIONAL ENGLISH SCHOOL*`,
    `*Official Payment Receipt*`,
    `---------------------------------------`,
    `*Receipt No:* ${rcp.receiptNumber || "N/A"}`,
    `*Student Name:* ${rcp.studentName}`,
    rcp.planName ? `*Payment Plan:* ${rcp.planName}` : null,
    `*Billing Period:* ${rcp.period}`,
    validThroughStr ? `*Valid Through:* ${validThroughStr}` : null,
    `*Payment Method:* ${rcp.method}`,
    `*Amount Paid:* ${formatIDR(rcp.amount)}`,
    `*Date:* ${dateStr}`,
    rcp.notes ? `*Notes:* ${rcp.notes}` : null,
    `---------------------------------------`,
    `Thank you for your payment! This is an official electronic receipt issued by MY LIBERTY.`,
  ].filter(Boolean);

  return lines.join("\n");
}

/**
 * Builds the text for the tuition renewal reminder message.
 */
export function buildWhatsAppRenewalReminderMessage({
  student,
  paidUntil,
  planLabel,
  remainingDays,
}) {
  const studentName = student?.displayName || "Student";
  const validUntilStr = formatReceiptDate(paidUntil, "recently");

  const planText = planLabel ? `*${planLabel}* plan` : "tuition plan";

  let statusSentence;
  if (remainingDays !== null && remainingDays !== undefined && remainingDays < 0) {
    statusSentence = `The ${planText} for *${studentName}* expired on *${validUntilStr}*.`;
  } else if (remainingDays === 0) {
    statusSentence = `The ${planText} for *${studentName}* expires *today* (*${validUntilStr}*).`;
  } else if (remainingDays !== null && remainingDays !== undefined) {
    statusSentence = `The ${planText} for *${studentName}* is due for renewal on *${validUntilStr}* (${remainingDays} day${remainingDays === 1 ? "" : "s"} remaining).`;
  } else {
    statusSentence = `The ${planText} for *${studentName}* is due for renewal.`;
  }

  const lines = [
    `*MY LIBERTY INTERNATIONAL ENGLISH SCHOOL*`,
    `*Tuition & Enrollment Renewal Reminder*`,
    `---------------------------------------`,
    `Dear Parent / Student of *${studentName}*,`,
    ``,
    `Greetings from My Liberty!`,
    statusSentence,
    ``,
    `To ensure uninterrupted learning and retain class batch placement, please contact the Front Office or reply to this message for renewal assistance.`,
    `---------------------------------------`,
    `Warm regards,`,
    `*My Liberty International English School*`,
  ];

  return lines.join("\n");
}
