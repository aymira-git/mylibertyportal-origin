import { useState, useEffect } from "react";
import { auth } from "../../firebase";
import schoolLogo from "../../assets/school-logo.webp";
import { useToast, useConfirm } from "../shared";
import { fetchPaymentHistory, recordPayment, markPaymentPending } from "./paymentsRepository";

function formatIDR(value) {
  const num = Number(value) || 0;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(num);
}

function formatWhatsAppNumber(phone) {
  if (!phone) return "";
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("0")) {
    return "62" + cleaned.slice(1);
  }
  if (cleaned.startsWith("62")) {
    return cleaned;
  }
  return cleaned;
}

function getDefaultPeriod() {
  const date = new Date();
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export default function PaymentModal({ student, onClose, onPaymentUpdated }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [activeTab, setActiveTab] = useState("record"); // "record" | "history" | "receipt"
  const [amount, setAmount] = useState(350000);
  const [period, setPeriod] = useState(getDefaultPeriod());
  const [method, setMethod] = useState("Bank Transfer"); // "Bank Transfer" | "QRIS" | "Cash"
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [history, setHistory] = useState([]);
  const [activeReceipt, setActiveReceipt] = useState(null);

  const refreshHistory = async () => {
    if (!student?.id) return;
    try {
      setHistory(await fetchPaymentHistory(student.id));
    } catch (err) {
      console.error("Failed to load payment history:", err);
    }
  };

  useEffect(() => {
    let ignore = false;
    const studentId = student?.id;
    if (!studentId) return;

    fetchPaymentHistory(studentId)
      .then((list) => {
        if (!ignore) setHistory(list);
      })
      .catch((err) => {
        console.error("Failed to load payment history:", err);
      })
      .finally(() => {
        if (!ignore) setLoadingHistory(false);
      });

    return () => {
      ignore = true;
    };
  }, [student?.id]);

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      toast("Cannot record payment while offline. Please connect to the internet to prevent database discrepancies.", "error");
      return;
    }
    if (!amount || amount <= 0) {
      toast("Please enter a valid payment amount.", "error");
      return;
    }
    if (!period.trim()) {
      toast("Please enter a billing period (e.g. September 2026).", "error");
      return;
    }

    setSaving(true);
    try {
      const receiptNo = `ML-${Date.now().toString().slice(-6)}`;
      const nowISO = new Date().toISOString();
      const paymentRecord = {
        studentId: student.id,
        studentName: student.displayName || "Student",
        parentName: student.parentName || "",
        parentPhone: student.parentPhone || student.phone || "",
        amount: Number(amount),
        period: period.trim(),
        method,
        notes: notes.trim(),
        receiptNumber: receiptNo,
        recordedAt: nowISO,
        recordedBy: auth.currentUser?.email || "Staff",
      };

      const savedPayment = await recordPayment(student.id, paymentRecord);

      await refreshHistory();
      if (onPaymentUpdated) onPaymentUpdated();

      // Switch to receipt view
      setActiveReceipt(savedPayment);
      setActiveTab("receipt");
    } catch (err) {
      toast("Error saving payment: " + err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleMarkPending = async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      toast("Cannot update payment status while offline. Please connect to the internet.", "error");
      return;
    }
    if (!(await confirm(`Mark ${student.displayName}'s payment status as Pending for the next period?`))) return;
    try {
      await markPaymentPending(student.id);
      if (onPaymentUpdated) onPaymentUpdated();
      toast("Status updated to Pending.");
      onClose();
    } catch (err) {
      toast("Error updating status: " + err.message, "error");
    }
  };

  const generateWhatsAppMessage = (rcp) => {
    const lines = [
      `*MY LIBERTY INTERNATIONAL ENGLISH SCHOOL*`,
      `*Official Payment Receipt*`,
      `---------------------------------------`,
      `*Receipt No:* ${rcp.receiptNumber || "N/A"}`,
      `*Student Name:* ${rcp.studentName}`,
      `*Billing Period:* ${rcp.period}`,
      `*Payment Method:* ${rcp.method}`,
      `*Amount Paid:* ${formatIDR(rcp.amount)}`,
      `*Date:* ${new Date(rcp.recordedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}`,
      rcp.notes ? `*Notes:* ${rcp.notes}` : null,
      `---------------------------------------`,
      `Thank you for your payment! This is an official electronic receipt issued by MY LIBERTY.`,
    ].filter(Boolean);

    return lines.join("\n");
  };

  const handleSendWhatsApp = (rcp) => {
    const rawPhone = student.parentPhone || student.phone;
    const formatted = formatWhatsAppNumber(rawPhone);
    const message = generateWhatsAppMessage(rcp);

    if (!formatted) {
      toast("No valid phone number found for parent or student. Please update contact information first.", "error");
      return;
    }

    const waUrl = `https://wa.me/${formatted}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, "_blank");
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="bg-[#1a3a8f] text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center font-bold text-lg">
              💳
            </div>
            <div>
              <h2 className="text-base font-bold leading-tight">Student Payment Center</h2>
              <p className="text-xs text-white/80">{student.displayName} (ID: {student.id})</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white text-xl font-bold p-1 leading-none rounded-lg hover:bg-white/10"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-5 pt-3 gap-2 select-none">
          <button
            onClick={() => setActiveTab("record")}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition ${
              activeTab === "record"
                ? "border-[#1a3a8f] text-[#1a3a8f]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            ➕ Record Payment
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition ${
              activeTab === "history"
                ? "border-[#1a3a8f] text-[#1a3a8f]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            📜 Payment History ({history.length})
          </button>
          {activeReceipt && (
            <button
              onClick={() => setActiveTab("receipt")}
              className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition ${
                activeTab === "receipt"
                  ? "border-[#1a3a8f] text-[#1a3a8f]"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              🧾 Digital Receipt
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">

          {/* TAB 1: RECORD PAYMENT */}
          {activeTab === "record" && (
            <form onSubmit={handleRecordPayment} className="space-y-4 text-xs">
              
              {/* Current Status Banner */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <span className="text-slate-500 font-medium block">Current Status</span>
                  <span className={`inline-block mt-0.5 px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                    student.paymentStatus === "paid"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-rose-100 text-rose-700"
                  }`}>
                    {student.paymentStatus === "paid" ? "Paid" : "Pending"}
                  </span>
                  {student.lastPaymentPeriod && (
                    <span className="text-slate-500 text-[11px] ml-2">
                      (Last: {student.lastPaymentPeriod})
                    </span>
                  )}
                </div>

                {student.paymentStatus === "paid" && (
                  <button
                    type="button"
                    onClick={handleMarkPending}
                    className="text-xs bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-3 py-1.5 rounded-lg transition"
                  >
                    Reset to Pending
                  </button>
                )}
              </div>

              {/* Payment Amount */}
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
                  Amount (IDR)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-sm">Rp</span>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    min="1000"
                    step="1000"
                    required
                    className="w-full pl-10 pr-3 py-2 border rounded-xl font-bold text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a8f]/20 focus:border-[#1a3a8f]"
                    placeholder="350000"
                  />
                </div>
                {/* Quick nominal chips */}
                <div className="flex gap-1.5 mt-2">
                  {[250000, 350000, 500000, 750000].map((val) => (
                    <button
                      type="button"
                      key={val}
                      onClick={() => setAmount(val)}
                      className={`px-2 py-1 rounded-lg border text-[11px] font-semibold transition ${
                        amount === val
                          ? "bg-[#1a3a8f] text-white border-[#1a3a8f]"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {formatIDR(val)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Billing Period */}
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
                  Billing Period
                </label>
                <input
                  type="text"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  placeholder="e.g. September 2026 or Term 1"
                  required
                  className="w-full p-2.5 border rounded-xl font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1a3a8f]/20 focus:border-[#1a3a8f]"
                />
              </div>

              {/* Payment Method */}
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1.5">
                  Payment Method
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "Bank Transfer", icon: "🏦", label: "Bank Transfer" },
                    { id: "QRIS", icon: "📱", label: "QRIS" },
                    { id: "Cash", icon: "💵", label: "Cash" },
                  ].map((m) => (
                    <button
                      type="button"
                      key={m.id}
                      onClick={() => setMethod(m.id)}
                      className={`p-3 rounded-xl border text-center font-bold flex flex-col items-center gap-1 transition ${
                        method === m.id
                          ? "bg-indigo-50 border-[#1a3a8f] text-[#1a3a8f] shadow-sm"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <span className="text-xl">{m.icon}</span>
                      <span className="text-xs">{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Reference / Notes */}
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
                  Reference Note (Optional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. BCA transfer ref #9872 or Cash at front desk"
                  className="w-full p-2.5 border rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1a3a8f]/20 focus:border-[#1a3a8f]"
                />
              </div>

              {/* Parent Contact Summary */}
              <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold text-slate-700">Parent Contact</p>
                  <p className="text-slate-500 text-[11px]">
                    {student.parentName || "N/A"} ({student.parentPhone || student.phone || "No phone"})
                  </p>
                </div>
                <span className="text-[10px] font-bold text-[#1a3a8f] bg-blue-100 px-2 py-0.5 rounded">
                  WhatsApp Ready
                </span>
              </div>

              {/* Offline Warning */}
              {typeof navigator !== "undefined" && !navigator.onLine && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs font-semibold flex items-center gap-2">
                  <span>⚠️</span>
                  <span>Offline Mode: Payment processing is paused to protect database records. Reconnect to internet to save.</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={saving || (typeof navigator !== "undefined" && !navigator.onLine)}
                className="w-full bg-[#1a3a8f] hover:bg-[#122b6e] text-white p-3 rounded-xl font-bold text-sm shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
              >
                {saving ? "Saving Payment..." : "💾 Save Payment & Generate Receipt"}
              </button>
            </form>
          )}

          {/* TAB 2: PAYMENT HISTORY */}
          {activeTab === "history" && (
            <div className="space-y-3">
              {loadingHistory ? (
                <p className="text-center text-slate-400 py-8 text-xs animate-pulse">
                  Loading payment records...
                </p>
              ) : history.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <p className="text-2xl mb-1">🧾</p>
                  <p className="text-xs font-bold text-slate-600">No payment history recorded yet.</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Record a payment on the Record tab to start tracking payments.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {history.map((h) => (
                    <div
                      key={h.id}
                      className="p-3.5 bg-white border border-slate-200 rounded-xl hover:shadow-sm transition flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-[#1a3a8f]">{formatIDR(h.amount)}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 uppercase">
                            {h.method}
                          </span>
                        </div>
                        <p className="font-semibold text-slate-700">Period: {h.period}</p>
                        <p className="text-[11px] text-slate-400">
                          {new Date(h.recordedAt).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}{" "}
                          • Rec by: {h.recordedBy}
                        </p>
                        {h.notes && (
                          <p className="text-[11px] text-slate-500 italic">Note: {h.notes}</p>
                        )}
                      </div>

                      <div className="flex flex-col gap-1.5 shrink-0">
                        <button
                          onClick={() => {
                            setActiveReceipt(h);
                            setActiveTab("receipt");
                          }}
                          className="bg-indigo-50 text-[#1a3a8f] font-bold px-2.5 py-1 rounded-lg text-xs hover:bg-indigo-100 transition border border-indigo-100"
                        >
                          View Receipt
                        </button>
                        <button
                          onClick={() => handleSendWhatsApp(h)}
                          className="bg-emerald-50 text-emerald-700 font-bold px-2.5 py-1 rounded-lg text-xs hover:bg-emerald-100 transition border border-emerald-200"
                        >
                          WhatsApp
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: DIGITAL RECEIPT */}
          {activeTab === "receipt" && activeReceipt && (
            <div className="space-y-4">
              {/* Receipt Printable Card */}
              <div id="receipt-card" className="bg-white border-2 border-slate-200 rounded-2xl p-6 shadow-sm space-y-4 text-slate-800">
                
                {/* School Header */}
                <div className="flex items-center justify-between border-b pb-4">
                  <div className="flex items-center gap-3">
                    <img src={schoolLogo} alt="Logo" className="w-12 h-12 object-contain" />
                    <div>
                      <h3 className="font-black text-[#1a3a8f] text-sm tracking-tight leading-tight">
                        MY LIBERTY
                      </h3>
                      <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">
                        International English School
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full font-black text-[10px] uppercase">
                      Official Receipt
                    </span>
                    <p className="text-[11px] text-slate-400 font-mono mt-1">
                      {activeReceipt.receiptNumber || "REC-ONLINE"}
                    </p>
                  </div>
                </div>

                {/* Details Table */}
                <div className="space-y-2 text-xs divide-y divide-slate-100">
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400 font-medium">Student Name:</span>
                    <span className="font-bold text-slate-800">{activeReceipt.studentName}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400 font-medium">Billing Period:</span>
                    <span className="font-bold text-slate-800">{activeReceipt.period}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400 font-medium">Payment Method:</span>
                    <span className="font-bold text-slate-800">{activeReceipt.method}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400 font-medium">Date & Time:</span>
                    <span className="font-medium text-slate-700">
                      {new Date(activeReceipt.recordedAt).toLocaleString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  {activeReceipt.notes && (
                    <div className="flex justify-between py-1">
                      <span className="text-slate-400 font-medium">Reference:</span>
                      <span className="font-medium text-slate-700">{activeReceipt.notes}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-3 border-t border-slate-200">
                    <span className="font-bold text-slate-700 uppercase tracking-wider text-xs">Total Paid:</span>
                    <span className="text-lg font-black text-[#1a3a8f]">{formatIDR(activeReceipt.amount)}</span>
                  </div>
                </div>

                {/* Footer Notice */}
                <div className="pt-3 border-t border-slate-100 text-center text-[10px] text-slate-400 font-medium">
                  This electronic receipt is valid proof of payment issued by MY LIBERTY.
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleSendWhatsApp(activeReceipt)}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold p-3 rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition"
                >
                  <span>💬</span> Send Receipt via WhatsApp
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-3 rounded-xl text-xs flex items-center gap-1.5 transition"
                >
                  <span>🖨️</span> Print
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
