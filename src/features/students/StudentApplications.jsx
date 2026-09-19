/**
 * StudentApplications.jsx
 * Admissions Cockpit for Admin and Front Office.
 * Handles incoming registrations, duplicate detection, guided placement,
 * WhatsApp outreach, and soft-rejection archiving.
 */

import { useState, useMemo } from "react";
import { auth } from "../../firebase";
import { useToast, useConfirm, Pagination, usePagination } from "../shared";
import {
  approveApplication,
  archiveApplication,
  restoreApplication,
  deleteApplicationPermanently,
} from "./applicationsRepository";
import {
  isPending,
  findDuplicates,
  buildApplicantWhatsAppUrl,
  filterApplications,
  getDistinctValues,
} from "./admissionsUtils";
import ApplicationPlacementModal from "./ApplicationPlacementModal";
import ApplicationRejectModal from "./ApplicationRejectModal";
import {
  Check,
  X,
  ExternalLink,
  Loader2,
  Calendar,
  Phone,
  MessageCircle,
  Search,
  RotateCcw,
  Trash2,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  UserPlus,
} from "lucide-react";

export default function StudentApplications({
  applications = [],
  classes = [],
  users = [],
  onApproveAndEdit = null,
  onViewStudent = null,
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const actorEmail = auth.currentUser?.email || "staff";

  // Views / Tabs
  const [activeView, setActiveView] = useState("pending"); // "pending" | "approved" | "rejected"
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState("all");
  const [programFilter, setProgramFilter] = useState("all");

  // Modals & Action processing states
  const [placementApp, setPlacementApp] = useState(null);
  const [rejectingApp, setRejectingApp] = useState(null);
  const [processingId, setProcessingId] = useState(null);

  // Derive counts
  const pendingCount = useMemo(
    () => applications.filter(isPending).length,
    [applications]
  );
  const approvedCount = useMemo(
    () => applications.filter((a) => a.status === "approved").length,
    [applications]
  );
  const rejectedCount = useMemo(
    () => applications.filter((a) => a.status === "rejected").length,
    [applications]
  );

  // Dynamic filter options
  const branchOptions = useMemo(
    () => getDistinctValues(applications, "branch"),
    [applications]
  );
  const programOptions = useMemo(
    () => getDistinctValues(applications, "program"),
    [applications]
  );

  // Filtered dataset
  const filteredApps = useMemo(() => {
    return filterApplications({
      apps: applications,
      view: activeView,
      search,
      branch: branchFilter,
      program: programFilter,
    });
  }, [applications, activeView, search, branchFilter, programFilter]);

  // Pagination (20 per page)
  const { page, setPage, totalPages, pageItems, from, to, total } = usePagination(
    filteredApps,
    20
  );

  // Handle Approve from modal
  const handleConfirmPlacement = async ({ level, paymentPlan, classId, openProfile }) => {
    if (!placementApp) return;
    setProcessingId(placementApp.id);
    try {
      const newStudent = await approveApplication({
        app: placementApp,
        level,
        paymentPlan,
        classId,
        actorEmail,
      });
      toast(`Approved ${newStudent.displayName || "student"} into active roster!`);
      setPlacementApp(null);

      if (openProfile && onApproveAndEdit) {
        onApproveAndEdit(newStudent);
      } else if (openProfile && onViewStudent) {
        onViewStudent(newStudent);
      }
    } catch (err) {
      toast(err.message || "Error approving application", "error");
    } finally {
      setProcessingId(null);
    }
  };

  // Handle Reject from modal
  const handleConfirmReject = async ({ reason, note }) => {
    if (!rejectingApp) return;
    setProcessingId(rejectingApp.id);
    try {
      await archiveApplication(rejectingApp.id, { reason, note, actorEmail });
      toast("Application rejected and moved to archive.");
      setRejectingApp(null);
    } catch (err) {
      toast(err.message || "Error rejecting application", "error");
    } finally {
      setProcessingId(null);
    }
  };

  // Handle Restore
  const handleRestore = async (app) => {
    setProcessingId(app.id);
    try {
      await restoreApplication(app.id);
      toast(`Restored "${app.displayName || "Application"}" to Pending review.`);
    } catch (err) {
      toast(err.message || "Error restoring application", "error");
    } finally {
      setProcessingId(null);
    }
  };

  // Handle Permanent Delete
  const handlePermanentDelete = async (app) => {
    if (
      !(await confirm(
        `Permanently delete ${app.displayName || "this applicant"}'s submission from the archive? This cannot be undone.`
      ))
    ) {
      return;
    }
    setProcessingId(app.id);
    try {
      await deleteApplicationPermanently(app.id);
      toast("Application permanently deleted.");
    } catch (err) {
      toast(err.message || "Error deleting application", "error");
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm max-w-5xl mx-auto text-xs space-y-5">
      {/* Header */}
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:justify-between sm:items-center pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#1a3a8f] bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100 flex items-center gap-1">
              <UserPlus className="w-3 h-3" />
              Admissions Desk
            </span>
            {pendingCount > 0 && (
              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                {pendingCount} Pending Review
              </span>
            )}
          </div>
          <h3 className="mt-1.5 font-extrabold text-slate-900 text-lg">
            Student Admissions &amp; Registrations
          </h3>
          <p className="text-xs text-slate-500 font-medium">
            Review online Google Form submissions, perform placement triage, and enroll incoming students
          </p>
        </div>

        <a
          href="https://docs.google.com/spreadsheets/d/12FfhjJ_gxXLhII8LYLhOyeIbwcxXLNIlvZ2RbtdVgqQ/edit?resourcekey=&gid=800855144#gid=800855144"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 px-3.5 py-2 rounded-xl font-bold text-xs transition shadow-2xs shrink-0"
        >
          <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
          <span>Google Sheet Backup</span>
        </a>
      </div>

      {/* View Switcher Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3">
        <button
          type="button"
          onClick={() => {
            setActiveView("pending");
            setPage(1);
          }}
          className={`py-2 px-4 rounded-xl font-bold text-xs transition flex items-center gap-2 cursor-pointer ${
            activeView === "pending"
              ? "bg-[#1a3a8f] text-white shadow-xs"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <span>Pending Review</span>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
              activeView === "pending"
                ? "bg-white/20 text-white"
                : "bg-slate-200 text-slate-700"
            }`}
          >
            {pendingCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveView("approved");
            setPage(1);
          }}
          className={`py-2 px-4 rounded-xl font-bold text-xs transition flex items-center gap-2 cursor-pointer ${
            activeView === "approved"
              ? "bg-[#1a3a8f] text-white shadow-xs"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <span>Approved Roster</span>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
              activeView === "approved"
                ? "bg-white/20 text-white"
                : "bg-slate-200 text-slate-700"
            }`}
          >
            {approvedCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveView("rejected");
            setPage(1);
          }}
          className={`py-2 px-4 rounded-xl font-bold text-xs transition flex items-center gap-2 cursor-pointer ${
            activeView === "rejected"
              ? "bg-[#1a3a8f] text-white shadow-xs"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <span>Archived / Rejected</span>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
              activeView === "rejected"
                ? "bg-white/20 text-white"
                : "bg-slate-200 text-slate-700"
            }`}
          >
            {rejectedCount}
          </span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-2.5 pt-1">
        <div className="sm:col-span-2 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search applicant name, phone, parent phone, or school..."
            className="w-full pl-9 pr-3 py-2 border rounded-xl bg-white text-xs font-medium focus:border-[#1a3a8f] outline-none"
          />
        </div>

        <div>
          <select
            value={branchFilter}
            onChange={(e) => {
              setBranchFilter(e.target.value);
              setPage(1);
            }}
            className="w-full p-2 border rounded-xl bg-white text-xs font-medium focus:border-[#1a3a8f] outline-none"
          >
            <option value="all">All Branches</option>
            {branchOptions.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={programFilter}
            onChange={(e) => {
              setProgramFilter(e.target.value);
              setPage(1);
            }}
            className="w-full p-2 border rounded-xl bg-white text-xs font-medium focus:border-[#1a3a8f] outline-none"
          >
            <option value="all">All Programs</option>
            {programOptions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Applications List */}
      {pageItems.length === 0 ? (
        <div className="p-10 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
          {activeView === "pending" ? (
            <>
              <CheckCircle2 className="w-9 h-9 text-emerald-500 mx-auto mb-1" />
              <p className="text-sm font-bold text-slate-800">No pending applications</p>
              <p className="text-xs text-slate-400">
                All incoming student registrations have been processed. Great job!
              </p>
            </>
          ) : activeView === "approved" ? (
            <>
              <UserCheck className="w-9 h-9 text-slate-300 mx-auto mb-1" />
              <p className="text-sm font-bold text-slate-700">No approved applications found</p>
              <p className="text-xs text-slate-400">
                Processed admissions will appear here once candidates are approved.
              </p>
            </>
          ) : (
            <>
              <X className="w-9 h-9 text-slate-300 mx-auto mb-1" />
              <p className="text-sm font-bold text-slate-700">No archived applications</p>
              <p className="text-xs text-slate-400">
                Rejected or declined submissions will be retained here for audit and recovery.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3.5">
          {pageItems.map((app) => {
            const isProcessing = processingId === app.id;
            const duplicates = findDuplicates(app, users, applications);
            const applicantWa = buildApplicantWhatsAppUrl({ target: "applicant", app });
            const parentWa = buildApplicantWhatsAppUrl({ target: "parent", app });

            const matchingStudent = app.studentId
              ? users.find((u) => u.id === app.studentId)
              : null;

            return (
              <div
                key={app.id}
                className="p-4 sm:p-5 bg-white border border-slate-200/90 rounded-2xl shadow-2xs hover:border-indigo-200 transition space-y-3"
              >
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
                          <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                            {app.program}
                          </span>
                        )}
                        {app.classType && (
                          <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                            {app.classType}
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
                                onClick={() =>
                                  (onViewStudent || onApproveAndEdit)?.(match.student)
                                }
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
                          onClick={() => setPlacementApp(app)}
                          disabled={isProcessing}
                          className="flex-1 py-2 px-3 rounded-xl font-extrabold text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setRejectingApp(app)}
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
                          onClick={() => handleRestore(app)}
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
                          onClick={() => handlePermanentDelete(app)}
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
                        {app.approvedAt
                          ? new Date(app.approvedAt).toLocaleString()
                          : "—"}
                      </span>
                      <span className="mx-1.5">·</span>
                      <span>By: <strong>{app.approvedBy || "system"}</strong></span>
                      {app.studentId && (
                        <span className="ml-2 font-mono text-[10px] text-emerald-700">
                          (Student ID: {app.studentId.slice(0, 8)}...)
                        </span>
                      )}
                    </div>

                    {matchingStudent && (
                      <button
                        type="button"
                        onClick={() =>
                          (onViewStudent || onApproveAndEdit)?.(matchingStudent)
                        }
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
                        {app.rejectedAt
                          ? new Date(app.rejectedAt).toLocaleString()
                          : "—"}
                      </span>
                      <span>·</span>
                      <span>By: <strong>{app.rejectedBy || "staff"}</strong></span>
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
                      DOB: <span className="font-semibold text-slate-800">{app.dob || "—"}</span> ({app.gender || "—"})
                    </p>
                    <p>
                      Birthplace: <span className="font-semibold text-slate-800">{app.placeOfBirth || "—"}</span>
                    </p>
                  </div>
                  <div>
                    <span className="font-bold text-slate-400 uppercase text-[9px] block">
                      Parents
                    </span>
                    <p>
                      Father: <span className="font-semibold text-slate-800">{app.fatherName || "—"}</span> ({app.fatherPhone || "—"})
                    </p>
                    <p>
                      Mother: <span className="font-semibold text-slate-800">{app.motherName || "—"}</span> ({app.motherPhone || "—"})
                    </p>
                  </div>
                  <div className="sm:col-span-2 md:col-span-1">
                    <span className="font-bold text-slate-400 uppercase text-[9px] block">
                      Academic &amp; Address
                    </span>
                    <p>
                      School/Job: <span className="font-semibold text-slate-800">{app.schoolOrJob || "—"}</span>
                    </p>
                    <p className="truncate" title={app.address}>
                      Address: <span className="font-semibold text-slate-800">{app.address || "—"}</span>
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      <Pagination
        page={page}
        totalPages={totalPages}
        setPage={setPage}
        from={from}
        to={to}
        total={total}
        label="applications"
      />

      {/* Placement Modal */}
      {placementApp && (
        <ApplicationPlacementModal
          app={placementApp}
          classes={classes}
          duplicates={findDuplicates(placementApp, users, applications)}
          submitting={processingId === placementApp.id}
          onClose={() => setPlacementApp(null)}
          onConfirm={handleConfirmPlacement}
        />
      )}

      {/* Rejection Modal */}
      {rejectingApp && (
        <ApplicationRejectModal
          app={rejectingApp}
          submitting={processingId === rejectingApp.id}
          onClose={() => setRejectingApp(null)}
          onConfirm={handleConfirmReject}
        />
      )}
    </div>
  );
}
