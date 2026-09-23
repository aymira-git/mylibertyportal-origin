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
  filterApplications,
  getDistinctValues,
} from "./admissionsUtils";
import ApplicationPlacementModal from "./ApplicationPlacementModal";
import ApplicationRejectModal from "./ApplicationRejectModal";
import { STUDENT_APPLICATIONS_SHEET_URL } from "../../constants/externalLinks";
import { ApplicantCard } from "./ApplicantCard";
import {
  ExternalLink,
  Search,
  UserCheck,
  CheckCircle2,
  X,
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
  const pendingCount = useMemo(() => applications.filter(isPending).length, [applications]);
  const approvedCount = useMemo(
    () => applications.filter((a) => a.status === "approved").length,
    [applications]
  );
  const rejectedCount = useMemo(
    () => applications.filter((a) => a.status === "rejected").length,
    [applications]
  );

  // Dynamic filter options
  const branchOptions = useMemo(() => getDistinctValues(applications, "branch"), [applications]);
  const programOptions = useMemo(() => getDistinctValues(applications, "program"), [applications]);

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
  const { page, setPage, totalPages, pageItems, from, to, total } = usePagination(filteredApps, 20);

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
    <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm w-full text-xs space-y-5">
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
            Review online Google Form submissions, perform placement triage, and enroll incoming
            students
          </p>
        </div>

        <a
          href={STUDENT_APPLICATIONS_SHEET_URL}
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
              activeView === "pending" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
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
              activeView === "approved" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
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
              activeView === "rejected" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
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
          {pageItems.map((app) => (
            <ApplicantCard
              key={app.id}
              app={app}
              activeView={activeView}
              users={users}
              classes={classes}
              applications={applications}
              isProcessing={processingId === app.id}
              onApprove={setPlacementApp}
              onReject={setRejectingApp}
              onRestore={handleRestore}
              onDelete={handlePermanentDelete}
              onViewStudent={onViewStudent}
              onApproveAndEdit={onApproveAndEdit}
            />
          ))}
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
