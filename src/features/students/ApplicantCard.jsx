import {
  Check,
  X,
  Loader2,
  Calendar,
  Phone,
  MessageCircle,
  RotateCcw,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { getProgram, getStudentProgram } from "../../constants/programs";
import { getBatchType } from "../../constants/batchTypes";
import {
  findDuplicates,
  buildApplicantWhatsAppUrl,
} from "./admissionsUtils";

export function ApplicantCard({
  app,
  activeView,
  users,
  classes,
  applications,
  isProcessing,
  onApprove,
  onReject,
  onRestore,
  onDelete,
  onViewStudent,
  onApproveAndEdit,
}) {
  const duplicates = findDuplicates(app, users, applications);
  const applicantWa = buildApplicantWhatsAppUrl({ target: "applicant", app });
  const parentWa = buildApplicantWhatsAppUrl({ target: "parent", app });

  const matchingStudent = app.studentId
    ? users.find((u) => u.id === app.studentId)
    : null;

  return (
    <div className="p-4 sm:p-5 bg-white border border-slate-200/90 rounded-2xl shadow-2xs hover:border-indigo-200 transition space-y-3">
      {/* Header row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start">
        <div className="flex items-start gap-3.5 min-w-0">
          {app.photoURL ? (
            <img
              src={app.photoURL}
              alt={app.displayName}
              className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0 shadow-2xs"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#1a3a8f] to-indigo-700 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-2xs uppercase">
              {app.displayName ? app.displayName.slice(0, 2) : "??"}
            </div>
          )}

          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-extrabold text-slate-900 text-base">
                {app.displayName || "Unnamed applicant"}
              </p>
              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                {app.branch || "General Branch"}
              </span>
              {app.program && (
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                    getProgram(getStudentProgram(app)).badgeBg
                  }`}
                >
                  {app.program}
                </span>
              )}
              {(app.batchType || app.classType) && (
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                    getBatchType(app.batchType || app.classType).badgeBg
                  }`}
                >
                  {getBatchType(app.batchType || app.classType).label}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-500 text-[11px] font-medium">
              <span className="flex items-center gap-1">
                <Phone className="w-3 h-3 text-slate-400" />
                {app.phone || "No phone"}
              </span>
              <span>·</span>
              <span className="flex items-center gap-1 text-slate-400">
                <Calendar className="w-3 h-3 text-slate-400" />
                {app.submittedAt
                  ? new Date(app.submittedAt).toLocaleDateString()
                  : "Just now"}
              </span>
            </div>

            {/* Duplicate Alert Badges (Pending View) */}
            {activeView === "pending" && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {duplicates.students.map((match, idx) => {
                  const studentBatches = classes.filter((c) =>
                    (c.studentIds || []).includes(match.student.id)
                  );
                  const batchName =
                    studentBatches.length > 0
                      ? studentBatches.map((b) => b.className).join(", ")
                      : "no batch";
                  const isStrong = match.strength === "strong";

                  return (
                    <button
                      key={`dup-s-${idx}`}
                      type="button"
                      onClick={() => (onViewStudent || onApproveAndEdit)?.(match.student)}
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md transition flex items-center gap-1 cursor-pointer ${
                        isStrong
                          ? "bg-amber-100 text-amber-900 hover:bg-amber-200 border border-amber-200"
                          : "bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200"
                      }`}
                      title="Click to view existing student profile in Roster"
                    >
                      <AlertTriangle className="w-3 h-3 shrink-0" />
                      <span>
                        {isStrong
                          ? `⚠️ Existing student: ${match.student.displayName} (${batchName})`
                          : `Possible match: ${match.student.displayName}`}
                      </span>
                    </button>
                  );
                })}

                {duplicates.pendingTwins.map((twin, idx) => (
                  <span
                    key={`dup-t-${idx}`}
                    className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-800 border border-purple-200 flex items-center gap-1"
                  >
                    <span>
                      Duplicate submission: also applied on{" "}
                      {twin.app.submittedAt
                        ? new Date(twin.app.submittedAt).toLocaleDateString()
                        : "earlier"}
                    </span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Actions Column */}
        <div className="flex gap-2 shrink-0 sm:flex-col sm:w-32">
          {activeView === "pending" && (
            <>
              <button
                type="button"
                onClick={() => onApprove(app)}
                disabled={isProcessing}
                className="flex-1 py-2 px-3 rounded-xl font-extrabold text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Approve</span>
              </button>
              <button
                type="button"
                onClick={() => onReject(app)}
                disabled={isProcessing}
                className="flex-1 py-2 px-3 rounded-xl font-bold text-xs bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-600 border border-slate-200 hover:border-rose-200 transition flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reject</span>
              </button>
            </>
          )}

          {activeView === "rejected" && (
            <>
              <button
                type="button"
                onClick={() => onRestore(app)}
                disabled={isProcessing}
                className="flex-1 py-1.5 px-3 rounded-xl font-bold text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isProcessing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="w-3.5 h-3.5" />
                )}
                <span>Restore</span>
              </button>
              <button
                type="button"
                onClick={() => onDelete(app)}
                disabled={isProcessing}
                className="flex-1 py-1.5 px-3 rounded-xl font-bold text-xs bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            </>
          )}

          {/* WhatsApp Outreach */}
          {applicantWa && (
            <a
              href={applicantWa}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-1.5 px-2 rounded-xl font-bold text-[11px] bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition flex items-center justify-center gap-1 shadow-2xs text-center"
              title="Follow up with applicant on WhatsApp"
            >
              <MessageCircle className="w-3 h-3 text-emerald-600 shrink-0" />
              <span>WA Chat</span>
            </a>
          )}

          {parentWa && (
            <a
              href={parentWa}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-1.5 px-2 rounded-xl font-bold text-[11px] bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition flex items-center justify-center gap-1 shadow-2xs text-center"
              title="Follow up with parent on WhatsApp"
            >
              <MessageCircle className="w-3 h-3 text-emerald-600 shrink-0" />
              <span>WA Parent</span>
            </a>
          )}
        </div>
      </div>

      {/* Audit metadata for Approved & Rejected views */}
      {activeView === "approved" && (
        <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-xl text-[11px] text-emerald-950 flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="font-bold">Approved: </span>
            <span>
              {app.approvedAt ? new Date(app.approvedAt).toLocaleString() : "—"}
            </span>
            <span className="mx-1.5">·</span>
            <span>
              By: <strong>{app.approvedBy || "system"}</strong>
            </span>
            {app.studentId && (
              <span className="ml-2 font-mono text-[10px] text-emerald-700">
                (Student ID: {app.studentId.slice(0, 8)}...)
              </span>
            )}
          </div>

          {matchingStudent && (
            <button
              type="button"
              onClick={() => (onViewStudent || onApproveAndEdit)?.(matchingStudent)}
              className="font-extrabold text-emerald-800 hover:text-emerald-900 underline cursor-pointer"
            >
              Open Student Profile →
            </button>
          )}
        </div>
      )}

      {activeView === "rejected" && (
        <div className="p-3 bg-rose-50/70 border border-rose-100 rounded-xl text-[11px] text-rose-950 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold">Rejected: </span>
            <span>
              {app.rejectedAt ? new Date(app.rejectedAt).toLocaleString() : "—"}
            </span>
            <span>·</span>
            <span>
              By: <strong>{app.rejectedBy || "staff"}</strong>
            </span>
            {app.rejectedReason && (
              <>
                <span>·</span>
                <span className="px-2 py-0.5 rounded bg-rose-100 font-bold text-rose-800">
                  Reason: {app.rejectedReason}
                </span>
              </>
            )}
          </div>
          {app.rejectedNote && (
            <p className="text-slate-600 italic pt-0.5">
              &ldquo;{app.rejectedNote}&rdquo;
            </p>
          )}
        </div>
      )}

      {/* Extended Dossier Details */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-3 border-t border-slate-100 text-[11px] text-slate-600 bg-slate-50/50 -mx-4 -mb-4 p-3 rounded-b-2xl">
        <div>
          <span className="font-bold text-slate-400 uppercase text-[9px] block">
            Personal
          </span>
          <p>
            DOB: <span className="font-semibold text-slate-800">{app.dob || "—"}</span> (
            {app.gender || "—"})
          </p>
          <p>
            Birthplace:{" "}
            <span className="font-semibold text-slate-800">
              {app.placeOfBirth || "—"}
            </span>
          </p>
        </div>
        <div>
          <span className="font-bold text-slate-400 uppercase text-[9px] block">
            Parents
          </span>
          <p>
            Father:{" "}
            <span className="font-semibold text-slate-800">{app.fatherName || "—"}</span>{" "}
            ({app.fatherPhone || "—"})
          </p>
          <p>
            Mother:{" "}
            <span className="font-semibold text-slate-800">{app.motherName || "—"}</span>{" "}
            ({app.motherPhone || "—"})
          </p>
        </div>
        <div className="sm:col-span-2 md:col-span-1">
          <span className="font-bold text-slate-400 uppercase text-[9px] block">
            Academic &amp; Address
          </span>
          <p>
            School/Job:{" "}
            <span className="font-semibold text-slate-800">{app.schoolOrJob || "—"}</span>
          </p>
          <p className="truncate" title={app.address}>
            Address:{" "}
            <span className="font-semibold text-slate-800">{app.address || "—"}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
