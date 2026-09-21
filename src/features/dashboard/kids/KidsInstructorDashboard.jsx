import { useState, useMemo, useEffect } from "react";
import { useInstructorRoster } from "../useInstructorRoster";
import { AIAssistant, DashboardShell } from "../../shared";
import { KioskModal, KioskSidebarButton } from "../../attendance";
import { TeachingMaterial, ClassPhotoShare } from "../../classes";
import { ReportsDashboard } from "../../reports";
import { useStaffDirectives, StaffDirectivesWidget } from "../../staff";
import { db } from "../../../firebase";
import { collection, onSnapshot } from "firebase/firestore";
import {
  InstructorOverview,
  InstructorClasses,
  InstructorProgress,
} from "../instructor";
import { matchesDivisionFilter, divisionOfProgram } from "../../../constants/divisions";

export default function KidsInstructorDashboard() {
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

  const { classes: rawClasses, students: rawStudents, instructorName } = useInstructorRoster();

  // Kindergarten instructors only see kindergarten learners and classes
  const classes = useMemo(
    () =>
      rawClasses.filter((c) =>
        matchesDivisionFilter(c.division || divisionOfProgram(c.programId || c.program), "kindergarten")
      ),
    [rawClasses]
  );

  const students = useMemo(
    () =>
      rawStudents.filter((s) =>
        matchesDivisionFilter(s.division || divisionOfProgram(s.programId || s.program), "kindergarten")
      ),
    [rawStudents]
  );

  // All kindergarten classes for coverage & reference
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
      /** @type {any[]} */
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setAllClasses(
        all.filter((c) =>
          matchesDivisionFilter(c.division || divisionOfProgram(c.programId || c.program), "kindergarten")
        )
      );
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
          roleLabel="Kindergarten Teachers"
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
    {
      id: "reports",
      label: "Reports",
      component: <ReportsDashboard division="kindergarten" />,
    },
    { id: "ai", label: "AI Assistant", component: <AIAssistant /> },
  ];

  return (
    <div className="p-5 bg-[#f0f2f5] rounded-2xl min-h-[500px]">
      <DashboardShell
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        title="Kids School — Teacher Portal"
        extraSidebarContent={
          <div className="space-y-2">
            <div className="px-2 pt-1">
              <span className="inline-flex items-center gap-1.5 bg-cyan-50 text-cyan-800 text-[11px] font-black px-2.5 py-0.5 rounded-full border border-cyan-200">
                Kindergarten Division
              </span>
            </div>
            <KioskSidebarButton onClick={() => setKioskOpen(true)} label="Attendance & Kiosk" />
          </div>
        }
      />

      <KioskModal
        isOpen={kioskOpen}
        onClose={() => setKioskOpen(false)}
        title="Kids School Attendance Scanner"
        studentsOnly={true}
        extraContent={<ClassPhotoShare />}
        initialScrollToExtra={isClassPhotoAction}
      />
    </div>
  );
}
