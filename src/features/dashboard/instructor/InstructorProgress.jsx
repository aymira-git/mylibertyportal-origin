import { useState, useCallback, useMemo } from "react";
import { useInstructorRoster } from "../useInstructorRoster";
import { LevelBadge } from "../../shared";
import { StudentProgressForm, fetchInstructorProgressReports } from "../../students";
import { uniqueClasses } from "./instructorUtils";
import { Info, GraduationCap, Award, Search } from "lucide-react";

export default function InstructorProgress() {
  const { uid, classes: allClasses, students, loading, error } = useInstructorRoster();
  const classes = useMemo(() => uniqueClasses(allClasses), [allClasses]);
  const [progressTab, setProgressTab] = useState("form"); // "form" | "history"
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");

  const loadHistory = useCallback(async () => {
    if (!uid) return;
    setHistoryLoading(true);
    try {
      const reports = await fetchInstructorProgressReports(uid);
      setHistory(reports);
    } catch (err) {
      console.error("Failed to fetch evaluation history:", err);
    } finally {
      setHistoryLoading(false);
    }
  }, [uid]);

  const handleSwitchToHistory = () => {
    setProgressTab("history");
    loadHistory();
  };

  const filteredHistory = useMemo(() => {
    if (!searchFilter.trim()) return history;
    const q = searchFilter.toLowerCase();
    return history.filter(
      (h) =>
        (h.studentName || "").toLowerCase().includes(q) ||
        (h.className || "").toLowerCase().includes(q) ||
        (h.level || "").toLowerCase().includes(q)
    );
  }, [history, searchFilter]);

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-400 text-sm font-medium">
        Loading assigned class rosters...
      </div>
    );
  }
  if (error) {
    return (
      <div className="bg-rose-50 border border-rose-200 text-rose-800 p-5 rounded-2xl max-w-2xl mx-auto text-xs font-semibold">
        Unable to load your progress classes: {error}
      </div>
    );
  }
  if (classes.length === 0) {
    return (
      <div className="bg-amber-50 border border-amber-200 text-amber-900 p-6 rounded-2xl max-w-2xl mx-auto text-xs font-medium space-y-2">
        <div className="flex items-center gap-2 font-bold text-sm text-amber-950">
          <Info className="w-4 h-4 text-amber-600" />
          <span>No Assigned Teaching Classes</span>
        </div>
        <p>No active cohorts are assigned to your instructor profile. Please contact the front office or academic coordinator to assign classes.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 w-full">
      {/* Tab switcher: New Assessment vs History */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 flex items-center justify-between gap-3 shadow-2xs">
        <div className="flex gap-2">
          <button
            onClick={() => setProgressTab("form")}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-2 ${
              progressTab === "form"
                ? "bg-[#1a3a8f] text-white shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            <span>Record New Assessment</span>
          </button>
          <button
            onClick={handleSwitchToHistory}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-2 ${
              progressTab === "history"
                ? "bg-[#1a3a8f] text-white shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <Award className="w-4 h-4" />
            <span>Evaluation History</span>
            {history.length > 0 && (
              <span className="text-[10px] bg-white/20 text-white px-1.5 py-0.2 rounded-full font-bold">
                {history.length}
              </span>
            )}
          </button>
        </div>

        {progressTab === "history" && (
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search evaluations..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#1a3a8f] w-48"
            />
          </div>
        )}
      </div>

      {progressTab === "form" ? (
        <StudentProgressForm classes={classes} students={students} onSaved={loadHistory} />
      ) : historyLoading ? (
        <div className="p-12 text-center text-slate-400 text-xs font-semibold">
          Loading evaluation history...
        </div>
      ) : filteredHistory.length === 0 ? (
        <div className="bg-white p-10 rounded-3xl border border-dashed border-slate-200 text-center space-y-2">
          <GraduationCap className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="font-bold text-slate-700 text-sm">No Recorded Evaluations Yet</p>
          <p className="text-xs text-slate-400">
            {searchFilter ? "No evaluations match your search query." : "Evaluations submitted through the form will appear here with full rubric breakdown."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredHistory.map((report) => (
            <div
              key={report.id}
              className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-2xs space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-extrabold text-slate-900 text-base">{report.studentName || "Student"}</p>
                    {report.level && <LevelBadge level={report.level} />}
                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                      {report.className}
                    </span>
                  </div>
                  <p className="text-slate-400 text-xs font-medium">
                    Evaluated: {report.examDate ? new Date(report.examDate).toLocaleDateString() : "Recent"}
                  </p>
                </div>

                <div className="flex items-center gap-2 bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 px-3.5 py-1.5 rounded-2xl self-start sm:self-auto">
                  <Award className="w-4 h-4 text-[#1a3a8f]" />
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block leading-none">Score</span>
                    <span className="text-sm font-black text-[#1a3a8f]">{report.overallScore || "—"} / 100</span>
                  </div>
                </div>
              </div>

              {/* Rubric Criteria Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 text-xs">
                <div className="bg-slate-50 p-2 rounded-xl">
                  <span className="text-[10px] text-slate-400 font-bold block">Pronunciation</span>
                  <span className="font-extrabold text-slate-800">{report.pronunciationScore ?? "—"}</span>
                </div>
                <div className="bg-slate-50 p-2 rounded-xl">
                  <span className="text-[10px] text-slate-400 font-bold block">Fluency</span>
                  <span className="font-extrabold text-slate-800">{report.fluencyScore ?? "—"}</span>
                </div>
                <div className="bg-slate-50 p-2 rounded-xl">
                  <span className="text-[10px] text-slate-400 font-bold block">Vocabulary</span>
                  <span className="font-extrabold text-slate-800">{report.vocabularyScore ?? "—"}</span>
                </div>
                <div className="bg-slate-50 p-2 rounded-xl">
                  <span className="text-[10px] text-slate-400 font-bold block">Comprehension</span>
                  <span className="font-extrabold text-slate-800">{report.comprehensionScore ?? "—"}</span>
                </div>
              </div>

              {report.notes && (
                <div className="p-3 bg-slate-50/60 rounded-xl text-xs text-slate-600 font-medium">
                  <span className="font-bold text-slate-500 block mb-0.5">Instructor Feedback:</span>
                  <p>{report.notes}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
