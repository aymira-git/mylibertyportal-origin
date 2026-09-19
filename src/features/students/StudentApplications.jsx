import { useState, useEffect, useCallback } from "react";
import { useToast, useConfirm } from "../shared";
import { fetchApplications as fetchApplicationsData, approveApplication, rejectApplication } from "./applicationsRepository";
import { Check, X, ExternalLink, Loader2, UserCheck, Calendar, Phone } from "lucide-react";

export default function StudentApplications() {
  const toast = useToast();
  const confirm = useConfirm();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    try {
      setApplications(await fetchApplicationsData());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { (async () => { await fetchApplications(); })(); }, [fetchApplications]);

  const handleApprove = async (app) => {
    setProcessingId(app.id);
    try {
      // Creates the real roster entry and clears the application in one
      // atomic step — same shape as a manually-added student, just
      // sourced from the form instead of Add User. Father's info fills
      // the existing parentName/parentPhone fields (what Directory/Roster
      // already display); mother's info is kept alongside it so nothing
      // from the form gets silently dropped.
      await approveApplication(app);
      toast(`Approved ${app.displayName || "student"} into active roster!`);
      fetchApplications();
    } catch (err) {
      toast("Error approving: " + err.message, "error");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (app) => {
    if (!(await confirm(`Reject ${app.displayName}'s application? This deletes it permanently — there's no record kept afterward.`))) return;
    setProcessingId(app.id);
    try {
      await rejectApplication(app.id);
      toast("Application rejected and archived.");
      fetchApplications();
    } catch (err) {
      toast("Error rejecting: " + err.message, "error");
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm max-w-5xl mx-auto text-xs space-y-5">
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:justify-between sm:items-center pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#1a3a8f] bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
              Admissions Desk
            </span>
            {applications.length > 0 && (
              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                {applications.length} Pending Review
              </span>
            )}
          </div>
          <h3 className="mt-1.5 font-extrabold text-slate-900 text-lg">
            Student Admissions & Registrations
          </h3>
          <p className="text-xs text-slate-500 font-medium">Review submitted online Google Forms & walk-in applicants</p>
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

      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
          <p className="font-semibold text-xs">Loading applicant submissions...</p>
        </div>
      ) : applications.length === 0 ? (
        <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-1">
          <UserCheck className="w-8 h-8 text-slate-300 mx-auto mb-1" />
          <p className="text-sm font-bold text-slate-700">Inbox Zero!</p>
          <p className="text-xs text-slate-400">All student applications have been reviewed and approved.</p>
        </div>
      ) : (
        <div className="space-y-3.5 max-h-[600px] overflow-y-auto pr-1">
          {applications.map(app => (
            <div key={app.id} className="p-4 sm:p-5 bg-white border border-slate-200/90 rounded-2xl shadow-2xs hover:border-indigo-200 transition space-y-3">
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
                      <p className="font-extrabold text-slate-900 text-base">{app.displayName || "Unnamed applicant"}</p>
                      <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                        {app.branch || "General Branch"}
                      </span>
                      {app.program && (
                        <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                          {app.program}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-500 text-[11px] font-medium">
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-400" />
                        {app.phone || "No phone"}
                      </span>
                      <span>·</span>
                      <span>{app.classType || "Standard class"}</span>
                      <span>·</span>
                      <span className="flex items-center gap-1 text-slate-400">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        {app.submittedAt ? new Date(app.submittedAt).toLocaleDateString() : "Just now"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Approve / Reject Actions */}
                <div className="flex gap-2 shrink-0 sm:flex-col sm:w-28">
                  <button
                    onClick={() => handleApprove(app)}
                    disabled={processingId === app.id}
                    className="flex-1 py-2 px-3 rounded-xl font-extrabold text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {processingId === app.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    <span>Approve</span>
                  </button>
                  <button
                    onClick={() => handleReject(app)}
                    disabled={processingId === app.id}
                    className="flex-1 py-2 px-3 rounded-xl font-bold text-xs bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-600 border border-slate-200 hover:border-rose-200 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Reject</span>
                  </button>
                </div>
              </div>

              {/* Extended Dossier Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-3 border-t border-slate-100 text-[11px] text-slate-600 bg-slate-50/50 -mx-4 -mb-4 p-3 rounded-b-2xl">
                <div>
                  <span className="font-bold text-slate-400 uppercase text-[9px] block">Personal</span>
                  <p>DOB: <span className="font-semibold text-slate-800">{app.dob || "—"}</span> ({app.gender || "—"})</p>
                  <p>Birthplace: <span className="font-semibold text-slate-800">{app.placeOfBirth || "—"}</span></p>
                </div>
                <div>
                  <span className="font-bold text-slate-400 uppercase text-[9px] block">Parents</span>
                  <p>Father: <span className="font-semibold text-slate-800">{app.fatherName || "—"}</span> ({app.fatherPhone || "—"})</p>
                  <p>Mother: <span className="font-semibold text-slate-800">{app.motherName || "—"}</span> ({app.motherPhone || "—"})</p>
                </div>
                <div className="sm:col-span-2 md:col-span-1">
                  <span className="font-bold text-slate-400 uppercase text-[9px] block">Academic & Address</span>
                  <p>School/Job: <span className="font-semibold text-slate-800">{app.schoolOrJob || "—"}</span></p>
                  <p className="truncate" title={app.address}>Address: <span className="font-semibold text-slate-800">{app.address || "—"}</span></p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
