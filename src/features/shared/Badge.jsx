// Generic small colored pill shared across feature screens.
// (role, level, application status, payment status, etc.) should use this
// instead of inventing another one-off span with its own colors.
//
// Usage: <Badge tone="emerald">Active</Badge>
const TONE_STYLES = {
  slate: "bg-slate-100 text-slate-700",
  blue: "bg-blue-100 text-blue-700",
  purple: "bg-purple-100 text-purple-700",
  amber: "bg-amber-100 text-amber-700",
  rose: "bg-rose-100 text-rose-700",
  emerald: "bg-emerald-100 text-emerald-700",
  indigo: "bg-indigo-100 text-indigo-700",
  gray: "bg-gray-100 text-gray-400",
};

export default function Badge({ tone = "gray", children }) {
  return (
    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${TONE_STYLES[tone] || TONE_STYLES.gray}`}>
      {children}
    </span>
  );
}
