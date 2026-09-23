import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { AT_RISK_LABEL } from "../atRisk";

export function LearnerCard({ s, isExpanded, onToggleExpand }) {
  return (
    <div
      className={`p-4 rounded-2xl border transition shadow-2xs space-y-3 ${
        s.isAtRisk
          ? "bg-rose-50/40 border-rose-200"
          : "bg-slate-50/70 border-slate-200/80 hover:bg-white"
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-extrabold text-slate-900 text-sm">{s.displayName}</p>
            {s.isAtRisk && (
              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-rose-600 text-white shadow-2xs flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {AT_RISK_LABEL}
              </span>
            )}
            <span className="text-[10px] font-semibold text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded">
              {s.branch}
            </span>
            {s.isArchived && (
              <span className="text-[9px] font-bold text-slate-400 bg-slate-200/80 px-2 py-0.5 rounded-full">
                Archived
              </span>
            )}
          </div>

          {s.classes.length === 0 ? (
            <p className="text-[11px] text-slate-400 italic">
              No current cohort assignment
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {s.classes.map((c, i) => (
                <span
                  key={i}
                  className="text-[10px] font-bold bg-white border border-slate-200/80 text-slate-700 px-2 py-0.5 rounded-lg"
                >
                  📚 {c.className} ({c.schedule}) · {c.instructorName}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center sm:flex-col sm:items-end gap-3 sm:gap-1 text-xs shrink-0">
          <span className="font-extrabold text-slate-900 bg-white border border-slate-200 px-2.5 py-0.5 rounded-xl">
            {s.attendanceCount} check-in{s.attendanceCount === 1 ? "" : "s"}
          </span>
          <span className="text-[10px] text-slate-400 font-medium">
            Last:{" "}
            {s.lastCheckIn ? new Date(s.lastCheckIn).toLocaleDateString() : "Never"}
          </span>
        </div>
      </div>

      {/* Most Recent Assessment */}
      {s.assessments.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200/80 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Most Recent Assessment
            </p>
            <span className="text-xs font-black text-[#1a3a8f]">
              Band: {s.assessments[0].overallScore || "—"} / 100
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div>
              <span className="text-[10px] text-slate-400 font-medium">Date</span>
              <p className="font-bold text-slate-800">
                {s.assessments[0].examDate || "N/A"}
              </p>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-medium">
                CEFR Level
              </span>
              <p className="font-bold text-slate-800 capitalize">
                {s.assessments[0].level || "N/A"}
              </p>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-medium">Class</span>
              <p className="font-bold text-slate-800 truncate">
                {s.assessments[0].className || "N/A"}
              </p>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-medium">
                Evaluator
              </span>
              <p className="font-bold text-slate-800 truncate">
                {s.assessments[0].instructorName || "Teacher"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Expand Detailed Attendance Logs */}
      {s.history.length > 0 && (
        <div className="pt-1">
          <button
            onClick={onToggleExpand}
            className="text-xs font-bold text-[#1a3a8f] hover:underline flex items-center gap-1 cursor-pointer"
          >
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
            <span>
              {isExpanded ? "Hide" : "View"} {s.history.length} Attendance Records
            </span>
          </button>

          {isExpanded && (
            <div className="mt-2 p-3 bg-white rounded-xl border border-slate-200/80 space-y-1.5 max-h-48 overflow-y-auto">
              {s.history.map((record, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-xs py-1 border-b border-slate-100 last:border-0"
                >
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="font-medium text-slate-700">
                      {new Date(record.timestamp).toLocaleDateString([], {
                        weekday: "short",
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                    <span>
                      {new Date(record.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] font-bold text-slate-600 uppercase">
                      {record.method || "KIOSK"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
