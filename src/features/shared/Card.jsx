// One shared "white box" wrapper. It keeps the common dashboard card style in
// slightly different version of this (different padding, shadow, spacing) —
// this is now the single source of truth for that look.
//
// Usage: <Card>...</Card>  or  <Card padding="p-6" className="text-center">...</Card>
export default function Card({ children, className = "", padding = "p-5" }) {
  return (
    <div className={`bg-white ${padding} rounded-2xl border border-slate-200 shadow-sm ${className}`}>
      {children}
    </div>
  );
}
