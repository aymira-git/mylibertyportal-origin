import { exportTableCSV, getPaymentHealthStatus } from "../shared";
import { getStudentPlanLabel } from "./studentRosterBadges";

export function exportStudentRosterCSV(sortedStudents) {
  const headers = [
    "Student Name",
    "Parent Contact",
    "Status",
    "Education",
    "DOB",
    "Joined",
    "Payment Status",
    "Plan",
    "Paid Until",
    "Class",
    "Instructor",
  ];
  const rows = sortedStudents.map((s) => {
    const planLabel = getStudentPlanLabel(s) || "—";
    const isPending = s.paymentStatus === "pending";
    const health = isPending ? { label: "Pending" } : getPaymentHealthStatus(s.paidUntil);
    return [
      s.displayName || "",
      `${s.parentName || "N/A"} (${s.parentPhone || "N/A"})`,
      s.effectiveStatus || "active",
      s.educationLevel || s.schoolOrJob || "N/A",
      s.dob || "N/A",
      s.effectiveJoinedDate || "N/A",
      health.label,
      planLabel,
      s.paidUntil || s.lastPaymentPeriod || "—",
      s.studentClasses.length
        ? s.studentClasses.map((c) => c.className).join(", ")
        : "Unassigned",
      s.studentClasses.length
        ? s.studentClasses.map((c) => c.instructorName || "Unassigned").join(", ")
        : "—",
    ];
  });
  exportTableCSV(`student-roster-${new Date().toISOString().slice(0, 10)}`, headers, rows);
}
