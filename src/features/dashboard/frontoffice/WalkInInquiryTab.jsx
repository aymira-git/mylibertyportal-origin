import { useState, useEffect, useMemo, useCallback } from "react";
import {
  fetchRecentDeskInquiries,
  createDeskInquiry,
  updateDeskInquiryStatus,
  addPlacementTestToInquiry,
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
import { getProgram } from "../../../constants/programs";
import { UserCheck, PlusCircle, Search, RefreshCw } from "lucide-react";
import { WalkInModal } from "./WalkInModal";
import { WalkInTable } from "./WalkInTable";
import { PlacementTestModal } from "./PlacementTestModal";

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
  const [placementModalOpen, setPlacementModalOpen] = useState(false);
  const [selectedInquiryForTest, setSelectedInquiryForTest] = useState(null);
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

  const handleOpenPlacementTest = (inquiry) => {
    setSelectedInquiryForTest(inquiry);
    setPlacementModalOpen(true);
  };

  const handleSavePlacementTest = async (testData, { enrollImmediately = false } = {}) => {
    if (!selectedInquiryForTest) return;
    setSubmitting(true);
    try {
      const updated = await addPlacementTestToInquiry(selectedInquiryForTest.id, testData);
      setInquiries((prev) =>
        prev.map((i) =>
          i.id === selectedInquiryForTest.id
            ? {
                ...i,
                ...updated,
                placementTests: updated.placementTests || [
                  ...(i.placementTests || []),
                  testData,
                ],
                currentLevel: testData.assessedLevel || i.currentLevel,
              }
            : i
        )
      );
      setPlacementModalOpen(false);

      if (enrollImmediately && onEnrollStudent) {
        const fullUpdatedInquiry = {
          ...selectedInquiryForTest,
          ...updated,
          currentLevel: testData.assessedLevel || selectedInquiryForTest.currentLevel,
          placementTests: updated.placementTests || [
            ...(selectedInquiryForTest.placementTests || []),
            testData,
          ],
        };
        toast("Placement test recorded! Opening Student Registration form...", "success");
        onEnrollStudent(fullUpdatedInquiry);
      } else {
        toast("Placement test recorded successfully!", "success");
      }
    } catch (err) {
      console.error("Failed to save placement test:", err);
      toast("Failed to save placement test: " + err.message, "error");
    } finally {
      setSubmitting(false);
    }
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

        <WalkInTable
          loading={loading}
          filteredInquiries={filteredInquiries}
          tierOptions={tierOptions}
          onStatusChange={handleStatusChange}
          onSendWhatsApp={handleSendWhatsAppFollowUp}
          onEnroll={onEnrollStudent ? handleEnrollFromList : null}
          onTakePlacementTest={handleOpenPlacementTest}
        />
      </div>

      <WalkInModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        formData={formData}
        setFormData={setFormData}
        calculatedAge={calculatedAge}
        tierOptions={tierOptions}
        submitting={submitting}
        onSubmit={handleSaveInquiry}
        canEnrollImmediately={Boolean(onEnrollStudent)}
      />

      <PlacementTestModal
        isOpen={placementModalOpen}
        onClose={() => setPlacementModalOpen(false)}
        inquiry={selectedInquiryForTest}
        division={division}
        onSaveTest={handleSavePlacementTest}
        submitting={submitting}
        canEnrollImmediately={Boolean(onEnrollStudent)}
      />
    </div>
  );
}
