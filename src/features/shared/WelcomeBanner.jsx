import { useState, useEffect } from "react";
import { auth, db } from "../../firebase";
import { doc, getDoc } from "firebase/firestore";

/**
 * High-craft Welcome Banner component sharing the signature MYLIBERTY royal navy aesthetic:
 * - Gradient backdrop: from-[#1a3a8f] via-[#152e74] to-indigo-950
 * - Frosted pill role tags and live date indicator
 * - Optional frosted KPI stat cards with hover and click navigation
 */
export default function WelcomeBanner({
  portalLabel = "Campus Portal",
  roleLabel = "Active Staff",
  roleBadgeColor = "text-emerald-300 bg-emerald-950/40 border-emerald-500/30",
  userName: propUserName,
  fallbackName = "Staff",
  subtitle = "Manage your academy operations, review daily schedules, and coordinate activities.",
  stats = [],
  extraPills = null,
  children = null,
}) {
  const [fetchedName, setFetchedName] = useState(() => {
    return auth.currentUser?.displayName || "";
  });

  useEffect(() => {
    if (propUserName) return;

    const currentUser = auth.currentUser;
    if (!currentUser?.uid || currentUser.displayName) return;

    let isMounted = true;
    getDoc(doc(db, "users", currentUser.uid))
      .then((snap) => {
        if (!isMounted || !snap.exists()) return;
        const data = snap.data();
        const bestName = data.nickname || data.displayName || data.firstName || "";
        if (bestName) setFetchedName(bestName);
      })
      .catch((err) => {
        console.error("WelcomeBanner name lookup:", err);
      });

    return () => {
      isMounted = false;
    };
  }, [propUserName]);

  const todayStr = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const displayName = propUserName || fetchedName || fallbackName;

  return (
    <div className="bg-gradient-to-br from-[#1a3a8f] via-[#152e74] to-indigo-950 text-white p-6 sm:p-7 rounded-3xl shadow-sm space-y-4">
      {/* Top row: Tags, Title, Subtitle, Date */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.14em] bg-white/10 text-indigo-200 px-2.5 py-0.5 rounded-full border border-white/15">
              {portalLabel}
            </span>
            <span
              className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${roleBadgeColor}`}
            >
              {roleLabel}
            </span>
            {extraPills}
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight">
            Welcome back, {displayName}!
          </h2>
          <p className="text-xs text-indigo-200/90 font-medium max-w-2xl leading-relaxed">
            {subtitle}
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur-xs border border-white/15 px-4 py-2.5 rounded-2xl text-right shrink-0 self-start sm:self-auto">
          <p className="text-[10px] font-bold text-indigo-200 uppercase tracking-wider">
            Today&apos;s Date
          </p>
          <p className="text-xs font-black text-white">{todayStr}</p>
        </div>
      </div>

      {/* Optional Frosted KPI Stat Cards */}
      {stats && stats.length > 0 && (
        <div
          className={`grid gap-3 pt-2 ${
            stats.length === 1
              ? "grid-cols-1"
              : stats.length === 2
                ? "grid-cols-2"
                : stats.length === 3
                  ? "grid-cols-2 sm:grid-cols-3"
                  : stats.length === 4
                    ? "grid-cols-2 lg:grid-cols-4"
                    : "grid-cols-2 sm:grid-cols-3"
          }`}
        >
          {stats.map((stat, idx) => {
            const Icon = stat.icon;
            const isClickable = Boolean(stat.onClick);

            return (
              <div
                key={stat.label || idx}
                onClick={stat.onClick}
                role={isClickable ? "button" : undefined}
                tabIndex={isClickable ? 0 : undefined}
                onKeyDown={
                  isClickable
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          stat.onClick();
                        }
                      }
                    : undefined
                }
                className={`bg-white/10 border border-white/15 p-3.5 rounded-2xl flex items-center gap-3 transition select-none ${
                  isClickable
                    ? "cursor-pointer hover:bg-white/15 hover:border-white/30 hover:scale-[1.01] active:scale-[0.99]"
                    : ""
                }`}
              >
                {Icon && (
                  <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center text-white shrink-0 shadow-2xs">
                    <Icon className="w-5 h-5" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-200 truncate">
                    {stat.label}
                  </p>
                  <p className="text-lg font-black text-white">{stat.value}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {children}
    </div>
  );
}
