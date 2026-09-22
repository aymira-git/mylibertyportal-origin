import { useState, useMemo } from "react";
import {
  Calendar,
  TrendingUp,
  Clock,
  Search,
  Eye,
  X,
  Building2,
} from "lucide-react";
import {
  getStartOfWeekWita,
  getEndOfWeekWita,
} from "../marketing/schoolOutreachRepository";
import {
  calculateCoverage,
  filterVisitsByOfficer,
  calculateWeeklyMetrics,
  getFollowUpSchools,
} from "./outreachTrackerUtils";

export default function MarketingOutreachTracker({
  schools = [],
  visits = [],
  loading = false,
  users = [],
}) {
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

  // Visits for currently viewed school in modal
  const activeSchoolVisits = useMemo(() => {
    if (!viewSchool?.id) return [];
    return visitsBySchoolId.get(viewSchool.id) || [];
  }, [viewSchool, visitsBySchoolId]);

  // Current week WITA range
  const startOfWeek = useMemo(() => getStartOfWeekWita(), []);
  const endOfWeek = useMemo(() => getEndOfWeekWita(), []);

  // Filtered visits by officer
  const filteredVisits = useMemo(() => {
    return filterVisitsByOfficer(visits, selectedOfficer);
  }, [visits, selectedOfficer]);

  // Weekly visits and metrics in current WITA week
  const { visitsCount: weeklyVisitsCount, flyersCount: weeklyFlyers, leadsCount: weeklyLeads } =
    useMemo(() => {
      return calculateWeeklyMetrics(filteredVisits, startOfWeek, endOfWeek);
    }, [filteredVisits, startOfWeek, endOfWeek]);

  // School status metrics
  const { total: totalSchools, visited: visitedCount, percentage: visitedPercentage } =
    useMemo(() => {
      return calculateCoverage(schools);
    }, [schools]);

  const scheduledCount = useMemo(() => {
    return schools.filter((s) => s.status === "scheduled").length;
  }, [schools]);

  const followUpSchools = useMemo(() => {
    return getFollowUpSchools(schools);
  }, [schools]);

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

  if (loading) {
    return (
      <div className="py-20 text-center space-y-3 bg-white rounded-3xl border border-slate-200/90 shadow-2xs">
        <div className="inline-block w-8 h-8 border-3 border-slate-200 border-t-[#1a3a8f] rounded-full animate-spin" />
        <p className="text-xs font-bold text-slate-500">Loading Marketing Outreach analytics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      {/* ── Filter & Header Bar ── */}
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

      {/* ── Key Performance Metric Cards ── */}
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

      {/* ── Follow-up Queue Section ── */}
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
                    className="text-[11px] font-bold text-[#1a3a8f] hover:underline flex items-center gap-1"
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

      {/* ── Recent Visits History Log ── */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div>
            <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">
              Recent Field Visit Logs ({searchedVisits.length})
            </h4>
            <p className="text-xs text-slate-500 font-medium">
              Real-time feed of visits logged by marketing representatives.
            </p>
          </div>

          <div className="relative sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by school, contact, or outcome..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#1a3a8f]/30"
            />
          </div>
        </div>

        {searchedVisits.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            <Calendar className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            <p className="font-bold">No visits recorded yet for this selection.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200/90 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                <tr>
                  <th className="py-3 px-3">Date (WITA)</th>
                  <th className="py-3 px-3">Target School</th>
                  <th className="py-3 px-3">Marketing Officer</th>
                  <th className="py-3 px-3">Contact Person</th>
                  <th className="py-3 px-3 text-center">Flyers / Leads</th>
                  <th className="py-3 px-3">Outcome</th>
                  <th className="py-3 px-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {searchedVisits.slice(0, 20).map((v) => {
                  const school = schoolMap.get(v.schoolId);
                  const officerName = userMap.get(v.createdBy) || "Marketing Officer";

                  return (
                    <tr key={v.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                        {v.visitDate}
                      </td>
                      <td className="py-3 px-3 font-extrabold text-slate-900">
                        {school?.name || "School"}
                        <span className="block text-[10px] font-normal text-slate-400">
                          {school?.district || school?.municipality || "Gorontalo"}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-700 whitespace-nowrap">
                        {officerName}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="font-semibold text-slate-800">{v.contactName}</span>
                        <span className="block text-[10px] text-slate-500">
                          {v.contactRole || "Guru BK"}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-bold">
                          {v.flyersHandedOut || 0} / {v.leadsCollected || 0}
                        </span>
                      </td>
                      <td className="py-3 px-3 max-w-[200px]">
                        <p className="text-[11px] text-slate-600 truncate">{v.outcome || "—"}</p>
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        {school && (
                          <button
                            onClick={() => setViewSchool(school)}
                            className="p-1.5 text-slate-400 hover:text-[#1a3a8f] rounded-lg hover:bg-slate-100 transition"
                            title="View School History"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Read-Only School Details Modal ── */}
      {viewSchool && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-xl border border-slate-100 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-5 bg-gradient-to-r from-slate-800 to-slate-900 text-white flex items-start justify-between">
              <div>
                <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-bold uppercase">
                  {viewSchool.tier || "School"}
                </span>
                <h3 className="text-lg font-black mt-1">{viewSchool.name}</h3>
                <p className="text-xs text-white/80">{viewSchool.address || viewSchool.district}</p>
              </div>
              <button
                onClick={() => setViewSchool(null)}
                className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-2xl text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold">STATUS</span>
                  <span className="font-black text-slate-800 uppercase">{viewSchool.status}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold">LAST VISIT</span>
                  <span className="font-black text-slate-800">{viewSchool.lastVisitDate || "None"}</span>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-xs text-slate-700 uppercase tracking-wider mb-2">
                  Visit History Records
                </h4>
                <div className="space-y-2">
                  {activeSchoolVisits.map((v) => (
                    <div
                      key={v.id}
                      className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between font-bold text-slate-800">
                        <span>{v.visitDate}</span>
                        <span className="text-slate-500 font-normal">
                          Officer: {userMap.get(v.createdBy) || "Marketing"}
                        </span>
                      </div>
                      <p className="text-slate-600">
                        Contact: <b>{v.contactName}</b> ({v.contactRole})
                      </p>
                      {v.outcome && <p className="text-slate-600 italic">"{v.outcome}"</p>}
                      {v.notes && <p className="text-slate-500 text-[11px]">{v.notes}</p>}
                    </div>
                  ))}
                  {activeSchoolVisits.length === 0 && (
                    <p className="text-xs text-slate-400 italic">No visit records found.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setViewSchool(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
