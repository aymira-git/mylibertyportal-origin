import { useState, Fragment } from "react";
import {
  LevelBadge,
  LEVELS,
  LEVEL_KEYS,
  useToast,
  useConfirm,
  uploadFileToCloudinary,
  exportTableCSV
} from "../shared";
import {
  createClass,
  deleteClass,
  addStudentToClass,
  removeStudentFromClass,
  setClassGroupLevel,
  syncStudentsCurrentLevel,
} from "./classesRepository";
import AvailableBatches from "./AvailableBatches";
import BatchModal from "./BatchModal";
import TransferModal from "./TransferModal";
import {
  Calendar,
  MapPin,
  Users,
  Plus,
  Trash2,
  Edit2,
  ChevronDown,
  ChevronRight,
  Download,
  FileText,
  Search,
  ExternalLink,
  Check,
  Sparkles,
  ArrowRightLeft,
} from "lucide-react";

export default function ClassManager({
  classes,
  users,
  instructors,
  unenrolledStudents,
  role = "admin",
  isAdmin = true,
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [classSubTab, setClassSubTab] = useState("batches");
  const [editingBatchFromCard, setEditingBatchFromCard] = useState(null);
  const [className, setClassName] = useState("");
  const [assignedInstructor, setAssignedInstructor] = useState("");
  const [classDay, setClassDay] = useState("Mon/Wed");
  const [classStartDate, setClassStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [classLevel, setClassLevel] = useState("warrior");
  const [enrolledStudents, setEnrolledStudents] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [classRoom, setClassRoom] = useState("");

  // Search & filter for Active Classes tab
  const [searchQuery, setSearchQuery] = useState("");
  const [filterLevel, setFilterLevel] = useState("all");

  // Add-to-existing-class panel state
  const [enrollingIntoClassId, setEnrollingIntoClassId] = useState(null);
  const [addStudentId, setAddStudentId] = useState("");
  const [addDateJoined, setAddDateJoined] = useState(new Date().toISOString().slice(0, 10));
  const [transferringStudent, setTransferringStudent] = useState(null);
  const canEnroll = isAdmin || role === "frontoffice";

  const [classSortField, setClassSortField] = useState("className");
  const [classSortAsc, setClassSortAsc] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [editingLevelKey, setEditingLevelKey] = useState(null);
  const [pendingLevel, setPendingLevel] = useState("warrior");

  const handleCreateClass = async (e) => {
    e.preventDefault();

    const mismatched = enrolledStudents
      .map((id) => users.find((u) => u.id === id))
      .filter((s) => s?.currentLevel && s.currentLevel !== classLevel);

    if (mismatched.length > 0) {
      const names = mismatched.map((s) => `${s.displayName} (currently ${s.currentLevel})`).join(", ");
      if (
        !(await confirm(
          `These students are recorded at a different track level than "${classLevel}": ${names}.\n\nEnroll them anyway?`
        ))
      ) {
        return;
      }
    }

    try {
      setUploading(true);
      let fileUrl = "";
      if (selectedFile) {
        fileUrl = await uploadFileToCloudinary(selectedFile);
      }
      await createClass({
        className,
        instructorId: assignedInstructor,
        schedule: `${classDay} @ ${startTime} - ${endTime}`,
        classDay,
        classStartDate,
        startTime,
        endTime,
        classLevel,
        studentIds: enrolledStudents,
        enrollments: enrolledStudents.map((studentId) => {
          const student = users.find((u) => u.id === studentId);
          return {
            studentId,
            dateJoined: student?.joinedDate || classStartDate || new Date().toISOString().slice(0, 10),
            level: classLevel,
          };
        }),
        worksheetUrl: fileUrl,
        classRoom: classRoom || "N/A",
      });

      await syncStudentsCurrentLevel(enrolledStudents, classLevel);

      toast("Class cohort scheduled successfully!", "success");
      setClassName("");
      setAssignedInstructor("");
      setClassDay("Mon/Wed");
      setClassStartDate(new Date().toISOString().slice(0, 10));
      setStartTime("");
      setEndTime("");
      setClassLevel("warrior");
      setEnrolledStudents([]);
      setSelectedFile(null);
      setClassRoom("");
      setClassSubTab("list");
    } catch (err) {
      toast("Error: " + err.message, "error");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteClass = async (classId) => {
    if (await confirm("Are you sure you want to delete this scheduled class batch? This action cannot be undone.")) {
      try {
        await deleteClass(classId);
        toast("Class batch deleted.", "info");
      } catch (err) {
        toast(err.message, "error");
      }
    }
  };

  const handleAddStudentToClass = async (classId, e) => {
    e.preventDefault();
    if (!addStudentId) return;

    const cls = classes.find((c) => c.id === classId);
    const targetLevel = cls?.classLevel || "warrior";
    const student = users.find((u) => u.id === addStudentId);

    if (student?.currentLevel && student.currentLevel !== targetLevel) {
      if (
        !(await confirm(
          `${student.displayName} is recorded at level "${student.currentLevel}", but this class is "${targetLevel}".\n\nEnroll anyway?`
        ))
      ) {
        return;
      }
    }

    try {
      await addStudentToClass(classId, {
        studentId: addStudentId,
        dateJoined: addDateJoined || new Date().toISOString().slice(0, 10),
        level: targetLevel,
      });
      await syncStudentsCurrentLevel([addStudentId], targetLevel);
      setEnrollingIntoClassId(null);
      setAddStudentId("");
      setAddDateJoined(new Date().toISOString().slice(0, 10));
      toast("Student enrolled successfully!", "success");
    } catch (err) {
      toast("Error enrolling student: " + err.message, "error");
    }
  };

  const handleRemoveStudentFromClass = async (cls, studentId) => {
    const student = users.find((u) => u.id === studentId);
    if (!(await confirm(`Remove ${student?.displayName || "this student"} from ${cls.className}?`))) return;
    try {
      await removeStudentFromClass(cls, studentId);
      toast("Student removed from class.", "info");
    } catch (err) {
      toast("Error removing student: " + err.message, "error");
    }
  };

  const handleClassSort = (field) => {
    if (classSortField === field) {
      setClassSortAsc(!classSortAsc);
    } else {
      setClassSortField(field);
      setClassSortAsc(true);
    }
  };

  const sortedClasses = [...classes].sort((a, b) => {
    let valA = a[classSortField] || "";
    let valB = b[classSortField] || "";

    if (classSortField === "instructorId") {
      valA = users.find((u) => u.id === a.instructorId)?.displayName || "";
      valB = users.find((u) => u.id === b.instructorId)?.displayName || "";
    }

    if (valA < valB) return classSortAsc ? -1 : 1;
    if (valA > valB) return classSortAsc ? 1 : -1;
    return 0;
  });

  const getGroupKey = (cls) =>
    [cls.className, cls.schedule, cls.instructorId, cls.classLevel || "unset"].join("::");

  const classGroups = [];
  const groupIndex = {};
  sortedClasses.forEach((cls) => {
    const key = getGroupKey(cls);
    if (!groupIndex[key]) {
      groupIndex[key] = {
        key,
        className: cls.className,
        schedule: cls.schedule,
        instructorId: cls.instructorId,
        classLevel: cls.classLevel,
        items: [],
      };
      classGroups.push(groupIndex[key]);
    }
    groupIndex[key].items.push(cls);
  });

  const filteredGroups = classGroups.filter((group) => {
    const matchesSearch =
      !searchQuery ||
      group.className.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (group.schedule || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLevel = filterLevel === "all" || group.classLevel === filterLevel;
    return matchesSearch && matchesLevel;
  });

  const handleSetGroupLevel = async (group, level) => {
    try {
      await setClassGroupLevel(group.items, level);
      const studentIds = [...new Set(group.items.flatMap((cls) => cls.studentIds || []))];
      await syncStudentsCurrentLevel(studentIds, level);
      setEditingLevelKey(null);
      toast("Cohort level updated!", "success");
    } catch (err) {
      toast("Error setting level: " + err.message, "error");
    }
  };

  const toggleGroup = (key) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleStudentEnrollment = (uid) => {
    setEnrolledStudents((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const getEnrollment = (cls, studentId) =>
    (cls.enrollments || []).find((enrollment) => enrollment.studentId === studentId) || {};

  const getDuration = (dateJoined) => {
    if (!dateJoined) return "Not recorded";
    const joined = new Date(`${dateJoined}T00:00:00`);
    if (Number.isNaN(joined.getTime())) return "Not recorded";
    const now = new Date();
    let months = (now.getFullYear() - joined.getFullYear()) * 12 + now.getMonth() - joined.getMonth();
    if (now.getDate() < joined.getDate()) months -= 1;
    if (months < 1) return "Joined this month";
    const years = Math.floor(months / 12);
    months %= 12;
    return [
      years ? `${years} yr${years === 1 ? "" : "s"}` : "",
      months ? `${months} mo${months === 1 ? "" : "s"}` : "",
    ]
      .filter(Boolean)
      .join(" ");
  };

  const renderBatchCard = (cls) => (
    <div key={cls.id} className="border border-slate-200 bg-white rounded-2xl p-4 space-y-3 shadow-2xs">
      <div className="flex justify-between items-start gap-2 flex-wrap pb-2 border-b border-slate-100">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-indigo-600" />
              <span>Room: {cls.classRoom || "Standard Classroom"}</span>
            </span>
            {cls.worksheetUrl && (
              <a
                href={cls.worksheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md hover:bg-emerald-100 transition"
              >
                <FileText className="w-3 h-3" />
                <span>Worksheet</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            )}
          </div>
          <p className="text-[11px] text-slate-400 font-medium">
            Start Date: {cls.classStartDate || "Recorded"} · {(cls.studentIds || []).length} Students Enrolled
          </p>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setEditingBatchFromCard(cls)}
              className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 border border-indigo-100"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Edit Batch</span>
            </button>
            <button
              onClick={() => handleDeleteClass(cls.id)}
              className="text-rose-600 hover:text-rose-800 hover:bg-rose-50 px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Batch</span>
            </button>
          </div>
        )}
      </div>

      {/* Roster of Students in this Batch */}
      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
        {(cls.studentIds || []).length === 0 ? (
          <p className="text-[11px] text-slate-400 italic py-1">No students enrolled in this batch yet.</p>
        ) : (
          (cls.studentIds || []).map((studentId) => {
            const student = users.find((user) => user.id === studentId);
            const enrollment = getEnrollment(cls, studentId);
            return (
              <div
                key={studentId}
                className="text-xs p-2 rounded-xl bg-slate-50 border border-slate-200/70 flex justify-between items-center gap-2 hover:bg-indigo-50/30 transition"
              >
                <div className="min-w-0">
                  <p className="font-extrabold text-slate-800 truncate">
                    {student?.displayName || "Enrolled Student"}
                  </p>
                  <p className="text-[10px] text-slate-400 font-medium">
                    Joined: {enrollment.dateJoined || "N/A"} · {getDuration(enrollment.dateJoined)}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {canEnroll && (
                    <button
                      onClick={() =>
                        setTransferringStudent({
                          student: student || { id: studentId, displayName: "Enrolled Student" },
                          sourceClass: cls,
                        })
                      }
                      title="Transfer to another batch"
                      className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer"
                    >
                      <ArrowRightLeft className="w-3 h-3" />
                      <span>Transfer</span>
                    </button>
                  )}
                  <button
                    onClick={() => handleRemoveStudentFromClass(cls, studentId)}
                    className="text-[10px] font-bold text-rose-500 hover:text-rose-700 hover:bg-rose-50 px-2 py-1 rounded-lg transition cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Student to Existing Batch */}
      {enrollingIntoClassId === cls.id ? (
        <form
          onSubmit={(e) => handleAddStudentToClass(cls.id, e)}
          className="mt-2 space-y-2.5 border border-indigo-200 rounded-2xl p-3 bg-indigo-50/30"
        >
          <p className="text-[11px] font-bold text-indigo-900 flex items-center gap-1">
            <Plus className="w-3.5 h-3.5 text-indigo-600" />
            <span>Enroll Unassigned Student</span>
          </p>

          <select
            value={addStudentId}
            onChange={(e) => {
              const sid = e.target.value;
              setAddStudentId(sid);
              const st = users.find((u) => u.id === sid);
              if (st?.joinedDate) setAddDateJoined(st.joinedDate);
            }}
            className="w-full p-2.5 border border-slate-200 rounded-xl bg-white text-xs font-semibold"
            required
          >
            <option value="">Select unassigned student...</option>
            {unenrolledStudents.map((stud) => (
              <option key={stud.id} value={stud.id}>
                {stud.displayName}
                {stud.currentLevel && stud.currentLevel !== (cls.classLevel || "warrior")
                  ? ` (currently ${stud.currentLevel})`
                  : ""}
              </option>
            ))}
          </select>

          <div className="grid grid-cols-2 gap-2 items-center">
            <input
              type="date"
              value={addDateJoined}
              onChange={(e) => setAddDateJoined(e.target.value)}
              className="w-full p-2 border border-slate-200 rounded-xl bg-white text-xs font-medium"
              required
            />
            <div className="text-[10px] text-slate-600">
              <span className="font-bold">Track:</span> {cls.classLevel || "Warrior"}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              className="flex-1 bg-[#1a3a8f] text-white py-2 px-3 rounded-xl font-bold text-xs hover:bg-[#122b6e] transition shadow-xs"
            >
              Confirm Enrollment
            </button>
            <button
              type="button"
              onClick={() => setEnrollingIntoClassId(null)}
              className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-xs transition"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => {
            setEnrollingIntoClassId(cls.id);
            setAddStudentId("");
          }}
          disabled={unenrolledStudents.length === 0}
          className="w-full py-2 px-3 rounded-xl border border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/20 text-indigo-900 font-bold text-xs transition flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{unenrolledStudents.length === 0 ? "All Students Enrolled" : "Enroll Student to this Batch"}</span>
        </button>
      )}
    </div>
  );

  return (
    <div className="bg-white p-5 sm:p-7 rounded-3xl border border-slate-200/90 max-w-5xl mx-auto space-y-6 shadow-sm">
      {/* ── Sub-Tab Navigation Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <h3 className="font-extrabold text-slate-900 text-xl tracking-tight">Class Cohort Management</h3>
          <p className="text-xs text-slate-500 font-medium">Timetable schedules, classroom allocations & student rosters</p>
        </div>

        <div className="flex p-1 bg-slate-100 rounded-2xl border border-slate-200/80 flex-wrap gap-1">
          <button
            onClick={() => setClassSubTab("batches")}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 ${
              classSubTab === "batches"
                ? "bg-white text-[#1a3a8f] shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Available Batches ({classes.length})</span>
          </button>
          <button
            onClick={() => setClassSubTab("list")}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 ${
              classSubTab === "list"
                ? "bg-white text-[#1a3a8f] shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Class Rosters ({classGroups.length})</span>
          </button>
          {isAdmin && (
            <button
              onClick={() => setClassSubTab("schedule")}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 ${
                classSubTab === "schedule"
                  ? "bg-[#1a3a8f] text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Schedule New Class</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Tab: Available Batches ── */}
      {classSubTab === "batches" && (
        <AvailableBatches
          classes={classes}
          instructors={instructors}
          users={users}
          canEdit={isAdmin}
          role={role}
        />
      )}

      {/* ── Tab: Schedule Class ── */}
      {isAdmin && classSubTab === "schedule" && (
        <form onSubmit={handleCreateClass} className="space-y-5 max-w-2xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                Cohort Title
              </label>
              <input
                type="text"
                placeholder="e.g. Cambridge B1 - Evening Cohort"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                className="w-full p-3 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold bg-slate-50 focus:bg-white focus:border-[#1a3a8f] outline-none transition"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                Room / Facility
              </label>
              <input
                type="text"
                placeholder="e.g. Studio Lab 2 / Oxford Hall"
                value={classRoom}
                onChange={(e) => setClassRoom(e.target.value)}
                className="w-full p-3 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold bg-slate-50 focus:bg-white focus:border-[#1a3a8f] outline-none transition"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                Assigned Instructor
              </label>
              <select
                value={assignedInstructor}
                onChange={(e) => setAssignedInstructor(e.target.value)}
                className="w-full p-3 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold bg-slate-50 focus:bg-white focus:border-[#1a3a8f] outline-none transition"
                required
              >
                <option value="">Select Instructor...</option>
                {instructors.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.displayName}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                Academic Level Track
              </label>
              <div className="flex gap-2 items-center">
                <select
                  value={classLevel}
                  onChange={(e) => setClassLevel(e.target.value)}
                  className="flex-1 p-3 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold bg-slate-50 focus:bg-white focus:border-[#1a3a8f] outline-none transition capitalize"
                  required
                >
                  {LEVEL_KEYS.map((lvl) => (
                    <option key={lvl} value={lvl}>
                      {LEVELS[lvl]?.label || (lvl.charAt(0).toUpperCase() + lvl.slice(1))}
                    </option>
                  ))}
                </select>
                <LevelBadge level={classLevel} size="md" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                Timetable Frequency
              </label>
              <select
                value={classDay}
                onChange={(e) => setClassDay(e.target.value)}
                className="w-full p-3 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold bg-slate-50 focus:bg-white focus:border-[#1a3a8f] outline-none transition"
              >
                <option value="Mon/Wed">Mon / Wed</option>
                <option value="Tue/Thu">Tue / Thu</option>
                <option value="Sat/Sun">Sat / Sun</option>
                <option value="Private">Private / 1-on-1</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                Cohort Start Date
              </label>
              <input
                type="date"
                value={classStartDate}
                onChange={(e) => setClassStartDate(e.target.value)}
                className="w-full p-3 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold bg-slate-50 focus:bg-white focus:border-[#1a3a8f] outline-none transition"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                Session Start Time
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full p-3 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold bg-slate-50 focus:bg-white focus:border-[#1a3a8f] outline-none transition"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                Session End Time
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full p-3 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold bg-slate-50 focus:bg-white focus:border-[#1a3a8f] outline-none transition"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              Upload Class Syllabus / Worksheet
            </label>
            <input
              type="file"
              onChange={(e) => setSelectedFile(e.target.files[0])}
              className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 text-xs font-semibold"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                Initial Student Enrollments ({enrolledStudents.length} Selected)
              </label>
              <span className="text-[10px] text-slate-400 font-medium">Unenrolled students only</span>
            </div>

            <div className="border border-slate-200 rounded-2xl p-3 max-h-44 overflow-y-auto space-y-1 bg-slate-50/70">
              {unenrolledStudents.length === 0 ? (
                <div className="p-4 text-center text-slate-400 italic text-xs">
                  All active students currently hold class placements.
                </div>
              ) : (
                unenrolledStudents.map((stud) => {
                  const isChecked = enrolledStudents.includes(stud.id);
                  const isMismatched = stud.currentLevel && stud.currentLevel !== classLevel;
                  return (
                    <label
                      key={stud.id}
                      className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition ${
                        isChecked
                          ? "bg-indigo-50 border-indigo-200 text-indigo-950"
                          : "bg-white border-slate-200/80 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-4 h-4 rounded-md border flex items-center justify-center ${
                            isChecked ? "bg-[#1a3a8f] border-[#1a3a8f] text-white" : "border-slate-300 bg-white"
                          }`}
                        >
                          {isChecked && <Check className="w-3 h-3" />}
                        </div>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleStudentEnrollment(stud.id)}
                          className="hidden"
                        />
                        <span>{stud.displayName}</span>
                      </div>
                      {isMismatched && (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/60">
                          {stud.currentLevel}
                        </span>
                      )}
                    </label>
                  );
                })
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={uploading}
            className="w-full min-h-[52px] bg-[#1a3a8f] hover:bg-[#122b6e] text-white py-3.5 px-6 rounded-2xl font-bold text-sm transition duration-150 shadow-md shadow-indigo-950/15 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {uploading ? (
              <span>Uploading Syllabus & Saving...</span>
            ) : (
              <>
                <Calendar className="w-4 h-4" />
                <span>Publish & Schedule Cohort</span>
              </>
            )}
          </button>
        </form>
      )}

      {/* ── Tab: Active Classes List ── */}
      {classSubTab === "list" && (
        <div className="space-y-4">
          {/* Action & Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-1 items-center gap-2 max-w-md">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by class name or schedule..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold bg-slate-50 focus:bg-white focus:border-[#1a3a8f] outline-none transition"
                />
              </div>

              <select
                value={filterLevel}
                onChange={(e) => setFilterLevel(e.target.value)}
                className="p-2 border border-slate-200 rounded-xl text-xs font-semibold bg-white text-slate-700 outline-none"
              >
                <option value="all">All Levels</option>
                {LEVEL_KEYS.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {LEVELS[lvl]?.label?.toUpperCase() || lvl.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => {
                const headers = ["Class Name", "Level", "Instructor", "Schedule", "Students"];
                const rows = classGroups.map((group) => {
                  const teacher = users.find((u) => u.id === group.instructorId);
                  const totalStudents = group.items.reduce((sum, cls) => sum + (cls.studentIds || []).length, 0);
                  return [
                    group.className + (group.items.length > 1 ? ` (${group.items.length} batches)` : ""),
                    group.classLevel || "Unset",
                    teacher ? teacher.displayName : "Unassigned",
                    group.schedule,
                    `${totalStudents} enrolled`,
                  ];
                });
                exportTableCSV(`active-classes-${new Date().toISOString().slice(0, 10)}`, headers, rows);
              }}
              className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2 rounded-xl font-bold text-xs border border-slate-200 transition shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-hidden rounded-2xl border border-slate-200">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/90 text-slate-500 font-extrabold uppercase text-[11px]">
                  <th
                    className="p-3.5 cursor-pointer hover:bg-slate-100 transition"
                    onClick={() => handleClassSort("className")}
                  >
                    Class Cohort {classSortField === "className" && (classSortAsc ? "▲" : "▼")}
                  </th>
                  <th
                    className="p-3.5 cursor-pointer hover:bg-slate-100 transition"
                    onClick={() => handleClassSort("classLevel")}
                  >
                    Level {classSortField === "classLevel" && (classSortAsc ? "▲" : "▼")}
                  </th>
                  <th
                    className="p-3.5 cursor-pointer hover:bg-slate-100 transition"
                    onClick={() => handleClassSort("instructorId")}
                  >
                    Instructor {classSortField === "instructorId" && (classSortAsc ? "▲" : "▼")}
                  </th>
                  <th className="p-3.5">Schedule</th>
                  <th className="p-3.5">Enrollment</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredGroups.map((group) => {
                  const teacher = users.find((u) => u.id === group.instructorId);
                  const totalStudents = group.items.reduce(
                    (sum, cls) => sum + (cls.studentIds || []).length,
                    0
                  );
                  const isExpanded = expandedGroups.has(group.key);

                  return (
                    <Fragment key={group.key}>
                      <tr
                        className={`hover:bg-indigo-50/30 transition cursor-pointer ${
                          isExpanded ? "bg-indigo-50/20" : ""
                        }`}
                        onClick={() => toggleGroup(group.key)}
                      >
                        <td className="p-3.5 font-extrabold text-slate-900">
                          <div>{group.className}</div>
                          {group.items.length > 1 && (
                            <span className="text-[10px] text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full font-bold">
                              {group.items.length} batches
                            </span>
                          )}
                        </td>

                        <td className="p-3.5" onClick={(e) => e.stopPropagation()}>
                          {group.classLevel ? (
                            <LevelBadge level={group.classLevel} />
                          ) : editingLevelKey === group.key ? (
                            <div className="flex items-center gap-1">
                              <select
                                value={pendingLevel}
                                onChange={(e) => setPendingLevel(e.target.value)}
                                className="text-[11px] border rounded p-1 bg-white font-bold"
                              >
                                {LEVEL_KEYS.map((lvl) => (
                                  <option key={lvl} value={lvl}>
                                    {LEVELS[lvl]?.label?.toUpperCase() || lvl.toUpperCase()}
                                  </option>
                                ))}
                              </select>
                              <button
                                onClick={() => handleSetGroupLevel(group, pendingLevel)}
                                className="text-[10px] font-bold text-emerald-600 hover:underline"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingLevelKey(null)}
                                className="text-[10px] font-bold text-slate-400 hover:underline"
                              >
                                ✕
                              </button>
                            </div>
                          ) : isAdmin ? (
                            <button
                              onClick={() => {
                                setEditingLevelKey(group.key);
                                setPendingLevel("warrior");
                              }}
                              className="text-[11px] font-bold text-amber-600 hover:underline"
                            >
                              Set Level
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400 font-medium">Unset</span>
                          )}
                        </td>

                        <td className="p-3.5 font-bold text-slate-700">
                          {teacher ? teacher.displayName : "Unassigned"}
                        </td>
                        <td className="p-3.5 font-semibold text-slate-600">{group.schedule}</td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 font-extrabold text-slate-800 text-[11px]">
                            {totalStudents} Enrolled
                          </span>
                        </td>
                        <td className="p-3.5 text-right font-bold text-xs text-indigo-700">
                          <span className="inline-flex items-center gap-1">
                            {isExpanded ? (
                              <>
                                <span>Collapse</span>
                                <ChevronDown className="w-3.5 h-3.5" />
                              </>
                            ) : (
                              <>
                                <span>Manage</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </>
                            )}
                          </span>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr>
                          <td colSpan={6} className="p-4 bg-slate-50/70 border-b border-slate-200">
                            <div className="space-y-3">
                              {group.items.map((cls) => renderBatchCard(cls))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}

                {filteredGroups.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400 text-xs font-medium">
                      No matching class cohorts found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List */}
          <div className="space-y-3 md:hidden">
            {filteredGroups.map((group) => {
              const teacher = users.find((u) => u.id === group.instructorId);
              const totalStudents = group.items.reduce(
                (sum, cls) => sum + (cls.studentIds || []).length,
                0
              );
              const isExpanded = expandedGroups.has(group.key);

              return (
                <div
                  key={group.key}
                  className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3 shadow-2xs"
                >
                  <div
                    onClick={() => toggleGroup(group.key)}
                    className="cursor-pointer space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-extrabold text-slate-900 text-sm">{group.className}</h4>
                      <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-[#1a3a8f] font-extrabold text-[10px]">
                        {totalStudents} students
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                      <span>{teacher?.displayName || "Unassigned"}</span>
                      <span>{group.schedule}</span>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      {group.classLevel ? (
                        <LevelBadge level={group.classLevel} />
                      ) : (
                        <span className="text-xs font-bold text-amber-700">Level Unset</span>
                      )}
                      <span className="text-xs font-bold text-indigo-700 flex items-center gap-1">
                        {isExpanded ? "Hide Details" : "Manage Batches"}
                        <ChevronRight
                          className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                        />
                      </span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="pt-3 border-t border-slate-100 space-y-3">
                      {group.items.map((cls) => renderBatchCard(cls))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Batch Edit Modal (Admin only) */}
      {isAdmin && (
        <BatchModal
          isOpen={Boolean(editingBatchFromCard)}
          onClose={() => setEditingBatchFromCard(null)}
          batch={editingBatchFromCard}
          instructors={instructors}
        />
      )}

      {/* Dedicated One-Click Batch Transfer Modal */}
      {transferringStudent && (
        <TransferModal
          isOpen={Boolean(transferringStudent)}
          onClose={() => setTransferringStudent(null)}
          student={transferringStudent.student}
          sourceClass={transferringStudent.sourceClass}
          classes={classes}
          users={users}
        />
      )}
    </div>
  );
}
