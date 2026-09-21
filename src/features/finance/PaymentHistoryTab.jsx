import { formatIDR } from "./receiptMessages";

export default function PaymentHistoryTab({
  history = [],
  loadingHistory = false,
  onViewReceipt,
  onSendWhatsApp,
}) {
  if (loadingHistory) {
    return (
      <p className="text-center text-slate-400 py-8 text-xs animate-pulse">
        Loading payment records...
      </p>
    );
  }

  if (history.length === 0) {
    return (
      <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
        <p className="text-2xl mb-1">🧾</p>
        <p className="text-xs font-bold text-slate-600">No payment history recorded yet.</p>
        <p className="text-[11px] text-slate-400 mt-1">
          Record a payment on the Record tab to start tracking payments.
        </p>
      </div>
    );
  }

  return (
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
              {h.planName && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-[#1a3a8f]">
                  {h.planName}
                </span>
              )}
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
            {h.notes && <p className="text-[11px] text-slate-500 italic">Note: {h.notes}</p>}
          </div>

          <div className="flex flex-col gap-1.5 shrink-0">
            {onViewReceipt && (
              <button
                onClick={() => onViewReceipt(h)}
                className="bg-indigo-50 text-[#1a3a8f] font-bold px-2.5 py-1 rounded-lg text-xs hover:bg-indigo-100 transition border border-indigo-100 cursor-pointer"
              >
                View Receipt
              </button>
            )}
            {onSendWhatsApp && (
              <button
                onClick={() => onSendWhatsApp(h)}
                className="bg-emerald-50 text-emerald-700 font-bold px-2.5 py-1 rounded-lg text-xs hover:bg-emerald-100 transition border border-emerald-200 cursor-pointer"
              >
                WhatsApp
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
