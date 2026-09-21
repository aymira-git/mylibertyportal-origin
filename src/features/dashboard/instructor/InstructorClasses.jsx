import { useState, useMemo } from "react";
import { useInstructorRoster } from "../useInstructorRoster";
import { auth } from "../../../firebase";
import { LevelBadge } from "../../shared";
import { AvailableBatches } from "../../classes";
import { StudentRoster, BadgeModal } from "../../students";
import { uniqueClasses } from "./instructorUtils";
import { Info, ExternalLink, FileText } from "lucide-react";

export default function InstructorClasses({
  selectedClassFilter,
  setSelectedClassFilter,
  allClasses = [],
}) {
  const [subTab, setSubTab] = useState("my_classes");
  const {
    classes: rawClasses,
    students: allStudents,
    instructorName,
    loading,
    error,
  } = useInstructorRoster();
  const classes = useMemo(() => uniqueClasses(rawClasses), [rawClasses]);
  const [selectedStudent, setSelectedStudent] = useState(null);

  const enrolledIds = useMemo(
    () => new Set(classes.flatMap((cls) => cls.studentIds || [])),
    [classes]
  );
  const students = useMemo(
    () => allStudents.filter((student) => enrolledIds.has(student.id)),
    [allStudents, enrolledIds]
  );

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
        dateJoined:
          (cls.enrollments || []).find((enrollment) => enrollment.studentId === studentId)
            ?.dateJoined || "",
      }));
  };

  if (subTab === "all_batches") {
    return (
      <div className="space-y-5 w-full">
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
      <div className="space-y-5 w-full">
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
          <p>
            You have not been assigned to any student cohorts yet. Check in with administration for
            class scheduling.
          </p>
        </div>
      </div>
    );
  }

  const worksheets = classes.filter((cls) => cls.worksheetUrl);

  return (
    <div className="space-y-5 w-full">
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
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                selectedClassFilter === "all"
                  ? "bg-white/20 text-white"
                  : "bg-slate-200 text-slate-600"
              }`}
            >
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
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isSelected ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600"
                  }`}
                >
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
              <span className="text-slate-500 font-medium">
                · Room: {activeFilteredClass.classRoom || "Main Campus"}
              </span>
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
        <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-2xs w-full space-y-3">
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
