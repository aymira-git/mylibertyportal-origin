import { useState, useMemo } from "react";
import {
  Calendar,
  TrendingUp,
  Clock,
  Eye,
  Building2,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import {
  getStartOfWeekWita,
  getEndOfWeekWita,
} from "../marketing/schoolOutreachRepository.js";
import { todayWita } from "../../../utils/dateWita.js";
import {
  calculateCoverage,
  filterVisitsByOfficer,
  filterSchoolsByOfficer,
  calculateWeeklyMetrics,
  getFollowUpSchools,
} from "./outreachTrackerUtils";
import { SchoolDetailModal } from "./SchoolDetailModal";
import { RecentVisitsTable } from "./RecentVisitsTable";

export default function MarketingOutreachTracker({
  schools = [],
  visits = [],
  weekVisits,
  loading = false,
  users = [],
  error = null,
  onRetry = null,
}) {
  // weekVisits is a week-scoped subscription used exclusively for KPI metric
  // calculations, ensuring the limit on the 90-day log query (visits) never
  // silently truncates weekly counts. Falls back to visits if not provided.
  const metricsVisits = weekVisits ?? visits;
  const [selectedOfficer, setSelectedOfficer] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewSchool, setViewSchool] = useState(null);

  // Marketing officers lookup
  const marketingOfficers = useMemo(() => {
    return users.filter((u) => u.role === "marketing");
  }, [users]);

  const userMap = useMemo(() => {
    const map = new Map();
    users.forEach((u) => {
      map.set(u.id, u.displayName || u.nickname || u.name || "Marketing Officer");
    });
    return map;
  }, [users]);

  // Fast school lookup map (id -> school)
  const schoolMap = useMemo(() => {
    const map = new Map();
    schools.forEach((s) => {
      map.set(s.id, s);
    });
    return map;
  }, [schools]);

  // Group visits by schoolId (schoolId -> visits[])
  // Built from the 90-day visit window so school attribution covers recent history.
  const visitsBySchoolId = useMemo(() => {
    const map = new Map();
    visits.forEach((v) => {
      if (!v.schoolId) return;
      const list = map.get(v.schoolId);
      if (list) {
        list.push(v);
      } else {
        map.set(v.schoolId, [v]);
      }
    });
    return map;
  }, [visits]);

  // Schools attributed to the selected officer via visit history.
  const filteredSchools = useMemo(() => {
    return filterSchoolsByOfficer(schools, selectedOfficer, visitsBySchoolId);
  }, [schools, selectedOfficer, visitsBySchoolId]);

  // Visits for currently viewed school in modal
  const activeSchoolVisits = useMemo(() => {
    if (!viewSchool?.id) return [];
    return visitsBySchoolId.get(viewSchool.id) || [];
  }, [viewSchool, visitsBySchoolId]);

  // Current week WITA range
  const startOfWeek = useMemo(() => getStartOfWeekWita(), []);
  const endOfWeek = useMemo(() => getEndOfWeekWita(), []);

  // Today's date in WITA (UTC+8) as YYYY-MM-DD
  const [todayWitaDate] = useState(() => todayWita());

  // Filtered visits by officer — used only for the recent log display
  const filteredVisits = useMemo(() => {
    return filterVisitsByOfficer(visits, selectedOfficer);
  }, [visits, selectedOfficer]);

  // Weekly KPI metrics use metricsVisits (week-scoped)
  const filteredMetricsVisits = useMemo(() => {
    return filterVisitsByOfficer(metricsVisits, selectedOfficer);
  }, [metricsVisits, selectedOfficer]);

  // Weekly visits and metrics in current WITA week
  const { visitsCount: weeklyVisitsCount, flyersCount: weeklyFlyers, leadsCount: weeklyLeads } =
    useMemo(() => {
      return calculateWeeklyMetrics(filteredMetricsVisits, startOfWeek, endOfWeek);
    }, [filteredMetricsVisits, startOfWeek, endOfWeek]);

  // School status metrics
  const { total: totalSchools, visited: visitedCount, percentage: visitedPercentage } =
    useMemo(() => {
      return calculateCoverage(filteredSchools);
    }, [filteredSchools]);

  // Schools with a visit explicitly scheduled for today (WITA)
  const scheduledCount = useMemo(() => {
    return filteredSchools.filter(
      (s) => s.status === "scheduled" && s.scheduledDate === todayWitaDate
    ).length;
  }, [filteredSchools, todayWitaDate]);

  const followUpSchools = useMemo(() => {
    return getFollowUpSchools(filteredSchools);
  }, [filteredSchools]);

  // Search filtered visits
  const searchedVisits = useMemo(() => {
    if (!searchQuery.trim()) return filteredVisits;
    const q = searchQuery.toLowerCase();
    return filteredVisits.filter((v) => {
      const school = schoolMap.get(v.schoolId);
      const schoolName = (school?.name || "").toLowerCase();
      const contact = (v.contactName || "").toLowerCase();
      const outcome = (v.outcome || "").toLowerCase();
      return schoolName.includes(q) || contact.includes(q) || outcome.includes(q);
    });
  }, [filteredVisits, searchQuery, schoolMap]);

  if (error && schools.length === 0 && visits.length === 0) {
    return (
      <div className="py-16 px-6 text-center space-y-3 bg-white rounded-3xl border border-rose-200/80 shadow-2xs">
        <AlertTriangle className="w-10 h-10 mx-auto text-rose-500" />
        <h3 className="text-sm font-extrabold text-slate-800">Failed to Load Outreach Data</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">{error}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-[#1a3a8f] hover:bg-[#152e72] text-white rounded-xl font-bold text-xs transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Connection</span>
          </button>
        )}
      </div>
    );
  }

  if (loading && schools.length === 0 && visits.length === 0) {
    return (
      <div className="py-20 text-center space-y-3 bg-white rounded-3xl border border-slate-200/90 shadow-2xs">
        <div className="inline-block w-8 h-8 border-3 border-slate-200 border-t-[#1a3a8f] rounded-full animate-spin" />
        <p className="text-xs font-bold text-slate-500">Loading Marketing Outreach analytics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      {/* Error Notification Banner */}
      {error && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Outreach connection warning:</strong> {error}. Showing latest cached data.
            </span>
          </div>
          {onRetry && (
            <button
              onClick={onRetry}
              className="px-3 py-1.5 bg-amber-200 hover:bg-amber-300 text-amber-900 rounded-xl font-bold text-xs flex items-center gap-1.5 transition self-start sm:self-auto cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Connection</span>
            </button>
          )}
        </div>
      )}

      {/* Filter & Header Bar */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full bg-blue-50 text-[#1a3a8f] text-[10px] font-black uppercase tracking-wider">
              Management Oversight
            </span>
            <span className="text-slate-400 text-xs">·</span>
            <span className="text-xs text-slate-500 font-semibold">Read-Only Analytics</span>
          </div>
          <h2 className="text-base font-extrabold text-slate-900 mt-0.5">
            School Outreach Campaign Tracker
          </h2>
          <p className="text-xs text-slate-500">
            Monitoring field admissions outreach and weekly performance across Gorontalo schools.
          </p>
        </div>

        {/* Marketing Officer Selector */}
        <div className="flex items-center gap-2 shrink-0">
          <label className="text-xs font-bold text-slate-700 whitespace-nowrap">Officer:</label>
          <select
            value={selectedOfficer}
            onChange={(e) => setSelectedOfficer(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#1a3a8f]/30"
          >
            <option value="all">All Marketing Officers</option>
            {marketingOfficers.map((o) => (
              <option key={o.id} value={o.id}>
                {o.displayName || o.nickname || o.name || "Marketing Officer"}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Empty State for Unseeded Schools */}
      {schools.length === 0 && (
        <div className="py-8 px-6 text-center space-y-2 bg-white rounded-3xl border border-dashed border-slate-300 shadow-2xs">
          <Building2 className="w-8 h-8 mx-auto text-slate-300" />
          <h4 className="text-xs font-extrabold text-slate-700">No Target Schools Available</h4>
          <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
            No school records have been added or seeded yet. New target schools can be managed in the Marketing Portal.
          </p>
        </div>
      )}

      {/* Key Performance Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Metric 1: Coverage */}
        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/90 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold text-slate-600">Total Coverage</span>
            <Building2 className="w-4 h-4 text-[#1a3a8f]" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">
              {visitedCount} <span className="text-sm font-semibold text-slate-400">/ {totalSchools}</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${visitedPercentage}%` }}
                />
              </div>
              <span className="text-xs font-extrabold text-emerald-700">{visitedPercentage}%</span>
            </div>
          </div>
          <p className="text-[10px] text-slate-500 font-medium">Active target schools in database</p>
        </div>

        {/* Metric 2: Weekly Visits */}
        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/90 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold text-slate-600">Visits This Week</span>
            <Calendar className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <div className="text-2xl font-black text-emerald-700">{weeklyVisitsCount}</div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              WITA ({startOfWeek} to {endOfWeek})
            </p>
          </div>
          <p className="text-[10px] text-slate-500 font-medium">Schools visited Monday–Sunday</p>
        </div>

        {/* Metric 3: Weekly Materials & Leads */}
        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/90 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold text-slate-600">Weekly Outreach</span>
            <TrendingUp className="w-4 h-4 text-amber-500" />
          </div>
          <div className="space-y-0.5">
            <div className="text-lg font-black text-slate-800">
              {weeklyLeads} <span className="text-xs font-bold text-slate-500">Leads</span>
            </div>
            <div className="text-xs font-bold text-slate-600">
              {weeklyFlyers} <span className="text-[11px] text-slate-400 font-normal">Flyers handed out</span>
            </div>
          </div>
          <p className="text-[10px] text-slate-500 font-medium">Acquisitions during current week</p>
        </div>

        {/* Metric 4: Follow-up Queue */}
        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/90 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold text-slate-600">Follow-ups Due</span>
            <Clock className="w-4 h-4 text-purple-600" />
          </div>
          <div>
            <div className="text-2xl font-black text-purple-700">{followUpSchools.length}</div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {scheduledCount} scheduled today
            </p>
          </div>
          <p className="text-[10px] text-slate-500 font-medium">Schools awaiting next action</p>
        </div>
      </div>

      {/* Follow-up Queue Section */}
      {followUpSchools.length > 0 && (
        <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-600" />
              <span>Priority Outreach Follow-up Queue ({followUpSchools.length})</span>
            </h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {followUpSchools.map((school) => (
              <div
                key={school.id}
                className="p-3.5 rounded-2xl bg-purple-50/50 border border-purple-200/70 text-xs space-y-2 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-1">
                    <h5 className="font-bold text-slate-900">{school.name}</h5>
                    <span className="px-2 py-0.5 rounded-md bg-purple-200/60 text-purple-900 font-bold text-[10px]">
                      {school.tier || "School"}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1">
                    Contact: <b>{school.lastContactName || "Guru BK"}</b>{" "}
                    {school.lastContactRole && `(${school.lastContactRole})`}
                  </p>
                  {school.nextActionDate && (
                    <div className="mt-1 text-[11px] font-semibold text-purple-800 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Next Action Date: {school.nextActionDate}</span>
                    </div>
                  )}
                  {school.lastOutcome && (
                    <p className="text-[11px] text-slate-600 italic bg-white/80 p-1.5 rounded-lg border border-purple-100 mt-1.5">
                      "{school.lastOutcome}"
                    </p>
                  )}
                </div>

                <div className="pt-2 border-t border-purple-100 flex items-center justify-end">
                  <button
                    onClick={() => setViewSchool(school)}
                    className="text-[11px] font-bold text-[#1a3a8f] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View History</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Visits History Log */}
      <RecentVisitsTable
        searchedVisits={searchedVisits}
        schoolMap={schoolMap}
        userMap={userMap}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onViewSchool={setViewSchool}
      />

      {/* Read-Only School Details Modal */}
      <SchoolDetailModal
        viewSchool={viewSchool}
        activeSchoolVisits={activeSchoolVisits}
        userMap={userMap}
        onClose={() => setViewSchool(null)}
      />
    </div>
  );
}
