import { useState } from "react";
import { auth } from "../../../firebase";
import { useDashboardData } from "../useDashboardData";
import { AIAssistant, DashboardShell, WelcomeBanner, useToast } from "../../shared";
import { ReportsDashboard } from "../../reports";
import {
  StudentApplications,
  StudentRoster,
  UserForm,
  BadgeModal,
  isActiveStudent,
} from "../../students";
import { KioskModal, KioskSidebarButton } from "../../attendance";
import { ClassManager } from "../../classes";
import { TasksPanel } from "../../staff";
import {
  ScanLine,
  Send,
  MessageCircle,
  UserPlus,
  GraduationCap,
  BookOpen,
  AlertCircle,
  Sparkles,
} from "lucide-react";

export default function KidsFrontOfficeDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [waPhone, setWaPhone] = useState("");
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
  } = useDashboardData({
    restrictedRead: true,
    setActiveTab,
    division: "kindergarten",
  });

  const sendWhatsAppInvite = (phone) => {
    if (!phone) return toast("Please enter a phone number first.", "error");

    let cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.startsWith("0")) {
      cleanPhone = "62" + cleanPhone.substring(1);
    }

    const regUrl = window.location.origin + "/register";
    const message = encodeURIComponent(
      `Hello! Greetings from MY LIBERTY Kids School (Kindergarten). 🌟 Please complete your child's registration application here: ${regUrl}`
    );
    window.open(`https://wa.me/${cleanPhone}?text=${message}`, "_blank");
    setWaPhone("");
  };

  const overviewTab = (
    <div className="space-y-6 w-full">
      <WelcomeBanner
        portalLabel="Kids School Front Desk"
        roleLabel="Kindergarten Front Office"
        fallbackName="Duty Officer"
        subtitle="Manage early childhood admissions, Nursery & TK classes, parent communications, and reception attendance."
        stats={[
          {
            label: "Pending Applications",
            value: pendingApplications,
            icon: UserPlus,
            onClick: () => setActiveTab("applications"),
          },
          {
            label: "Active Children",
            value: students.filter(isActiveStudent).length,
            icon: GraduationCap,
            onClick: () => setActiveTab("students"),
          },
          {
            label: "TK & Nursery Cohorts",
            value: classes.length,
            icon: BookOpen,
            onClick: () => setActiveTab("classes"),
          },
          {
            label: "Unassigned Children",
            value: unenrolledStudents.length,
            icon: AlertCircle,
            onClick: () => setActiveTab("students"),
          },
        ]}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-cyan-100 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-cyan-900 font-extrabold text-sm">
            <MessageCircle className="w-4 h-4 text-emerald-600" />
            <span>Walk-in Child Registration</span>
          </div>
          <p className="text-xs text-slate-500 font-medium">
            Send an application link directly to a parent's WhatsApp for Nursery, TK-A, or TK-B admission.
          </p>
          <div className="flex gap-2 pt-1">
            <input
              type="tel"
              value={waPhone}
              onChange={(e) => setWaPhone(e.target.value)}
              placeholder="Parent's WhatsApp (e.g. 0812...)"
              className="flex-1 p-2.5 border border-slate-200 rounded-xl text-xs font-semibold bg-slate-50 focus:bg-white focus:border-[#1a3a8f] outline-none transition"
            />
            <button
              onClick={() => sendWhatsAppInvite(waPhone)}
              className="bg-[#25D366] hover:bg-[#20ba59] text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send Link</span>
            </button>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-slate-800 font-extrabold text-sm">
              <Sparkles className="w-4 h-4 text-cyan-600" />
              <span>Kindergarten Schedule Policy</span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Kids School operates on a formal academic schedule: <strong>Monday to Friday (Mon–Fri)</strong> daily. Saturday and Sunday are strictly OFF.
            </p>
          </div>
          <div className="pt-3">
            <button
              onClick={() => setKioskOpen(true)}
              className="w-full py-2.5 px-4 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border border-cyan-200 rounded-xl font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <ScanLine className="w-4 h-4 text-cyan-600" />
              <span>Launch Daily Kiosk Station</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const tabs = [
    { id: "overview", label: "Overview", component: overviewTab },
    {
      id: "applications",
      label: "Applications",
      badge: pendingApplications || null,
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
      label: "Learners",
      badge: unenrolledStudents.length ? `${unenrolledStudents.length} unassigned` : null,
      badgeDot: unenrolledStudents.length > 0,
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
      label: "Classes & Rooms",
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
      id: "reports",
      label: "Reports",
      component: (
        <ReportsDashboard isAdminView={false} isFrontOffice={true} division="kindergarten" />
      ),
    },
    {
      id: "tasks",
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
      label: editId ? "Edit Learner" : "Register Learner",
      hidden: true,
      component: (
        <UserForm
          formData={formData}
          setFormData={setFormData}
          editId={editId}
          onSubmit={handleSave}
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
        title="Kids School — Front Desk"
        extraSidebarContent={
          <div className="space-y-2">
            <div className="px-2 pt-1">
              <span className="inline-flex items-center gap-1.5 bg-cyan-50 text-cyan-800 text-[11px] font-black px-2.5 py-0.5 rounded-full border border-cyan-200">
                Kindergarten Division
              </span>
            </div>
            <KioskSidebarButton onClick={() => setKioskOpen(true)} label="Reception Kiosk" />
          </div>
        }
      />

      <KioskModal
        isOpen={kioskOpen}
        onClose={() => setKioskOpen(false)}
        title="Kids School Reception Scanner"
        studentsOnly={true}
      />

      {selectedStudent && (
        <BadgeModal person={selectedStudent} onClose={() => setSelectedStudent(null)} />
      )}
    </div>
  );
}
