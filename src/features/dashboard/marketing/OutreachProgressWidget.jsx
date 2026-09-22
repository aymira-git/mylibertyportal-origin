import { MapPin } from "lucide-react";

export default function OutreachProgressWidget({
  schools = [],
  activeFilter = "all",
  onFilterChange,
  isCompact = false,
  onNavigateToMap,
}) {
  const total = schools.length;
  const visited = schools.filter((s) => s.status === "visited").length;
  const scheduled = schools.filter((s) => s.status === "scheduled").length;
  const followUp = schools.filter((s) => s.status === "follow_up").length;
  const pending = schools.filter((s) => !s.status || s.status === "pending").length;

  const visitedPercentage = total > 0 ? Math.round((visited / total) * 100) : 0;

  if (isCompact) {
    return (
      <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-50 text-[#1a3a8f]">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">
                Gorontalo School Outreach Progress
              </h4>
              <p className="text-[11px] text-slate-500 font-medium">
                {visited} of {total} target schools visited
              </p>
            </div>
          </div>
          {onNavigateToMap && (
            <button
              onClick={onNavigateToMap}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-[#1a3a8f] font-extrabold text-xs rounded-xl transition"
            >
              Open Map &rarr;
            </button>
          )}
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
          <div
            className="bg-emerald-500 h-full rounded-full transition-all duration-500"
            style={{ width: `${visitedPercentage}%` }}
          />
        </div>

        {/* Mini stats */}
        <div className="grid grid-cols-4 gap-2 pt-1 text-center">
          <div className="p-2 bg-emerald-50/70 rounded-xl border border-emerald-100">
            <span className="block text-xs font-black text-emerald-800">{visited}</span>
            <span className="text-[10px] text-emerald-600 font-semibold">Visited</span>
          </div>
          <div className="p-2 bg-amber-50/70 rounded-xl border border-amber-100">
            <span className="block text-xs font-black text-amber-800">{scheduled}</span>
            <span className="text-[10px] text-amber-600 font-semibold">Scheduled</span>
          </div>
          <div className="p-2 bg-purple-50/70 rounded-xl border border-purple-100">
            <span className="block text-xs font-black text-purple-800">{followUp}</span>
            <span className="text-[10px] text-purple-600 font-semibold">Follow-up</span>
          </div>
          <div className="p-2 bg-slate-50 rounded-xl border border-slate-200">
            <span className="block text-xs font-black text-slate-800">{pending}</span>
            <span className="text-[10px] text-slate-500 font-semibold">Pending</span>
          </div>
        </div>
      </div>
    );
  }

  const filters = [
    { id: "all", label: "All Schools", count: total },
    { id: "visited", label: "Visited", count: visited, color: "text-emerald-700 bg-emerald-50" },
    { id: "scheduled", label: "Scheduled", count: scheduled, color: "text-amber-700 bg-amber-50" },
    { id: "follow_up", label: "Follow-up", count: followUp, color: "text-purple-700 bg-purple-50" },
    { id: "pending", label: "Pending", count: pending, color: "text-slate-600 bg-slate-100" },
  ];

  return (
    <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-2xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-extrabold text-slate-800 text-sm">Outreach Progression Tracker</h3>
          <p className="text-xs text-slate-500 font-medium">
            Track daily school admissions campaigns across Kota Gorontalo
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-extrabold text-slate-700">
            {visited} / {total} Visited
          </span>
          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-black text-xs">
            {visitedPercentage}%
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden flex">
        <div
          className="bg-emerald-500 h-full transition-all duration-500"
          style={{ width: `${total ? (visited / total) * 100 : 0}%` }}
          title={`Visited: ${visited}`}
        />
        <div
          className="bg-amber-400 h-full transition-all duration-500"
          style={{ width: `${total ? (scheduled / total) * 100 : 0}%` }}
          title={`Scheduled: ${scheduled}`}
        />
        <div
          className="bg-purple-500 h-full transition-all duration-500"
          style={{ width: `${total ? (followUp / total) * 100 : 0}%` }}
          title={`Follow-up: ${followUp}`}
        />
      </div>

      {/* Interactive Filter Chips */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {filters.map((f) => {
          const isActive = activeFilter === f.id;
          return (
            <button
              key={f.id}
              onClick={() => onFilterChange && onFilterChange(f.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 ${
                isActive
                  ? "bg-[#1a3a8f] text-white shadow-xs"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700"
              }`}
            >
              <span>{f.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-md text-[10px] font-black ${
                  isActive ? "bg-white/25 text-white" : "bg-white text-slate-600"
                }`}
              >
                {f.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
