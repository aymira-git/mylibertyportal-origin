import { useMemo } from "react";
import { getPaymentHealthStatus, useToast } from "../../shared";
import { buildWhatsAppRenewalReminderMessage, normalizeWhatsAppNumber } from "../../finance/receiptMessages";
import { AlertCircle, CreditCard, MessageCircle, ArrowRight } from "lucide-react";

/**
 * Overview alert widget showing students whose tuition is expired or due soon (<= 8 days / 7 + 1 buffer).
 * Reuses existing in-memory students array from useDashboardData (0 extra Firestore reads).
 */
export default function TuitionDueWidget({
  students = [],
  onOpenPaymentModal = null,
  onNavigateToStudents = null,
  dueSoonThresholdDays = 8,
}) {
  const toast = useToast();

  const flaggedStudents = useMemo(() => {
    return students
      .map((student) => {
        const health = getPaymentHealthStatus(student.paidUntil, dueSoonThresholdDays);
        return { student, health };
      })
      .filter(({ health }) => health.status === "expired" || health.status === "due_soon")
      .sort((a, b) => {
        // expired first, then due_soon
        if (a.health.status === "expired" && b.health.status !== "expired") return -1;
        if (a.health.status !== "expired" && b.health.status === "expired") return 1;
        return (a.student.displayName || "").localeCompare(b.student.displayName || "");
      });
  }, [students, dueSoonThresholdDays]);

  const handleSendReminder = (student) => {
    const rawPhone = student.phone || student.parentPhone;
    const cleanPhone = normalizeWhatsAppNumber(rawPhone);
    if (!cleanPhone) {
      toast("No valid WhatsApp phone number found for this student or parent.", "error");
      return;
    }

    const message = buildWhatsAppRenewalReminderMessage(student);
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    const link = document.createElement("a");
    link.href = waUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (flaggedStudents.length === 0) {
    return null;
  }

  const expiredCount = flaggedStudents.filter((f) => f.health.status === "expired").length;
  const dueSoonCount = flaggedStudents.filter((f) => f.health.status === "due_soon").length;

  return (
    <div className="bg-amber-50/60 rounded-3xl border border-amber-200 p-5 shadow-2xs space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold">
            <AlertCircle className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-extrabold text-amber-950 flex items-center gap-2">
              <span>Tuition Follow-Up Alerts</span>
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-200 text-amber-900">
                {flaggedStudents.length} Students
              </span>
            </h4>
            <p className="text-xs text-amber-800/80 font-medium">
              {expiredCount > 0 && <span>{expiredCount} expired</span>}
              {expiredCount > 0 && dueSoonCount > 0 && <span> • </span>}
              {dueSoonCount > 0 && <span>{dueSoonCount} due soon</span>}
              {" — remind parents at reception or record tuition payment."}
            </p>
          </div>
        </div>

        {onNavigateToStudents && (
          <button
            onClick={onNavigateToStudents}
            className="text-xs font-bold text-amber-900 hover:underline flex items-center gap-1"
          >
            <span>View All in Roster</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {flaggedStudents.slice(0, 6).map(({ student, health }) => {
          const isExpired = health.status === "expired";
          return (
            <div
              key={student.id}
              className="bg-white p-3 rounded-2xl border border-amber-100 flex items-center justify-between gap-2 shadow-2xs"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-xs text-slate-800 truncate">
                    {student.displayName}
                  </span>
                  <span
                    className={`px-1.5 py-0.2 rounded-md font-black text-[9px] uppercase tracking-wider shrink-0 ${
                      isExpired
                        ? "bg-rose-100 text-rose-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {isExpired ? "Expired" : "Due Soon"}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 truncate mt-0.5 font-medium">
                  {student.program || "General"} • Paid until: {student.paidUntil || "None"}
                </p>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleSendReminder(student)}
                  title="Send WhatsApp Reminder"
                  className="p-2 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                </button>
                {onOpenPaymentModal && (
                  <button
                    onClick={() => onOpenPaymentModal(student)}
                    title="Record Payment"
                    className="p-2 rounded-xl bg-[#1a3a8f] text-white hover:bg-[#153075] transition"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
