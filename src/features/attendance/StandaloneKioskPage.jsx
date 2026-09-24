import { useState } from "react";
import schoolLogo from "../../assets/school-logo.webp";
import Kiosk from "./Kiosk";
import { Users, GraduationCap, ArrowLeft, ShieldCheck } from "lucide-react";

/**
 * StandaloneKioskPage
 * Dedicated full-screen kiosk page for physical lobby stations and attendance tablets.
 * Supports distinct entry points (/kiosk/staff and /kiosk/students) to eliminate lobby queues.
 */
export default function StandaloneKioskPage({ initialMode = "students" }) {
  const [mode, setMode] = useState(() => {
    if (typeof window !== "undefined") {
      const path = window.location.pathname.toLowerCase();
      if (path.includes("/staff")) return "staff";
      if (path.includes("/students") || path.includes("/student")) return "students";
    }
    return initialMode;
  });

  const isStaff = mode === "staff";
  const isStudents = mode === "students";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white flex flex-col justify-between p-4 sm:p-6 select-none">
      {/* Top Brand & Mode Bar */}
      <header className="w-full max-w-2xl mx-auto flex items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <img
            src={schoolLogo}
            alt="My Liberty Logo"
            className="w-10 h-10 rounded-xl object-contain bg-white/10 p-1 border border-white/10 shadow-md"
          />
          <div>
            <h1 className="text-base font-black tracking-tight leading-none text-white">
              MY LIBERTY
            </h1>
            <p className="text-[11px] font-bold text-indigo-300 mt-0.5">
              Attendance &amp; Check-In Station
            </p>
          </div>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex items-center bg-slate-800/80 p-1 rounded-xl border border-slate-700/80 text-xs">
          <button
            type="button"
            onClick={() => {
              setMode("students");
              window.history.replaceState(null, "", "/kiosk/students");
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
              isStudents
                ? "bg-emerald-500 text-white shadow-xs"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Students</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("staff");
              window.history.replaceState(null, "", "/kiosk/staff");
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
              isStaff
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Staff Shift</span>
          </button>
        </div>
      </header>

      {/* Main Kiosk Scanner Frame */}
      <main className="w-full max-w-xl mx-auto my-auto py-4">
        <div className="text-center mb-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-slate-800/90 text-slate-300 border border-slate-700">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            {isStudents ? "Student Roster Scanner" : "Staff Duty Clock-In / Clock-Out"}
          </span>
          <p className="text-xs text-slate-400 mt-1">
            {isStudents
              ? "Hold student ID badge / QR code up to camera"
              : "Scan staff QR code to start or finish your shift"}
          </p>
        </div>

        <Kiosk
          key={mode}
          title={isStudents ? "Student Attendance Kiosk" : "Staff Shift Kiosk"}
          studentsOnly={isStudents}
          staffOnly={isStaff}
        />
      </main>

      {/* Footer Navigation */}
      <footer className="w-full max-w-2xl mx-auto flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-slate-800/60">
        <button
          type="button"
          onClick={() => {
            window.location.href = "/";
          }}
          className="flex items-center gap-1 hover:text-white transition cursor-pointer font-bold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Portal Login</span>
        </button>
        <span className="text-[11px] text-slate-500 font-mono">
          Station: {isStudents ? "LOBBY_STUDENTS" : "DESK_STAFF"}
        </span>
      </footer>
    </div>
  );
}
