import { useState } from "react";
import { getCleanLabel, getTabIcon } from "./tabUtils";

/**
 * Phone-only presentation for the shared DashboardShell.
 *
 * It deliberately receives the same tabs and callbacks as the desktop shell,
 * so this component changes navigation appearance only. Dashboard data,
 * permissions and individual tab components stay shared between phone and
 * desktop views.
 */
export default function MobileDashboardShell({ tabs, activeTab, onTabChange, title, extraSidebarContent }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const visibleTabs = tabs.filter(tab => !tab.hidden);
  const primaryTabs = visibleTabs.slice(0, 4);
  const moreTabs = visibleTabs.slice(4);
  const active = tabs.find(tab => tab.id === activeTab);
  const activeIsInMore = moreTabs.some(tab => tab.id === activeTab);

  const selectTab = (tabId) => {
    onTabChange(tabId);
    setMoreOpen(false);
  };

  return (
    <div className="md:hidden">
      {/* Dashboard Subheader & Action Launcher (Scrolls with content, no competing sticky) */}
      <div className="-mx-3 -mt-3 mb-4 border-b border-slate-200/90 bg-white px-3.5 py-3 sm:-mx-4 sm:-mt-4 sm:px-4 shadow-2xs">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#1a3a8f]">{title || "MYLIBERTY"}</p>
        <h2 className="mt-0.5 text-lg font-black text-slate-800 leading-tight">{getCleanLabel(active?.label) || "Dashboard"}</h2>
        {extraSidebarContent && <div className="mt-2.5">{extraSidebarContent}</div>}
      </div>

      <main className="pb-24">{active?.component}</main>

      {/* "More Tools" Bottom Sheet */}
      {moreOpen && (
        <>
          <button
            aria-label="Close navigation menu"
            onClick={() => setMoreOpen(false)}
            className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150 cursor-pointer"
          />
          <section className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl bg-white p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl animate-in slide-in-from-bottom duration-200 overscroll-contain">
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-slate-300" />
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-black text-slate-800">More Tools</h3>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="text-xs font-bold text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                ✕ Close
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {moreTabs.map(tab => {
                const Icon = getTabIcon(tab);
                const label = getCleanLabel(tab.label);
                const isActive = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    onClick={() => selectTab(tab.id)}
                    className={`min-h-14 rounded-xl border px-3 py-2 text-left text-xs font-bold transition flex items-center justify-between gap-2.5 cursor-pointer ${
                      isActive
                        ? "border-[#1a3a8f] bg-[#1a3a8f] text-white"
                        : "border-slate-200 bg-slate-50 text-slate-700 active:bg-slate-100"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        isActive ? "bg-white/20 text-white" : "bg-white text-[#1a3a8f] shadow-2xs"
                      }`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="truncate">{label}</span>
                    </div>
                    {tab.badge !== undefined && tab.badge !== null && (
                      <span className={`px-1.5 py-0.5 text-[10px] font-black rounded-full shrink-0 ${
                        isActive ? "bg-white text-[#1a3a8f]" : "bg-amber-100 text-amber-800"
                      }`}>
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        </>
      )}

      {/* Floating Bottom Navigation Bar with Home Indicator Safe Area */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex gap-1 bg-[#1a3a8f]/95 backdrop-blur-lg border-t border-white/10 px-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-6px_20px_rgba(15,23,42,0.2)]">
        {primaryTabs.map(tab => {
          const Icon = getTabIcon(tab);
          const label = getCleanLabel(tab.label);
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => selectTab(tab.id)}
              className={`relative min-h-14 min-w-0 flex-1 rounded-xl px-1 flex flex-col items-center justify-center text-[10px] font-extrabold leading-tight transition cursor-pointer ${
                isActive ? "bg-white text-[#1a3a8f] shadow-xs" : "text-white/80 active:bg-white/10"
              }`}
            >
              <Icon className={`w-4 h-4 mb-1 shrink-0 ${isActive ? "text-[#1a3a8f]" : "text-white"}`} />
              <span className="block truncate max-w-full">{label}</span>
              {tab.badge !== undefined && tab.badge !== null && (
                <span className="absolute top-1 right-2 px-1 py-0.2 text-[9px] font-black rounded-full bg-amber-400 text-slate-900 shadow-xs">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
        {moreTabs.length > 0 && (
          <button
            onClick={() => setMoreOpen(true)}
            className={`min-h-14 min-w-0 flex-1 rounded-xl px-1 text-center text-[10px] font-extrabold transition cursor-pointer ${
              activeIsInMore || moreOpen ? "bg-white text-[#1a3a8f] shadow-sm" : "text-white/80 active:bg-white/10"
            }`}
          >
            <span className="block text-base leading-none">•••</span>
            <span className="block mt-1">More</span>
          </button>
        )}
      </nav>
    </div>
  );
}
