/**
 * Page controls for a paginated list. Renders nothing when everything
 * fits on one page, so it can be dropped in unconditionally without
 * cluttering small lists.
 *
 * Prev/next rather than numbered pages: on a phone, a row of page numbers
 * either overflows or ends up with tap targets too small to hit reliably.
 * Two large buttons and a position readout work at any list length.
 */
export default function Pagination({ page, totalPages, setPage, from, to, total, label = "records" }) {
  if (totalPages <= 1) return null;

  return (
    <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-150 pt-3">
      <button
        type="button"
        onClick={() => setPage(page - 1)}
        disabled={page <= 1}
        className="min-h-11 rounded-xl border border-slate-200 bg-slate-100 px-4 text-xs font-bold text-slate-600 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
      >
        ← Prev
      </button>

      <p className="text-center text-[11px] font-bold text-slate-500">
        {from}–{to} of {total} {label}
        <span className="mt-0.5 block text-[10px] font-normal text-slate-400">
          Page {page} of {totalPages}
        </span>
      </p>

      <button
        type="button"
        onClick={() => setPage(page + 1)}
        disabled={page >= totalPages}
        className="min-h-11 rounded-xl border border-slate-200 bg-slate-100 px-4 text-xs font-bold text-slate-600 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Next →
      </button>
    </div>
  );
}
