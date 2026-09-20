import { useState, useMemo, useEffect } from "react";
import { useInstructorRoster } from "./useInstructorRoster";
import { AIAssistant, DashboardShell } from "../shared";
import { KioskModal, KioskSidebarButton } from "../attendance";
import { ClassPhotoShare, TeachingMaterial } from "../classes";
import { ReportsDashboard } from "../reports";
import { useStaffDirectives, StaffDirectivesWidget } from "../staff";
import { db } from "../../firebase";
import { collection, onSnapshot } from "firebase/firestore";
import {
  InstructorOverview,
  InstructorClasses,
  InstructorProgress,
  uniqueClasses,
} from "./instructor";

export default function InstructorDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const isClassPhotoAction = useMemo(() => {
    if (typeof window === "undefined") return false;
    try {
      return new URLSearchParams(window.location.search).get("action") === "class-photo";
    } catch {
      return false;
    }
  }, []);
  const [kioskOpen, setKioskOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      const action = new URLSearchParams(window.location.search).get("action");
      return action === "attendance" || action === "class-photo";
    } catch {
      return false;
    }
  });
  const [selectedClassFilter, setSelectedClassFilter] = useState("all");

  const { classes: rawClasses, students, instructorName } = useInstructorRoster();
  const classes = useMemo(() => uniqueClasses(rawClasses), [rawClasses]);
  const [allClasses, setAllClasses] = useState([]);

  const {
    activeDirectives,
    completedDirectives,
    pendingCount: pendingDirectivesCount,
    loading: directivesLoading,
    handleToggle: handleToggleDirective,
  } = useStaffDirectives("instructor");

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "classes"), (snap) => {
      setAllClasses(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const tabs = [
    {
      id: "overview",
      label: "Overview",
      component: (
        <InstructorOverview
          classes={classes}
          students={students}
          instructorName={instructorName}
          onNavigate={setActiveTab}
          onOpenKiosk={() => setKioskOpen(true)}
          onSelectClass={(classId) => setSelectedClassFilter(classId)}
          allClasses={allClasses}
        />
      ),
    },
    {
      id: "directives",
      label: "Directives",
      badge: pendingDirectivesCount || null,
      component: (
        <StaffDirectivesWidget
          activeDirectives={activeDirectives}
          completedDirectives={completedDirectives}
          loading={directivesLoading}
          onToggle={handleToggleDirective}
          roleLabel="Faculty & Instructors"
        />
      ),
    },
    {
      id: "classes",
      label: "My Classes",
      component: (
        <InstructorClasses
          selectedClassFilter={selectedClassFilter}
          setSelectedClassFilter={setSelectedClassFilter}
          allClasses={allClasses}
        />
      ),
    },
    { id: "progress", label: "Student Progress", component: <InstructorProgress /> },
    { id: "materials", label: "Lesson Materials", component: <TeachingMaterial /> },
    { id: "reports", label: "Reports", component: <ReportsDashboard /> },
    { id: "ai", label: "AI Assistant", component: <AIAssistant /> },
  ];

  return (
    <div className="p-5 bg-[#f0f2f5] rounded-2xl min-h-[500px]">
      <DashboardShell
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        title="Instructor Portal"
        extraSidebarContent={
          <KioskSidebarButton
            onClick={() => setKioskOpen(true)}
            label="Attendance & Kiosk"
          />
        }
      />

      {/* Standalone Full-Screen Kiosk Station with ClassPhotoShare */}
      <KioskModal
        isOpen={kioskOpen}
        onClose={() => setKioskOpen(false)}
        title="Student Attendance Scanner"
        studentsOnly={true}
        extraContent={<ClassPhotoShare />}
        initialScrollToExtra={isClassPhotoAction}
      />
    </div>
  );
}
