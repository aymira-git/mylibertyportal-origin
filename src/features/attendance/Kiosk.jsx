import { useState, useEffect } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import {
  isShiftStale,
  autoCloseShift,
  getTodaysClasses,
  getInstantPunctuality
} from ".";
import {
  fetchUserById,
  fetchOpenShiftFor,
  fetchInstructorClasses,
  clockIn,
  clockOutShift,
  switchClassAtomic,
  recordStudentAttendance,
} from "./shiftsRepository";
import { soundEffects } from "./soundEffects";
import {
  Camera,
  ScanLine,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  Sparkles,
  Calendar,
  X,
  Volume2,
  ShieldCheck
} from "lucide-react";

export default function Kiosk({ title = "Reception Kiosk Station", studentsOnly = false, staffOnly = false }) {
  const [kioskScanning, setKioskScanning] = useState(false);
  const [pendingClockIn, setPendingClockIn] = useState(null);
  const [pendingTransition, setPendingTransition] = useState(null);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [nextClassId, setNextClassId] = useState("");
  const [status, setStatus] = useState({ message: "", type: "", detail: "", personName: "" });
  const [lastScanned, setLastScanned] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Real-time digital clock display
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const showStatus = (message, type = "success", detail = "", personName = "") => {
    setStatus({ message, type, detail, personName });
    if (type === "success") {
      soundEffects.playSuccess();
    } else {
      soundEffects.playError();
    }
    // Auto-clear after 4.5 seconds
    setTimeout(() => {
      setStatus({ message: "", type: "", detail: "", personName: "" });
    }, 4500);
  };

  const createShift = async () => {
    const selectedClass = pendingClockIn?.classes.find((cls) => cls.id === selectedClassId);
    if (!pendingClockIn || !selectedClass) return;
    try {
      const clockInAt = new Date();
      const punctuality = getInstantPunctuality(selectedClass, clockInAt);

      await clockIn({
        uid: pendingClockIn.uid,
        displayName: pendingClockIn.userData.displayName,
        role: pendingClockIn.userData.role,
        classId: selectedClass.id,
        className: selectedClass.className,
        clockInAt,
        punctuality,
      });

      const isLeave = (pendingClockIn.userData.status || "active") === "on_leave";
      const name = pendingClockIn.userData.displayName;
      setPendingClockIn(null);
      setSelectedClassId("");
      showStatus(
        isLeave ? `Shift Confirmed (On Leave)` : `Shift Confirmed`,
        "success",
        `Clocked in for ${selectedClass.className} (${punctuality.status})${isLeave ? " - Note: Marked on Leave" : ""}`,
        name
      );
      setLastScanned({ name, role: pendingClockIn.userData.role, time: new Date(), type: "Clock In" });
    } catch (err) {
      showStatus("Clock-in Error", "error", err.message);
    }
  };

  const switchToNextClass = async () => {
    const nextClass = pendingTransition?.remainingClasses.find((cls) => cls.id === nextClassId);
    if (!pendingTransition || !nextClass) return;
    try {
      const now = new Date();
      const punctuality = getInstantPunctuality(nextClass, now);

      await switchClassAtomic({
        previousShiftId: pendingTransition.openShift.id,
        clockOutAt: now,
        uid: pendingTransition.uid,
        displayName: pendingTransition.userData.displayName,
        role: pendingTransition.userData.role,
        classId: nextClass.id,
        className: nextClass.className,
        punctuality,
      });

      const name = pendingTransition.userData.displayName;
      showStatus(
        `Class Switched`,
        "success",
        `Transitioned to ${nextClass.className} (${punctuality.status})`,
        name
      );
      setLastScanned({ name, role: pendingTransition.userData.role, time: new Date(), type: "Switched" });
    } catch (err) {
      showStatus("Transition Error", "error", err.message);
    } finally {
      setPendingTransition(null);
      setNextClassId("");
    }
  };

  const clockOutOnly = async () => {
    if (!pendingTransition) return;
    try {
      await clockOutShift(pendingTransition.openShift.id);
      const name = pendingTransition.userData.displayName;
      showStatus(`Clocked Out`, "success", "Shift completed and archived.", name);
      setLastScanned({ name, role: pendingTransition.userData.role, time: new Date(), type: "Clock Out" });
    } catch (err) {
      showStatus("Clock-out Error", "error", err.message);
    } finally {
      setPendingTransition(null);
      setNextClassId("");
    }
  };

  useEffect(() => {
    if (!kioskScanning) return;
    const scanner = new Html5QrcodeScanner("kiosk-reader", {
      fps: 10,
      qrbox: { width: 260, height: 260 },
      aspectRatio: 1.0,
    });

    scanner.render(
      async (uid) => {
        scanner.clear();
        setKioskScanning(false);
        try {
          const userData = await fetchUserById(uid);
          if (!userData) {
            return showStatus("Invalid Pass", "error", "No user profile found matching this QR badge.");
          }

          if (studentsOnly && userData.role !== "student") {
            return showStatus(
              "Restricted Kiosk",
              "error",
              "This station only accepts student identification passes."
            );
          }
          if (staffOnly && userData.role === "student") {
            return showStatus(
              "Staff Only",
              "error",
              "This station is dedicated to staff clock-in and instructor shifts."
            );
          }

          if (userData.role === "manager") {
            return showStatus(
              "Manager Pass",
              "info",
              "Managers do not record shift attendance at this kiosk.",
              userData.displayName
            );
          }

          if (userData.role === "student") {
            const studentStatus = userData.status || "active";
            if (studentStatus === "inactive" || studentStatus === "graduated") {
              return showStatus(
                "Pass Inactive",
                "error",
                studentStatus === "graduated"
                  ? "This student has graduated. Please contact the administration."
                  : "This student pass is inactive. Please contact the front office.",
                userData.displayName
              );
            }

            await recordStudentAttendance({ uid, displayName: userData.displayName });
            const isLeave = studentStatus === "on_leave";
            showStatus(
              isLeave ? "Attendance Recorded (On Leave)" : "Attendance Recorded",
              "success",
              isLeave
                ? "Welcome back! Note: Your profile is currently marked on leave."
                : "Welcome to My Liberty! Have a great learning session.",
              userData.displayName
            );
            setLastScanned({
              name: userData.displayName,
              role: "student",
              time: new Date(),
              type: "Check-in"
            });
          } else {
            const staffStatus = userData.status || "active";
            if (staffStatus === "resigned" || staffStatus === "terminated") {
              return showStatus(
                "Badge Deactivated",
                "error",
                "This staff badge is no longer active. Please contact academy administration.",
                userData.displayName
              );
            }

            let openShift = await fetchOpenShiftFor(uid);
            if (openShift && isShiftStale(openShift)) {
              await autoCloseShift(openShift);
              openShift = null;
            }

            if (!openShift) {
              const instructorClasses = await fetchInstructorClasses(uid);
              const todayClasses = getTodaysClasses(instructorClasses);

              if (todayClasses.length > 0) {
                setPendingClockIn({ uid, userData, classes: todayClasses });
              } else {
                await clockIn({
                  uid,
                  displayName: userData.displayName,
                  role: userData.role,
                  classId: "general",
                  className: "General Duty",
                  clockInAt: new Date(),
                  punctuality: {
                    status: "Present",
                    scheduledStart: null,
                    requiredArrival: null,
                    minutesEarlyOrLate: 0,
                  },
                });
                const isLeave = staffStatus === "on_leave";
                showStatus(
                  isLeave ? "Duty Started (On Leave)" : "Duty Started",
                  "success",
                  isLeave
                    ? "Clocked in on General Administrative Duty (Note: Marked on Leave)."
                    : "Clocked in on General Administrative Duty.",
                  userData.displayName
                );
                setLastScanned({
                  name: userData.displayName,
                  role: userData.role,
                  time: new Date(),
                  type: "Clock In"
                });
              }
            } else {
              const instructorClasses = await fetchInstructorClasses(uid);
              const todayClasses = getTodaysClasses(instructorClasses);
              const remainingClasses = todayClasses.filter((cls) => cls.id !== openShift.classId);

              if (remainingClasses.length > 0) {
                setPendingTransition({ uid, userData, openShift, remainingClasses });
              } else {
                await clockOutShift(openShift.id);
                showStatus(
                  "Shift Concluded",
                  "success",
                  "Thank you for teaching today!",
                  userData.displayName
                );
                setLastScanned({
                  name: userData.displayName,
                  role: userData.role,
                  time: new Date(),
                  type: "Clock Out"
                });
              }
            }
          }
        } catch (err) {
          showStatus("Scanner Error", "error", err.message);
        }
      },
      () => {}
    );
    return () => {
      try {
        scanner.clear();
      } catch {
        // Safe unmount
      }
    };
  }, [kioskScanning, studentsOnly, staffOnly]);

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
      {status.message && (
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
                <h4 className="text-xl font-extrabold text-white tracking-tight">{status.personName}</h4>
              )}
              <h5 className="text-lg font-bold text-white/90 mt-1">{status.message}</h5>
              {status.detail && (
                <p className="text-xs text-white/70 mt-1.5 leading-relaxed font-medium">{status.detail}</p>
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
      )}

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
        {!kioskScanning ? (
          <div className="space-y-4">
            <div className="p-8 sm:p-10 rounded-3xl border-2 border-dashed border-indigo-200 bg-slate-50/70 flex flex-col items-center justify-center space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-indigo-100/60 text-[#1a3a8f] flex items-center justify-center shadow-xs">
                <Camera className="w-8 h-8" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">Ready to Scan Credentials</p>
                <p className="text-xs text-slate-500 max-w-xs mt-1 leading-normal">
                  Tap below to open the camera, then hold your student or staff QR code in front of the lens.
                </p>
              </div>
            </div>

            <button
              onClick={() => setKioskScanning(true)}
              className="w-full min-h-[52px] bg-[#1a3a8f] hover:bg-[#122b6e] text-white py-3.5 px-6 rounded-2xl font-bold text-sm transition duration-150 shadow-md shadow-indigo-950/15 flex items-center justify-center gap-2 group"
            >
              <ScanLine className="w-4 h-4 group-hover:scale-110 transition-transform" />
              <span>Open Scanner Camera</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Viewport Frame */}
            <div className="rounded-3xl border-2 border-indigo-600/30 bg-slate-950 p-3 shadow-inner relative overflow-hidden">
              <div id="kiosk-reader" className="w-full overflow-hidden rounded-2xl bg-black" />
            </div>

            <p className="text-xs font-semibold text-slate-600 flex items-center justify-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Center your QR code inside the green border for instant recognition</span>
            </p>

            <button
              onClick={() => setKioskScanning(false)}
              className="w-full py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
            >
              Close Camera Viewport
            </button>
          </div>
        )}

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
      {pendingClockIn && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-200 text-left">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#1a3a8f]" />
                <h4 className="font-bold text-slate-900 text-sm">Confirm Teaching Shift</h4>
              </div>
              <button
                onClick={() => {
                  setPendingClockIn(null);
                  setSelectedClassId("");
                }}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                Welcome, <span className="font-bold text-slate-900">{pendingClockIn.userData.displayName}</span>! Select
                the class cohort you are teaching right now:
              </p>
            </div>

            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full p-3 border border-slate-200 rounded-xl text-xs font-semibold bg-white text-slate-800 outline-none focus:border-[#1a3a8f] focus:ring-1 focus:ring-[#1a3a8f]"
            >
              <option value="">Select today&apos;s scheduled class...</option>
              {pendingClockIn.classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.className} ({cls.startTime || "Schedule not set"})
                </option>
              ))}
            </select>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  setPendingClockIn(null);
                  setSelectedClassId("");
                }}
                className="flex-1 py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
              >
                Cancel
              </button>
              <button
                onClick={createShift}
                disabled={!selectedClassId}
                className="flex-[2] py-3 px-4 rounded-xl bg-[#1a3a8f] hover:bg-[#122b6e] text-white font-bold text-xs transition shadow-md disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <span>Confirm Clock In</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Shift Transition or Clock Out ── */}
      {pendingTransition && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-200 text-left">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#1a3a8f]" />
                <h4 className="font-bold text-slate-900 text-sm">Shift Transition</h4>
              </div>
              <button
                onClick={() => {
                  setPendingTransition(null);
                  setNextClassId("");
                }}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                Active shift:{" "}
                <span className="font-bold text-[#1a3a8f]">{pendingTransition.openShift.className}</span>.
                Switch to another scheduled class or clock out for today.
              </p>
            </div>

            <select
              value={nextClassId}
              onChange={(e) => setNextClassId(e.target.value)}
              className="w-full p-3 border border-slate-200 rounded-xl text-xs font-semibold bg-white text-slate-800 outline-none focus:border-[#1a3a8f] focus:ring-1 focus:ring-[#1a3a8f]"
            >
              <option value="">Select next class to switch to...</option>
              {pendingTransition.remainingClasses.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.className} ({cls.startTime || "Schedule not set"})
                </option>
              ))}
            </select>

            <div className="flex gap-2 pt-2">
              <button
                onClick={clockOutOnly}
                className="flex-1 py-3 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
              >
                Clock Out Only
              </button>
              <button
                onClick={switchToNextClass}
                disabled={!nextClassId}
                className="flex-[2] py-3 px-4 rounded-xl bg-[#1a3a8f] hover:bg-[#122b6e] text-white font-bold text-xs transition shadow-md disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <span>Switch Class</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
