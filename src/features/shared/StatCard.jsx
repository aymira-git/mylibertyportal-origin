// Reusable statistics tile shared across dashboard screens.
// Originally a local function inside ManagerDashboard, then promoted here so
// AdminDashboard/FrontOfficeDashboard's clickable overview tiles can use the
// exact same tile instead of a hand-rolled lookalike, just at a smaller size.
//
// Usage (static, like ManagerDashboard's original):
//   <StatCard label="Total Students" value={42} color="bg-indigo-50 text-indigo-700 border-indigo-100" />
//
// Usage (clickable overview tile, like AdminDashboard/FrontOfficeDashboard):
//   <StatCard size="sm" onClick={() => setActiveTab("students")} label="Active students" value={12} color="text-indigo-700 bg-indigo-50" />
const SIZE_STYLES = {
  lg: { padding: "p-6", value: "text-3xl", tracking: "tracking-wider" },
  sm: { padding: "p-4", value: "text-2xl", tracking: "tracking-wide" },
};

export default function StatCard({ label, value, color, onClick, size = "lg" }) {
  const s = SIZE_STYLES[size] || SIZE_STYLES.lg;
  const Tag = onClick ? "button" : "div";

  return (
    <Tag
      onClick={onClick}
      className={`${s.padding} rounded-xl border text-left transition ${onClick ? "hover:shadow-sm" : ""} ${color}`}
    >
      <p className={`text-[10px] font-bold uppercase ${s.tracking} opacity-80`}>{label}</p>
      <p className={`${s.value} font-black mt-2`}>{value}</p>
    </Tag>
  );
}
