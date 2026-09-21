import { Share, PlusSquare, X } from "lucide-react";

export default function IosInstallModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 space-y-4 text-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/pwa-192x192.png" alt="MY LIBERTY" className="w-9 h-9 rounded-xl shadow-xs" />
            <div>
              <h3 className="font-extrabold text-sm text-slate-900">Install MY LIBERTY</h3>
              <p className="text-[11px] text-slate-500">Add to iPhone / iPad Home Screen</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3 pt-2 text-xs">
          <div className="flex items-start gap-3 p-2.5 rounded-2xl bg-indigo-50/60 border border-indigo-100/80">
            <div className="w-6 h-6 rounded-lg bg-[#1a3a8f] text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
              1
            </div>
            <div>
              <p className="font-bold text-slate-900 flex items-center gap-1.5">
                Tap Share in Safari <Share className="w-3.5 h-3.5 text-[#1a3a8f] inline" />
              </p>
              <p className="text-slate-500 text-[11px] mt-0.5">
                Located at the bottom of the screen (or top on iPad).
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-2.5 rounded-2xl bg-indigo-50/60 border border-indigo-100/80">
            <div className="w-6 h-6 rounded-lg bg-[#1a3a8f] text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
              2
            </div>
            <div>
              <p className="font-bold text-slate-900 flex items-center gap-1.5">
                Select &quot;Add to Home Screen&quot;{" "}
                <PlusSquare className="w-3.5 h-3.5 text-[#1a3a8f] inline" />
              </p>
              <p className="text-slate-500 text-[11px] mt-0.5">
                Scroll down the action list to find the option.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-2.5 rounded-2xl bg-indigo-50/60 border border-indigo-100/80">
            <div className="w-6 h-6 rounded-lg bg-[#1a3a8f] text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
              3
            </div>
            <div>
              <p className="font-bold text-slate-900">Tap &quot;Add&quot; in top-right</p>
              <p className="text-slate-500 text-[11px] mt-0.5">
                Launch the portal from your home screen just like a native app.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
