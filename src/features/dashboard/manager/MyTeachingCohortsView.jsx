import { BookOpen, ExternalLink } from "lucide-react";
import { LevelBadge } from "../../shared";

export function MyTeachingCohortsView({ myClasses, users }) {
  if (myClasses.length === 0) {
    return (
      <div className="bg-white p-12 rounded-3xl border border-dashed border-slate-200 text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-[#1a3a8f] flex items-center justify-center mx-auto font-bold">
          <BookOpen className="w-6 h-6" />
        </div>
        <h4 className="font-extrabold text-slate-800 text-base">No Teaching Cohorts Assigned</h4>
        <p className="text-xs text-slate-500 max-w-md mx-auto font-medium">
          You are currently not designated as the lead instructor for any active class batches.
          When an administrator assigns you to a batch in batch configuration, it will appear here
          with its student roster, room schedule, and course syllabus.
        </p>
      </div>
    );
  }

  const totalMyStudents = myClasses.reduce((sum, c) => sum + c.studentCount, 0);

  return (
    <div className="space-y-5">
      {/* Overview Header */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-black text-[#1a3a8f]">My Teaching Cohorts</h3>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-indigo-50 text-[#1a3a8f] border border-indigo-100">
              {myClasses.length} Active {myClasses.length === 1 ? "Cohort" : "Cohorts"}
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Classes and student groups where you lead instruction, progress monitoring, and evaluations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 text-center min-w-[110px]">
            <p className="text-[10px] font-extrabold uppercase text-slate-400">Enrolled Students</p>
            <p className="text-xl font-black text-slate-800 mt-0.5">{totalMyStudents}</p>
          </div>
        </div>
      </div>

      {/* Cohort Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {myClasses.map((cls) => {
          const studentList = (cls.studentIds || []).map((sId) => {
            const u = users.find((user) => user.id === sId);
            return u || { id: sId, displayName: "Student" };
          });

          return (
            <div
              key={cls.id}
              className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs p-5 flex flex-col justify-between space-y-4 hover:shadow-md transition"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <LevelBadge level={cls.classLevel || "warrior"} />
                  <span className="text-[11px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 rounded-full">
                    {cls.studentCount} / {cls.maxCapacity || 15} Enrolled
                  </span>
                </div>

                <div>
                  <h4 className="text-base font-extrabold text-slate-900">{cls.className}</h4>
                  <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap font-medium">
                    <span>{cls.schedule || "Schedule unset"}</span>
                    <span>·</span>
                    <span>{cls.classRoom || "Main Campus"}</span>
                  </div>
                </div>

                {/* Enrolled Students Roster preview */}
                <div className="space-y-1.5 pt-1">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    Enrolled Roster ({studentList.length})
                  </p>
                  {studentList.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-2">No students enrolled yet.</p>
                  ) : (
                    <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                      {studentList.map((stu) => (
                        <div
                          key={stu.id}
                          className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs"
                        >
                          <span className="font-bold text-slate-800 truncate">
                            {stu.displayName || stu.name || "Student"}
                          </span>
                          <span className="text-[10px] text-slate-500 font-medium">
                            {stu.currentLevel ? `Level ${stu.currentLevel}` : "Level unset"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {cls.worksheetUrl && (
                <div className="pt-2 border-t border-slate-100">
                  <a
                    href={cls.worksheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-bold text-[#1a3a8f] hover:underline inline-flex items-center gap-1"
                  >
                    <span>View Syllabus / Course Worksheet</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
