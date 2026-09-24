import { useState, useEffect } from "react";
import { auth } from "../../../firebase";
import FrontDeskCashReconcile from "./FrontDeskCashReconcile";
import { fetchRecentDeskInquiries } from "./deskInquiriesRepository";
import { fetchUserShifts } from "../../attendance/shiftsRepository";
import { todayWita } from "../../../utils/dateWita";
import { matchesBranchFilter } from "../../../constants/branches";
import {
  Wallet,
  UserCheck,
  Clock,
  Building2,
  Phone,
  GraduationCap,
} from "lucide-react";

/**
 * FrontOfficeReportsTab
 *
 * Dedicated, privacy-isolated operational reporting cockpit for Front Office staff.
 * Explicitly scoped to:
 * 1. Daily Cash Register Reconciliation (Cash & QRIS vs till count)
 * 2. Daily Inquiry Count (Today's walk-in visitors for this branch only)
 * 3. Personal Shift Log (Logged-in staff member's own clock-in/out records only)
 *
 * Excludes branch-wide financials, other staff audit logs, and marketing funnel analytics.
 */
export default function FrontOfficeReportsTab({
  myBranch = "Kota Gorontalo",
  students = [],
  activeShift = null,
  onShiftClosed = null,
}) {
  const [activeSubTab, setActiveSubTab] = useState("cash"); // 'cash' | 'inquiries' | 'shifts'
  const [todayInquiries, setTodayInquiries] = useState([]);
  const [inquiriesLoading, setInquiriesLoading] = useState(true);
  const [personalShifts, setPersonalShifts] = useState([]);
  const [shiftsLoading, setShiftsLoading] = useState(() => Boolean(auth.currentUser?.uid));

  const currentUser = auth.currentUser;
  const todayStr = todayWita();

  useEffect(() => {
    let isMounted = true;

    fetchRecentDeskInquiries(100)
      .then((allInquiries) => {
        if (!isMounted) return;
        const filtered = allInquiries.filter((inq) => {
          const dateStr = (inq.createdAt || inq.timestamp || "").substring(0, 10);
          const isToday = dateStr === todayStr;
          const matchesBranch = matchesBranchFilter(inq.branch, myBranch);
          return isToday && matchesBranch;
        });
        setTodayInquiries(filtered);
        setInquiriesLoading(false);
      })
      .catch((err) => {
        if (isMounted) {
          console.warn("Failed to load today inquiries for Front Office reports:", err);
          setInquiriesLoading(false);
        }
      });

    if (currentUser?.uid) {
      fetchUserShifts(currentUser.uid, 30)
        .then((shifts) => {
          if (!isMounted) return;
          setPersonalShifts(shifts);
          setShiftsLoading(false);
        })
        .catch((err) => {
          if (isMounted) {
            console.warn("Failed to load personal shifts for Front Office reports:", err);
            setShiftsLoading(false);
          }
        });
    }

    return () => {
      isMounted = false;
    };
  }, [myBranch, todayStr, currentUser?.uid]);

  // Derived Inquiry counts
  const inquiryCounts = {
    total: todayInquiries.length,
    new: todayInquiries.filter((i) => (i.status || "new") === "new").length,
    testing: todayInquiries.filter((i) => i.status === "testing").length,
    followup: todayInquiries.filter((i) => i.status === "follow_up").length,
    converted: todayInquiries.filter((i) => i.status === "enrolled" || i.status === "converted").length,
  };

  return (
    <div className="bg-white p-5 sm:p-7 rounded-3xl border border-slate-200/90 space-y-6 text-sm w-full shadow-sm">
      {/* ── Header ── */}
      <div className="space-y-4 border-b border-slate-100 pb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-extrabold text-slate-900 text-xl tracking-tight">
                Front Desk Daily Operations &amp; Shift Reports
              </h3>
              <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-[#1a3a8f] font-extrabold text-[10px] tracking-wide">
                WITA (UTC+8)
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Daily register reconciliation, walk-in lead counts, and personal duty log.
            </p>
          </div>

          {/* Assigned Branch Badge (Locked, No Dropdown) */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 shrink-0">
            <Building2 className="w-3.5 h-3.5 text-[#1a3a8f]" />
            <span>Campus: <strong>{myBranch}</strong></span>
          </div>
        </div>

        {/* Navigation Sub-Tabs */}
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            onClick={() => setActiveSubTab("cash")}
            className={`px-4 py-2.5 rounded-xl font-extrabold text-xs transition flex items-center gap-2 cursor-pointer ${
              activeSubTab === "cash"
                ? "bg-[#1a3a8f] text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>Cash Register Reconciliation</span>
          </button>

          <button
            onClick={() => setActiveSubTab("inquiries")}
            className={`px-4 py-2.5 rounded-xl font-extrabold text-xs transition flex items-center gap-2 cursor-pointer ${
              activeSubTab === "inquiries"
                ? "bg-[#1a3a8f] text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Today&apos;s Inquiry Count</span>
            {inquiryCounts.total > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                activeSubTab === "inquiries" ? "bg-white text-[#1a3a8f]" : "bg-indigo-100 text-indigo-900"
              }`}>
                {inquiryCounts.total}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveSubTab("shifts")}
            className={`px-4 py-2.5 rounded-xl font-extrabold text-xs transition flex items-center gap-2 cursor-pointer ${
              activeSubTab === "shifts"
                ? "bg-[#1a3a8f] text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>My Personal Shift Log</span>
          </button>
        </div>
      </div>

      {/* ── Sub-Tab 1: Cash Reconciliation ── */}
      {activeSubTab === "cash" && (
        <div className="space-y-4">
          <FrontDeskCashReconcile
            branchLabel={myBranch}
            students={students}
            activeShift={activeShift}
            currentUser={currentUser || {}}
            onShiftClosed={onShiftClosed}
          />
        </div>
      )}

      {/* ── Sub-Tab 2: Daily Inquiry Count ── */}
      {activeSubTab === "inquiries" && (
        <div className="space-y-5">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100">
              <p className="text-xs font-bold text-indigo-800">Total Walk-ins Today</p>
              <p className="text-2xl font-black text-indigo-950 mt-1">{inquiryCounts.total}</p>
              <p className="text-[11px] text-indigo-600 font-medium mt-0.5">{todayStr}</p>
            </div>

            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-100">
              <p className="text-xs font-bold text-amber-800">New Prospects</p>
              <p className="text-2xl font-black text-amber-950 mt-1">{inquiryCounts.new}</p>
              <p className="text-[11px] text-amber-600 font-medium mt-0.5">Awaiting follow-up</p>
            </div>

            <div className="p-4 rounded-2xl bg-sky-50/70 border border-sky-100">
              <p className="text-xs font-bold text-sky-800">Placement Tests</p>
              <p className="text-2xl font-black text-sky-950 mt-1">{inquiryCounts.testing}</p>
              <p className="text-[11px] text-sky-600 font-medium mt-0.5">Testing in progress</p>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-100">
              <p className="text-xs font-bold text-emerald-800">Converted to Enrolled</p>
              <p className="text-2xl font-black text-emerald-950 mt-1">{inquiryCounts.converted}</p>
              <p className="text-[11px] text-emerald-600 font-medium mt-0.5">Joined today</p>
            </div>
          </div>

          {/* Today's Inquiries List */}
          <div className="border border-slate-200/80 rounded-2xl overflow-hidden">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200/80 flex items-center justify-between">
              <span className="font-extrabold text-xs text-slate-800 uppercase tracking-wide">
                Today&apos;s Visitor Log ({myBranch})
              </span>
              <span className="text-[11px] font-bold text-slate-500">
                {todayInquiries.length} registered visitor{todayInquiries.length !== 1 ? "s" : ""}
              </span>
            </div>

            {inquiriesLoading ? (
              <div className="p-8 text-center text-xs text-slate-400 font-semibold animate-pulse">
                Loading today&apos;s inquiries...
              </div>
            ) : todayInquiries.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 space-y-1">
                <p className="font-bold">No walk-in visitors recorded today yet.</p>
                <p className="text-slate-400">Visitors logged via the Walk-in tab will appear here.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {todayInquiries.map((inq) => (
                  <div key={inq.id} className="p-4 hover:bg-slate-50/50 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-900">{inq.studentName || inq.parentName || "Anonymous Visitor"}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold capitalize bg-slate-100 text-slate-700">
                          {inq.status || "New"}
                        </span>
                        {inq.division && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-indigo-50 text-indigo-700">
                            {inq.division}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                        {inq.phone && (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {inq.phone}
                          </span>
                        )}
                        {inq.program && (
                          <span className="inline-flex items-center gap-1">
                            <GraduationCap className="w-3 h-3 text-slate-400" />
                            {inq.program}
                          </span>
                        )}
                        {inq.createdAt && (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {new Date(inq.createdAt).toLocaleTimeString("id-ID", {
                              hour: "2-digit",
                              minute: "2-digit",
                              timeZone: "Asia/Makassar",
                            })} WITA
                          </span>
                        )}
                      </div>
                    </div>

                    {inq.notes && (
                      <p className="text-xs text-slate-600 bg-slate-50 sm:max-w-xs p-2 rounded-xl border border-slate-100">
                        {inq.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Sub-Tab 3: Personal Shift Log ── */}
      {activeSubTab === "shifts" && (
        <div className="space-y-4">
          <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-between">
            <div>
              <p className="font-extrabold text-xs text-slate-800">My Attendance &amp; Shift History</p>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Logged in as: <strong>{currentUser?.displayName || currentUser?.email || "Front Office"}</strong>
              </p>
            </div>
            <span className="text-xs font-bold text-slate-500 bg-white px-3 py-1.5 rounded-xl border border-slate-200">
              {personalShifts.length} shift record{personalShifts.length !== 1 ? "s" : ""}
            </span>
          </div>

          {shiftsLoading ? (
            <div className="p-8 text-center text-xs text-slate-400 font-semibold animate-pulse">
              Loading your shift records...
            </div>
          ) : personalShifts.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 border border-slate-200/80 rounded-2xl">
              No previous shift records found for your account.
            </div>
          ) : (
            <div className="border border-slate-200/80 rounded-2xl overflow-hidden divide-y divide-slate-100">
              {personalShifts.map((shift) => {
                const inTime = shift.clockIn ? new Date(shift.clockIn) : null;
                const outTime = shift.clockOut ? new Date(shift.clockOut) : null;
                const durationMs = inTime && outTime ? outTime.getTime() - inTime.getTime() : null;
                const durationHours = durationMs ? (durationMs / (1000 * 60 * 60)).toFixed(1) : null;

                return (
                  <div key={shift.id} className="p-4 hover:bg-slate-50/50 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-900">
                          {inTime ? inTime.toLocaleDateString("id-ID", {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            timeZone: "Asia/Makassar",
                          }) : "Unknown Date"}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                          outTime ? "bg-slate-100 text-slate-700" : "bg-emerald-100 text-emerald-800 animate-pulse"
                        }`}>
                          {outTime ? "Completed" : "Active Shift"}
                        </span>
                        {shift.punctualityStatus && (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            shift.punctualityStatus === "On Time" || shift.punctualityStatus === "Early"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-amber-50 text-amber-700"
                          }`}>
                            {shift.punctualityStatus}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          In: {inTime ? inTime.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Makassar" }) : "-"}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          Out: {outTime ? outTime.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Makassar" }) : "Active"}
                        </span>
                        {durationHours && (
                          <span className="font-bold text-slate-700">
                            ({durationHours} hrs)
                          </span>
                        )}
                        {shift.stationId && (
                          <span className="text-slate-400">
                            Station: {shift.stationId}
                          </span>
                        )}
                      </div>
                    </div>

                    {shift.cashReconciliation && (
                      <div className="text-xs bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700">
                        Cash Reconciled: <strong className={shift.cashReconciliation.discrepancy < 0 ? "text-rose-600" : "text-emerald-700"}>
                          {shift.cashReconciliation.discrepancy === 0 ? "Balanced" : `Discrepancy: Rp ${shift.cashReconciliation.discrepancy.toLocaleString("id-ID")}`}
                        </strong>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
