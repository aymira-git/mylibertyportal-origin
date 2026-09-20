import schoolLogo from "../../assets/school-logo.webp";
import { formatIDR } from "./receiptMessages";

export default function DigitalReceiptTab({
  activeReceipt,
  onSendWhatsApp,
  onPrint,
}) {
  if (!activeReceipt) return null;

  return (
    <div className="space-y-4">
      {/* Receipt Printable Card */}
      <div
        id="receipt-card"
        className="bg-white border-2 border-slate-200 rounded-2xl p-6 shadow-sm space-y-4 text-slate-800"
      >
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
          {activeReceipt.planName && (
            <div className="flex justify-between py-1">
              <span className="text-slate-400 font-medium">Payment Plan:</span>
              <span className="font-bold text-[#1a3a8f] bg-indigo-50 px-2 py-0.5 rounded text-[11px]">
                {activeReceipt.planName}
              </span>
            </div>
          )}
          <div className="flex justify-between py-1">
            <span className="text-slate-400 font-medium">Billing Period:</span>
            <span className="font-bold text-slate-800">{activeReceipt.period}</span>
          </div>
          {activeReceipt.coverageEnd && (
            <div className="flex justify-between py-1">
              <span className="text-slate-400 font-medium">Valid Through:</span>
              <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px]">
                {activeReceipt.coverageEnd}
              </span>
            </div>
          )}
          <div className="flex justify-between py-1">
            <span className="text-slate-400 font-medium">Payment Method:</span>
            <span className="font-bold text-slate-800">{activeReceipt.method}</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-slate-400 font-medium">Date &amp; Time:</span>
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
          onClick={() => onSendWhatsApp && onSendWhatsApp(activeReceipt)}
          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold p-3 rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
        >
          <span>💬</span> Send Receipt via WhatsApp
        </button>
        <button
          type="button"
          onClick={onPrint}
          className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-3 rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer"
        >
          <span>🖨️</span> Print
        </button>
      </div>
    </div>
  );
}
