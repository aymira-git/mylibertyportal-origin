import { useMemo } from "react";
import { auth } from "../../../firebase";
import { LevelBadge, WelcomeBanner } from "../../shared";
import { AvailableBatches } from "../../classes";
import { TuitionDueWidget } from "../frontoffice";
import {
  BookOpen,
  Users,
  FileText,
  Clock,
  GraduationCap,
  FolderOpen,
  ArrowRight,
  Info,
  Calendar,
  MapPin,
  ExternalLink,
} from "lucide-react";

export default function InstructorOverview({
  classes,
  students,
  instructorName,
  onNavigate,
  onOpenKiosk,
  onSelectClass,
  allClasses = [],
}) {
  const enrolledIds = useMemo(
    () => new Set(classes.flatMap((cls) => cls.studentIds || [])),
    [classes]
  );
  const enrolledStudents = useMemo(
    () => students.filter((student) => enrolledIds.has(student.id)),
    [students, enrolledIds]
  );
  const worksheets = useMemo(() => classes.filter((cls) => cls.worksheetUrl), [classes]);

  return (
    <div className="space-y-6 w-full">
      {/* ── Welcome Banner ── */}
      <WelcomeBanner
        portalLabel="Faculty Portal"
        roleLabel="Active Instructor"
        userName={instructorName}
        fallbackName="Teacher"
        subtitle="Manage your student cohorts, record CEFR evaluations, and track class attendance."
        stats={[
          {
            label: "Teaching Cohorts",
            value: classes.length,
            icon: BookOpen,
          },
          {
            label: "Enrolled Students",
            value: enrolledStudents.length,
            icon: Users,
          },
          {
            label: "Syllabi & Materials",
            value: worksheets.length,
            icon: FileText,
          },
        ]}
      />

      {/* ── Tuition Due / Expiry Alerts for Enrolled Students ── */}
      <TuitionDueWidget
        students={enrolledStudents}
        onNavigateToStudents={() => onNavigate("classes")}
      />

      {/* ── Quick Action Shortcuts ── */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-3">
        <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">
          Instructor Quick Actions
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <button
            onClick={onOpenKiosk}
            className="p-3 bg-slate-50 hover:bg-indigo-50/60 border border-slate-200/80 hover:border-indigo-200 rounded-2xl text-left transition group cursor-pointer"
          >
            <Clock className="w-4 h-4 text-[#1a3a8f] mb-1.5 group-hover:scale-110 transition-transform" />
            <p className="font-extrabold text-xs text-slate-800">Scan Attendance</p>
            <p className="text-[10px] text-slate-500">Student QR scanner</p>
          </button>

          <button
            onClick={() => onNavigate("progress")}
            className="p-3 bg-slate-50 hover:bg-indigo-50/60 border border-slate-200/80 hover:border-indigo-200 rounded-2xl text-left transition group"
          >
            <GraduationCap className="w-4 h-4 text-emerald-600 mb-1.5 group-hover:scale-110 transition-transform" />
            <p className="font-extrabold text-xs text-slate-800">Evaluate Student</p>
            <p className="text-[10px] text-slate-500">Record CEFR report</p>
          </button>

          <button
            onClick={() => onNavigate("classes")}
            className="p-3 bg-slate-50 hover:bg-indigo-50/60 border border-slate-200/80 hover:border-indigo-200 rounded-2xl text-left transition group"
          >
            <Users className="w-4 h-4 text-blue-600 mb-1.5 group-hover:scale-110 transition-transform" />
            <p className="font-extrabold text-xs text-slate-800">Class Rosters</p>
            <p className="text-[10px] text-slate-500">View enrolled cohorts</p>
          </button>

          <button
            onClick={() => onNavigate("materials")}
            className="p-3 bg-slate-50 hover:bg-indigo-50/60 border border-slate-200/80 hover:border-indigo-200 rounded-2xl text-left transition group"
          >
            <FolderOpen className="w-4 h-4 text-amber-600 mb-1.5 group-hover:scale-110 transition-transform" />
            <p className="font-extrabold text-xs text-slate-800">Lesson Resources</p>
            <p className="text-[10px] text-slate-500">Curriculum & links</p>
          </button>
        </div>
      </div>

      {/* ── Assigned Cohort Cards ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-extrabold text-slate-800 text-sm">
            My Assigned Teaching Cohorts ({classes.length})
          </h4>
          <button
            onClick={() => onNavigate("classes")}
            className="text-xs font-bold text-[#1a3a8f] hover:underline flex items-center gap-1"
          >
            <span>View All in Roster</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {classes.length === 0 ? (
          <div className="bg-white p-8 rounded-3xl border border-dashed border-slate-200 text-center space-y-2">
            <Info className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="font-bold text-slate-700 text-sm">No Cohorts Assigned</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              You do not have any active teaching batches assigned to your profile yet. Please
              contact administration for class scheduling.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {classes.map((cls) => {
              const studentCount = (cls.studentIds || []).length;
              return (
                <div
                  key={cls.id}
                  className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-2xs hover:border-indigo-200 transition space-y-3.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h5 className="font-black text-slate-900 text-base truncate">
                          {cls.className}
                        </h5>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-500 text-xs font-medium mt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{cls.schedule || "Schedule TBA"}</span>
                        </span>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          <span>{cls.classRoom || "Main Campus"}</span>
                        </span>
                      </div>
                    </div>

                    {cls.classLevel && <LevelBadge level={cls.classLevel} />}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-600 font-semibold">
                      <Users className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{studentCount} Enrolled</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {cls.worksheetUrl && (
                        <a
                          href={cls.worksheetUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 px-2.5 py-1 rounded-lg transition"
                        >
                          <FileText className="w-3 h-3 text-emerald-600" />
                          <span>Syllabus</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                      <button
                        onClick={() => {
                          onSelectClass(cls.id);
                          onNavigate("classes");
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-[#1a3a8f] bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 px-2.5 py-1 rounded-lg transition"
                      >
                        <span>View Roster</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Academy Available Batches (View Only) ── */}
      <AvailableBatches
        classes={allClasses}
        users={students}
        canEdit={false}
        role="instructor"
        currentUserId={auth.currentUser?.uid}
        isOverviewWidget={true}
        onNavigateToClasses={() => onNavigate("classes")}
      />
    </div>
  );
}
