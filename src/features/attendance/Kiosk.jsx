import { Clock, ScanLine } from "lucide-react";
import { useKioskScanner } from "./useKioskScanner";
import KioskStatusOverlay from "./KioskStatusOverlay";
import KioskCameraView from "./KioskCameraView";
import KioskClockInModal from "./KioskClockInModal";
import KioskTransitionModal from "./KioskTransitionModal";

export default function Kiosk({
  title = "Reception Kiosk Station",
  studentsOnly = false,
  staffOnly = false,
}) {
  const {
    kioskScanning,
    setKioskScanning,
    pendingClockIn,
    cancelPendingClockIn,
    pendingTransition,
    cancelPendingTransition,
    selectedClassId,
    setSelectedClassId,
    nextClassId,
    setNextClassId,
    status,
    lastScanned,
    currentTime,
    createShift,
    switchToNextClass,
    clockOutOnly,
  } = useKioskScanner({ studentsOnly, staffOnly });

  const formattedTime = currentTime.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const formattedDate = currentTime.toLocaleDateString([], {
    weekday: "long",
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="bg-white rounded-3xl shadow-xl border border-slate-200/90 max-w-xl mx-auto overflow-hidden relative">
      {/* ── Visual Audio / Mode Indicator Bar ── */}
      <div className="bg-slate-900 text-white px-5 py-3 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
            {studentsOnly ? "Student Station" : staffOnly ? "Staff Station" : "Unified Kiosk"}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono font-bold text-slate-300">
          <Clock className="w-3.5 h-3.5 text-indigo-400" />
          <span>{formattedTime}</span>
        </div>
      </div>

      {/* ── Status Toast / Success Alert Overlay ── */}
      <KioskStatusOverlay status={status} />

      {/* ── Main Station Content ── */}
      <div className="p-6 sm:p-8 space-y-6 text-center">
        {/* Title & Station Date */}
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-xs font-bold text-[#1a3a8f] mb-1">
            <ScanLine className="w-3.5 h-3.5" />
            <span>High-Speed Attendance Scanner</span>
          </div>
          <h3 className="font-extrabold text-slate-900 text-2xl tracking-tight">{title}</h3>
          <p className="text-xs font-medium text-slate-500">{formattedDate}</p>
        </div>

        {/* Action / Camera State */}
        <KioskCameraView
          kioskScanning={kioskScanning}
          onOpenScanner={() => setKioskScanning(true)}
          onCloseScanner={() => setKioskScanning(false)}
        />

        {/* ── Recent Scan Activity Card ── */}
        {lastScanned && (
          <div className="border border-slate-100 bg-slate-50/90 rounded-2xl p-3.5 text-left flex items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 font-bold text-xs">
                ✓
              </div>
              <div className="min-w-0">
                <p className="text-xs font-extrabold text-slate-800 truncate">{lastScanned.name}</p>
                <p className="text-[10px] text-slate-400 capitalize">
                  {lastScanned.role} · {lastScanned.type}
                </p>
              </div>
            </div>
            <span className="text-[11px] font-mono text-slate-500 shrink-0 font-semibold">
              {lastScanned.time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        )}
      </div>

      {/* ── Modal: Multi-Class Selection on Clock-in ── */}
      <KioskClockInModal
        pendingClockIn={pendingClockIn}
        selectedClassId={selectedClassId}
        onSelectClassId={setSelectedClassId}
        onConfirm={createShift}
        onCancel={cancelPendingClockIn}
      />

      {/* ── Modal: Shift Transition or Clock Out ── */}
      <KioskTransitionModal
        pendingTransition={pendingTransition}
        nextClassId={nextClassId}
        onSelectNextClassId={setNextClassId}
        onSwitchClass={switchToNextClass}
        onClockOutOnly={clockOutOnly}
        onCancel={cancelPendingTransition}
      />
    </div>
  );
}
