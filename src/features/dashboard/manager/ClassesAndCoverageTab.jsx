import { useState, useMemo } from "react";
import { LevelBadge } from "../../shared";
import { AvailableBatches } from "../../classes";
import { MyTeachingCohortsView } from "./MyTeachingCohortsView";

export function ClassesAndCoverageTab({ classes, users, currentUserId }) {
  const [viewMode, setViewMode] = useState("batches");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const instructorMap = useMemo(() => {
    const map = new Map();
    users.forEach((u) => {
      if (u.role === "instructor" || u.role === "admin") {
        map.set(
          u.id,
          u.displayName || `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email
        );
      }
    });
    return map;
  }, [users]);

  const augmentedClasses = useMemo(() => {
    return classes.map((c) => {
      const hasInstructor = Boolean(c.instructorId && instructorMap.has(c.instructorId));
      const hasRoom = Boolean(c.classRoom && c.classRoom !== "N/A" && c.classRoom.trim() !== "");
      return {
        ...c,
        instructorName: c.instructorId
          ? instructorMap.get(c.instructorId) || "Unknown Staff"
          : null,
        hasInstructor,
        hasRoom,
        studentCount: c.studentIds?.length || 0,
      };
    });
  }, [classes, instructorMap]);

  const myAssignedClasses = useMemo(() => {
    if (!currentUserId) return [];
    return augmentedClasses.filter((c) => c.instructorId === currentUserId);
  }, [augmentedClasses, currentUserId]);

  const filteredClasses = useMemo(() => {
    return augmentedClasses
      .filter((c) => {
        if (filter === "my_classes") return c.instructorId === currentUserId;
        if (filter === "needs_instructor") return !c.hasInstructor;
        if (filter === "needs_room") return !c.hasRoom;
        if (filter === "covered") return c.hasInstructor && c.hasRoom;
        return true;
      })
      .filter((c) => {
        const q = search.trim().toLowerCase();
        if (!q) return true;
        return (
          (c.className || "").toLowerCase().includes(q) ||
          (c.instructorName || "").toLowerCase().includes(q) ||
          (c.schedule || "").toLowerCase().includes(q) ||
          (c.classRoom || "").toLowerCase().includes(q)
        );
      });
  }, [augmentedClasses, filter, search, currentUserId]);

  const totalClasses = augmentedClasses.length;
  const staffedClasses = augmentedClasses.filter((c) => c.hasInstructor).length;
  const roomedClasses = augmentedClasses.filter((c) => c.hasRoom).length;
  const totalEnrolledSeats = augmentedClasses.reduce((sum, c) => sum + c.studentCount, 0);

  return (
    <div className="w-full space-y-6">
      {/* Subtab Navigation */}
      <div className="flex p-1 bg-slate-100 rounded-2xl border border-slate-200/80 w-fit flex-wrap gap-1">
        <button
          onClick={() => setViewMode("batches")}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold transition ${
            viewMode === "batches"
              ? "bg-white text-[#1a3a8f] shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Available Batches ({classes.length})
        </button>
        <button
          onClick={() => setViewMode("coverage")}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold transition ${
            viewMode === "coverage"
              ? "bg-white text-[#1a3a8f] shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Coverage &amp; Logistics Audit
        </button>
        <button
          onClick={() => setViewMode("my_cohorts")}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 ${
            viewMode === "my_cohorts"
              ? "bg-white text-[#1a3a8f] shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <span>My Teaching Cohorts</span>
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
              viewMode === "my_cohorts"
                ? "bg-[#1a3a8f]/10 text-[#1a3a8f]"
                : "bg-slate-200 text-slate-700"
            }`}
          >
            {myAssignedClasses.length}
          </span>
        </button>
      </div>

      {viewMode === "batches" && (
        <AvailableBatches
          classes={classes}
          users={users}
          canEdit={false}
          role="manager"
          currentUserId={currentUserId}
        />
      )}

      {viewMode === "my_cohorts" && (
        <MyTeachingCohortsView myClasses={myAssignedClasses} users={users} />
      )}

      {viewMode === "coverage" && (
        <>
          {/* Header Banner */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div>
              <h2 className="text-2xl font-black text-[#1a3a8f]">Classes &amp; Coverage Command</h2>
              <p className="text-sm text-slate-500 mt-1">
                Audit instructor assignments, room logistics, and student group capacity across all
                programs.
              </p>
            </div>

            {/* Coverage Metrics Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="p-3 bg-slate-50 border rounded-xl">
                <p className="text-[10px] font-bold uppercase text-slate-500">Total Classes</p>
                <p className="text-2xl font-black text-slate-800 mt-1">{totalClasses}</p>
              </div>
              <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                <p className="text-[10px] font-bold uppercase text-emerald-700">
                  Instructor Coverage
                </p>
                <p className="text-2xl font-black text-emerald-800 mt-1">
                  {totalClasses > 0 ? Math.round((staffedClasses / totalClasses) * 100) : 0}%
                </p>
              </div>
              <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                <p className="text-[10px] font-bold uppercase text-indigo-700">Room Allocated</p>
                <p className="text-2xl font-black text-indigo-800 mt-1">
                  {totalClasses > 0 ? Math.round((roomedClasses / totalClasses) * 100) : 0}%
                </p>
              </div>
              <div className="p-3 bg-purple-50 border border-purple-100 rounded-xl">
                <p className="text-[10px] font-bold uppercase text-purple-700">Enrolled Seats</p>
                <p className="text-2xl font-black text-purple-800 mt-1">{totalEnrolledSeats}</p>
              </div>
            </div>

            {/* Filter and Search Controls */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <input
                type="text"
                placeholder="🔍 Search class name, instructor, room, or schedule..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 p-2.5 border rounded-xl text-sm"
              />
              <div className="flex gap-1.5 flex-wrap text-xs font-bold">
                {[
                  { id: "all", label: "All Classes" },
                  { id: "my_classes", label: `⭐ My Cohorts (${myAssignedClasses.length})` },
                  { id: "needs_instructor", label: "⚠️ Needs Instructor" },
                  { id: "needs_room", label: "⚠️ Needs Room" },
                  { id: "covered", label: "✓ Fully Covered" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setFilter(tab.id)}
                    className={`px-3 py-2 rounded-xl transition ${
                      filter === tab.id
                        ? "bg-[#1a3a8f] text-white shadow-sm"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Classes Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {filteredClasses.length === 0 ? (
              <div className="p-10 text-center text-slate-400 text-sm">
                No classes found matching your search and filter criteria.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="p-3.5">Class Name</th>
                      <th className="p-3.5">Level</th>
                      <th className="p-3.5">Assigned Instructor</th>
                      <th className="p-3.5">Schedule</th>
                      <th className="p-3.5">Room</th>
                      <th className="p-3.5 text-right">Enrollment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredClasses.map((cls) => (
                      <tr key={cls.id} className="hover:bg-slate-50/80 transition">
                        <td className="p-3.5">
                          <p className="font-bold text-slate-800 text-sm">{cls.className}</p>
                          <span className="text-[10px] text-slate-400">
                            ID: {cls.id.slice(0, 8)}...
                          </span>
                        </td>
                        <td className="p-3.5">
                          <LevelBadge level={cls.classLevel || "warrior"} />
                        </td>
                        <td className="p-3.5">
                          {cls.hasInstructor ? (
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                              <span className="font-semibold text-slate-700">
                                {cls.instructorName}
                              </span>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-bold text-[10px] uppercase bg-rose-100 text-rose-800 px-2 py-0.5 rounded border border-rose-200">
                              ⚠️ Unassigned
                            </span>
                          )}
                        </td>
                        <td className="p-3.5">
                          <p className="font-medium text-slate-700">
                            {cls.schedule ||
                              `${cls.classDay || "Days unset"} @ ${cls.startTime || "--"} - ${cls.endTime || "--"}`}
                          </p>
                        </td>
                        <td className="p-3.5">
                          {cls.hasRoom ? (
                            <span className="font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded">
                              {cls.classRoom}
                            </span>
                          ) : (
                            <span className="inline-flex items-center font-bold text-[10px] uppercase bg-amber-100 text-amber-800 px-2 py-0.5 rounded border border-amber-200">
                              ⚠️ Room Needed
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 text-right">
                          <span className="font-black text-slate-800 bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full text-xs">
                            {cls.studentCount} student{cls.studentCount === 1 ? "" : "s"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
