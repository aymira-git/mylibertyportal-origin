import { useState, useRef } from "react";
import {
  TodayTab,
  StaffDutyTab,
  LearnerProgressTab,
  AdmissionsTab,
  InstructorPunctualityTab,
} from "./tabs";
import { Clock, Download, Users, GraduationCap, TrendingUp, UserCheck } from "lucide-react";
import { BRANCHES } from "../../constants/branches";

export default function ReportsDashboard({
  isAdminView = false,
  isFrontOffice = false,
  canEdit = true,
  division = "all",
}) {
  const isActualAdmin = isAdminView && !isFrontOffice;
  const canPerformAdminActions = isActualAdmin && canEdit;

  // Default initial subTab
  const [subTab, setSubTab] = useState(isFrontOffice || !isAdminView ? "today" : "staff");

  // Shared Horizon Range (0 = all, or days)
  const [rangeDays, setRangeDays] = useState(30);

  // Branch filter
  const [branchFilter, setBranchFilter] = useState("all");

  // Ref to active tab for CSV export
  const activeTabRef = useRef(null);

  const handleExportCSV = () => {
    if (activeTabRef.current?.exportCSV) {
      activeTabRef.current.exportCSV();
    }
  };

  return (
    <div className="bg-white p-5 sm:p-7 rounded-3xl border border-slate-200/90 space-y-6 text-sm w-full shadow-sm">
      {/* ── Cockpit Header & Export ── */}
      <div className="space-y-4 border-b border-slate-100 pb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-slate-900 text-xl tracking-tight">
                Institutional Reports &amp; Analytics
              </h3>
              <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-[#1a3a8f] font-extrabold text-[10px] tracking-wide">
                WITA (UTC+8)
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              MYLIBERTY International English School — Operational audit logs &amp; performance
              metrics
            </p>
          </div>

          <button
            onClick={handleExportCSV}
            className="inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-bold text-xs shadow-xs transition shrink-0 active:scale-95 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV Dataset</span>
          </button>
        </div>

        {/* Navigation Pills */}
        <div className="flex flex-wrap gap-2 pt-1">
          {/* Sub-Tab: Today's Check-ins */}
          <button
            onClick={() => setSubTab("today")}
            className={`px-4 py-2.5 rounded-xl font-extrabold text-xs transition flex items-center gap-2 cursor-pointer ${
              subTab === "today"
                ? "bg-[#1a3a8f] text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Today&apos;s Check-ins</span>
          </button>

          {/* Sub-Tab: Staff Duty Logs */}
          <button
            onClick={() => setSubTab("staff")}
            className={`px-4 py-2.5 rounded-xl font-extrabold text-xs transition flex items-center gap-2 cursor-pointer ${
              subTab === "staff"
                ? "bg-[#1a3a8f] text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>{isActualAdmin || isAdminView ? "Staff Duty Logs" : "My Duty Log"}</span>
          </button>

          {/* Sub-Tab: Learner Progress & Attendance */}
          <button
            onClick={() => setSubTab("students")}
            className={`px-4 py-2.5 rounded-xl font-extrabold text-xs transition flex items-center gap-2 cursor-pointer ${
              subTab === "students"
                ? "bg-[#1a3a8f] text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Learner Progress</span>
          </button>

          {/* Sub-Tab: Admissions Velocity (Admin, Manager, Front Office) */}
          {(isAdminView || isFrontOffice) && (
            <button
              onClick={() => setSubTab("admissions")}
              className={`px-4 py-2.5 rounded-xl font-extrabold text-xs transition flex items-center gap-2 cursor-pointer ${
                subTab === "admissions"
                  ? "bg-[#1a3a8f] text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Admissions &amp; Leads</span>
            </button>
          )}

          {/* Sub-Tab: Instructor Punctuality (Admin, Manager, Instructor) */}
          {!isFrontOffice && (
            <button
              onClick={() => setSubTab("instructors")}
              className={`px-4 py-2.5 rounded-xl font-extrabold text-xs transition flex items-center gap-2 cursor-pointer ${
                subTab === "instructors"
                  ? "bg-[#1a3a8f] text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>
                {isActualAdmin || isAdminView ? "Instructor Punctuality" : "My Punctuality"}
              </span>
            </button>
          )}
        </div>

        {/* Global Controls & Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
          {/* Branch Filter */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Campus Branch
            </label>
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="w-full p-2 border border-slate-200 rounded-xl bg-white text-xs font-semibold focus:border-[#1a3a8f] outline-none"
            >
              <option value="all">All Campuses</option>
              {BRANCHES.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          {/* Date Horizon Presets (for staff, students, admissions) */}
          {subTab !== "today" && subTab !== "instructors" && (
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Historical Horizon
              </label>
              <select
                value={rangeDays}
                onChange={(e) => setRangeDays(Number(e.target.value))}
                className="w-full p-2 border border-slate-200 rounded-xl bg-white text-xs font-semibold focus:border-[#1a3a8f] outline-none"
              >
                <option value={7}>Last 7 Days</option>
                <option value={30}>Last 30 Days</option>
                <option value={90}>Last 90 Days</option>
                <option value={365}>Last 12 Months</option>
                <option value={0}>All Recorded History</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* ── ACTIVE SUB-TAB VIEW ── */}
      {subTab === "today" && (
        <TodayTab
          ref={activeTabRef}
          branchFilter={branchFilter}
          isAdminView={isAdminView}
          isFrontOffice={isFrontOffice}
          division={division}
        />
      )}

      {subTab === "staff" && (
        <StaffDutyTab
          ref={activeTabRef}
          branchFilter={branchFilter}
          rangeDays={rangeDays}
          isAdminView={isAdminView}
          isActualAdmin={isActualAdmin}
          canPerformAdminActions={canPerformAdminActions}
        />
      )}

      {subTab === "students" && (
        <LearnerProgressTab
          ref={activeTabRef}
          branchFilter={branchFilter}
          rangeDays={rangeDays}
          isAdminView={isAdminView}
          isFrontOffice={isFrontOffice}
        />
      )}

      {subTab === "admissions" && (isAdminView || isFrontOffice) && (
        <AdmissionsTab ref={activeTabRef} branchFilter={branchFilter} rangeDays={rangeDays} />
      )}

      {subTab === "instructors" && !isFrontOffice && (
        <InstructorPunctualityTab
          ref={activeTabRef}
          isAdminView={isAdminView}
          branchFilter={branchFilter}
        />
      )}
    </div>
  );
}
