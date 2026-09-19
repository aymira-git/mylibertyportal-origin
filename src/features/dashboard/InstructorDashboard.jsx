import { useState, useCallback, useMemo, useEffect } from "react";
import { useInstructorRoster } from "./useInstructorRoster";
import { AIAssistant, DashboardShell, LevelBadge, WelcomeBanner } from "../shared";
import { Kiosk } from "../attendance";
import { ClassPhotoShare, TeachingMaterial, AvailableBatches } from "../classes";
import { ReportsDashboard } from "../reports";
import { StudentProgressForm, StudentRoster, BadgeModal, fetchInstructorProgressReports } from "../students";
import { auth, db } from "../../firebase";
import { collection, onSnapshot } from "firebase/firestore";
import {
  FileText,
  ExternalLink,
  Info,
  Users,
  GraduationCap,
  Calendar,
  Clock,
  MapPin,
  Award,
  Search,
  BookOpen,
  ArrowRight,
  FolderOpen
} from "lucide-react";

function uniqueClasses(classes) {
  const seen = new Set();
  return classes.filter((cls) => {
    const signature = [cls.className, cls.instructorId, cls.schedule, cls.classRoom].join("|");
    if (seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
}

function InstructorOverview({ classes, students, instructorName, onNavigate, onSelectClass, allClasses = [] }) {
  const enrolledIds = useMemo(() => new Set(classes.flatMap((cls) => cls.studentIds || [])), [classes]);
  const enrolledStudents = useMemo(() => students.filter((student) => enrolledIds.has(student.id)), [students, enrolledIds]);
  const worksheets = useMemo(() => classes.filter((cls) => cls.worksheetUrl), [classes]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* ── Welcome Banner ── */}
      <WelcomeBanner
        portalLabel="Faculty Portal"
        roleLabel="Active Instructor"
        userName={instructorName}
        fallbackName="Teacher"
        subtitle="Manage your student cohorts, record CEFR evaluations, and track class attendance."
        stats={[
          {
            label: "Teaching Cohorts",
            value: classes.length,
            icon: BookOpen,
          },
          {
            label: "Enrolled Students",
            value: enrolledStudents.length,
            icon: Users,
          },
          {
            label: "Syllabi & Materials",
            value: worksheets.length,
            icon: FileText,
          },
        ]}
      />

      {/* ── Quick Action Shortcuts ── */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-3">
        <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">
          Instructor Quick Actions
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <button
            onClick={() => onNavigate("kiosk")}
            className="p-3 bg-slate-50 hover:bg-indigo-50/60 border border-slate-200/80 hover:border-indigo-200 rounded-2xl text-left transition group"
          >
            <Clock className="w-4 h-4 text-[#1a3a8f] mb-1.5 group-hover:scale-110 transition-transform" />
            <p className="font-extrabold text-xs text-slate-800">Scan Attendance</p>
            <p className="text-[10px] text-slate-500">Student QR scanner</p>
          </button>

          <button
            onClick={() => onNavigate("progress")}
            className="p-3 bg-slate-50 hover:bg-indigo-50/60 border border-slate-200/80 hover:border-indigo-200 rounded-2xl text-left transition group"
          >
            <GraduationCap className="w-4 h-4 text-emerald-600 mb-1.5 group-hover:scale-110 transition-transform" />
            <p className="font-extrabold text-xs text-slate-800">Evaluate Student</p>
            <p className="text-[10px] text-slate-500">Record CEFR report</p>
          </button>

          <button
            onClick={() => onNavigate("classes")}
            className="p-3 bg-slate-50 hover:bg-indigo-50/60 border border-slate-200/80 hover:border-indigo-200 rounded-2xl text-left transition group"
          >
            <Users className="w-4 h-4 text-blue-600 mb-1.5 group-hover:scale-110 transition-transform" />
            <p className="font-extrabold text-xs text-slate-800">Class Rosters</p>
            <p className="text-[10px] text-slate-500">View enrolled cohorts</p>
          </button>

          <button
            onClick={() => onNavigate("materials")}
            className="p-3 bg-slate-50 hover:bg-indigo-50/60 border border-slate-200/80 hover:border-indigo-200 rounded-2xl text-left transition group"
          >
            <FolderOpen className="w-4 h-4 text-amber-600 mb-1.5 group-hover:scale-110 transition-transform" />
            <p className="font-extrabold text-xs text-slate-800">Lesson Resources</p>
            <p className="text-[10px] text-slate-500">Curriculum & links</p>
          </button>
        </div>
      </div>

      {/* ── Assigned Cohort Cards ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-extrabold text-slate-800 text-sm">
            My Assigned Teaching Cohorts ({classes.length})
          </h4>
          <button
            onClick={() => onNavigate("classes")}
            className="text-xs font-bold text-[#1a3a8f] hover:underline flex items-center gap-1"
          >
            <span>View All in Roster</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {classes.length === 0 ? (
          <div className="bg-white p-8 rounded-3xl border border-dashed border-slate-200 text-center space-y-2">
            <Info className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="font-bold text-slate-700 text-sm">No Cohorts Assigned</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              You do not have any active teaching batches assigned to your profile yet. Please contact administration for class scheduling.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {classes.map((cls) => {
              const studentCount = (cls.studentIds || []).length;
              return (
                <div
                  key={cls.id}
                  className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-2xs hover:border-indigo-200 transition space-y-3.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h5 className="font-black text-slate-900 text-base truncate">{cls.className}</h5>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-500 text-xs font-medium mt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{cls.schedule || "Schedule TBA"}</span>
                        </span>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          <span>{cls.classRoom || "Main Campus"}</span>
                        </span>
                      </div>
                    </div>

                    {cls.classLevel && (
                      <LevelBadge level={cls.classLevel} />
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-600 font-semibold">
                      <Users className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{studentCount} Enrolled</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {cls.worksheetUrl && (
                        <a
                          href={cls.worksheetUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 px-2.5 py-1 rounded-lg transition"
                        >
                          <FileText className="w-3 h-3 text-emerald-600" />
                          <span>Syllabus</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                      <button
                        onClick={() => {
                          onSelectClass(cls.id);
                          onNavigate("classes");
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-[#1a3a8f] bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 px-2.5 py-1 rounded-lg transition"
                      >
                        <span>View Roster</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Academy Available Batches (View Only) ── */}
      <AvailableBatches
        classes={allClasses}
        users={students}
        canEdit={false}
        role="instructor"
        currentUserId={auth.currentUser?.uid}
        isOverviewWidget={true}
        onNavigateToClasses={() => onNavigate("classes")}
      />
    </div>
  );
}

function InstructorClasses({ selectedClassFilter, setSelectedClassFilter, allClasses = [] }) {
  const [subTab, setSubTab] = useState("my_classes");
  const { classes: rawClasses, students: allStudents, instructorName, loading, error } = useInstructorRoster();
  const classes = useMemo(() => uniqueClasses(rawClasses), [rawClasses]);
  const [selectedStudent, setSelectedStudent] = useState(null);

  const enrolledIds = useMemo(() => new Set(classes.flatMap((cls) => cls.studentIds || [])), [classes]);
  const students = useMemo(() => allStudents.filter((student) => enrolledIds.has(student.id)), [allStudents, enrolledIds]);

  const activeFilteredClass = useMemo(() => {
    if (!selectedClassFilter || selectedClassFilter === "all") return null;
    return classes.find((c) => c.id === selectedClassFilter);
  }, [classes, selectedClassFilter]);

  const displayedStudents = useMemo(() => {
    if (!activeFilteredClass) return students;
    const filterIds = new Set(activeFilteredClass.studentIds || []);
    return students.filter((s) => filterIds.has(s.id));
  }, [activeFilteredClass, students]);

  const getStudentClasses = (studentId) => {
    return classes
      .filter((cls) => (cls.studentIds || []).includes(studentId))
      .map((cls) => ({
        className: cls.className,
        instructorName: instructorName || "Unassigned",
        dateJoined: (cls.enrollments || []).find((enrollment) => enrollment.studentId === studentId)?.dateJoined || "",
      }));
  };

  if (subTab === "all_batches") {
    return (
      <div className="space-y-5 max-w-6xl mx-auto">
        <div className="flex p-1 bg-slate-100 rounded-2xl border border-slate-200/80 w-fit">
          <button
            onClick={() => setSubTab("my_classes")}
            className="px-4 py-2 rounded-xl text-xs font-extrabold transition text-slate-600 hover:text-slate-900"
          >
            My Teaching Cohorts ({classes.length})
          </button>
          <button
            onClick={() => setSubTab("all_batches")}
            className="px-4 py-2 rounded-xl text-xs font-extrabold transition bg-white text-[#1a3a8f] shadow-xs"
          >
            All Available Batches ({allClasses.length})
          </button>
        </div>
        <AvailableBatches
          classes={allClasses}
          users={allStudents}
          canEdit={false}
          role="instructor"
          currentUserId={auth.currentUser?.uid}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-400 text-sm font-medium">
        Loading enrolled student rosters...
      </div>
    );
  }
  if (error) {
    return (
      <div className="bg-rose-50 border border-rose-200 text-rose-800 p-5 rounded-2xl max-w-2xl mx-auto text-xs font-semibold">
        Unable to load class roster: {error}
      </div>
    );
  }
  if (classes.length === 0) {
    return (
      <div className="space-y-5 max-w-6xl mx-auto">
        <div className="flex p-1 bg-slate-100 rounded-2xl border border-slate-200/80 w-fit">
          <button
            onClick={() => setSubTab("my_classes")}
            className="px-4 py-2 rounded-xl text-xs font-extrabold transition bg-white text-[#1a3a8f] shadow-xs"
          >
            My Teaching Cohorts (0)
          </button>
          <button
            onClick={() => setSubTab("all_batches")}
            className="px-4 py-2 rounded-xl text-xs font-extrabold transition text-slate-600 hover:text-slate-900"
          >
            All Available Batches ({allClasses.length})
          </button>
        </div>
        <div className="bg-amber-50 border border-amber-200 text-amber-900 p-6 rounded-2xl max-w-2xl mx-auto text-xs font-medium space-y-2">
          <div className="flex items-center gap-2 font-bold text-sm text-amber-950">
            <Info className="w-4 h-4 text-amber-600" />
            <span>No Assigned Teaching Cohorts</span>
          </div>
          <p>You have not been assigned to any student cohorts yet. Check in with administration for class scheduling.</p>
        </div>
      </div>
    );
  }

  const worksheets = classes.filter((cls) => cls.worksheetUrl);

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* ── Subtab Switcher ── */}
      <div className="flex p-1 bg-slate-100 rounded-2xl border border-slate-200/80 w-fit">
        <button
          onClick={() => setSubTab("my_classes")}
          className="px-4 py-2 rounded-xl text-xs font-extrabold transition bg-white text-[#1a3a8f] shadow-xs"
        >
          My Teaching Cohorts ({classes.length})
        </button>
        <button
          onClick={() => setSubTab("all_batches")}
          className="px-4 py-2 rounded-xl text-xs font-extrabold transition text-slate-600 hover:text-slate-900"
        >
          All Available Batches ({allClasses.length})
        </button>
      </div>
      {/* ── Cohort Filter Switcher ── */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
          <div>
            <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">
              Filter by Cohort
            </h4>
            <p className="text-[11px] text-slate-500">
              Select a class batch to view its dedicated roster and syllabus
            </p>
          </div>
          {selectedClassFilter !== "all" && (
            <button
              onClick={() => setSelectedClassFilter("all")}
              className="text-xs font-bold text-[#1a3a8f] hover:underline self-start sm:self-auto"
            >
              Reset to All Students
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            onClick={() => setSelectedClassFilter("all")}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 ${
              selectedClassFilter === "all"
                ? "bg-[#1a3a8f] text-white shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <span>All Cohorts</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
              selectedClassFilter === "all" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600"
            }`}>
              {students.length}
            </span>
          </button>

          {classes.map((cls) => {
            const isSelected = selectedClassFilter === cls.id;
            const count = (cls.studentIds || []).length;
            return (
              <button
                key={cls.id}
                onClick={() => setSelectedClassFilter(cls.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-2 ${
                  isSelected
                    ? "bg-[#1a3a8f] text-white shadow-xs"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                <span>{cls.className}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  isSelected ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600"
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Selected Cohort Detail Pill */}
        {activeFilteredClass && (
          <div className="mt-2 p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-extrabold text-slate-900">{activeFilteredClass.className}</span>
              <span className="text-slate-500 font-medium">· {activeFilteredClass.schedule}</span>
              <span className="text-slate-500 font-medium">· Room: {activeFilteredClass.classRoom || "Main Campus"}</span>
              {activeFilteredClass.classLevel && (
                <LevelBadge level={activeFilteredClass.classLevel} />
              )}
            </div>

            {activeFilteredClass.worksheetUrl && (
              <a
                href={activeFilteredClass.worksheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-xl font-bold text-xs transition shadow-2xs shrink-0 self-start sm:self-auto"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Class Syllabus / Worksheet</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        )}
      </div>

      {/* ── Syllabi Resources (if not filtered or all) ── */}
      {selectedClassFilter === "all" && worksheets.length > 0 && (
        <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-2xs max-w-6xl mx-auto space-y-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-600" />
            <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">
              Assigned Class Worksheets & Syllabi
            </h4>
          </div>
          <div className="flex flex-wrap gap-2">
            {worksheets.map((cls) => (
              <a
                key={cls.id}
                href={cls.worksheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 px-3 py-1.5 rounded-xl font-bold text-xs transition shadow-2xs group"
              >
                <span>{cls.className} Worksheet</span>
                <ExternalLink className="w-3 h-3 text-emerald-600 group-hover:translate-x-0.5 transition-transform" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* ── Student Roster Component ── */}
      <StudentRoster
        readOnly
        students={displayedStudents}
        getStudentClasses={getStudentClasses}
        setSelectedStudent={setSelectedStudent}
      />
      <BadgeModal person={selectedStudent} onClose={() => setSelectedStudent(null)} />
    </div>
  );
}

function InstructorProgress() {
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
    <div className="space-y-5 max-w-4xl mx-auto">
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

export default function InstructorDashboard() {
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window === "undefined") return "overview";
    try {
      const params = new URLSearchParams(window.location.search);
      const action = params.get("action");
      if (action === "class-photo" || action === "attendance") {
        return "kiosk";
      }
    } catch {
      // Ignore URL parsing errors
    }
    return "overview";
  });
  const [selectedClassFilter, setSelectedClassFilter] = useState("all");

  const { classes: rawClasses, students, instructorName } = useInstructorRoster();
  const classes = useMemo(() => uniqueClasses(rawClasses), [rawClasses]);
  const [allClasses, setAllClasses] = useState([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "classes"), (snap) => {
      setAllClasses(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const tabs = [
    {
      id: "overview",
      label: "Overview",
      component: (
        <InstructorOverview
          classes={classes}
          students={students}
          instructorName={instructorName}
          onNavigate={setActiveTab}
          onSelectClass={(classId) => setSelectedClassFilter(classId)}
          allClasses={allClasses}
        />
      ),
    },
    {
      id: "kiosk",
      label: "Attendance & Kiosk",
      component: (
        <div className="space-y-6 max-w-xl mx-auto">
          <Kiosk title="Student Attendance Scanner" studentsOnly={true} />
          <ClassPhotoShare />
        </div>
      ),
    },
    {
      id: "classes",
      label: "My Classes",
      component: (
        <InstructorClasses
          selectedClassFilter={selectedClassFilter}
          setSelectedClassFilter={setSelectedClassFilter}
          allClasses={allClasses}
        />
      ),
    },
    { id: "progress", label: "Student Progress", component: <InstructorProgress /> },
    { id: "materials", label: "Lesson Materials", component: <TeachingMaterial /> },
    { id: "reports", label: "Reports", component: <ReportsDashboard /> },
    { id: "ai", label: "AI Assistant", component: <AIAssistant /> },
  ];

  return (
    <div className="p-5 bg-[#f0f2f5] rounded-2xl min-h-[500px]">
      <DashboardShell
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        title="Instructor Portal"
      />
    </div>
  );
}
