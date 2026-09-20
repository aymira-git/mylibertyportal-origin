import { useState, useEffect, useMemo } from "react";
import { db } from "../../firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { WelcomeBanner, DashboardShell, useToast } from "../shared";
import { UserPlus, BookOpen, Users, Copy, Check, ExternalLink } from "lucide-react";
import { AvailableBatches } from "../classes";
import { useStaffDirectives, StaffDirectivesWidget } from "../staff";

function MarketingOverview({
  leadCount,
  loading,
  classes,
  openSeats,
  onNavigate,
}) {
  const toast = useToast();
  const [copiedLink, setCopiedLink] = useState(false);

  const registrationLink =
    typeof window !== "undefined"
      ? `${window.location.origin}/register`
      : "https://myliberty.id/register";

  const handleCopyLink = () => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(registrationLink);
      setCopiedLink(true);
      toast("Student Registration link copied to clipboard!", "success");
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <WelcomeBanner
        portalLabel="Admissions & Outreach"
        roleLabel="Marketing Representative"
        fallbackName="Marketing Officer"
        subtitle="Drive academy admissions, review prospective student inquiries, and promote available class batches."
        stats={[
          {
            label: "Pending Inquiries",
            value: loading ? "..." : leadCount,
            icon: UserPlus,
          },
          {
            label: "Total Open Seats",
            value: openSeats,
            icon: Users,
          },
          {
            label: "Available Batches",
            value: classes.length,
            icon: BookOpen,
          },
        ]}
      />

      {/* ── Marketing Fast Tools & Share Bar ── */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-2xs space-y-3">
        <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">
          Admissions &amp; Lead Generation Link
        </h4>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="flex-1 bg-slate-50 border border-slate-200/90 px-3.5 py-2.5 rounded-2xl text-xs font-semibold text-slate-600 truncate flex items-center gap-2">
            <span className="text-slate-400 select-none">Link:</span>
            <span className="font-mono text-slate-800 truncate">{registrationLink}</span>
          </div>
          <button
            onClick={handleCopyLink}
            className="px-4 py-2.5 bg-[#1a3a8f] hover:bg-[#122b6e] text-white font-extrabold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 shrink-0"
          >
            {copiedLink ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-300" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Link</span>
              </>
            )}
          </button>
          <a
            href="/register"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1 shrink-0"
          >
            <span>Preview Form</span>
            <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
          </a>
        </div>

        <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200/80 text-xs text-emerald-800 font-medium">
          💡 <strong>Tip for Outreach:</strong> You can copy pre-formatted WhatsApp promotional blurbs directly for any open batch in the <strong>Available Batches</strong> tab or below!
        </div>
      </div>

      {/* ── Attendance & Reception Note ── */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-2xs space-y-1.5">
        <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">
          Staff Attendance Verification
        </h4>
        <p className="text-xs text-slate-500 leading-relaxed font-medium">
          Your daily shifts are tracked through the front desk reception scanner. Clock in upon arrival and clock out before leaving.
        </p>
      </div>

      {/* ── Available Batches Overview Widget ── */}
      <AvailableBatches
        classes={classes}
        canEdit={false}
        role="marketing"
        isOverviewWidget={true}
        onNavigateToClasses={() => onNavigate("classes")}
      />
    </div>
  );
}

export default function MarketingDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [leadCount, setLeadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState([]);

  const {
    activeDirectives,
    completedDirectives,
    pendingCount: pendingDirectivesCount,
    loading: directivesLoading,
    handleToggle: handleToggleDirective,
  } = useStaffDirectives("marketing");

  useEffect(() => {
    const unsubApplications = onSnapshot(
      collection(db, "applications"),
      (snap) => {
        const pending = snap.docs.filter((d) => (d.data().status || "pending") === "pending").length;
        setLeadCount(pending);
        setLoading(false);
      },
      (err) => {
        console.error("applications listener:", err);
        setLoading(false);
      }
    );

    const unsubClasses = onSnapshot(
      collection(db, "classes"),
      (snap) => {
        setClasses(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => {
        console.error("marketing classes listener:", err);
      }
    );

    return () => {
      unsubApplications();
      unsubClasses();
    };
  }, []);

  const openSeats = useMemo(() => {
    return classes.reduce((sum, cls) => {
      const studentCount = (cls.studentIds || []).length;
      const capacity = Number(cls.maxCapacity) || 15;
      return sum + Math.max(0, capacity - studentCount);
    }, 0);
  }, [classes]);

  const tabs = [
    {
      id: "overview",
      label: "Campaign & Outreach",
      component: (
        <MarketingOverview
          leadCount={leadCount}
          loading={loading}
          classes={classes}
          openSeats={openSeats}
          onNavigate={setActiveTab}
        />
      ),
    },
    {
      id: "directives",
      label: "Directives",
      badge: pendingDirectivesCount || null,
      component: (
        <div className="max-w-4xl mx-auto">
          <StaffDirectivesWidget
            activeDirectives={activeDirectives}
            completedDirectives={completedDirectives}
            loading={directivesLoading}
            onToggle={handleToggleDirective}
            roleLabel="Marketing & Outreach"
          />
        </div>
      ),
    },
    {
      id: "classes",
      label: "Available Batches",
      badge: openSeats > 0 ? `${openSeats} open` : null,
      component: (
        <div className="max-w-6xl mx-auto">
          <AvailableBatches
            classes={classes}
            canEdit={false}
            role="marketing"
          />
        </div>
      ),
    },
  ];

  return (
    <div className="p-5 bg-[#f0f2f5] rounded-2xl min-h-[500px]">
      <DashboardShell
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        title="Marketing Portal"
      />
    </div>
  );
}
