import { useMemo } from "react";
import { getTodayWitaWeekday, todayWita } from "../../../utils/dateWita";
import { parseScheduleDayCodes, NUM_TO_DAY_CODE } from "../../../constants/scheduleDays";
import { DoorOpen, Clock, Users, User, BookOpen, AlertCircle } from "lucide-react";

/**
 * Today's Live Class & Room Board for Front Office.
 * Inspects classes already in memory, checking schedule overlap with today's WITA day.
 * Zero additional Firestore reads.
 */
export default function TodayScheduleBoard({ classes = [], instructors = [], onNavigateToClasses }) {
  const todayDateStr = todayWita();
  const weekdayNum = getTodayWitaWeekday();
  const todayDayCode = NUM_TO_DAY_CODE[weekdayNum]; // "sun", "mon", "tue", ...

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const todayDayName = dayNames[weekdayNum] || "Today";

  const todayClasses = useMemo(() => {
    return classes
      .filter((c) => {
        if (!c.classDay) return false;
        const codes = parseScheduleDayCodes(c.classDay);
        return codes.has(todayDayCode);
      })
      .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));
  }, [classes, todayDayCode]);

  const getInstructorName = (instructorId) => {
    const found = instructors.find((i) => i.id === instructorId);
    return found?.displayName || found?.firstName || "TBA";
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
      <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#1a3a8f] flex items-center justify-center font-bold">
            <DoorOpen className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
              <span>Today&apos;s Room & Class Board</span>
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-[#1a3a8f]">
                {todayDayName} • {todayDateStr}
              </span>
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Live schedule for greeting arriving students and directing parents to the right rooms.
            </p>
          </div>
        </div>

        {onNavigateToClasses && (
          <button
            onClick={onNavigateToClasses}
            className="text-xs font-bold text-[#1a3a8f] hover:underline"
          >
            View All Classes →
          </button>
        )}
      </div>

      {todayClasses.length === 0 ? (
        <div className="p-8 text-center text-slate-500 space-y-2">
          <AlertCircle className="w-8 h-8 mx-auto text-slate-300" />
          <p className="text-xs font-semibold">No scheduled classes running today ({todayDayName}).</p>
          <p className="text-[11px] text-slate-400">
            Check the Classes tab if a batch needs a room reassignment or schedule adjustment.
          </p>
        </div>
      ) : (
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {todayClasses.map((c) => {
            const studentCount = Array.isArray(c.studentIds) ? c.studentIds.length : 0;
            const instructorName = getInstructorName(c.instructorId);

            return (
              <div
                key={c.id}
                className="p-4 rounded-2xl border border-slate-200/90 bg-slate-50/50 hover:bg-white hover:border-[#1a3a8f]/40 hover:shadow-xs transition space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-extrabold text-xs text-slate-800 leading-tight">
                      {c.className}
                    </h4>
                    <span className="text-[10px] font-semibold text-slate-400 flex items-center gap-1 mt-0.5">
                      <BookOpen className="w-3 h-3 text-slate-400" />
                      {c.programId || "General"}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-lg bg-indigo-100 text-indigo-900 font-extrabold text-[10px] shrink-0">
                    {c.classRoom || "Room TBA"}
                  </span>
                </div>

                <div className="pt-1 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-600 font-medium">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      {c.startTime || "--:--"} - {c.endTime || "--:--"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <span>{studentCount} enrolled</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                  <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">Instructor: {instructorName}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
