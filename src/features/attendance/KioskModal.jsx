import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import Kiosk from "./Kiosk";

/**
 * Full-screen modal takeover for attendance scanning station.
 * Standardized across Admin, Front Office, and Instructor dashboards.
 */
export default function KioskModal({
  isOpen,
  onClose,
  title = "Attendance Scanner Station",
  studentsOnly = false,
  extraContent = null,
  initialScrollToExtra = false,
}) {
  const extraRef = useRef(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Auto-scroll to extra content if requested (e.g. ?action=class-photo)
  useEffect(() => {
    if (isOpen && initialScrollToExtra && extraRef.current) {
      const timer = setTimeout(() => {
        extraRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen, initialScrollToExtra]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex flex-col items-center justify-start p-4 sm:p-6 overflow-y-auto">
      {/* Top Header Control Bar */}
      <div className="w-full max-w-xl flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-2 text-white">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Live Scanner Station
          </span>
        </div>
        <button
          onClick={onClose}
          className="bg-white/10 hover:bg-white/20 text-white px-3.5 py-1.5 rounded-xl font-bold text-xs transition border border-white/10 flex items-center gap-1.5 cursor-pointer active:scale-95"
          title="Exit scanner view (Esc)"
        >
          <X className="w-4 h-4" />
          <span>Exit Scanner</span>
        </button>
      </div>

      {/* Main Scanner Container */}
      <div className="w-full max-w-xl space-y-6 pb-12">
        <Kiosk title={title} studentsOnly={studentsOnly} />
        {extraContent && (
          <div ref={extraRef} className="pt-2">
            {extraContent}
          </div>
        )}
      </div>
    </div>
  );
}
