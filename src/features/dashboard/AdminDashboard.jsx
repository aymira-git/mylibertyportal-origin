import { useState } from "react";
import { useDashboardData } from "./useDashboardData";
import { AIAssistant, DashboardShell, WelcomeBanner } from "../shared";
import { UserPlus, GraduationCap, BookOpen, AlertCircle, ArrowRight } from "lucide-react";
import { ReportsDashboard } from "../reports";
import { StudentApplications, UserForm, StudentRoster, BadgeModal } from "../students";
import { Kiosk } from "../attendance";
import { ClassManager, AvailableBatches } from "../classes";
import { InvitesPanel, TasksPanel } from "../staff";

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [filterRole, setFilterRole] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // 👈 The old sidebar button reset filterRole to "all" inline on click.
  // DashboardShell's buttons don't carry per-tab side effects, so this
  // replicates the same behavior: reset whenever Staff Directory becomes active.
  // Done directly in the tab-change handler (not a useEffect) so the two
  // state updates land in the same render instead of cascading.
  const handleTabChange = (tab) => {
    if (tab === "directory") setFilterRole("all");
    setActiveTab(tab);
  };

  const {
    users, classes, invites, todos,
    editId, selectedStudent, setSelectedStudent,
    formData, setFormData,
    handleSave, handleEdit, handleAddStaff, handleAddStudent, handleDelete,
    handleAddTodo, handleDeleteTodo,
    handleCreateInvite, handleDeleteInvite,
    getStudentClasses, instructors, students, unenrolledStudents, pendingApplications,
  } = useDashboardData({ setActiveTab: handleTabChange });

  const filteredUsers = users
    .filter(u => u.role !== "student" && u.role !== "admin") // Staff Directory is for regular academic & operations staff
    .filter(u => filterRole === "all" || u.role === filterRole)
    .filter(u => {
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      return (u.displayName || "").toLowerCase().includes(q) || (u.phone || "").includes(q);
    });

  const overviewTab = (
    <div className="space-y-6 max-w-6xl mx-auto">
      <WelcomeBanner
        portalLabel="Administrative Portal"
        roleLabel="System Administrator"
        fallbackName="Administrator"
        subtitle="Full administrative control of academy enrollments, staff assignments, academic cohorts, and school curriculum."
        stats={[
          {
            label: "Pending Applications",
            value: pendingApplications,
            icon: UserPlus,
            onClick: () => handleTabChange("applications"),
          },
          {
            label: "Active Students",
            value: students.length,
            icon: GraduationCap,
            onClick: () => handleTabChange("students"),
          },
          {
            label: "Active Classes",
            value: classes.length,
            icon: BookOpen,
            onClick: () => handleTabChange("classes"),
          },
          {
            label: "Unassigned Students",
            value: unenrolledStudents.length,
            icon: AlertCircle,
            onClick: () => handleTabChange("students"),
          },
        ]}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <h4 className="font-bold text-slate-800">Quick actions</h4>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <button
              onClick={() => handleTabChange("applications")}
              className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs font-bold text-slate-700 hover:bg-slate-100 transition text-left flex items-center justify-between cursor-pointer"
            >
              <span>Review applications</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            </button>
            <button
              onClick={() => handleAddStaff()}
              className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs font-bold text-slate-700 hover:bg-slate-100 transition text-left flex items-center justify-between cursor-pointer"
            >
              <span>Add staff</span>
              <UserPlus className="w-3.5 h-3.5 text-slate-400" />
            </button>
            <button
              onClick={() => handleTabChange("classes")}
              className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs font-bold text-slate-700 hover:bg-slate-100 transition text-left flex items-center justify-between cursor-pointer"
            >
              <span>Manage classes</span>
              <BookOpen className="w-3.5 h-3.5 text-slate-400" />
            </button>
            <button
              onClick={() => handleTabChange("reports")}
              className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs font-bold text-slate-700 hover:bg-slate-100 transition text-left flex items-center justify-between cursor-pointer"
            >
              <span>Open reports</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <h4 className="font-bold text-slate-800">Staff snapshot</h4>
          <p className="text-xs text-slate-500 mt-2 font-medium">
            {users.filter(user => user.role !== "student" && user.role !== "admin").length} staff profiles · {instructors.length} instructors
          </p>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            {invites.filter(inv => !inv.used).length} pending invitations · {todos.filter(todo => todo.isPinned || todo.type === "deadline").length} pinned tasks
          </p>
        </div>
      </div>

      {/* Available Batches & Capacity Overview */}
      <AvailableBatches
        classes={classes}
        instructors={instructors}
        users={users}
        canEdit={true}
        role="admin"
        isOverviewWidget={true}
        onNavigateToClasses={() => handleTabChange("classes")}
      />
    </div>
  );

  const directoryTab = (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-150 max-w-6xl mx-auto">
      <h3 className="font-bold text-slate-800 text-base mb-3">Staff Directory</h3>
      <input
        type="text"
        placeholder="🔍 Search by name or phone..."
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        className="w-full p-2.5 border rounded-lg mb-3 text-sm"
      />
      <div className="flex gap-1.5 mb-4 flex-wrap text-[10px] font-bold">
        {["all", "instructor", "manager", "marketing", "frontoffice", "officeboy"].map(r => (
          <button
            key={r}
            onClick={() => setFilterRole(r)}
            className={`px-3 py-1.5 rounded-lg transition uppercase ${filterRole === r ? "bg-[#1a3a8f] text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
          >
            {r === "officeboy" ? "Office Boy" : r === "frontoffice" ? "Front Office" : r}
          </button>
        ))}
      </div>
      <div className="space-y-2 max-h-[450px] overflow-y-auto">
        {filteredUsers.map(u => (
          <div key={u.id} className="flex justify-between items-start p-3.5 bg-slate-50/50 rounded-xl text-xs border border-slate-150 gap-1.5 hover:bg-slate-50 transition">
            <div className="space-y-1">
              <div className="flex gap-2.5 items-center">
                <span className="bg-[#1a3a8f]/10 text-[#1a3a8f] px-2 py-0.5 rounded uppercase font-bold text-[9px]">{u.role}</span>
                <p className="font-bold text-slate-800">{u.displayName}</p>
              </div>
              <p className="text-slate-500">Email: {u.email} | Phone: {u.phone || "N/A"}</p>
              <p className="text-slate-500">DOB: {u.dob || "N/A"} | Education: {u.educationLevel || "N/A"}</p>
            </div>
            <div className="flex gap-1.5">
              <button onClick={() => setSelectedStudent(u)} className="bg-green-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-green-700 transition">Print Badge</button>
              <button onClick={() => handleEdit(u)} className="bg-blue-500 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-blue-600 transition">Edit</button>
              <button onClick={() => handleDelete(u.id)} className="bg-red-500 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-red-600 transition">Delete</button>
            </div>
          </div>
        ))}
      </div>
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
          role="admin"
          isAdmin={true}
        />
      ),
    },
    { id: "kiosk", label: "Attendance", component: <Kiosk title="Office Reception Kiosk Station" staffOnly={true} /> },
    { id: "directory", label: "Staff", component: directoryTab },
    {
      id: "invites",
      label: "Invites",
      component: (
        <InvitesPanel invites={invites} onCreateInvite={handleCreateInvite} onDeleteInvite={handleDeleteInvite} />
      ),
    },
    { id: "reports", label: "Reports", component: <ReportsDashboard isAdminView={true} isFrontOffice={false} /> },
    {
      id: "misc",
      label: "Tasks",
      badge: todos.filter(t => !t.completed).length || null,
      component: (
        <TasksPanel todos={todos} onAddTodo={handleAddTodo} onDeleteTodo={handleDeleteTodo} />
      ),
    },
    { id: "aiAssistant", label: "AI Assistant", component: <AIAssistant /> },
    // 👈 Not a nav destination — only reached via "Edit"/"Add staff" above,
    // which is why it's marked hidden instead of getting a sidebar button.
    {
      id: "addUser", label: "Add / Edit User", hidden: true, component: (
        <UserForm formData={formData} setFormData={setFormData} editId={editId} onSubmit={handleSave} />
      )
    },
  ];

  return (
    <div className="p-5 bg-[#f0f2f5] rounded-2xl min-h-[500px]">
      <DashboardShell tabs={tabs} activeTab={activeTab} onTabChange={handleTabChange} title="Admin Panel" />

      {/* ID Badge Modal */}
      <BadgeModal
        person={selectedStudent}
        onClose={() => setSelectedStudent(null)}
      />
    </div>
  );
}
