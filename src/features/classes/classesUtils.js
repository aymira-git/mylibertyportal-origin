import { normalizeWhatsAppNumber } from "../finance/receiptMessages";

export const getEnrollment = (cls, studentId) =>
  (cls.enrollments || []).find((enrollment) => enrollment.studentId === studentId) || {};

export const getDuration = (dateJoined) => {
  if (!dateJoined) return "Not recorded";
  const joined = new Date(`${dateJoined}T00:00:00`);
  if (Number.isNaN(joined.getTime())) return "Not recorded";
  const now = new Date();
  let months = (now.getFullYear() - joined.getFullYear()) * 12 + now.getMonth() - joined.getMonth();
  if (now.getDate() < joined.getDate()) months -= 1;
  if (months < 1) return "Joined this month";
  const years = Math.floor(months / 12);
  months %= 12;
  return [
    years ? `${years} yr${years === 1 ? "" : "s"}` : "",
    months ? `${months} mo${months === 1 ? "" : "s"}` : "",
  ]
    .filter(Boolean)
    .join(" ");
};

export const openWhatsAppParentChat = (parentPhone, studentName, cls, toast) => {
  const formatted = normalizeWhatsAppNumber(parentPhone);
  if (!formatted) {
    if (toast) toast("No valid parent phone number recorded.", "error");
    return;
  }
  const text = `Halo Bapak/Ibu, kami dari Liberty English School ingin menginformasikan mengenai ananda ${studentName || "siswa"} di kelas ${cls.className}...`;
  const url = `https://wa.me/${formatted}?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank");
};
