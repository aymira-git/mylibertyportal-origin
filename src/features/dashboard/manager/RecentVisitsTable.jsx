import { Calendar, Eye, Search } from "lucide-react";

export function RecentVisitsTable({
  searchedVisits,
  schoolMap,
  userMap,
  searchQuery,
  onSearchChange,
  onViewSchool,
}) {
  return (
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
            onChange={(e) => onSearchChange(e.target.value)}
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
                          onClick={() => onViewSchool(school)}
                          className="p-1.5 text-slate-400 hover:text-[#1a3a8f] rounded-lg hover:bg-slate-100 transition cursor-pointer"
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
  );
}
