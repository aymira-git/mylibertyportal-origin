import { useState, useEffect } from "react";
import {
  listenToPendingApprovals,
  approveApprovalRequest,
  rejectApprovalRequest,
} from "./approvalsRepository";
import { applyApprovedShiftCorrection } from "../attendance/shiftsRepository";
import { useToast } from "./useToast";
import { useConfirm } from "./useConfirm";
import { idToBranch } from "../../constants/branches";
import {
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  FileCheck,
  User,
  Building,
} from "lucide-react";

export function ApprovalInbox({
  userRole = "admin",
  branchId = null,
  title = "Pending Authorization Requests",
  subtitle = "Maker-Checker dual-control operational review queue.",
}) {
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDomain, setSelectedDomain] = useState("all");
  const [processingId, setProcessingId] = useState(null);

  const toast = useToast();
  const confirm = useConfirm();

  useEffect(() => {
    const unsubscribe = listenToPendingApprovals(
      userRole,
      branchId,
      (items) => {
        setApprovals(items);
        setLoading(false);
      },
      (err) => {
        console.warn("ApprovalInbox listen error:", err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userRole, branchId]);

  const handleApprove = async (approval) => {
    const isConfirmed = await confirm({
      title: "Authorize Operational Action",
      message: `Are you sure you want to approve "${approval.label}" requested by ${approval.requestedBy}?`,
      confirmLabel: "Approve & Execute",
      cancelLabel: "Cancel",
    });

    if (!isConfirmed) return;

    setProcessingId(approval.id);
    try {
      await approveApprovalRequest(approval.id);

      if (approval.actionId === "STAFF_SHIFT_SELF_CORRECTION" && approval.payload?.afterData) {
        try {
          await applyApprovedShiftCorrection({ approval });
          toast(`Authorized & applied: ${approval.label}`, "success");
        } catch (applyErr) {
          toast(
            `Approved, but the correction could not be applied (${applyErr.message}). An admin can apply it from Staff Duty Reports.`,
            "warning"
          );
        }
      } else {
        toast(`Authorized: ${approval.label}`, "success");
      }
    } catch (err) {
      toast("Failed to approve: " + err.message, "error");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (approval) => {
    const isConfirmed = await confirm({
      title: "Reject Request",
      message: `Are you sure you want to reject "${approval.label}" requested by ${approval.requestedBy}?`,
      confirmLabel: "Reject Request",
      cancelLabel: "Cancel",
      isDestructive: true,
    });

    if (!isConfirmed) return;

    setProcessingId(approval.id);
    try {
      await rejectApprovalRequest(approval.id, { reason: "Declined by approver" });
      toast(`Rejected: ${approval.label}`, "info");
    } catch (err) {
      toast("Failed to reject: " + err.message, "error");
    } finally {
      setProcessingId(null);
    }
  };

  const filteredApprovals =
    selectedDomain === "all"
      ? approvals
      : approvals.filter((a) => a.domain === selectedDomain);

  return (
    <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/90 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#1a3a8f]" />
            <h3 className="font-extrabold text-slate-900 text-lg tracking-tight">{title}</h3>
            {approvals.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-extrabold text-xs">
                {approvals.length} pending
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 font-medium mt-0.5">{subtitle}</p>
        </div>

        {/* Domain Filters */}
        <div className="flex flex-wrap gap-1.5">
          {["all", "finance", "students", "staff", "classes"].map((dom) => (
            <button
              key={dom}
              onClick={() => setSelectedDomain(dom)}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs capitalize transition cursor-pointer ${
                selectedDomain === dom
                  ? "bg-[#1a3a8f] text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {dom}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="py-12 text-center text-xs text-slate-400 font-semibold animate-pulse">
          Loading approval requests...
        </div>
      ) : filteredApprovals.length === 0 ? (
        <div className="py-12 text-center space-y-2">
          <FileCheck className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="font-extrabold text-sm text-slate-700">All clear!</p>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            There are currently no pending dual-control authorization requests in your queue.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredApprovals.map((req) => (
            <div
              key={req.id}
              className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/50 hover:bg-slate-50 transition flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-extrabold text-sm text-slate-900">{req.label}</span>
                  <span
                    className={`px-2 py-0.5 rounded-md font-bold text-[10px] uppercase tracking-wide ${
                      req.mode === "blocking"
                        ? "bg-rose-100 text-rose-800"
                        : "bg-indigo-100 text-indigo-800"
                    }`}
                  >
                    {req.mode}
                  </span>
                  {req.approverBranchId && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                      <Building className="w-3 h-3 text-slate-400" />
                      {idToBranch(req.approverBranchId)}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 font-medium">
                  <span className="inline-flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    Requested by: <strong className="text-slate-700">{req.requestedBy}</strong>
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    {req.requestedAt ? new Date(req.requestedAt).toLocaleString("id-ID") : "Recently"}
                  </span>
                </div>

                {req.reason && (
                  <p className="text-xs text-slate-600 bg-white p-2.5 rounded-xl border border-slate-200/60 font-medium">
                    <strong className="text-slate-800">Reason:</strong> {req.reason}
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                <button
                  disabled={processingId === req.id}
                  onClick={() => handleReject(req)}
                  className="px-3.5 py-2 rounded-xl bg-slate-200 hover:bg-rose-100 text-slate-700 hover:text-rose-700 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Reject</span>
                </button>
                <button
                  disabled={processingId === req.id}
                  onClick={() => handleApprove(req)}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Authorize</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
