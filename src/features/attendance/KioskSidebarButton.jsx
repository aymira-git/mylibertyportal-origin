import { ScanLine, Sparkles } from "lucide-react";

/**
 * Standardized sidebar launcher button for Attendance Kiosk.
 * Rendered at the top of the sidebar via extraSidebarContent in DashboardShell.
 * Sized to match the banner stat card (~68px height) for high visibility and quick tapping.
 */
export default function KioskSidebarButton({ onClick, label = "Attendance Kiosk" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full p-3.5 rounded-2xl text-left bg-white text-[#002069] shadow-md hover:shadow-lg hover:bg-slate-50 border-2 border-emerald-400/60 hover:border-emerald-500 transition-all duration-150 flex items-center justify-between gap-3 group cursor-pointer active:scale-[0.98] select-none"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 group-hover:bg-emerald-100 transition-transform">
          <ScanLine className="w-5 h-5 text-emerald-600" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 truncate">
              Live Check-In
            </p>
          </div>
          <p className="text-sm font-black text-[#002069] truncate leading-snug">
            {label}
          </p>
        </div>
      </div>

      <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-500 flex items-center justify-center shrink-0 group-hover:scale-110 group-hover:bg-amber-100 transition-transform">
        <Sparkles className="w-4 h-4 text-amber-500" />
      </div>
    </button>
  );
}
