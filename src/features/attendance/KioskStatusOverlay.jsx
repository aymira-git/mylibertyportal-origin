import { CheckCircle2, AlertCircle, Volume2 } from "lucide-react";

export default function KioskStatusOverlay({ status }) {
  if (!status?.message) return null;

  return (
    <div
      className={`absolute inset-0 z-50 flex items-center justify-center p-6 text-white text-center animate-in fade-in zoom-in duration-200 ${
        status.type === "error"
          ? "bg-rose-900/95 backdrop-blur-md"
          : "bg-gradient-to-br from-emerald-900/95 to-teal-900/95 backdrop-blur-md"
      }`}
    >
      <div className="space-y-3 max-w-sm">
        <div
          className={`w-16 h-16 mx-auto rounded-3xl flex items-center justify-center border shadow-lg ${
            status.type === "error"
              ? "bg-rose-500/20 border-rose-400/40 text-rose-200"
              : "bg-emerald-500/20 border-emerald-400/40 text-emerald-200"
          }`}
        >
          {status.type === "error" ? (
            <AlertCircle className="w-9 h-9" />
          ) : (
            <CheckCircle2 className="w-9 h-9" />
          )}
        </div>

        <div>
          {status.personName && (
            <h4 className="text-xl font-extrabold text-white tracking-tight">
              {status.personName}
            </h4>
          )}
          <h5 className="text-lg font-bold text-white/90 mt-1">{status.message}</h5>
          {status.detail && (
            <p className="text-xs text-white/70 mt-1.5 leading-relaxed font-medium">
              {status.detail}
            </p>
          )}
        </div>

        <div className="pt-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-[11px] font-semibold text-white/80 border border-white/20">
            <Volume2 className="w-3.5 h-3.5 text-emerald-300" />
            Audible confirmation played
          </span>
        </div>
      </div>
    </div>
  );
}
