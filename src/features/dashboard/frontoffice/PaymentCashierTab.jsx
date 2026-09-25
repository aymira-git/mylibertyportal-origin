import { useState, useEffect, useMemo, useCallback } from "react";
import { getRecentPayments } from "../../finance/paymentsRepository";
import { formatIDR, buildWhatsAppReceiptMessage, normalizeWhatsAppNumber } from "../../finance/receiptMessages";
import { PaymentModal } from "../../finance";
import FrontDeskCashReconcile from "./FrontDeskCashReconcile";
import { useToast } from "../../shared";
import { branchToId } from "../../../constants/branches";
import {
  CreditCard,
  PlusCircle,
  Search,
  MessageCircle,
  RefreshCw,
  Clock,
  User,
  X,
} from "lucide-react";

/**
 * Dedicated Front Desk Cashier & Payment Management Tab.
 *
 * Provides direct payment intake without drilling into the student roster,
 * live recent transaction log (bounded limit 50), receipt resending,
 * and daily cash reconciliation.
 */
export default function PaymentCashierTab({
  students = [],
  onPaymentRecorded = null,
  branchLabel = null,
}) {
  const toast = useToast();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [methodFilter, setMethodFilter] = useState("all");

  // State for opening the canonical PaymentModal
  const [selectedStudentForPayment, setSelectedStudentForPayment] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");

  const cashierBranchId = branchToId(branchLabel || "");

  const loadPayments = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getRecentPayments(50, cashierBranchId);
      setPayments(list);
    } catch (err) {
      console.error("Failed to load recent payments:", err);
      toast("Could not load recent payments.", "error");
    } finally {
      setLoading(false);
    }
  }, [toast, cashierBranchId]);

  useEffect(() => {
    let active = true;
    getRecentPayments(50, cashierBranchId)
      .then((list) => {
        if (active) {
          setPayments(list);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          console.error("Failed to load recent payments:", err);
          toast("Could not load recent payments.", "error");
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [toast, cashierBranchId]);

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      // Find matching student name from students list or recorded studentName
      const student = students.find((s) => s.id === p.studentId);
      const studentName = (student?.displayName || p.studentName || "").toLowerCase();
      const refNum = (p.referenceNumber || "").toLowerCase();
      const q = searchQuery.toLowerCase().trim();

      const matchesSearch = !q || studentName.includes(q) || refNum.includes(q);
      const matchesMethod =
        methodFilter === "all" ||
        (p.method || "").toLowerCase() === methodFilter.toLowerCase();

      return matchesSearch && matchesMethod;
    });
  }, [payments, students, searchQuery, methodFilter]);

  const pickerFilteredStudents = useMemo(() => {
    if (!pickerQuery.trim()) return students.slice(0, 15);
    const q = pickerQuery.toLowerCase().trim();
    return students
      .filter((s) => (s.displayName || "").toLowerCase().includes(q))
      .slice(0, 15);
  }, [students, pickerQuery]);

  const handleStartPayment = (student) => {
    setSelectedStudentForPayment(student);
    setPickerOpen(false);
    setPickerQuery("");
  };

  const handleWhatsAppReceipt = (payment) => {
    const student = students.find((s) => s.id === payment.studentId);
    const rawPhone = student?.phone || student?.parentPhone;
    const cleanPhone = normalizeWhatsAppNumber(rawPhone);

    if (!cleanPhone) {
      toast("No parent phone number found for this student. Enter phone manually.", "error");
      return;
    }

    const message = buildWhatsAppReceiptMessage({
      studentName: student?.displayName || "Student",
      period: payment.period,
      amount: payment.amount,
      planId: payment.planId,
      paidUntil: payment.coverageEnd || student?.paidUntil,
      coveragePeriod: payment.coveragePeriod || `${payment.coverageStart || ""} to ${payment.coverageEnd || ""}`,
      method: payment.method,
    });

    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, "_blank");
  };

  return (
    <div className="space-y-6 w-full">
      {/* 1. Daily Reconciliation Banner */}
      <FrontDeskCashReconcile branchLabel={branchLabel} students={students} />

      {/* 2. Cashier Header & Actions */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-[#1a3a8f]" />
              <span>Front Desk Cashier & Receipt Log</span>
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Accept tuition & fee payments directly at the front desk and issue digital receipts.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadPayments}
              disabled={loading}
              title="Refresh log"
              className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>

            <button
              onClick={() => setPickerOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-[#1a3a8f] text-white hover:bg-[#153075] text-xs font-bold transition flex items-center gap-2 shadow-xs"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ Record New Payment</span>
            </button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search student or ref number..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-[#1a3a8f] outline-none transition"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600">
            {["all", "cash", "transfer", "qris"].map((m) => (
              <button
                key={m}
                onClick={() => setMethodFilter(m)}
                className={`px-3 py-1.5 rounded-lg capitalize transition ${
                  methodFilter === m
                    ? "bg-white text-[#1a3a8f] shadow-2xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {m === "all" ? "All Methods" : m}
              </button>
            ))}
          </div>
        </div>

        {/* Recent Payments Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-100">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100">
              <tr>
                <th className="py-3 px-4">Date / Time (WITA)</th>
                <th className="py-3 px-4">Student</th>
                <th className="py-3 px-4">Period / Plan</th>
                <th className="py-3 px-4">Method</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4 text-center">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 font-medium">
                    {loading ? "Loading payments..." : "No recent payments found matching filter."}
                  </td>
                </tr>
              ) : (
                filteredPayments.map((p) => {
                  const student = students.find((s) => s.id === p.studentId);
                  const studentName = student?.displayName || p.studentName || "Student";
                  const dateStr = p.recordedAt
                    ? new Date(p.recordedAt).toLocaleString("id-ID", {
                        timeZone: "Asia/Makassar",
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "-";

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/60 transition font-medium text-slate-700">
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          {dateStr}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-[#1a3a8f] shrink-0" />
                          <span>{studentName}</span>
                        </div>
                        {student?.program && (
                          <span className="text-[10px] text-slate-400 font-normal block pl-5">
                            {student.program}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-800">{p.period}</span>
                        {p.coverageEnd && (
                          <span className="text-[10px] text-emerald-600 font-medium block">
                            Paid until: {p.coverageEnd}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-black text-[10px] uppercase">
                          {p.method}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-black text-slate-900">
                        {formatIDR(p.amount)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleWhatsAppReceipt(p)}
                          title="Send WhatsApp Receipt"
                          className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition inline-flex items-center gap-1 text-[11px] font-bold"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">WhatsApp</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Student Picker Modal for Recording Payment */}
      {pickerOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="font-extrabold text-sm text-slate-800 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-[#1a3a8f]" />
                <span>Select Student to Record Payment</span>
              </h4>
              <button
                onClick={() => setPickerOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                autoFocus
                value={pickerQuery}
                onChange={(e) => setPickerQuery(e.target.value)}
                placeholder="Type student name to search..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-[#1a3a8f] outline-none"
              />
            </div>

            <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-2xl">
              {pickerFilteredStudents.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">
                  No students found matching &quot;{pickerQuery}&quot;.
                </div>
              ) : (
                pickerFilteredStudents.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleStartPayment(s)}
                    className="w-full text-left p-3 hover:bg-indigo-50/50 transition flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-extrabold text-slate-800 block">{s.displayName}</span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {s.program || "General"} • {s.phone || "No phone"}
                      </span>
                    </div>
                    <span className="text-[11px] font-bold text-[#1a3a8f]">Select →</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Canonical PaymentModal */}
      {selectedStudentForPayment && (
        <PaymentModal
          student={selectedStudentForPayment}
          onClose={() => setSelectedStudentForPayment(null)}
          onPaymentUpdated={() => {
            loadPayments();
            onPaymentRecorded?.();
          }}
        />
      )}
    </div>
  );
}
