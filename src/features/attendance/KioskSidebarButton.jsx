import { ScanLine, Sparkles } from "lucide-react";

/**
 * Standardized sidebar launcher button for Attendance Kiosk.
 * Rendered at the top of the sidebar via extraSidebarContent in DashboardShell.
 */
export default function KioskSidebarButton({ onClick, label = "Attendance Kiosk" }) {
  return (
    <button
      onClick={onClick}
      className="w-full px-3 py-2.5 rounded-2xl text-left font-extrabold text-xs bg-[#1a3a8f] text-white shadow-sm hover:bg-[#122b6e] transition flex items-center justify-between gap-2 border border-indigo-400/30 group cursor-pointer active:scale-98"
    >
      <div className="flex items-center gap-2">
        <ScanLine className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
        <span>{label}</span>
      </div>
      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
    </button>
  );
}
