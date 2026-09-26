import { useState, useEffect, useMemo, useRef } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import {
  Calendar,
  ScanLine,
  CheckCircle2,
  XCircle,
  AlertCircle,
  HelpCircle,
  X,
  Sparkles,
  Users,
  Check,
  UserCheck,
} from "lucide-react";
import { useToast, useConfirm, LevelBadge } from "../shared";
import { todayWita } from "../../utils/dateWita.js";
import {
  subscribeClassAttendance,
  updateClassAttendanceManual,
  closeOutClassAttendance,
} from "./classAttendanceRepository";
import { handleKioskScan } from "./kioskScanProcessor";

export default function InstructorAttendanceView({
  classes = [],
  students = [],
  uid,
  instructorName = "",
  instructorBranch = "kota_gorontalo",
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const todayStr = useMemo(() => todayWita(), []);

  // Selected class
  const [selectedClassId, setSelectedClassId] = useState("");
  const activeClassId = classes.some((c) => c.id === selectedClassId)
    ? selectedClassId
    : classes[0]?.id || "";
  const selectedClass = useMemo(() => {
    return classes.find((c) => c.id === activeClassId) || null;
  }, [classes, activeClassId]);

  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [updatingStudentId, setUpdatingStudentId] = useState(null);

  // Scanner modal state
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerStatus, setScannerStatus] = useState(null);
  const [scannerLastScanned, setScannerLastScanned] = useState(null);

  // Realtime subscription scoped to selected class & today's date
  useEffect(() => {
    if (!selectedClass?.id) return;

    let isMounted = true;
    const unsubscribe = subscribeClassAttendance(
      selectedClass.id,
      todayStr,
      (records) => {
        if (!isMounted) return;
        setAttendanceRecords(records);
      },
      (err) => {
        if (!isMounted) return;
        console.error("Error subscribing to class attendance:", err);
        toast("Unable to load real-time attendance: " + err.message, "error");
      }
    );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [selectedClass?.id, todayStr, toast]);

  // Map enrolled students for selected class with legacy enrollments fallback
  const enrolledStudentIds = useMemo(() => {
    if (!selectedClass) return [];
    if (Array.isArray(selectedClass.studentIds) && selectedClass.studentIds.length > 0) {
      return selectedClass.studentIds;
    }
    if (Array.isArray(selectedClass.enrollments)) {
      return selectedClass.enrollments.map((e) => (typeof e === "string" ? e : e?.studentId)).filter(Boolean);
    }
    return [];
  }, [selectedClass]);

  const studentsMap = useMemo(() => {
    /** @type {Record<string, { displayName?: string; name?: string; id?: string }>} */
    const map = {};
    students.forEach((s) => {
      if (s?.id) map[s.id] = s;
    });
    return map;
  }, [students]);

  const enrolledStudents = useMemo(() => {
    return enrolledStudentIds.map((id) => {
      return studentsMap[id] || { id, displayName: "Student " + id.slice(0, 6), role: "student" };
    });
  }, [enrolledStudentIds, studentsMap]);

  // Attendance lookup by student ID
  const attendanceMap = useMemo(() => {
    const map = {};
    attendanceRecords.forEach((rec) => {
      if (rec?.studentId) map[rec.studentId] = rec;
    });
    return map;
  }, [attendanceRecords]);

  // Statistics counters
  const stats = useMemo(() => {
    let present = 0;
    let absent = 0;
    let late = 0;
    let excused = 0;
    let unmarked = 0;

    enrolledStudentIds.forEach((sId) => {
      const rec = attendanceMap[sId];
      if (!rec) {
        unmarked++;
      } else if (rec.status === "PRESENT") {
        present++;
      } else if (rec.status === "ABSENT") {
        absent++;
      } else if (rec.status === "LATE") {
        late++;
      } else if (rec.status === "EXCUSED") {
        excused++;
      } else {
        unmarked++;
      }
    });

    return {
      total: enrolledStudentIds.length,
      present,
      absent,
      late,
      excused,
      unmarked,
    };
  }, [enrolledStudentIds, attendanceMap]);

  // Manual status change handler
  const handleSetStatus = async (studentId, status) => {
    if (!selectedClass) return;
    setUpdatingStudentId(studentId);
    try {
      const student = studentsMap[studentId] || {};
      await updateClassAttendanceManual({
        classId: selectedClass.id,
        studentId,
        attendanceDate: todayStr,
        status,
        markedBy: uid,
        markedByName: instructorName,
        studentName: student.displayName || "",
        className: selectedClass.className || "",
        branchId: selectedClass.branchId || instructorBranch,
      });
      toast(`Marked ${status.toLowerCase()} for student.`, "success");
    } catch (err) {
      toast("Failed to update attendance: " + err.message, "error");
    } finally {
      setUpdatingStudentId(null);
    }
  };

  // Close-out handler
  const handleCloseOut = async () => {
    if (!selectedClass) return;
    if (stats.unmarked === 0) {
      toast("All enrolled students already have attendance recorded.", "info");
      return;
    }

    const message = `Close Attendance for ${selectedClass.className}?\n\n` +
      `${stats.unmarked} unmarked student(s) will be marked absent.\n` +
      `This operation cannot be undone.`;

    const confirmed = await confirm(message);
    if (!confirmed) return;

    try {
      const res = await closeOutClassAttendance({
        classId: selectedClass.id,
        attendanceDate: todayStr,
        rosterStudentIds: enrolledStudentIds,
        studentsMap,
        markedBy: uid,
        markedByName: instructorName,
        className: selectedClass.className || "",
        branchId: selectedClass.branchId || instructorBranch,
      });

      if (res.alreadyClosed || res.createdCount === 0) {
        toast("All students already have attendance records.", "info");
      } else {
        toast(`Attendance closed out: ${res.createdCount} student(s) marked absent.`, "success");
      }
    } catch (err) {
      toast("Close-out failed: " + err.message, "error");
    }
  };

  // Scanner scanner instance ref
  const scannerRef = useRef(null);

  useEffect(() => {
    if (!scannerOpen) return;

    const timer = setTimeout(() => {
      try {
        const scanner = new Html5QrcodeScanner(
          "class-attendance-reader",
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
          },
          false
        );
        scannerRef.current = scanner;

        scanner.render(
          async (scannedUid) => {
            try {
              await handleKioskScan(scannedUid, {
                attendanceMode: "CLASS",
                classId: selectedClass?.id,
                todayClasses: classes,
                markedBy: uid,
                markedByName: instructorName,
                showStatus: (title, type, message, studentName) => {
                  setScannerStatus({ title, type, message, studentName });
                },
                setLastScanned: (item) => {
                  setScannerLastScanned(item);
                },
              });
            } catch (err) {
              setScannerStatus({
                title: "Scan Error",
                type: "error",
                message: err.message,
              });
            }
          },
          (errorMessage) => {
            // Ignore frequent "not found" frames — only surface real failures
            if (
              typeof errorMessage === "string" &&
              !errorMessage.includes("No MultiFormat Readers") &&
              !errorMessage.includes("NotFoundException")
            ) {
              setScannerStatus({
                title: "Scanner Error",
                type: "error",
                message: errorMessage,
              });
            }
          });
      } catch (e) {
        console.warn("Failed to initialize camera scanner:", e);
      }
    }, 100);

    return () => {
      clearTimeout(timer);
      if (scannerRef.current) {
        try {
          scannerRef.current.clear();
        } catch {
          // unmount
        }
        scannerRef.current = null;
      }
    };
  }, [scannerOpen, selectedClass?.id, classes, uid, instructorName]);

  if (classes.length === 0) {
    return (
      <div className="bg-white p-8 rounded-3xl border border-slate-200 text-center space-y-3">
        <Users className="w-12 h-12 text-slate-400 mx-auto" />
        <h3 className="font-extrabold text-slate-800 text-base">No Teaching Cohorts Assigned</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          You currently have no classes assigned. Contact the administration or front office to have teaching cohorts assigned to your profile.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      {/* ── Cohort Switcher & Station Controls ── */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-2xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-[#1a3a8f] uppercase tracking-wider mb-1">
              <Calendar className="w-3.5 h-3.5 text-indigo-500" />
              <span>Session Attendance · {todayStr} (WITA)</span>
            </div>
            <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">
              Class Roster & Attendance Control
            </h3>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                setScannerStatus(null);
                setScannerLastScanned(null);
                setScannerOpen(true);
              }}
              disabled={!selectedClass}
              className="inline-flex items-center gap-2 bg-[#1a3a8f] hover:bg-[#122b6e] text-white px-4 py-2.5 rounded-xl font-bold text-xs transition shadow-xs cursor-pointer disabled:opacity-50"
            >
              <ScanLine className="w-4 h-4" />
              <span>Scan QR Badges</span>
            </button>

            <button
              onClick={handleCloseOut}
              disabled={!selectedClass || stats.unmarked === 0}
              className="inline-flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-3.5 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              title="Marks all remaining unmarked students as absent"
            >
              <UserCheck className="w-4 h-4 text-rose-600" />
              <span>Close-out ({stats.unmarked})</span>
            </button>
          </div>
        </div>

        {/* Cohort Selector Pills */}
        <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-100">
          {classes.map((cls) => {
            const isSelected = cls.id === activeClassId;
            const count = (cls.studentIds || cls.enrollments || []).length;
            return (
              <button
                key={cls.id}
                onClick={() => setSelectedClassId(cls.id)}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-2 cursor-pointer ${
                  isSelected
                    ? "bg-[#1a3a8f] text-white shadow-xs"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                <span>{cls.className}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    isSelected ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Selected Cohort Metadata Banner */}
        {selectedClass && (
          <div className="p-4 bg-indigo-50/60 border border-indigo-100/80 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-extrabold text-slate-900 text-sm">{selectedClass.className}</span>
              <span className="text-slate-500 font-medium">· Schedule: {selectedClass.schedule || selectedClass.classDay || "Regular"}</span>
              <span className="text-slate-500 font-medium">· Room: {selectedClass.classRoom || "Main Campus"}</span>
              {selectedClass.classLevel && <LevelBadge level={selectedClass.classLevel} />}
            </div>

            {/* Attendance Completion Progress */}
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-bold text-[11px]">
                {stats.present + stats.absent + stats.late + stats.excused} of {stats.total} recorded
              </span>
              <div className="w-24 h-2 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-300"
                  style={{
                    width: stats.total > 0
                      ? `${Math.round(((stats.present + stats.absent + stats.late + stats.excused) / stats.total) * 100)}%`
                      : "0%",
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Summary Counters Grid ── */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 pt-1">
          <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-center">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Roster</p>
            <p className="text-lg font-black text-slate-800">{stats.total}</p>
          </div>
          <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-2xl text-center">
            <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Present</p>
            <p className="text-lg font-black text-emerald-800">{stats.present}</p>
          </div>
          <div className="p-3 bg-rose-50/70 border border-rose-100 rounded-2xl text-center">
            <p className="text-[10px] font-bold text-rose-700 uppercase tracking-wider">Absent</p>
            <p className="text-lg font-black text-rose-800">{stats.absent}</p>
          </div>
          <div className="p-3 bg-amber-50/70 border border-amber-100 rounded-2xl text-center">
            <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Late</p>
            <p className="text-lg font-black text-amber-800">{stats.late}</p>
          </div>
          <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-2xl text-center">
            <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">Excused</p>
            <p className="text-lg font-black text-blue-800">{stats.excused}</p>
          </div>
          <div className="p-3 bg-slate-100 border border-slate-200 rounded-2xl text-center">
            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Unmarked</p>
            <p className="text-lg font-black text-slate-700">{stats.unmarked}</p>
          </div>
        </div>
      </div>

      {/* ── Enrolled Students Table ── */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h4 className="font-extrabold text-slate-900 text-sm">
            Cohort Student Roster ({enrolledStudents.length})
          </h4>
        </div>

        {enrolledStudents.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-xs font-medium">
            No students are currently enrolled in this cohort.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {enrolledStudents.map((student) => {
              const record = attendanceMap[student.id];
              const isUpdating = updatingStudentId === student.id;
              const status = record?.status || "UNMARKED";
              const method = record?.method || "";
              const markedTime = record?.markedAt
                ? new Date(record.markedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                : null;

              return (
                <div
                  key={student.id}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 transition"
                >
                  {/* Student Info */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-[#1a3a8f] font-black text-xs flex items-center justify-center shrink-0">
                      {student.displayName?.slice(0, 2).toUpperCase() || "ST"}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-extrabold text-slate-900 truncate">
                        {student.displayName || "Student"}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                        <span>ID: {student.id.slice(0, 8)}</span>
                        {student.level && (
                          <>
                            <span>·</span>
                            <span className="font-semibold text-slate-600 uppercase">{student.level}</span>
                          </>
                        )}
                        {markedTime && (
                          <>
                            <span>·</span>
                            <span className="text-indigo-600 font-medium">
                              Marked at {markedTime} ({method})
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Status Badge & Action Buttons */}
                  <div className="flex items-center gap-2.5 self-end sm:self-auto shrink-0">
                    {/* Current Status Pill */}
                    {status === "PRESENT" && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Present</span>
                      </span>
                    )}
                    {status === "ABSENT" && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-extrabold bg-rose-50 text-rose-700 border border-rose-200">
                        <XCircle className="w-3.5 h-3.5 text-rose-600" />
                        <span>Absent</span>
                      </span>
                    )}
                    {status === "LATE" && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-extrabold bg-amber-50 text-amber-700 border border-amber-200">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                        <span>Late</span>
                      </span>
                    )}
                    {status === "EXCUSED" && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
                        <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
                        <span>Excused</span>
                      </span>
                    )}
                    {status === "UNMARKED" && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                        <span>Unmarked</span>
                      </span>
                    )}

                    {/* Manual Status Buttons */}
                    <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80 gap-1">
                      <button
                        onClick={() => handleSetStatus(student.id, "PRESENT")}
                        disabled={isUpdating}
                        className={`px-2 py-1 rounded-lg text-[11px] font-extrabold transition cursor-pointer ${
                          status === "PRESENT"
                            ? "bg-emerald-600 text-white shadow-xs"
                            : "text-slate-600 hover:text-emerald-700"
                        }`}
                        title="Mark Present"
                      >
                        P
                      </button>
                      <button
                        onClick={() => handleSetStatus(student.id, "ABSENT")}
                        disabled={isUpdating}
                        className={`px-2 py-1 rounded-lg text-[11px] font-extrabold transition cursor-pointer ${
                          status === "ABSENT"
                            ? "bg-rose-600 text-white shadow-xs"
                            : "text-slate-600 hover:text-rose-700"
                        }`}
                        title="Mark Absent"
                      >
                        A
                      </button>
                      <button
                        onClick={() => handleSetStatus(student.id, "LATE")}
                        disabled={isUpdating}
                        className={`px-2 py-1 rounded-lg text-[11px] font-extrabold transition cursor-pointer ${
                          status === "LATE"
                            ? "bg-amber-600 text-white shadow-xs"
                            : "text-slate-600 hover:text-amber-700"
                        }`}
                        title="Mark Late"
                      >
                        L
                      </button>
                      <button
                        onClick={() => handleSetStatus(student.id, "EXCUSED")}
                        disabled={isUpdating}
                        className={`px-2 py-1 rounded-lg text-[11px] font-extrabold transition cursor-pointer ${
                          status === "EXCUSED"
                            ? "bg-blue-600 text-white shadow-xs"
                            : "text-slate-600 hover:text-blue-700"
                        }`}
                        title="Mark Excused"
                      >
                        E
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Modal: In-Session Camera Scanner ── */}
      {scannerOpen && (
        <div className="fixed inset-0 z-[1000] bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-start p-4 sm:p-6 overflow-y-auto">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto space-y-4">
            {/* Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  {selectedClass?.className || "Class Scanner"}
                </span>
              </div>
              <button
                onClick={() => setScannerOpen(false)}
                className="bg-white/10 hover:bg-white/20 text-white p-1.5 rounded-xl transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scan Feedback Banner */}
            {scannerStatus && (
              <div
                className={`mx-4 p-3.5 rounded-2xl border text-xs font-bold flex items-center gap-2.5 ${
                  scannerStatus.type === "success"
                    ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                    : scannerStatus.type === "error"
                    ? "bg-rose-50 text-rose-900 border-rose-200"
                    : "bg-indigo-50 text-indigo-900 border-indigo-200"
                }`}
              >
                {scannerStatus.type === "success" && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                {scannerStatus.type === "error" && <X className="w-4 h-4 text-rose-600 shrink-0" />}
                {scannerStatus.type === "info" && <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />}
                <div>
                  <p>{scannerStatus.title}: {scannerStatus.message}</p>
                  {scannerStatus.studentName && (
                    <p className="text-[10px] font-medium opacity-80">Student: {scannerStatus.studentName}</p>
                  )}
                </div>
              </div>
            )}

            {/* Camera Viewport */}
            <div className="px-4 pb-2">
              <div className="rounded-2xl border border-slate-200 bg-black overflow-hidden relative">
                <div id="class-attendance-reader" className="w-full" />
              </div>
            </div>

            {/* Recent Scanned Info */}
            {scannerLastScanned && (
              <div className="mx-4 p-3 bg-slate-50 border border-slate-200 rounded-xl text-left flex items-center justify-between text-xs">
                <div>
                  <p className="font-extrabold text-slate-800">{scannerLastScanned.name}</p>
                  <p className="text-[10px] text-slate-500">{scannerLastScanned.type}</p>
                </div>
                <span className="text-[10px] font-mono text-slate-400">
                  {new Date(scannerLastScanned.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            )}

            <div className="p-4 pt-0">
              <button
                onClick={() => setScannerOpen(false)}
                className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
              >
                Done Scanning
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
