import { useState, useEffect } from "react";
import { X, Calendar, User, Phone, CheckCircle2, History, AlertCircle } from "lucide-react";
import { todayWita } from "../../../utils/dateWita";
import { CONTACT_ROLES } from "../../../schemas/schoolOutreachSchema";
import {
  createSchoolVisit,
  listenToSchoolVisits,
} from "./schoolOutreachRepository";
import { useToast } from "../../shared";

export default function SchoolVisitModal({ school, currentUser, onClose, onVisitLogged }) {
  const toast = useToast();

  const [visitDate, setVisitDate] = useState(todayWita());
  const [statusAfterVisit, setStatusAfterVisit] = useState("visited");
  const [contactName, setContactName] = useState(school?.lastContactName || "");
  const [contactRole, setContactRole] = useState(school?.lastContactRole || "Guru BK");
  const [phone, setPhone] = useState("");
  const [flyersHandedOut, setFlyersHandedOut] = useState(0);
  const [leadsCollected, setLeadsCollected] = useState(0);
  const [outcome, setOutcome] = useState("");
  const [notes, setNotes] = useState("");
  const [nextActionDate, setNextActionDate] = useState("");

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [pastVisits, setPastVisits] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  // Subscribe to past visits for this school
  useEffect(() => {
    if (!school?.id) return;
    const unsub = listenToSchoolVisits(school.id, (visits) => {
      setPastVisits(visits);
    });
    return () => unsub();
  }, [school?.id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!contactName.trim()) {
      setErrorMsg("Please provide the contact person's name.");
      return;
    }

    try {
      setSaving(true);
      setErrorMsg("");

      const payload = {
        visitDate,
        contactName: contactName.trim(),
        contactRole: contactRole.trim(),
        phone: phone.trim(),
        flyersHandedOut: Math.max(0, parseInt(flyersHandedOut, 10) || 0),
        leadsCollected: Math.max(0, parseInt(leadsCollected, 10) || 0),
        outcome: outcome.trim(),
        notes: notes.trim(),
        nextActionDate: nextActionDate || "",
        statusAfterVisit,
      };

      await createSchoolVisit(school.id, payload, currentUser?.uid || "marketing-user");

      toast(`Visit to ${school.name} successfully logged!`, "success");
      if (onVisitLogged) onVisitLogged();
      onClose();
    } catch (err) {
      console.error("Error logging visit:", err);
      setErrorMsg(err.message || "Failed to log visit. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!school) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-[#1a3a8f] to-[#2a4db3] text-white flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-bold uppercase tracking-wider">
                {school.tier || "School"}
              </span>
              <span className="text-white/80 text-xs font-semibold">{school.district || school.municipality}</span>
            </div>
            <h3 className="text-lg font-black">{school.name}</h3>
            <p className="text-xs text-white/80 mt-0.5 line-clamp-1">{school.address || "Gorontalo"}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-2 text-xs text-red-700 font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Form */}
          <form id="visit-form" onSubmit={handleSubmit} className="space-y-4">
            {/* Visit Date & Outcome Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Visit Date (WITA)</label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="date"
                    value={visitDate}
                    onChange={(e) => setVisitDate(e.target.value)}
                    required
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#1a3a8f]/30"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Status After Visit</label>
                <select
                  value={statusAfterVisit}
                  onChange={(e) => setStatusAfterVisit(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#1a3a8f]/30"
                >
                  <option value="visited">🟢 Visited / Completed</option>
                  <option value="follow_up">🟣 Follow-up Needed</option>
                </select>
              </div>
            </div>

            {/* Contact Person & Role */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Contact Person <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="e.g. Ibu Rahma, S.Pd"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    required
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#1a3a8f]/30"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Contact Role</label>
                <select
                  value={contactRole}
                  onChange={(e) => setContactRole(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#1a3a8f]/30"
                >
                  {CONTACT_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Phone Number */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">WhatsApp / Phone</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="e.g. 081234567890"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#1a3a8f]/30"
                />
              </div>
            </div>

            {/* Numeric Counts: Flyers & Leads */}
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200/80">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Flyers Handed Out</label>
                <input
                  type="number"
                  min="0"
                  value={flyersHandedOut}
                  onChange={(e) => setFlyersHandedOut(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Prospect Leads Collected</label>
                <input
                  type="number"
                  min="0"
                  value={leadsCollected}
                  onChange={(e) => setLeadsCollected(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                />
              </div>
            </div>

            {/* Outcome & Next Action */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Outreach Outcome</label>
                <input
                  type="text"
                  placeholder="e.g. Presentation scheduled"
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#1a3a8f]/30"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Next Action Date</label>
                <input
                  type="date"
                  value={nextActionDate}
                  onChange={(e) => setNextActionDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#1a3a8f]/30"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Field Notes</label>
              <textarea
                rows={2}
                placeholder="Additional details about the conversation, reception, or campus rules..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#1a3a8f]/30"
              />
            </div>
          </form>

          {/* Past Visits Toggle */}
          {pastVisits.length > 0 && (
            <div className="pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowHistory(!showHistory)}
                className="text-xs font-bold text-[#1a3a8f] hover:underline flex items-center gap-1.5"
              >
                <History className="w-3.5 h-3.5" />
                <span>{showHistory ? "Hide Visit History" : `View Visit History (${pastVisits.length})`}</span>
              </button>

              {showHistory && (
                <div className="mt-2.5 space-y-2 max-h-40 overflow-y-auto pr-1">
                  {pastVisits.map((v) => (
                    <div key={v.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                      <div className="flex items-center justify-between font-bold text-slate-800">
                        <span>{v.visitDate}</span>
                        <span className="text-slate-500 font-normal">{v.contactName} ({v.contactRole})</span>
                      </div>
                      {v.outcome && <p className="text-[11px] text-slate-600 mt-1">Outcome: {v.outcome}</p>}
                      {v.notes && <p className="text-[11px] text-slate-500 italic mt-0.5">{v.notes}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="visit-form"
            disabled={saving}
            className="px-5 py-2 bg-[#1a3a8f] hover:bg-[#122b6e] text-white text-xs font-extrabold rounded-xl shadow-xs transition flex items-center gap-1.5 disabled:opacity-60"
          >
            {saving ? (
              <span>Saving...</span>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Log Visit</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
