import { useState } from "react";
import { auth } from "../../firebase";
import { useDashboardData } from "./useDashboardData";
import { AIAssistant, DashboardShell, WelcomeBanner, useToast, ApprovalInbox } from "../shared";
import {
  StudentApplications,
  StudentRoster,
  UserForm,
  BadgeModal,
  isActiveStudent,
} from "../students";
import { KioskModal, KioskSidebarButton, CorporateEventsPanel } from "../attendance";
import { ClassManager, AvailableBatches } from "../classes";
import { TasksPanel } from "../staff";
import { PaymentModal } from "../finance";
import {
  TodayScheduleBoard,
  TuitionDueWidget,
  PaymentCashierTab,
  WalkInInquiryTab,
  FrontOfficeReportsTab,
} from "./frontoffice";
import { getProgram } from "../../constants/programs";
import { normalizeBranch } from "../../constants/branches";
import { normalizeDivision } from "../../constants/divisions";
import {
  ScanLine,
  FileText,
  Send,
  MessageCircle,
  UserPlus,
  GraduationCap,
  BookOpen,
  AlertCircle,
  CreditCard,
  UserCheck,
} from "lucide-react";

export default function FrontOfficeDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [waPhone, setWaPhone] = useState("");
  const [paymentModalStudent, setPaymentModalStudent] = useState(null);
  const [kioskOpen, setKioskOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return new URLSearchParams(window.location.search).get("action") === "attendance";
    } catch {
      return false;
    }
  });
  const toast = useToast();

  const {
    users,
    classes,
    applications,
    todos,
    editId,
    selectedStudent,
    setSelectedStudent,
    formData,
    setFormData,
    handleSave,
    handleEdit,
    handleAddStudent,
    handleDelete,
    handleAddTodo,
    handleDeleteTodo,
    handleToggleTodo,
    getStudentClasses,
    instructors,
    students,
    unenrolledStudents,
    pendingApplications,
    myBranch,
  } = useDashboardData({ restrictedRead: true, setActiveTab, division: "courses" });

  const sendWhatsAppInvite = (phone) => {
    if (!phone) return toast("Please enter a phone number first.", "error");

    // Clean and format phone for international use (62 for Indonesia)
    let cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.startsWith("0")) {
      cleanPhone = "62" + cleanPhone.substring(1);
    }

    const regUrl = window.location.origin + "/register";
    const message = encodeURIComponent(
      `Hello! Greetings from My Liberty school. 🌟 Please complete your student registration here: ${regUrl}`
    );
    window.open(`https://wa.me/${cleanPhone}?text=${message}`, "_blank");
    setWaPhone("");
  };

  const handleEnrollProspect = (inquiry) => {
    const isKindergarten = (inquiry.division || "courses") === "kindergarten";
    const defaultProgId = isKindergarten ? "kids_school" : "english_course";
    const chosenProgId = inquiry.programId || defaultProgId;
    const prog = getProgram(chosenProgId);

    let level = inquiry.currentLevel;
    if (!level) {
      if (isKindergarten) {
        level =
          inquiry.fluencyTier === "intermediate"
            ? "tk_a"
            : inquiry.fluencyTier === "fluent"
              ? "tk_b"
              : "nursery";
      } else {
        level =
          inquiry.fluencyTier === "intermediate"
            ? "master"
            : inquiry.fluencyTier === "fluent"
              ? "epic"
              : "warrior";
      }
    }

    handleAddStudent({
      displayName: inquiry.studentName || "",
      firstName: inquiry.studentName?.split(" ")[0] || "",
      lastName: inquiry.studentName?.split(" ").slice(1).join(" ") || "",
      dob: inquiry.dob || "",
      phone: inquiry.phone || "",
      parentName: inquiry.parentName || "",
      parentPhone: inquiry.phone || "",
      fatherName: inquiry.parentName || "",
      fatherPhone: inquiry.phone || "",
      motherName: inquiry.parentName || "",
      motherPhone: inquiry.phone || "",
      branch: normalizeBranch(inquiry.branch || "Kota Gorontalo"),
      division: normalizeDivision(inquiry.division || "courses"),
      programId: chosenProgId,
      program:
        prog?.label ||
        inquiry.program ||
        (isKindergarten ? "Kids School (Kindergarten)" : "English Course"),
      currentLevel: level || (isKindergarten ? "nursery" : "warrior"),
      placementTests: Array.isArray(inquiry.placementTests) ? inquiry.placementTests : [],
      inquiryId: inquiry.id || "",
      referralSource: "Walk-in Front Desk",
      notes: `Walk-in prospect enrolled directly.${inquiry.notes ? ` Inquired: ${inquiry.notes}` : ""}`,
    });
  };

  const handleSaveAndCollectPayment = async (e) => {
    const savedRecord = await handleSave(e);
    if (savedRecord && savedRecord.id) {
      setPaymentModalStudent(savedRecord);
    }
  };

  const overviewTab = (
    <div className="space-y-6 w-full">
      <WelcomeBanner
        portalLabel="Front Desk Portal"
        roleLabel="Front Office Desk"
        fallbackName="Duty Officer"
        subtitle="Manage front-desk student registrations, class scheduling, parent inquiries, and daily reception attendance."
        stats={[
          {
            label: "Pending Applications",
            value: pendingApplications,
            icon: UserPlus,
            onClick: () => setActiveTab("applications"),
          },
          {
            label: "Active Students",
            value: students.filter(isActiveStudent).length,
            icon: GraduationCap,
            onClick: () => setActiveTab("students"),
          },
          {
            label: "Active Classes",
            value: classes.length,
            icon: BookOpen,
            onClick: () => setActiveTab("classes"),
          },
          {
            label: "Unassigned Students",
            value: unenrolledStudents.length,
            icon: AlertCircle,
            onClick: () => setActiveTab("students"),
          },
        ]}
      />

      {/* Tuition Due / Overdue Alert Widget */}
      <TuitionDueWidget
        students={students}
        onOpenPaymentModal={(student) => setPaymentModalStudent(student)}
        onNavigateToStudents={() => setActiveTab("students")}
      />

      {/* Today's Live Room & Class Board */}
      <TodayScheduleBoard
        classes={classes}
        instructors={instructors}
        onNavigateToClasses={() => setActiveTab("classes")}
      />

      {/* Quick Actions & Walk-in Sender */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-indigo-100 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-indigo-900 font-extrabold text-sm">
            <MessageCircle className="w-4 h-4 text-emerald-600" />
            <span>Walk-in Student Registration</span>
          </div>
          <p className="text-xs text-slate-500 font-medium">
            Send an application form link directly to a parent&apos;s WhatsApp.
          </p>
          <div className="flex gap-2 pt-1">
            <input
              type="tel"
              value={waPhone}
              onChange={(e) => setWaPhone(e.target.value)}
              placeholder="Parent's Phone (e.g. 0812...)"
              className="flex-1 p-2.5 border border-slate-200 rounded-xl text-xs font-semibold bg-slate-50 focus:bg-white focus:border-[#1a3a8f] outline-none transition"
            />
            <button
              onClick={() => sendWhatsAppInvite(waPhone)}
              className="bg-[#25D366] hover:bg-[#20ba59] text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-xs transition flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send Link</span>
            </button>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-extrabold text-slate-800 text-sm">Quick Actions</h4>
            <button
              onClick={handleAddStudent}
              className="text-[11px] font-bold text-[#1a3a8f] hover:underline inline-flex items-center gap-1"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>+ Add Walk-in</span>
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={() => setActiveTab("cashier")}
              className="p-2.5 rounded-xl bg-indigo-50/80 border border-indigo-200/80 text-xs font-bold text-[#1a3a8f] hover:bg-indigo-100 transition flex items-center gap-2"
            >
              <CreditCard className="w-4 h-4 text-[#1a3a8f] shrink-0" />
              <span className="truncate">Desk Cashier</span>
            </button>
            <button
              onClick={() => setActiveTab("inquiries")}
              className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs font-bold text-slate-700 hover:bg-slate-100 transition flex items-center gap-2"
            >
              <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="truncate">Guest Log</span>
            </button>
            <button
              onClick={() => setActiveTab("applications")}
              className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs font-bold text-slate-700 hover:bg-slate-100 transition flex items-center gap-2"
            >
              <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
              <span className="truncate">Applications</span>
            </button>
            <button
              onClick={() => setKioskOpen(true)}
              className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs font-bold text-slate-700 hover:bg-slate-100 transition flex items-center gap-2"
            >
              <ScanLine className="w-4 h-4 text-[#1a3a8f] shrink-0" />
              <span className="truncate">Reception Mode</span>
            </button>
          </div>
        </div>
      </div>

      {/* Available Batches & Capacity Openings */}
      <AvailableBatches
        classes={classes}
        instructors={instructors}
        users={users}
        canEdit={false}
        role="frontoffice"
        isOverviewWidget={true}
        onNavigateToClasses={() => setActiveTab("classes")}
      />
    </div>
  );

  const tabs = [
    { id: "overview", label: "Overview", component: overviewTab },
    {
      id: "cashier",
      label: "Cashier & Finance",
      icon: CreditCard,
      component: (
        <PaymentCashierTab
          students={students}
          branchLabel={myBranch}
        />
      ),
    },
    {
      id: "inquiries",
      label: "Guestbook & Inquiries",
      icon: UserCheck,
      component: (
        <WalkInInquiryTab
          division="courses"
          branchLabel={myBranch}
          onEnrollStudent={handleEnrollProspect}
        />
      ),
    },
    {
      id: "applications",
      label: "Applications",
      badge: pendingApplications > 0 ? pendingApplications : null,
      component: (
        <StudentApplications
          applications={applications}
          classes={classes}
          users={users}
          onApproveAndEdit={handleEdit}
          onViewStudent={handleEdit}
        />
      ),
    },
    {
      id: "students",
      label: "Students",
      component: (
        <StudentRoster
          students={students}
          classes={classes}
          users={users}
          getStudentClasses={getStudentClasses}
          setSelectedStudent={setSelectedStudent}
          handleEdit={handleEdit}
          handleDelete={handleDelete}
          handleAddStudent={handleAddStudent}
          canEditStatus={false}
        />
      ),
    },
    {
      id: "classes",
      label: "Classes",
      component: (
        <ClassManager
          classes={classes}
          users={users}
          instructors={instructors}
          unenrolledStudents={unenrolledStudents}
          role="frontoffice"
          isAdmin={false}
        />
      ),
    },
    {
      id: "events",
      label: "Events",
      component: <CorporateEventsPanel />,
    },
    {
      id: "reports",
      label: "Reports",
      component: (
        <FrontOfficeReportsTab
          myBranch={myBranch}
          students={students}
        />
      ),
    },
    {
      id: "approvals",
      label: "Approvals",
      component: (
        <ApprovalInbox
          userRole="frontoffice"
          branchId={myBranch}
          title="Front Desk Operational Approvals"
          subtitle="Dual-control authorization requests for desk operations and instructor escalations."
        />
      ),
    },
    {
      id: "misc",
      label: "Tasks",
      badge: todos.filter((t) => !t.completed).length || null,
      component: (
        <TasksPanel
          todos={todos}
          users={users}
          currentUser={auth.currentUser}
          onAddTodo={handleAddTodo}
          onDeleteTodo={handleDeleteTodo}
          onToggleTodo={handleToggleTodo}
        />
      ),
    },
    { id: "aiAssistant", label: "AI Assistant", component: <AIAssistant /> },
    {
      id: "addUser",
      label: editId ? "Edit Student" : "Add Student",
      hidden: true,
      component: (
        <UserForm
          formData={formData}
          setFormData={setFormData}
          editId={editId}
          onSubmit={handleSave}
          onSaveAndCollectPayment={handleSaveAndCollectPayment}
        />
      ),
    },
  ];

  return (
    <div className="p-5 bg-[#f0f2f5] rounded-2xl min-h-[500px]">
      <DashboardShell
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        title="Front Office"
        extraSidebarContent={
          <KioskSidebarButton onClick={() => setKioskOpen(true)} label="Reception Kiosk" />
        }
      />

      {/* Standalone Full-Screen Kiosk Station */}
      <KioskModal
        isOpen={kioskOpen}
        onClose={() => setKioskOpen(false)}
        title="Front Office Student Scan Station"
        studentsOnly={true}
      />

      {/* ID Badge Modal */}
      <BadgeModal person={selectedStudent} onClose={() => setSelectedStudent(null)} />

      {/* Direct PaymentModal from Overview Due Widget */}
      {paymentModalStudent && (
        <PaymentModal
          student={paymentModalStudent}
          onClose={() => setPaymentModalStudent(null)}
        />
      )}
    </div>
  );
}
