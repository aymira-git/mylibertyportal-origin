export function OperationalBottlenecksSection({
  pendingApplications,
  unenrolledStudents,
  classesWithIssues,
  totalBottlenecks,
  onNavigate,
}) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <span>🚨 Operational Bottlenecks &amp; Action Required</span>
            {totalBottlenecks > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-black bg-rose-100 text-rose-700">
                {totalBottlenecks}
              </span>
            )}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Items currently slowing down student onboarding or daily operations.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Bottleneck 1: Pending Applications */}
        <div
          className={`p-4 rounded-xl border flex flex-col justify-between ${
            pendingApplications.length > 0
              ? "bg-amber-50/70 border-amber-200"
              : "bg-slate-50 border-slate-200"
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                📝 Pending Leads
              </span>
              <span
                className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                  pendingApplications.length > 0
                    ? "bg-amber-200 text-amber-900"
                    : "bg-slate-200 text-slate-600"
                }`}
              >
                {pendingApplications.length}
              </span>
            </div>
            {pendingApplications.length > 0 ? (
              <div className="space-y-2 mb-3">
                <p className="text-xs text-amber-900 font-medium">
                  Leads waiting for Front Office / Marketing outreach:
                </p>
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {pendingApplications.slice(0, 3).map((app) => (
                    <div
                      key={app.id}
                      className="bg-white/90 p-2 rounded-lg text-xs border border-amber-200/80"
                    >
                      <p className="font-bold text-slate-800 truncate">
                        {app.fullName || app.name || "New Applicant"}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {app.program || "English Program"} · {app.phone || "No phone"}
                      </p>
                    </div>
                  ))}
                  {pendingApplications.length > 3 && (
                    <p className="text-[10px] text-amber-800 font-semibold text-center">
                      +{pendingApplications.length - 3} more waiting
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 py-3">
                ✓ All applicant leads have been contacted and processed.
              </p>
            )}
          </div>
          {pendingApplications.length > 0 && (
            <button
              onClick={() => onNavigate("tasks")}
              className="w-full mt-2 py-2 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition shadow-sm cursor-pointer"
            >
              Delegate Lead Follow-up →
            </button>
          )}
        </div>

        {/* Bottleneck 2: Unassigned Students */}
        <div
          className={`p-4 rounded-xl border flex flex-col justify-between ${
            unenrolledStudents.length > 0
              ? "bg-rose-50/70 border-rose-200"
              : "bg-slate-50 border-slate-200"
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                ⚠️ Unassigned Students
              </span>
              <span
                className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                  unenrolledStudents.length > 0
                    ? "bg-rose-200 text-rose-900"
                    : "bg-slate-200 text-slate-600"
                }`}
              >
                {unenrolledStudents.length}
              </span>
            </div>
            {unenrolledStudents.length > 0 ? (
              <div className="space-y-2 mb-3">
                <p className="text-xs text-rose-900 font-medium">
                  Active students not yet placed into a class group:
                </p>
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {unenrolledStudents.slice(0, 3).map((stu) => (
                    <div
                      key={stu.id}
                      className="bg-white/90 p-2 rounded-lg text-xs border border-rose-200/80"
                    >
                      <p className="font-bold text-slate-800 truncate">
                        {stu.displayName || stu.firstName || "Student"}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {stu.program || stu.branch || "General"} · Level:{" "}
                        {stu.currentLevel || "Unset"}
                      </p>
                    </div>
                  ))}
                  {unenrolledStudents.length > 3 && (
                    <p className="text-[10px] text-rose-800 font-semibold text-center">
                      +{unenrolledStudents.length - 3} more unplaced
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 py-3">
                ✓ 100% Student Placement. Every active student is assigned to a class.
              </p>
            )}
          </div>
          {unenrolledStudents.length > 0 && (
            <button
              onClick={() => onNavigate("classes")}
              className="w-full mt-2 py-2 px-3 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-sm cursor-pointer"
            >
              Assign to Open Classes →
            </button>
          )}
        </div>

        {/* Bottleneck 3: Class Coverage Alerts */}
        <div
          className={`p-4 rounded-xl border flex flex-col justify-between ${
            classesWithIssues.length > 0
              ? "bg-purple-50/70 border-purple-200"
              : "bg-slate-50 border-slate-200"
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                🏫 Coverage Alerts
              </span>
              <span
                className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                  classesWithIssues.length > 0
                    ? "bg-purple-200 text-purple-900"
                    : "bg-slate-200 text-slate-600"
                }`}
              >
                {classesWithIssues.length}
              </span>
            </div>
            {classesWithIssues.length > 0 ? (
              <div className="space-y-2 mb-3">
                <p className="text-xs text-purple-900 font-medium">
                  Classes with missing instructor or room allocation:
                </p>
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {classesWithIssues.slice(0, 3).map((cls) => (
                    <div
                      key={cls.id}
                      className="bg-white/90 p-2 rounded-lg text-xs border border-purple-200/80"
                    >
                      <p className="font-bold text-slate-800 truncate">
                        {cls.className || "Scheduled Class"}
                      </p>
                      <div className="flex gap-1.5 mt-0.5 flex-wrap">
                        {cls.needsInstructor && (
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">
                            Missing Instructor
                          </span>
                        )}
                        {cls.instructorInactive && (
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                            Instructor Inactive
                          </span>
                        )}
                        {cls.needsRoom && (
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                            Room Needed
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {classesWithIssues.length > 3 && (
                    <p className="text-[10px] text-purple-800 font-semibold text-center">
                      +{classesWithIssues.length - 3} more alerts
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 py-3">
                ✓ All active classes have confirmed instructors and room assignments.
              </p>
            )}
          </div>
          {classesWithIssues.length > 0 && (
            <button
              onClick={() => onNavigate("classes")}
              className="w-full mt-2 py-2 px-3 rounded-lg bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold transition shadow-sm cursor-pointer"
            >
              Resolve Coverage in Classes →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
