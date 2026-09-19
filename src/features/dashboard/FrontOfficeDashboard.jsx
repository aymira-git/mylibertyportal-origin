import { useState } from "react";
import { useDashboardData } from "./useDashboardData";
import { AIAssistant, DashboardShell, WelcomeBanner, useToast } from "../shared";
import { ReportsDashboard } from "../reports";
import { StudentApplications, StudentRoster, UserForm, BadgeModal } from "../students";
import { Kiosk } from "../attendance";
import { ClassManager, AvailableBatches } from "../classes";
import { TasksPanel } from "../staff";
import {
  ScanLine,
  FileText,
  School,
  BarChart3,
  Send,
  MessageCircle,
  Sparkles,
  UserPlus,
  GraduationCap,
  BookOpen,
  AlertCircle
} from "lucide-react";

export default function FrontOfficeDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [receptionMode, setReceptionMode] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return new URLSearchParams(window.location.search).get("action") === "attendance";
    } catch {
      return false;
    }
  });
  const toast = useToast();

  const {
    users, classes, todos,
    editId, selectedStudent, setSelectedStudent,
    formData, setFormData,
    handleSave, handleEdit, handleAddStudent, handleDelete,
    handleAddTodo, handleDeleteTodo,
    getStudentClasses, instructors, students, unenrolledStudents, pendingApplications,
  } = useDashboardData({ restrictedRead: true, setActiveTab });

  const sendWhatsAppInvite = (phone) => {
    if (!phone) return toast("Please enter a phone number first.", "error");

    // Clean and format phone for international use (62 for Indonesia)
    let cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.startsWith("0")) {
      cleanPhone = "62" + cleanPhone.substring(1);
    }

    const regUrl = window.location.origin + "/register";
    const message = encodeURIComponent(`Hello! Greetings from My Liberty school. 🌟 Please complete your student registration here: ${regUrl}`);
    window.open(`https://wa.me/${cleanPhone}?text=${message}`, "_blank");
  };

  // Full-screen takeover — deliberately rendered before DashboardShell, same
  // as before, since Reception Mode replaces the whole workspace including
  // the sidebar, not just the content pane.
  if (receptionMode) {
    return (
      <div className="fixed inset-0 z-[1000] bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex flex-col items-center justify-center p-4 sm:p-6 overflow-y-auto">
        <div className="w-full max-w-xl flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-white">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Live Reception Desk Station
            </span>
          </div>
          <button
            onClick={() => setReceptionMode(false)}
            className="bg-white/10 hover:bg-white/20 text-white px-3.5 py-1.5 rounded-xl font-bold text-xs transition border border-white/10 flex items-center gap-1.5"
          >
            <span>Exit Fullscreen</span>
          </button>
        </div>
        <div className="w-full max-w-xl">
          <Kiosk title="Front Office Student Scan Station" studentsOnly={true} />
        </div>
      </div>
    );
  }

  const overviewTab = (
    <div className="space-y-6 max-w-6xl mx-auto">
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
            value: students.length,
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-indigo-100 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-indigo-900 font-extrabold text-sm">
            <MessageCircle className="w-4 h-4 text-emerald-600" />
            <span>Walk-in Student Registration</span>
          </div>
          <p className="text-xs text-slate-500 font-medium">Send an application form link directly to a parent&apos;s WhatsApp.</p>
          <div className="flex gap-2 pt-1">
            <input
              type="tel"
              id="wa-phone"
              placeholder="Parent's Phone (e.g. 0812...)"
              className="flex-1 p-2.5 border border-slate-200 rounded-xl text-xs font-semibold bg-slate-50 focus:bg-white focus:border-[#1a3a8f] outline-none transition"
            />
            <button
              onClick={() => sendWhatsAppInvite(document.getElementById("wa-phone").value)}
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
              onClick={() => setActiveTab("applications")}
              className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs font-bold text-slate-700 hover:bg-slate-100 transition flex items-center gap-2"
            >
              <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
              <span className="truncate">Applications</span>
            </button>
            <button
              onClick={() => setActiveTab("classes")}
              className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs font-bold text-slate-700 hover:bg-slate-100 transition flex items-center gap-2"
            >
              <School className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="truncate">Manage Classes</span>
            </button>
            <button
              onClick={() => setActiveTab("reports")}
              className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs font-bold text-slate-700 hover:bg-slate-100 transition flex items-center gap-2"
            >
              <BarChart3 className="w-4 h-4 text-blue-600 shrink-0" />
              <span className="truncate">Open Reports</span>
            </button>
            <button
              onClick={() => setReceptionMode(true)}
              className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-200/80 text-xs font-bold text-[#1a3a8f] hover:bg-indigo-100 transition flex items-center gap-2"
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
        canEdit={true}
        role="frontoffice"
        isOverviewWidget={true}
        onNavigateToClasses={() => setActiveTab("classes")}
      />
    </div>
  );

  const tabs = [
    { id: "overview", label: "Overview", component: overviewTab },
    {
      id: "applications",
      label: "Applications",
      badge: pendingApplications > 0 ? pendingApplications : null,
      component: <StudentApplications />,
    },
    {
      id: "students",
      label: "Students",
      component: (
        <StudentRoster
          students={students}
          getStudentClasses={getStudentClasses}
          setSelectedStudent={setSelectedStudent}
          handleEdit={handleEdit}
          handleDelete={handleDelete}
          handleAddStudent={handleAddStudent}
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
        />
      ),
    },
    { id: "reports", label: "Reports", component: <ReportsDashboard isAdminView={false} isFrontOffice={true} /> },
    {
      id: "misc",
      label: "Tasks",
      badge: todos.filter(t => !t.completed).length || null,
      component: (
        <TasksPanel todos={todos} onAddTodo={handleAddTodo} onDeleteTodo={handleDeleteTodo} />
      ),
    },
    { id: "aiAssistant", label: "AI Assistant", component: <AIAssistant /> },
    // 👈 Not in the sidebar — reachable via "Add Student" and via "Edit" on a
    // student in the roster (both go through handleAddStudent/handleEdit,
    // which always set role: "student"). UserForm locks the Role field to a
    // read-only badge whenever formData.role === "student" (add OR edit), so
    // this can never expose the staff-role picker or create staff accounts.
    {
      id: "addUser", label: editId ? "Edit Student" : "Add Student", hidden: true, component: (
        <UserForm formData={formData} setFormData={setFormData} editId={editId} onSubmit={handleSave} />
      )
    },
  ];

  const launchReceptionButton = (
    <button
      onClick={() => setReceptionMode(true)}
      className="w-full px-3 py-2.5 rounded-xl text-left font-extrabold text-xs bg-[#1a3a8f] text-white shadow-sm hover:bg-[#122b6e] transition flex items-center justify-between gap-2 border border-indigo-400/30 group cursor-pointer"
    >
      <div className="flex items-center gap-2">
        <ScanLine className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
        <span>Reception Kiosk</span>
      </div>
      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
    </button>
  );

  return (
    <div className="p-5 bg-[#f0f2f5] rounded-2xl min-h-[500px]">
      <DashboardShell
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        title="Front Office"
        extraSidebarContent={launchReceptionButton}
      />

      {/* ID Badge Modal */}
      <BadgeModal
        person={selectedStudent}
        onClose={() => setSelectedStudent(null)}
      />
    </div>
  );
}
