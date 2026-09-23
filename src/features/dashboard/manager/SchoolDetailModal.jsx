import { X } from "lucide-react";

export function SchoolDetailModal({ viewSchool, activeSchoolVisits, userMap, onClose }) {
  if (!viewSchool) return null;

  return (
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
            onClick={onClose}
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
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
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
