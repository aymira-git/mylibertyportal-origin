import { useState, useEffect, useMemo, useCallback } from "react";
import {
  fetchRecentDeskInquiries,
  createDeskInquiry,
  updateDeskInquiryStatus,
} from "./deskInquiriesRepository";
import {
  calculateAge,
  COURSE_TIER_OPTIONS,
  KINDERGARTEN_TIER_OPTIONS,
  isPermissionError,
  getLocalInquiries,
  saveLocalInquiry,
} from "./walkInUtils";
import { INQUIRY_STATUSES } from "../../../schemas/deskInquirySchema";
import { normalizeWhatsAppNumber } from "../../finance/receiptMessages";
import { useToast } from "../../shared";
import { reportError } from "../../../utils/reportError";
import { getEnabledPrograms, getProgram } from "../../../constants/programs";
import {
  UserCheck,
  PlusCircle,
  Search,
  RefreshCw,
  Clock,
  Phone,
  Send,
  X,
  UserPlus,
  Sparkles,
  Calendar,
  GraduationCap,
} from "lucide-react";

function getDefaultFormData(division) {
  const isKg = division === "kindergarten";
  const tierOptions = isKg ? KINDERGARTEN_TIER_OPTIONS : COURSE_TIER_OPTIONS;
  const defaultProgramId = isKg ? "kids_school" : "english_course";
  const defaultProg = getProgram(defaultProgramId);

  return {
    parentName: "",
    phone: "",
    studentName: "",
    dob: "",
    ageOrGrade: "",
    fluencyTier: "beginner",
    currentLevel: tierOptions[0]?.defaultLevel || "warrior",
    programId: defaultProgramId,
    program: defaultProg?.label || "English Course",
    notes: "",
  };
}

/**
 * Walk-In Guest & Prospect Inquiries Tab.
 *
 * Fast logging of walk-in parents/visitors asking for course information,
 * status pipeline tracking, automatic age calculation from DOB, fluency tier selection,
 * program dropdown, one-click WhatsApp follow-ups, and immediate enrollment connection.
 *
 * @param {Object} props
 * @param {string} [props.division]
 * @param {string} [props.branchLabel]
 * @param {((inquiry: any) => void)|null} [props.onEnrollStudent]
 */
export default function WalkInInquiryTab({
  division = "courses",
  branchLabel = "Kota Gorontalo",
  onEnrollStudent = null,
}) {
  const toast = useToast();
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const tierOptions =
    division === "kindergarten" ? KINDERGARTEN_TIER_OPTIONS : COURSE_TIER_OPTIONS;

  const [formData, setFormData] = useState(() => getDefaultFormData(division));
  const [submitting, setSubmitting] = useState(false);

  const handleOpenModal = () => {
    setFormData(getDefaultFormData(division));
    setModalOpen(true);
  };

  const loadInquiries = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchRecentDeskInquiries(50);
      setInquiries(list);
      setHasPermission(true);
    } catch (err) {
      if (isPermissionError(err)) {
        console.warn(
          "deskInquiries: permission denied by Firestore rules. Loading local inquiries cache.",
          err?.message
        );
        setHasPermission(false);
        setInquiries(getLocalInquiries());
      } else {
        console.error("Failed to load desk inquiries:", err);
        toast("Could not load walk-in inquiries.", "error");
      }
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    let active = true;
    fetchRecentDeskInquiries(50)
      .then((list) => {
        if (!active) return;
        setInquiries(list);
        setHasPermission(true);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        if (isPermissionError(err)) {
          console.warn(
            "deskInquiries: permission denied by Firestore rules. Loading local inquiries cache.",
            err?.message
          );
          setHasPermission(false);
          setInquiries(getLocalInquiries());
        } else {
          console.error("Failed to load desk inquiries:", err);
          toast("Could not load walk-in inquiries.", "error");
        }
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [toast]);

  const filteredInquiries = useMemo(() => {
    return inquiries.filter((inq) => {
      const parent = (inq.parentName || "").toLowerCase();
      const student = (inq.studentName || "").toLowerCase();
      const phone = (inq.phone || "").toLowerCase();
      const q = searchQuery.toLowerCase().trim();

      const matchesSearch = !q || parent.includes(q) || student.includes(q) || phone.includes(q);
      const matchesStatus = statusFilter === "all" || inq.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [inquiries, searchQuery, statusFilter]);

  const calculatedAge = useMemo(() => {
    return calculateAge(formData.dob);
  }, [formData.dob]);

  const handleSaveInquiry = async ({ enrollImmediately = false } = {}) => {
    const parentName = formData.parentName.trim();
    const studentName = formData.studentName.trim();
    const phone = formData.phone.trim();

    if (!parentName || !studentName || !phone) {
      return toast("Please fill in parent name, student name, and phone number.", "error");
    }

    setSubmitting(true);
    try {
      const ageText = calculatedAge !== null ? `${calculatedAge} yo` : formData.ageOrGrade;
      const statusToSave = enrollImmediately ? "enrolled" : "inquired";

      const savedInquiry = await createDeskInquiry({
        ...formData,
        parentName,
        studentName,
        phone,
        ageOrGrade: formData.ageOrGrade.trim() || ageText || "",
        division,
        branch: branchLabel || "Kota Gorontalo",
        status: statusToSave,
      });

      setModalOpen(false);
      setFormData(getDefaultFormData(division));

      if (savedInquiry._permissionDenied) {
        setHasPermission(false);
        setInquiries((prev) => [
          savedInquiry,
          ...prev.filter((i) => i.id !== savedInquiry.id),
        ]);
        if (enrollImmediately && onEnrollStudent) {
          toast("Prospect saved locally! Opening Student Registration form...", "success");
          onEnrollStudent(savedInquiry);
        } else {
          toast("Prospect saved locally! Deploy firestore.rules to enable cloud sync.", "warning");
        }
      } else {
        loadInquiries();
        if (enrollImmediately && onEnrollStudent) {
          toast("Prospect saved! Opening Student Registration form...", "success");
          onEnrollStudent(savedInquiry);
        } else {
          toast("Walk-in prospect logged successfully!", "success");
        }
      }
    } catch (err) {
      if (isPermissionError(err)) {
        const localRecord = saveLocalInquiry({
          ...formData,
          parentName,
          studentName,
          phone,
          division,
          branch: branchLabel || "Kota Gorontalo",
          status: enrollImmediately ? "enrolled" : "inquired",
        });
        setHasPermission(false);
        setInquiries((prev) => [
          localRecord,
          ...prev.filter((i) => i.id !== localRecord.id),
        ]);
        setModalOpen(false);
        setFormData(getDefaultFormData(division));
        if (enrollImmediately && onEnrollStudent) {
          toast("Prospect saved locally! Opening Student Registration form...", "success");
          onEnrollStudent(localRecord);
        } else {
          toast("Prospect saved locally! Deploy firestore.rules to enable cloud sync.", "warning");
        }
      } else {
        console.error("Failed to save walk-in prospect:", err);
        reportError(err, "walk_in_inquiry_save");
        toast(err?.message || "Failed to save inquiry.", "error");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (inquiryId, newStatus) => {
    try {
      await updateDeskInquiryStatus(inquiryId, newStatus);
      toast(`Status updated to ${newStatus.replace("_", " ")}`, "success");
      setInquiries((prev) =>
        prev.map((i) => (i.id === inquiryId ? { ...i, status: newStatus } : i))
      );
    } catch (err) {
      console.error("Failed to update status:", err);
      toast("Failed to update status", "error");
    }
  };

  const handleEnrollFromList = async (inquiry) => {
    try {
      if (inquiry.status !== "enrolled") {
        await updateDeskInquiryStatus(inquiry.id, "enrolled");
        setInquiries((prev) =>
          prev.map((i) => (i.id === inquiry.id ? { ...i, status: "enrolled" } : i))
        );
      }
      if (onEnrollStudent) {
        toast(`Opening student registration for ${inquiry.studentName}...`, "info");
        onEnrollStudent(inquiry);
      } else {
        toast("Enrollment callback not attached to dashboard.", "error");
      }
    } catch (err) {
      console.error("Failed to enroll prospect from list:", err);
      toast("Failed to proceed with enrollment.", "error");
    }
  };

  const handleSendWhatsAppFollowUp = (inquiry) => {
    const cleanPhone = normalizeWhatsAppNumber(inquiry.phone);
    if (!cleanPhone) {
      toast("Invalid phone number for WhatsApp.", "error");
      return;
    }

    const regUrl = window.location.origin + "/register";
    const message = encodeURIComponent(
      `Hello ${inquiry.parentName}! Thank you for visiting the Front Desk at MY LIBERTY today. 🌟\n\n` +
        `Regarding the consultation for *${inquiry.studentName}* in *${inquiry.program || "our program"}*, ` +
        `you can complete our online registration form at this link:\n${regUrl}\n\n` +
        `If you have any further questions, our team is happy to assist. See you in class!`
    );

    const waUrl = `https://wa.me/${cleanPhone}?text=${message}`;
    const link = document.createElement("a");
    link.href = waUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    handleStatusChange(inquiry.id, "follow_up_sent");
  };

  return (
    <div className="space-y-6 w-full">
      {!hasPermission && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 space-y-1.5 shadow-xs">
          <div className="flex items-center gap-2 font-black text-amber-950">
            <span className="text-base">ℹ️</span>
            <span>Firestore Rules Deployment Required for Live Cloud Sync</span>
          </div>
          <p className="leading-relaxed text-amber-800">
            Your live Firebase project currently restricts access on the{" "}
            <code className="bg-amber-100 font-mono px-1 py-0.5 rounded font-bold">
              /deskInquiries
            </code>{" "}
            collection. To enable cloud sync across all front desk stations, deploy the updated
            security rules with{" "}
            <code className="bg-amber-100 px-1 py-0.5 rounded font-mono font-bold">
              firebase deploy --only firestore:rules
            </code>{" "}
            or update your Firebase Console. Walk-in visitors logged now are safely stored in your
            local session and can be immediately enrolled as students.
          </p>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-[#1a3a8f]" />
              <span>Walk-In Guest &amp; Prospect Inquiries</span>
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Log prospective parents &amp; students visiting the desk, track follow-ups, and convert to direct student registrations.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadInquiries}
              disabled={loading}
              title="Refresh log"
              className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>

            <button
              onClick={handleOpenModal}
              className="px-4 py-2.5 rounded-xl bg-[#1a3a8f] text-white hover:bg-[#153075] text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ Log Walk-in Guest</span>
            </button>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search parent, student, or phone..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-[#1a3a8f] outline-none transition"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600">
            {["all", ...INQUIRY_STATUSES].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg capitalize transition cursor-pointer ${
                  statusFilter === st
                    ? "bg-white text-[#1a3a8f] shadow-2xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {st === "all" ? "All Status" : st.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>

        {/* Table / List */}
        <div className="overflow-x-auto rounded-2xl border border-slate-100">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100">
              <tr>
                <th className="py-3 px-4">Date / Time</th>
                <th className="py-3 px-4">Parent / Visitor</th>
                <th className="py-3 px-4">Prospective Student</th>
                <th className="py-3 px-4">Program &amp; Notes</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInquiries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 font-medium">
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

                  // Match fluency tier info
                  const tierMatch =
                    tierOptions.find((t) => t.id === inq.fluencyTier) ||
                    (inq.fluencyTier ? { label: inq.fluencyTier, starText: "⭐" } : null);

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
                          onChange={(e) => handleStatusChange(inq.id, e.target.value)}
                          className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-bold outline-none cursor-pointer"
                        >
                          <option value="inquired">Inquired</option>
                          <option value="follow_up_sent">Follow-Up Sent</option>
                          <option value="enrolled">Enrolled</option>
                          <option value="closed">Closed</option>
                        </select>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleSendWhatsAppFollowUp(inq)}
                            title="Send WhatsApp Info & Link"
                            className="px-2.5 py-1.5 rounded-xl bg-[#25D366] text-white hover:bg-[#20ba59] transition inline-flex items-center gap-1 text-[11px] font-bold shadow-2xs cursor-pointer"
                          >
                            <Send className="w-3 h-3" />
                            <span>WhatsApp</span>
                          </button>

                          {onEnrollStudent && (
                            <button
                              type="button"
                              onClick={() => handleEnrollFromList(inq)}
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
      </div>

      {/* Log Walk-in Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 text-xs max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="font-extrabold text-sm text-slate-800 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-[#1a3a8f]" />
                <span>Log Walk-In Visitor / Prospect</span>
              </h4>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveInquiry({ enrollImmediately: false });
              }}
              className="space-y-3.5"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-extrabold text-slate-700 block mb-1">
                    Parent / Visitor Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ibu Maria"
                    value={formData.parentName}
                    onChange={(e) => setFormData({ ...formData, parentName: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:bg-white focus:border-[#1a3a8f] outline-none"
                  />
                </div>

                <div>
                  <label className="font-extrabold text-slate-700 block mb-1">
                    WhatsApp Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 081234567890"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:bg-white focus:border-[#1a3a8f] outline-none"
                  />
                </div>

                <div>
                  <label className="font-extrabold text-slate-700 block mb-1">
                    Child / Student Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Kevin"
                    value={formData.studentName}
                    onChange={(e) => setFormData({ ...formData, studentName: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:bg-white focus:border-[#1a3a8f] outline-none"
                  />
                </div>

                {/* Date of Birth with instant calculated age */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-extrabold text-slate-700 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>Date of Birth</span>
                    </label>
                    {calculatedAge !== null && (
                      <span className="px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 font-extrabold text-[10px] inline-flex items-center gap-1 animate-in fade-in">
                        <Sparkles className="w-2.5 h-2.5 text-indigo-600" />
                        <span>{calculatedAge} years old</span>
                      </span>
                    )}
                  </div>
                  <input
                    type="date"
                    value={formData.dob}
                    onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:bg-white focus:border-[#1a3a8f] outline-none"
                  />
                </div>
              </div>

              {/* Fluency Tier & School/Grade */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-extrabold text-slate-700 block mb-1">
                    Approximate Fluency Tier
                  </label>
                  <select
                    value={formData.fluencyTier}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      const matched = tierOptions.find((t) => t.id === selectedId);
                      setFormData({
                        ...formData,
                        fluencyTier: selectedId,
                        currentLevel: matched?.defaultLevel || "warrior",
                      });
                    }}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs focus:bg-white focus:border-[#1a3a8f] outline-none cursor-pointer"
                  >
                    {tierOptions.map((tier) => (
                      <option key={tier.id} value={tier.id}>
                        {tier.starText} {tier.label} ({tier.levelsText})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-extrabold text-slate-700 block mb-1">
                    Current Grade / School (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Grade 3 / SD Negeri 1"
                    value={formData.ageOrGrade}
                    onChange={(e) => setFormData({ ...formData, ageOrGrade: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:bg-white focus:border-[#1a3a8f] outline-none"
                  />
                </div>
              </div>

              {/* Program of Interest Dropdown */}
              <div>
                <label className="font-extrabold text-slate-700 block mb-1">
                  Program of Interest
                </label>
                <select
                  value={formData.programId}
                  onChange={(e) => {
                    const chosenId = e.target.value;
                    const prog = getProgram(chosenId);
                    setFormData({
                      ...formData,
                      programId: chosenId,
                      program: prog?.label || chosenId,
                    });
                  }}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs focus:bg-white focus:border-[#1a3a8f] outline-none cursor-pointer"
                >
                  {getEnabledPrograms().map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Inquiry Notes */}
              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Inquiry Notes</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Inquired about weekend morning classes, requested schedule and pricing"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:bg-white focus:border-[#1a3a8f] outline-none"
                />
              </div>

              {/* Modal Action Buttons */}
              <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold shadow-xs disabled:opacity-50 transition cursor-pointer"
                >
                  {submitting ? "Saving..." : "Save Prospect Only"}
                </button>

                {onEnrollStudent && (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleSaveInquiry({ enrollImmediately: true })}
                    className="px-4 py-2.5 rounded-xl bg-[#1a3a8f] text-white hover:bg-[#153075] font-bold shadow-xs disabled:opacity-50 transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>{submitting ? "Saving..." : "Save & Enroll Immediately"}</span>
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
