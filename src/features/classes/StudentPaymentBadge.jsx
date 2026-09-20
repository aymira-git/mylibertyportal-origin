import { getPaymentHealthStatus } from "../../constants/paymentPlans";

export default function StudentPaymentBadge({ student }) {
  if (!student) return null;
  const health =
    student.paymentStatus === "pending"
      ? { status: "pending", label: "Pending", tone: "amber" }
      : getPaymentHealthStatus(student.paidUntil);

  let badgeClass = "bg-slate-100 text-slate-600 border-slate-200";
  if (health.status === "active") {
    badgeClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
  } else if (health.status === "due_soon") {
    badgeClass = "bg-amber-50 text-amber-700 border-amber-200";
  } else if (health.status === "expired") {
    badgeClass = "bg-rose-50 text-rose-700 border-rose-200";
  } else if (health.status === "pending") {
    badgeClass = "bg-yellow-50 text-yellow-800 border-yellow-200";
  }

  return (
    <span
      className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${badgeClass} inline-flex items-center gap-1`}
      title={`Valid until: ${student.paidUntil || "No Plan"}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          health.status === "active"
            ? "bg-emerald-500"
            : health.status === "due_soon"
            ? "bg-amber-500"
            : health.status === "expired"
            ? "bg-rose-500"
            : "bg-slate-400"
        }`}
      />
      <span>{health.label}</span>
    </span>
  );
}
