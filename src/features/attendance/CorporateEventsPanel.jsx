import { useState, useEffect, useMemo } from "react";
import { useToast, useConfirm } from "../shared";
import { auth } from "../../firebase";
import {
  subscribeCorporateEvents,
  createCorporateEvent,
  cancelCorporateEvent,
} from "./corporateEventsRepository.js";
import { DEFAULT_BRANCH } from "../../constants/branches.js";
import { DIVISION_LABELS, DEFAULT_DIVISION } from "../../constants/divisions.js";
import { STAFF_ROLE_LABELS } from "../staff/staffUtils.js";
import { todayWita } from "../../utils/dateWita.js";
import {
  Calendar,
  Clock,
  Plus,
  Users,
  AlertTriangle,
  Ban,
  CheckCircle2,
  Building,
  Briefcase,
  Layers,
} from "lucide-react";
import { CorporateEventModal } from "./CorporateEventModal";

export default function CorporateEventsPanel() {
  const toast = useToast();
  const confirm = useConfirm();

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("upcoming"); // "upcoming" | "all"
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    eventDate: todayWita(),
    startTime: "",
    endTime: "",
    audienceType: "all",
    audienceValue: "",
  });

  useEffect(() => {
    const unsubscribe = subscribeCorporateEvents(
      (data) => {
        setEvents(data);
        setLoading(false);
      },
      (err) => {
        console.error("Error subscribing to corporate events:", err);
        toast("Failed to load corporate events: " + err.message, "error");
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [toast]);

  const todayStr = useMemo(() => todayWita(), []);

  // Filter events
  const filteredEvents = useMemo(() => {
    if (filter === "upcoming") {
      return events.filter((e) => e.status === "active" && e.eventDate >= todayStr);
    }
    return events;
  }, [events, filter, todayStr]);

  // Identify dates with multiple active events to highlight potential overlap
  const dateCounts = useMemo(() => {
    const counts = {};
    events.forEach((e) => {
      if (e.status === "active") {
        counts[e.eventDate] = (counts[e.eventDate] || 0) + 1;
      }
    });
    return counts;
  }, [events]);

  const handleAudienceTypeChange = (type) => {
    let defaultValue = "";
    if (type === "branch") defaultValue = DEFAULT_BRANCH;
    else if (type === "division") defaultValue = DEFAULT_DIVISION;
    else if (type === "role") defaultValue = "instructor";

    setFormData((prev) => ({
      ...prev,
      audienceType: type,
      audienceValue: defaultValue,
    }));
  };

  const handleOpenModal = () => {
    setFormData({
      name: "",
      eventDate: todayWita(),
      startTime: "",
      endTime: "",
      audienceType: "all",
      audienceValue: "",
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast("Please enter an event name.", "error");
      return;
    }
    if (!formData.eventDate) {
      toast("Please select an event date.", "error");
      return;
    }

    try {
      setSubmitting(true);
      const currentUser = auth.currentUser;
      await createCorporateEvent(
        {
          name: formData.name.trim(),
          eventDate: formData.eventDate,
          startTime: formData.startTime || null,
          endTime: formData.endTime || null,
          audienceType: formData.audienceType,
          audienceValue: formData.audienceType === "all" ? null : formData.audienceValue,
        },
        currentUser?.uid || "admin"
      );

      toast("Corporate event scheduled successfully!");
      setShowModal(false);
    } catch (err) {
      console.error("Error creating corporate event:", err);
      toast("Failed to create event: " + err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelEvent = async (event) => {
    const ok = await confirm(
      `Are you sure you want to cancel the event "${event.name}" scheduled for ${event.eventDate}? Past attendance records will remain preserved.`
    );
    if (!ok) return;

    try {
      const currentUser = auth.currentUser;
      await cancelCorporateEvent(event.id, currentUser?.uid);
      toast(`Event "${event.name}" cancelled.`);
    } catch (err) {
      console.error("Error cancelling corporate event:", err);
      toast("Failed to cancel event: " + err.message, "error");
    }
  };

  const renderAudienceBadge = (event) => {
    switch (event.audienceType) {
      case "all":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <Users className="w-3.5 h-3.5" />
            Everyone (All Students & Staff)
          </span>
        );
      case "branch":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Building className="w-3.5 h-3.5" />
            Branch: {event.audienceValue}
          </span>
        );
      case "division":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-cyan-50 text-cyan-700 border border-cyan-200">
            <Layers className="w-3.5 h-3.5" />
            Division: {DIVISION_LABELS[event.audienceValue] || event.audienceValue}
          </span>
        );
      case "role":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            <Briefcase className="w-3.5 h-3.5" />
            Role: {STAFF_ROLE_LABELS[event.audienceValue] || event.audienceValue}
          </span>
        );
      default:
        return <span>{event.audienceType}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-[#1a3a8f] rounded-xl">
              <Calendar className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">Corporate Events</h2>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Schedule workshops, training sessions, company meetings, and academy events. Eligible
            staff, managers, and students will automatically record attendance at the kiosk.
          </p>
        </div>

        <button
          onClick={handleOpenModal}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1a3a8f] hover:bg-[#152e72] text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Schedule Event</span>
        </button>
      </div>

      {/* Filter and Tab bar */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 pb-2">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter("upcoming")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              filter === "upcoming"
                ? "bg-[#1a3a8f] text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Upcoming & Active
          </button>
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              filter === "all"
                ? "bg-[#1a3a8f] text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All Events & History
          </button>
        </div>

        <span className="text-xs text-slate-400 font-semibold">
          {filteredEvents.length} event{filteredEvents.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Events Table / List */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 font-medium text-xs">
          Loading corporate events...
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 shadow-2xs">
          <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-700">No events found</p>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {filter === "upcoming"
              ? "No upcoming active corporate events scheduled."
              : "No corporate events recorded in the system yet."}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-5 py-3.5">Event Name</th>
                  <th className="px-5 py-3.5">Date & Time</th>
                  <th className="px-5 py-3.5">Target Audience</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEvents.map((evt) => {
                  const isMultipleOnDate = evt.status === "active" && dateCounts[evt.eventDate] > 1;

                  return (
                    <tr
                      key={evt.id}
                      className={`hover:bg-slate-50/80 transition ${
                        evt.status === "cancelled" ? "opacity-60 bg-slate-50/40" : ""
                      }`}
                    >
                      <td className="px-5 py-4">
                        <div className="font-bold text-slate-800 text-sm">{evt.name}</div>
                        {isMultipleOnDate && (
                          <div className="inline-flex items-center gap-1 mt-1 text-[11px] text-amber-600 font-medium bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60">
                            <AlertTriangle className="w-3 h-3 shrink-0" />
                            <span>
                              Multiple events on this date (staff with 2+ matches fall back to General Duty)
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-700 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{evt.eventDate}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5 mt-0.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            {evt.startTime ? `${evt.startTime} - ${evt.endTime || "End"}` : "All Day"}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4">{renderAudienceBadge(evt)}</td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        {evt.status === "active" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                            <Ban className="w-3 h-3" />
                            Cancelled
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        {evt.status === "active" ? (
                          <button
                            onClick={() => handleCancelEvent(evt)}
                            className="text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg transition cursor-pointer"
                          >
                            Cancel Event
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">No actions</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Creation Modal */}
      <CorporateEventModal
        showModal={showModal}
        onClose={() => setShowModal(false)}
        onSubmit={handleSubmit}
        formData={formData}
        setFormData={setFormData}
        submitting={submitting}
        onAudienceTypeChange={handleAudienceTypeChange}
      />
    </div>
  );
}
