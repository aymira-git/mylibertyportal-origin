import { Search } from "lucide-react";
import { LEVELS, LEVEL_KEYS, TIERS, TIER_KEYS } from "../shared";
import { BRANCHES } from "../../constants/branches";
import { getBatchTypeList } from "../../constants/batchTypes";

export function AvailableBatchesFilterBar({
  search,
  onSearchChange,
  programFilter,
  onProgramFilterChange,
  enabledPrograms,
  tierFilter,
  onTierFilterChange,
  levelFilter,
  onLevelFilterChange,
  statusFilter,
  onStatusFilterChange,
  batchTypeFilter,
  onBatchTypeFilterChange,
  branchFilter,
  onBranchFilterChange,
}) {
  return (
    <>
      {/* Program Filter Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-100 pt-1">
        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider shrink-0 mr-1">
          Program:
        </span>
        <button
          onClick={() => onProgramFilterChange("all")}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            programFilter === "all"
              ? "bg-[#1a3a8f] text-white shadow-xs"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          All Programs
        </button>
        {enabledPrograms.map((prog) => {
          const isSelected = programFilter === prog.id;
          return (
            <button
              key={prog.id}
              onClick={() => onProgramFilterChange(isSelected ? "all" : prog.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer border flex items-center gap-1.5 ${
                isSelected
                  ? "bg-[#1a3a8f] text-white border-[#1a3a8f] shadow-xs"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              <span>{prog.shortLabel || prog.label}</span>
            </button>
          );
        })}
      </div>

      {/* Filter and Search Controls */}
      <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search batch title, instructor, schedule, or room..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold bg-slate-50 focus:bg-white focus:border-[#1a3a8f] outline-none transition"
          />
        </div>

        {/* Marketing-Friendly Tier Filter Tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => {
              onTierFilterChange("all");
              onLevelFilterChange("all");
            }}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              tierFilter === "all" && levelFilter === "all"
                ? "bg-[#1a3a8f] text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All Batches
          </button>
          {TIER_KEYS.map((tierKey) => {
            const tier = TIERS[tierKey];
            const isSelected = tierFilter === tierKey;
            return (
              <button
                key={tierKey}
                onClick={() => {
                  onTierFilterChange(isSelected ? "all" : tierKey);
                  onLevelFilterChange("all");
                }}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-[#1a3a8f] text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <span>{tier.starText}</span>
                <span>{tier.label}</span>
                <span
                  className={`text-[10px] font-normal ${isSelected ? "text-indigo-200" : "text-slate-400"}`}
                >
                  ({tier.levels.map((l) => LEVELS[l]?.label).join("/")})
                </span>
              </button>
            );
          })}
        </div>

        {/* Sub-level Filter Dropdown */}
        <select
          value={levelFilter}
          onChange={(e) => onLevelFilterChange(e.target.value)}
          className="p-2.5 border border-slate-200 rounded-xl text-xs font-bold bg-white text-slate-700 focus:border-[#1a3a8f] outline-none capitalize"
        >
          <option value="all">All Sub-Levels</option>
          {LEVEL_KEYS.map((lvl) => (
            <option key={lvl} value={lvl}>
              {LEVELS[lvl]?.label} ({LEVELS[lvl]?.stars ? "⭐".repeat(LEVELS[lvl].stars) : ""})
            </option>
          ))}
        </select>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
          className="p-2.5 border border-slate-200 rounded-xl text-xs font-bold bg-white text-slate-700 focus:border-[#1a3a8f] outline-none"
        >
          <option value="all">All Statuses</option>
          <option value="open">🟢 Open Seats Only</option>
          <option value="filling_fast">🟡 Filling Fast (&le; 3)</option>
          <option value="upcoming">🔵 Upcoming Intake</option>
          <option value="full">🔴 Full / Closed</option>
          <option value="completed">🟣 Completed / Cancelled</option>
        </select>

        {/* Batch Type Filter */}
        <select
          value={batchTypeFilter}
          onChange={(e) => onBatchTypeFilterChange(e.target.value)}
          className="p-2.5 border border-slate-200 rounded-xl text-xs font-bold bg-white text-slate-700 focus:border-[#1a3a8f] outline-none"
        >
          <option value="all">All Batch Types</option>
          {getBatchTypeList().map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>

        {/* Campus Branch Filter */}
        <select
          value={branchFilter}
          onChange={(e) => onBranchFilterChange(e.target.value)}
          className="p-2.5 border border-slate-200 rounded-xl text-xs font-bold bg-white text-slate-700 focus:border-[#1a3a8f] outline-none"
        >
          <option value="all">All Campuses</option>
          {BRANCHES.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}
