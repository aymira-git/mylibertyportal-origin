import { useState, useMemo } from "react";
import { Search, MapPin, Navigation, Calendar, User, CheckCircle2, Plus, Sparkles } from "lucide-react";

const STATUS_BADGES = {
  visited: { label: "Visited", class: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  scheduled: { label: "Scheduled", class: "bg-amber-100 text-amber-800 border-amber-200" },
  follow_up: { label: "Follow-up", class: "bg-purple-100 text-purple-800 border-purple-200" },
  pending: { label: "Pending", class: "bg-slate-100 text-slate-700 border-slate-200" },
};

export default function SchoolOutreachList({
  schools = [],
  onSelectSchool,
  onOpenVisitModal,
  onOpenAddModal,
  onSeedSchools,
  seeding = false,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTier, setSelectedTier] = useState("all");

  const filteredSchools = useMemo(() => {
    return schools.filter((school) => {
      const matchSearch =
        !searchTerm.trim() ||
        (school.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (school.address || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (school.district || "").toLowerCase().includes(searchTerm.toLowerCase());

      const matchTier = selectedTier === "all" || school.tier === selectedTier;

      return matchSearch && matchTier;
    });
  }, [schools, searchTerm, selectedTier]);

  return (
    <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-2xs space-y-4">
      {/* List Header & Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center justify-between">
          <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">
            Target Schools Directory ({filteredSchools.length})
          </h4>
        </div>

        <div className="flex items-center gap-2">
          {onOpenAddModal && (
            <button
              onClick={onOpenAddModal}
              className="px-3.5 py-2 bg-[#1a3a8f] hover:bg-[#122b6e] text-white font-extrabold text-xs rounded-xl transition flex items-center gap-1.5 shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add School</span>
            </button>
          )}

          {schools.length === 0 && onSeedSchools && (
            <button
              onClick={onSeedSchools}
              disabled={seeding}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl transition flex items-center gap-1.5 shadow-2xs disabled:opacity-60"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{seeding ? "Loading..." : "Load Kota Gorontalo Schools"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Search & Tier Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search school by name, district, or address..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#1a3a8f]/30"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {["all", "SMA", "SMK", "SMP"].map((tier) => (
            <button
              key={tier}
              onClick={() => setSelectedTier(tier)}
              className={`px-3 py-2 rounded-xl text-xs font-extrabold transition shrink-0 ${
                selectedTier === tier
                  ? "bg-slate-800 text-white shadow-2xs"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-600"
              }`}
            >
              {tier === "all" ? "All Tiers" : tier}
            </button>
          ))}
        </div>
      </div>

      {/* School Cards */}
      {filteredSchools.length === 0 ? (
        <div className="py-10 text-center text-slate-500 text-xs">
          <p className="font-bold">No schools found matching your search.</p>
          {schools.length === 0 && onSeedSchools && (
            <div className="mt-3">
              <button
                onClick={onSeedSchools}
                disabled={seeding}
                className="px-4 py-2 bg-[#1a3a8f] text-white font-bold rounded-xl text-xs"
              >
                Load Starter Gorontalo Schools
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[520px] overflow-y-auto pr-1">
          {filteredSchools.map((school) => {
            const statusBadge = STATUS_BADGES[school.status] || STATUS_BADGES.pending;
            const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${school.lat},${school.lng}`;

            return (
              <div
                key={school.id}
                className="p-4 rounded-2xl border border-slate-200/90 bg-slate-50/60 hover:bg-white hover:border-slate-300 transition shadow-2xs flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-slate-200/70 text-slate-700 mb-1">
                        {school.tier || "SMA"}
                      </span>
                      <h5 className="font-extrabold text-slate-900 text-sm leading-snug">
                        {school.name}
                      </h5>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border shrink-0 ${statusBadge.class}`}
                    >
                      {statusBadge.label}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">
                    {school.address || school.district || "Kota Gorontalo"}
                  </p>

                  {/* Last visit & contact detail */}
                  <div className="mt-2.5 pt-2 border-t border-slate-200/60 text-[11px] space-y-0.5 text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {school.lastVisitDate ? (
                        <span>
                          Last visit: <b className="text-slate-800">{school.lastVisitDate}</b>
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">No visit logged yet</span>
                      )}
                    </div>
                    {school.lastContactName && (
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>
                          {school.lastContactName}{" "}
                          <span className="text-slate-400">({school.lastContactRole || "BK"})</span>
                        </span>
                      </div>
                    )}
                    {school.lastOutcome && (
                      <p className="text-[11px] text-slate-600 italic bg-white p-1.5 rounded-lg border border-slate-100 mt-1">
                        "{school.lastOutcome}"
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => onOpenVisitModal && onOpenVisitModal(school)}
                    className="flex-1 py-2 px-3 bg-[#1a3a8f] hover:bg-[#122b6e] text-white font-extrabold text-xs rounded-xl shadow-2xs transition flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Log Visit</span>
                  </button>

                  <button
                    onClick={() => onSelectSchool && onSelectSchool(school)}
                    className="py-2 px-3 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1"
                    title="Focus on map"
                  >
                    <MapPin className="w-3.5 h-3.5 text-[#1a3a8f]" />
                    <span className="hidden sm:inline">Map</span>
                  </button>

                  <a
                    href={navUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1"
                    title="Navigate with Google Maps"
                  >
                    <Navigation className="w-3.5 h-3.5 text-slate-600" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
