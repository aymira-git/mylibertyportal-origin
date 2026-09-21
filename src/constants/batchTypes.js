/**
 * batchTypes.js
 * Single Source of Truth for Batch Types in MY LIBERTY:
 * 1. "reguler"      - Standard group classes following program capacity/quorum defaults
 * 2. "private"      - Intensive 1-on-1 or semi-private personalized cohorts (default capacity 1, quorum 1)
 * 3. "the_three_rs" - Foundational literacy & numeracy cohorts (Reading, 'Riting, 'Rithmetic / Calistung - default capacity 8, quorum 3)
 */

import { getProgram } from "./programs.js";

export const DEFAULT_BATCH_TYPE = "reguler";

export const BATCH_TYPES = {
  reguler: {
    id: "reguler",
    label: "Reguler",
    shortLabel: "Reguler",
    badgeTone: "slate",
    badgeBg: "bg-slate-100 text-slate-700 border-slate-200",
    defaultCapacity: 15,
    defaultQuorum: 4,
    description: "Standard interactive group class cohorts following regular academic track.",
  },
  private: {
    id: "private",
    label: "Private",
    shortLabel: "Private",
    badgeTone: "purple",
    badgeBg: "bg-purple-50 text-purple-700 border-purple-200",
    defaultCapacity: 1,
    defaultQuorum: 1,
    description: "Personalized 1-on-1 or semi-private cohorts with tailored learning pace.",
  },
  the_three_rs: {
    id: "the_three_rs",
    label: "The Three Rs",
    shortLabel: "3Rs",
    badgeTone: "teal",
    badgeBg: "bg-teal-50 text-teal-700 border-teal-200",
    defaultCapacity: 8,
    defaultQuorum: 3,
    description: "Foundational literacy and numeracy cohorts (Reading, 'Riting, 'Rithmetic / Calistung).",
  },
};

export const BATCH_TYPE_KEYS = Object.keys(BATCH_TYPES);
export const BATCH_TYPE_LIST = Object.values(BATCH_TYPES);

const BATCH_TYPE_ALIASES = {
  // Reguler aliases
  reguler: "reguler",
  regular: "reguler",
  reg: "reguler",
  standard: "reguler",
  group: "reguler",

  // Private aliases
  private: "private",
  privat: "private",
  "1-on-1": "private",
  "1 on 1": "private",
  vip: "private",
  personal: "private",

  // The Three Rs aliases
  "the three rs": "the_three_rs",
  "three rs": "the_three_rs",
  the_three_rs: "the_three_rs",
  "3r": "the_three_rs",
  "3rs": "the_three_rs",
  "the 3rs": "the_three_rs",
  calistung: "the_three_rs",
};

/**
 * Normalizes any freeform or legacy batch type string to canonical batch type id.
 * Defaults safely to DEFAULT_BATCH_TYPE ("reguler") for empty/missing/legacy records.
 *
 * @param {any} [val]
 * @returns {"reguler" | "private" | "the_three_rs"}
 */
export function normalizeBatchType(val) {
  if (!val || typeof val !== "string") {
    return DEFAULT_BATCH_TYPE;
  }
  const clean = val.trim().toLowerCase();
  if (!clean) {
    return DEFAULT_BATCH_TYPE;
  }

  // Exact alias lookup
  if (BATCH_TYPE_ALIASES[clean]) {
    return BATCH_TYPE_ALIASES[clean];
  }

  // Canonical keys
  if (clean === "reguler" || clean === "private" || clean === "the_three_rs") {
    return clean;
  }

  // Boundary keyword checks
  if (/\b(three\s*rs|3\s*r(s)?|calistung)\b/i.test(clean)) {
    return "the_three_rs";
  }

  if (/\b(private|privat|1-on-1|vip)\b/i.test(clean)) {
    return "private";
  }

  if (/\b(reguler|regular|standard|group)\b/i.test(clean)) {
    return "reguler";
  }

  return DEFAULT_BATCH_TYPE;
}

/**
 * Get batch type configuration object by ID or string.
 *
 * @param {string} [batchType]
 * @returns {typeof BATCH_TYPES[keyof typeof BATCH_TYPES]}
 */
export function getBatchType(batchType) {
  const canonical = normalizeBatchType(batchType);
  return BATCH_TYPES[canonical] || BATCH_TYPES[DEFAULT_BATCH_TYPE];
}

/**
 * Get human-readable label for a batch type.
 *
 * @param {string} [batchType]
 * @returns {string}
 */
export function getBatchTypeLabel(batchType) {
  return getBatchType(batchType).label;
}

/**
 * Returns all active batch types.
 *
 * @returns {Array<typeof BATCH_TYPES[keyof typeof BATCH_TYPES]>}
 */
export function getBatchTypeList() {
  return BATCH_TYPE_LIST;
}

/**
 * Derives suggested capacity and quorum for a batch given its type and educational program.
 * Preserves program-specific defaults for 'reguler' (e.g. Professional School = 20, Kids Course = 12).
 *
 * @param {Object} params
 * @param {string} [params.batchType]
 * @param {string} [params.programId]
 * @returns {{ defaultCapacity: number, minQuorum: number }}
 */
export function getBatchTypeDefaults({ batchType, programId } = {}) {
  const canonicalType = normalizeBatchType(batchType);

  if (canonicalType === "private") {
    return {
      defaultCapacity: BATCH_TYPES.private.defaultCapacity,
      minQuorum: BATCH_TYPES.private.defaultQuorum,
    };
  }

  if (canonicalType === "the_three_rs") {
    return {
      defaultCapacity: BATCH_TYPES.the_three_rs.defaultCapacity,
      minQuorum: BATCH_TYPES.the_three_rs.defaultQuorum,
    };
  }

  // 'reguler' inherits from the educational program defaults if available
  if (programId) {
    const prog = getProgram(programId);
    return {
      defaultCapacity: prog.defaultCapacity || BATCH_TYPES.reguler.defaultCapacity,
      minQuorum: prog.minQuorum ?? BATCH_TYPES.reguler.defaultQuorum,
    };
  }

  return {
    defaultCapacity: BATCH_TYPES.reguler.defaultCapacity,
    minQuorum: BATCH_TYPES.reguler.defaultQuorum,
  };
}

/**
 * Matches an item's batch type against a filter value ("all" or canonical ID/alias).
 *
 * @param {string | null | undefined} itemBatchType
 * @param {string | null | undefined} filterBatchType
 * @returns {boolean}
 */
export function matchesBatchTypeFilter(itemBatchType, filterBatchType) {
  if (!filterBatchType || filterBatchType === "all") return true;
  const canonicalItem = normalizeBatchType(itemBatchType);
  const canonicalFilter = normalizeBatchType(filterBatchType);
  return canonicalItem === canonicalFilter;
}
