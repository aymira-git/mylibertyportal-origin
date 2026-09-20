import { useState } from "react";
import { auth } from "../../firebase";
import { useDashboardData } from "./useDashboardData";
import { AIAssistant, DashboardShell, WelcomeBanner } from "../shared";
import { UserPlus, GraduationCap, BookOpen, AlertCircle, ArrowRight } from "lucide-react";
import { ReportsDashboard } from "../reports";
import { StudentApplications, UserForm, StudentRoster, BadgeModal } from "../students";
import { AttendanceManager } from "../attendance";
import { ClassManager, AvailableBatches } from "../classes";
import { StaffDirectory, InvitesPanel, TasksPanel } from "../staff";

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("overview");

  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  const {
    users, classes, applications, invites, todos,
    editId, selectedStudent, setSelectedStudent,
    formData, setFormData,
    handleSave, handleEdit, handleAddStaff, handleAddStudent, handleDelete,
    handleAddTodo, handleDeleteTodo, handleToggleTodo,
    handleCreateInvite, handleDeleteInvite,
    getStudentClasses, instructors, students, unenrolledStudents, pendingApplications,
  } = useDashboardData({ setActiveTab: handleTabChange });

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
            value: students.filter((s) => (s.status || "active") === "active").length,
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
            {users.filter(user => user.role !== "student" && (user.status || "active") === "active").length} active staff · {instructors.filter(i => (i.status || "active") === "active").length} active instructors
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

  const tabs = [
    { id: "overview", label: "Overview", component: overviewTab },
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
    {
      id: "kiosk",
      label: "Attendance",
      component: <AttendanceManager users={users} instructors={instructors} />,
    },
    {
      id: "directory",
      label: "Staff",
      component: (
        <StaffDirectory
          users={users}
          classes={classes}
          invites={invites}
          currentUserId={auth.currentUser?.uid}
          onAddStaff={handleAddStaff}
          onEditStaff={handleEdit}
          onPrintBadge={setSelectedStudent}
          onDeleteStaff={handleDelete}
          onNavigateToInvites={() => handleTabChange("invites")}
        />
      ),
    },
    {
      id: "invites",
      label: "Invites",
      component: (
        <InvitesPanel
          invites={invites}
          users={users}
          onCreateInvite={handleCreateInvite}
          onDeleteInvite={handleDeleteInvite}
        />
      ),
    },
    { id: "reports", label: "Reports", component: <ReportsDashboard isAdminView={true} isFrontOffice={false} /> },
    {
      id: "misc",
      label: "Tasks",
      badge: todos.filter(t => !t.completed).length || null,
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
