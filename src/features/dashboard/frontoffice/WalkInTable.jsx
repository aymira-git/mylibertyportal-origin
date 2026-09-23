import { Clock, Phone, Calendar, GraduationCap, Send, UserPlus, Award } from "lucide-react";
import { calculateAge } from "./walkInUtils";

export function WalkInTable({
  loading,
  filteredInquiries,
  tierOptions,
  onStatusChange,
  onSendWhatsApp,
  onEnroll,
  onTakePlacementTest,
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-100">
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-50/80 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100">
          <tr>
            <th className="py-3 px-4">Date / Time</th>
            <th className="py-3 px-4">Parent / Visitor</th>
            <th className="py-3 px-4">Prospective Student</th>
            <th className="py-3 px-4">Placement / Level</th>
            <th className="py-3 px-4">Program &amp; Notes</th>
            <th className="py-3 px-4">Status</th>
            <th className="py-3 px-4 text-center">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {filteredInquiries.length === 0 ? (
            <tr>
              <td colSpan={7} className="py-8 text-center text-slate-400 font-medium">
                {loading ? "Loading inquiries..." : "No walk-in inquiries found."}
              </td>
            </tr>
          ) : (
            filteredInquiries.map((inq) => {
              const dateStr = inq.createdAt
                ? new Date(inq.createdAt).toLocaleString("id-ID", {
                    timeZone: "Asia/Makassar",
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "-";

              const ageVal = calculateAge(inq.dob);

              const tierMatch =
                tierOptions.find((t) => t.id === inq.fluencyTier) ||
                (inq.fluencyTier ? { label: inq.fluencyTier, starText: "⭐" } : null);

              const tests = Array.isArray(inq.placementTests) ? inq.placementTests : [];
              const latestTest = tests.length > 0 ? tests[tests.length - 1] : null;

              return (
                <tr
                  key={inq.id}
                  className="hover:bg-slate-50/60 transition font-medium text-slate-700"
                >
                  <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {dateStr}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-bold text-slate-900">
                    <span>{inq.parentName}</span>
                    <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium mt-0.5">
                      <Phone className="w-3 h-3 text-slate-400" />
                      <span>{inq.phone}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-extrabold text-slate-800">
                        {inq.studentName}
                      </span>
                      {ageVal !== null && (
                        <span className="px-1.5 py-0.2 rounded-md bg-indigo-50 text-indigo-700 text-[10px] font-black border border-indigo-100">
                          {ageVal} yo
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {inq.dob && (
                        <span className="text-[10px] text-slate-400 font-medium inline-flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-300" />
                          {inq.dob}
                        </span>
                      )}
                      {tierMatch && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-purple-50 text-purple-700 font-bold border border-purple-100">
                          {tierMatch.starText} {tierMatch.label}
                        </span>
                      )}
                      {inq.ageOrGrade && !inq.dob && (
                        <span className="text-[10px] text-slate-400 font-medium">
                          {inq.ageOrGrade}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    {latestTest ? (
                      <div className="space-y-0.5">
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 text-amber-900 border border-amber-200 text-[11px] font-black">
                          <Award className="w-3 h-3 text-amber-600 shrink-0" />
                          <span>
                            {latestTest.score != null ? `${latestTest.score} pts` : "Assessed"}:{" "}
                            <span className="capitalize">{latestTest.assessedLevel || inq.currentLevel || "Standard"}</span>
                          </span>
                        </div>
                        {tests.length > 1 && (
                          <p className="text-[9px] text-slate-400 font-bold">
                            {tests.length} tests recorded
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 font-semibold">
                        <span>Level:</span>
                        <strong className="text-slate-700 capitalize">
                          {inq.currentLevel || "Unassigned"}
                        </strong>
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 max-w-xs">
                    <span className="font-bold text-[#1a3a8f] inline-flex items-center gap-1">
                      <GraduationCap className="w-3.5 h-3.5 text-[#1a3a8f]" />
                      <span>{inq.program || "English Course"}</span>
                    </span>
                    {inq.notes && (
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {inq.notes}
                      </p>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <select
                      value={inq.status || "inquired"}
                      onChange={(e) => onStatusChange(inq.id, e.target.value)}
                      className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-bold outline-none cursor-pointer"
                    >
                      <option value="inquired">Inquired</option>
                      <option value="follow_up_sent">Follow-Up Sent</option>
                      <option value="enrolled">Enrolled</option>
                      <option value="closed">Closed</option>
                    </select>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-center gap-1.5 flex-wrap">
                      {onTakePlacementTest && (
                        <button
                          type="button"
                          onClick={() => onTakePlacementTest(inq)}
                          title="Record or update placement test"
                          className="px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 transition inline-flex items-center gap-1 text-[11px] font-bold shadow-2xs cursor-pointer"
                        >
                          <Award className="w-3 h-3 text-amber-700" />
                          <span>{latestTest ? "Retest" : "Test"}</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => onSendWhatsApp(inq)}
                        title="Send WhatsApp Info & Link"
                        className="px-2.5 py-1.5 rounded-xl bg-[#25D366] text-white hover:bg-[#20ba59] transition inline-flex items-center gap-1 text-[11px] font-bold shadow-2xs cursor-pointer"
                      >
                        <Send className="w-3 h-3" />
                        <span>WA</span>
                      </button>

                      {onEnroll && (
                        <button
                          type="button"
                          onClick={() => onEnroll(inq)}
                          title="Connect to Add Student form & enroll"
                          className="px-2.5 py-1.5 rounded-xl bg-[#1a3a8f] text-white hover:bg-[#153075] transition inline-flex items-center gap-1 text-[11px] font-bold shadow-2xs cursor-pointer"
                        >
                          <UserPlus className="w-3 h-3" />
                          <span>Enroll</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

