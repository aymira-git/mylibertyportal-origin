import { useState } from "react";
import MobileDashboardShell from "./MobileDashboardShell";
import { getCleanLabel, getTabIcon, groupTabsByCategory } from "./tabUtils";

/**
 * tabs: [{ id, label, component, hidden?, badge?, badgeDot?, icon?, category? }]
 *   - `hidden: true` renders the tab's content when active but skips its
 *     sidebar button — for screens only reachable programmatically (e.g. an
 *     edit form opened via an "Edit" button elsewhere, not a nav destination).
 *
 * Uncontrolled: pass just `tabs` (+ optional `defaultTab`)
 * Controlled: pass `activeTab` + `onTabChange`
 * `title`: optional heading shown above the tab list
 * `extraSidebarContent`: optional node rendered above the tabs in the sidebar
 */
export default function DashboardShell({
  tabs,
  defaultTab = null,
  activeTab: controlledActiveTab = undefined,
  onTabChange = null,
  title = null,
  extraSidebarContent = null,
}) {
  const [internalActiveTab, setInternalActiveTab] = useState(defaultTab || tabs[0]?.id);
  const isControlled = controlledActiveTab !== undefined;
  const activeTab = isControlled ? controlledActiveTab : internalActiveTab;
  const setActiveTab = isControlled ? onTabChange : setInternalActiveTab;

  const active = tabs.find((t) => t.id === activeTab);
  const groupedSections = groupTabsByCategory(tabs);

  return (
    <>
      {/* Mobile Presentation */}
      <MobileDashboardShell
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        title={title}
        extraSidebarContent={extraSidebarContent}
      />

      {/* Desktop & Tablet: Grouped Sidebar with Refined Lucide Icons & Active Brand Pill */}
      <div className="hidden md:flex md:flex-row gap-5 lg:gap-6 items-start w-full">
        {/* Modern School Management Sidebar */}
        <aside className="w-56 lg:w-60 shrink-0 bg-white rounded-2xl border border-slate-200/90 p-3 shadow-2xs flex flex-col gap-3 sticky top-5 self-start">
          {/* Header Identity & Quick Action */}
          <div>
            {title && (
              <div className="px-2 pt-1 pb-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#1a3a8f] animate-pulse" />
                  <h2 className="text-base font-black text-slate-900 tracking-tight">{title}</h2>
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5 pl-4">
                  Workspace
                </p>
              </div>
            )}
            {extraSidebarContent && <div className="mt-1">{extraSidebarContent}</div>}
          </div>

          {/* Grouped Navigation */}
          <nav className="flex flex-col gap-2.5">
            {groupedSections.map(([sectionName, sectionTabs]) => (
              <div key={sectionName} className="space-y-1">
                {sectionName !== "Main" && (
                  <div className="px-2.5 pt-2 pb-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      {sectionName}
                    </span>
                  </div>
                )}
                <div className="flex flex-col gap-1">
                  {sectionTabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    const Icon = getTabIcon(tab);
                    const label = getCleanLabel(tab.label);

                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={`group relative flex items-center justify-between w-full px-2.5 py-2 rounded-xl text-left font-bold text-xs transition-all duration-150 cursor-pointer select-none ${
                          isActive
                            ? "bg-[#1a3a8f] text-white shadow-sm shadow-indigo-950/20 ring-1 ring-[#1a3a8f]/40"
                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                              isActive
                                ? "bg-white/20 text-white shadow-2xs"
                                : "bg-slate-100 text-slate-500 group-hover:bg-indigo-50 group-hover:text-[#1a3a8f]"
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <span className="truncate">{label}</span>
                        </div>

                        {/* Attention Badge or Status Dot */}
                        {tab.badge !== undefined && tab.badge !== null && (
                          <span
                            className={`px-1.5 py-0.5 text-[10px] font-black rounded-full transition-colors shrink-0 ml-1.5 ${
                              isActive
                                ? "bg-white text-[#1a3a8f]"
                                : "bg-amber-100 text-amber-800 border border-amber-200"
                            }`}
                          >
                            {tab.badge}
                          </span>
                        )}
                        {tab.badgeDot && (
                          <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0 ml-1.5 animate-pulse" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        {/* Content Area */}
        <main className="flex-1 min-w-0 w-full">{active?.component}</main>
      </div>
    </>
  );
}
