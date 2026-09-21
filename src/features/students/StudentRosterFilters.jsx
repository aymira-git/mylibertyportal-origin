import { Search, X } from "lucide-react";

export default function StudentRosterFilters({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  actionFilter,
  onActionFilterChange,
  statusCounts,
  actionCounts,
}) {
  return (
    <div className="space-y-3">
      {/* Search Input Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search students by name, phone, or ID code..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-10 pr-9 py-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium bg-slate-50/50 focus:bg-white focus:border-[#1a3a8f] focus:ring-1 focus:ring-[#1a3a8f] outline-none transition"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Operational Quick Filters Bar */}
      <div className="space-y-2.5 pt-1">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs border-b border-slate-100 no-scrollbar">
          {[
            { id: "active", label: "Active", count: statusCounts.active },
            { id: "on_leave", label: "On Leave", count: statusCounts.onLeave },
            {
              id: "inactive_graduated",
              label: "Inactive / Graduated",
              count: statusCounts.inactiveGrad,
            },
            { id: "all", label: "All Records", count: statusCounts.total },
          ].map((tab) => {
            const isSelected = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onStatusFilterChange(tab.id)}
                className={`px-3 py-1.5 rounded-xl font-bold transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? "bg-[#1a3a8f] text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                    isSelected ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Action & Tier Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1">
            Filter:
          </span>
          {[
            { id: "all", label: "All" },
            {
              id: "unassigned",
              label: `⚠️ Unassigned (${actionCounts.unassigned})`,
              tone:
                actionCounts.unassigned > 0 ? "text-amber-700 bg-amber-50 border-amber-200" : "",
            },
            {
              id: "due_or_expired",
              label: `💳 Due Soon / Expired (${actionCounts.dueOrExpired})`,
              tone: actionCounts.dueOrExpired > 0 ? "text-rose-700 bg-rose-50 border-rose-200" : "",
            },
            { id: "beginner", label: "⭐ Beginner" },
            { id: "intermediate", label: "⭐⭐ Intermediate" },
            { id: "fluent", label: "⭐⭐⭐ Fluent" },
          ].map((pill) => {
            const isSelected = actionFilter === pill.id;
            return (
              <button
                key={pill.id}
                onClick={() => onActionFilterChange(pill.id)}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition whitespace-nowrap border cursor-pointer ${
                  isSelected
                    ? "bg-[#1a3a8f] text-white border-[#1a3a8f] shadow-2xs"
                    : pill.tone || "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {pill.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
