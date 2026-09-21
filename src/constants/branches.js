/**
 * branches.js
 * Canonical list of MY LIBERTY campus branches and legacy alias resolution.
 */

export const BRANCHES = ["Kota Gorontalo", "Bone Bolango", "Pohuwato", "Limboto"];

export const DEFAULT_BRANCH = "Kota Gorontalo";

/**
 * Mapping of legacy or alternate branch spellings to their canonical names.
 */
export const LEGACY_BRANCH_MAP = {
  "cabang utama": "Kota Gorontalo",
  utama: "Kota Gorontalo",
  "main branch": "Kota Gorontalo",
  gorontalo: "Kota Gorontalo",
  kota: "Kota Gorontalo",
};

/**
 * Normalizes a raw branch string into a canonical branch name.
 * Falls back to DEFAULT_BRANCH if input is empty, or returns original
 * string if it is an unknown custom branch name.
 *
 * @param {string | null | undefined} raw
 * @returns {string}
 */
export function normalizeBranch(raw) {
  if (!raw || typeof raw !== "string") {
    return DEFAULT_BRANCH;
  }
  const clean = raw.trim();
  if (!clean) {
    return DEFAULT_BRANCH;
  }

  // Check legacy map
  const lower = clean.toLowerCase();
  if (LEGACY_BRANCH_MAP[lower]) {
    return LEGACY_BRANCH_MAP[lower];
  }

  // Exact case-insensitive match against canonical branches
  const match = BRANCHES.find((b) => b.toLowerCase() === lower);
  if (match) {
    return match;
  }

  // Return cleaned string for custom/unrecognized branch
  return clean;
}

/**
 * Checks whether a branch matches a filter, taking into account
 * normalization and "all" keyword.
 *
 * @param {string | null | undefined} itemBranch
 * @param {string} filterBranch
 * @returns {boolean}
 */
export function matchesBranchFilter(itemBranch, filterBranch) {
  if (!filterBranch || filterBranch === "all") return true;
  if (!itemBranch || typeof itemBranch !== "string" || !itemBranch.trim()) {
    return false;
  }
  const canonicalItem = normalizeBranch(itemBranch);
  const canonicalFilter = normalizeBranch(filterBranch);
  return canonicalItem.toLowerCase() === canonicalFilter.toLowerCase();
}
