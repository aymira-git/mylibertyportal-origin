import { useState } from "react";
import { normalizeWhatsAppNumber } from "../finance/receiptMessages";
import {
  MapPin,
  AlertTriangle,
  FileText,
  ExternalLink,
  Radio,
  Edit2,
  Trash2,
  MessageCircle,
  ArrowRightLeft,
  Plus,
} from "lucide-react";
import {
  getEnrollment,
  getDuration,
  openWhatsAppParentChat,
} from "./classesUtils";
import StudentPaymentBadge from "./StudentPaymentBadge";

export default function BatchCard({
  cls,
  users = [],
  unenrolledStudents = [],
  isAdmin = false,
  canEnroll = false,
  onOutreach,
  onEditBatch,
  onDeleteClass,
  onTransferStudent,
  onRemoveStudent,
  onAddStudent,
  toast,
}) {
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [addStudentId, setAddStudentId] = useState("");
  const [addDateJoined, setAddDateJoined] = useState(
    new Date().toISOString().slice(0, 10)
  );

  const studentCount = (cls.studentIds || []).length;
  const capacity = Number(cls.maxCapacity) || 15;
  const quorum = Number(cls.minQuorum) || 4;
  const isUnderQuorum =
    studentCount < quorum &&
    (cls.status === "upcoming" || cls.status === "open" || !cls.status);

  const handleEnrollSubmit = async (e) => {
    e.preventDefault();
    if (!addStudentId) return;
    if (onAddStudent) {
      const success = await onAddStudent(cls.id, {
        studentId: addStudentId,
        dateJoined: addDateJoined || new Date().toISOString().slice(0, 10),
      });
      if (success) {
        setIsEnrolling(false);
        setAddStudentId("");
        setAddDateJoined(new Date().toISOString().slice(0, 10));
      }
    }
  };

  return (
    <div className="border border-slate-200 bg-white rounded-2xl p-4 space-y-3 shadow-2xs">
      <div className="flex justify-between items-start gap-2 flex-wrap pb-2 border-b border-slate-100">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-indigo-600" />
              <span>Room: {cls.classRoom || "Standard Classroom"}</span>
            </span>

            {/* Substitute Instructor Badge */}
            {cls.substituteInstructorId && (
              <span className="px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-900 font-extrabold text-[10px] inline-flex items-center gap-1">
                <span>🔄 Sub: {cls.substituteInstructorName || "Covering"}</span>
              </span>
            )}

            {/* Quorum Warning Badge */}
            {isUnderQuorum && (
              <span className="px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 font-extrabold text-[10px] inline-flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-amber-600" />
                <span>
                  Under Quorum ({studentCount}/{quorum})
                </span>
              </span>
            )}

            {/* Status Badge */}
            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-[10px] uppercase tracking-wide">
              {cls.status || "Open"}
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
            Start Date: {cls.classStartDate || "Recorded"} · {studentCount}/{capacity}{" "}
            Students Enrolled · Min Quorum: {quorum}
          </p>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Outreach Button */}
          {onOutreach && (
            <button
              onClick={() => onOutreach(cls)}
              className="text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 border border-emerald-200"
              title="Message Parents / Copy Phone List"
            >
              <Radio className="w-3.5 h-3.5 text-emerald-600" />
              <span>Outreach</span>
            </button>
          )}

          {isAdmin && (
            <>
              {onEditBatch && (
                <button
                  onClick={() => onEditBatch(cls)}
                  className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 border border-indigo-100"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit Batch</span>
                </button>
              )}
              {onDeleteClass && (
                <button
                  onClick={() => onDeleteClass(cls.id)}
                  className="text-rose-600 hover:text-rose-800 hover:bg-rose-50 px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Batch</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Capacity Meter */}
      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${
            studentCount >= capacity
              ? "bg-rose-500"
              : studentCount / capacity >= 0.75
              ? "bg-amber-500"
              : "bg-indigo-600"
          }`}
          style={{
            width: `${Math.min(100, Math.round((studentCount / capacity) * 100))}%`,
          }}
        />
      </div>

      {/* Roster of Students in this Batch */}
      <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
        {studentCount === 0 ? (
          <p className="text-[11px] text-slate-400 italic py-1">
            No students enrolled in this batch yet.
          </p>
        ) : (
          (cls.studentIds || []).map((studentId) => {
            const student = users.find((user) => user.id === studentId);
            const enrollment = getEnrollment(cls, studentId);
            const parentPhone = student?.parentPhone || student?.phone;

            return (
              <div
                key={studentId}
                className="text-xs p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 flex justify-between items-center gap-2 hover:bg-indigo-50/30 transition"
              >
                <div className="min-w-0 flex items-center gap-2.5 flex-1">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-extrabold text-slate-800 truncate">
                        {student?.displayName || "Enrolled Student"}
                      </p>
                      <StudentPaymentBadge student={student} />
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium">
                      Joined: {enrollment.dateJoined || "N/A"} ·{" "}
                      {getDuration(enrollment.dateJoined)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {/* WhatsApp Parent Button */}
                  {parentPhone && (
                    <button
                      onClick={() =>
                        openWhatsAppParentChat(
                          parentPhone,
                          student?.displayName,
                          cls,
                          toast
                        )
                      }
                      title={`Chat with parent (+${normalizeWhatsAppNumber(parentPhone)})`}
                      className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-lg transition flex items-center gap-1 border border-emerald-200"
                    >
                      <MessageCircle className="w-3 h-3 text-emerald-600" />
                      <span className="hidden sm:inline">Parent</span>
                    </button>
                  )}

                  {canEnroll && onTransferStudent && (
                    <button
                      onClick={() =>
                        onTransferStudent({
                          student:
                            student || {
                              id: studentId,
                              displayName: "Enrolled Student",
                            },
                          sourceClass: cls,
                        })
                      }
                      title="Transfer to another batch"
                      className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer"
                    >
                      <ArrowRightLeft className="w-3 h-3" />
                      <span className="hidden sm:inline">Transfer</span>
                    </button>
                  )}

                  {onRemoveStudent && (
                    <button
                      onClick={() => onRemoveStudent(cls, studentId)}
                      className="text-[10px] font-bold text-rose-500 hover:text-rose-700 hover:bg-rose-50 px-2 py-1 rounded-lg transition cursor-pointer"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Student to Existing Batch */}
      {isEnrolling ? (
        <form
          onSubmit={handleEnrollSubmit}
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
                {stud.currentLevel &&
                stud.currentLevel !== (cls.classLevel || "warrior")
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
              onClick={() => setIsEnrolling(false)}
              className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-xs transition"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => {
            setIsEnrolling(true);
            setAddStudentId("");
          }}
          disabled={unenrolledStudents.length === 0}
          className="w-full py-2 px-3 rounded-xl border border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/20 text-indigo-900 font-bold text-xs transition flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>
            {unenrolledStudents.length === 0
              ? "All Students Enrolled"
              : "Enroll Student to this Batch"}
          </span>
        </button>
      )}
    </div>
  );
}
