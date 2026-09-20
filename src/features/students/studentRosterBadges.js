import { PAYMENT_PLANS } from "../shared";
import { normalizeWhatsAppNumber } from "../finance/receiptMessages";
import { STUDENT_STATUS_MAP } from "./studentRecord";

export function getInitials(name) {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

export function getStudentPlanLabel(student) {
  if (!student.paymentPlan) return null;
  if (student.paymentPlan === "custom") return "Custom";
  return PAYMENT_PLANS[student.paymentPlan]?.label || student.paymentPlan;
}

export function getHealthBadgeClasses(tone) {
  switch (tone) {
    case "emerald":
      return "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 hover:ring-emerald-400";
    case "amber":
      return "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 hover:ring-amber-400";
    case "rose":
      return "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100 hover:ring-rose-400";
    case "slate":
    default:
      return "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200 hover:ring-slate-400";
  }
}

export function getHealthBadgeReadOnlyClasses(tone) {
  switch (tone) {
    case "emerald":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "amber":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "rose":
      return "bg-rose-50 text-rose-700 border-rose-200";
    case "slate":
    default:
      return "bg-slate-100 text-slate-600 border-slate-200";
  }
}

export function getStatusBadge(status) {
  const eff = status || "active";
  return STUDENT_STATUS_MAP[eff] || STUDENT_STATUS_MAP.active;
}

export function openWhatsAppParentChat(parentPhone, parentName, studentName) {
  const formatted = normalizeWhatsAppNumber(parentPhone);
  if (!formatted) return;
  const greeting = parentName ? `Halo Bapak/Ibu ${parentName}, ` : "Halo, ";
  const text = `${greeting}kami dari Liberty English Course ingin menginformasikan mengenai ananda ${studentName || "siswa"}...`;
  const url = `https://wa.me/${formatted}?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank");
}
