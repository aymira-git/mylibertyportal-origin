import { useState } from "react";

/**
 * Slices an already-filtered, already-sorted array into pages.
 *
 * Deliberately client-side. The obvious alternative — asking Firestore for
 * 25 documents at a time — doesn't work for the roster, because searching,
 * sorting, the "unenrolled students" list and the class lookups all need
 * the whole set in memory to be correct. Paging at the database level would
 * mean search only finding students who happen to be on the current page.
 *
 * What this fixes is rendering cost: a roster of several hundred students
 * currently builds every row on every keystroke in the search box. What it
 * does not fix is read cost — see ARCHITECTURE.md for where that's handled
 * (the reports date window) and why the roster isn't.
 */
export function usePagination(items, pageSize = 25) {
  const [page, setPage] = useState(1);

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // When the list shrinks — a search narrows it, someone deletes a record —
  // the raw `page` state can end up past the end. Clamped here, during
  // render, rather than synced back into state via an effect: every value
  // this hook returns (page, pageItems, from/to) is already derived from
  // the clamped number, so nothing downstream ever sees the stale one.
  // Prev/Next act on this same clamped `page`, so they recover correctly
  // even after the list has shrunk.
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;

  return {
    page: safePage,
    setPage,
    totalPages,
    total,
    pageItems: items.slice(start, start + pageSize),
    from: total === 0 ? 0 : start + 1,
    to: Math.min(start + pageSize, total),
  };
}
