import { describe, it, expect } from "vitest";
import {
  BATCH_TYPES,
  BATCH_TYPE_KEYS,
  BATCH_TYPE_LIST,
  DEFAULT_BATCH_TYPE,
  normalizeBatchType,
  getBatchType,
  getBatchTypeLabel,
  getBatchTypeList,
  getBatchTypeDefaults,
  matchesBatchTypeFilter,
} from "./batchTypes.js";

describe("batchTypes constants", () => {
  it("defines the three canonical batch types", () => {
    expect(BATCH_TYPE_KEYS).toEqual(["reguler", "private", "the_three_rs"]);
    expect(DEFAULT_BATCH_TYPE).toBe("reguler");
    expect(BATCH_TYPE_LIST.map((b) => b.id)).toEqual(["reguler", "private", "the_three_rs"]);
    expect(BATCH_TYPES.reguler.label).toBe("Reguler");
    expect(getBatchTypeList()).toEqual(BATCH_TYPE_LIST);
  });

  describe("normalizeBatchType", () => {
    it("normalizes canonical keys directly", () => {
      expect(normalizeBatchType("reguler")).toBe("reguler");
      expect(normalizeBatchType("private")).toBe("private");
      expect(normalizeBatchType("the_three_rs")).toBe("the_three_rs");
    });

    it("handles common aliases and case variations", () => {
      expect(normalizeBatchType("regular")).toBe("reguler");
      expect(normalizeBatchType("REGULER")).toBe("reguler");
      expect(normalizeBatchType("reg")).toBe("reguler");

      expect(normalizeBatchType("PRIVATE")).toBe("private");
      expect(normalizeBatchType("privat")).toBe("private");
      expect(normalizeBatchType("1-on-1")).toBe("private");
      expect(normalizeBatchType("vip")).toBe("private");

      expect(normalizeBatchType("3R")).toBe("the_three_rs");
      expect(normalizeBatchType("3rs")).toBe("the_three_rs");
      expect(normalizeBatchType("The Three Rs")).toBe("the_three_rs");
      expect(normalizeBatchType("three rs")).toBe("the_three_rs");
      expect(normalizeBatchType("calistung")).toBe("the_three_rs");
    });

    it("falls back safely to DEFAULT_BATCH_TYPE ('reguler') on empty or unknown values", () => {
      expect(normalizeBatchType("")).toBe("reguler");
      expect(normalizeBatchType("   ")).toBe("reguler");
      expect(normalizeBatchType(null)).toBe("reguler");
      expect(normalizeBatchType(undefined)).toBe("reguler");
      expect(normalizeBatchType("unknown_random_type")).toBe("reguler");
    });
  });

  describe("getBatchType & getBatchTypeLabel", () => {
    it("returns correct batch type object for canonical and aliased IDs", () => {
      const p = getBatchType("private");
      expect(p.id).toBe("private");
      expect(p.label).toBe("Private");
      expect(p.defaultCapacity).toBe(1);

      const r = getBatchType("regular");
      expect(r.id).toBe("reguler");
      expect(r.label).toBe("Reguler");

      const t = getBatchType("3rs");
      expect(t.id).toBe("the_three_rs");
      expect(t.label).toBe("The Three Rs");
    });

    it("returns correct label via getBatchTypeLabel", () => {
      expect(getBatchTypeLabel("reguler")).toBe("Reguler");
      expect(getBatchTypeLabel("private")).toBe("Private");
      expect(getBatchTypeLabel("the_three_rs")).toBe("The Three Rs");
      expect(getBatchTypeLabel("unknown")).toBe("Reguler");
    });
  });

  describe("getBatchTypeDefaults", () => {
    it("returns 1 capacity and 1 quorum for private", () => {
      expect(getBatchTypeDefaults({ batchType: "private" })).toEqual({
        defaultCapacity: 1,
        minQuorum: 1,
      });
      // Even if programId is specified, private overrides capacity/quorum
      expect(getBatchTypeDefaults({ batchType: "private", programId: "professional_school" })).toEqual({
        defaultCapacity: 1,
        minQuorum: 1,
      });
    });

    it("returns 8 capacity and 3 quorum for the_three_rs", () => {
      expect(getBatchTypeDefaults({ batchType: "the_three_rs" })).toEqual({
        defaultCapacity: 8,
        minQuorum: 3,
      });
    });

    it("preserves program-specific defaults for reguler batches", () => {
      // Professional School has default capacity 20, quorum 4
      expect(getBatchTypeDefaults({ batchType: "reguler", programId: "professional_school" })).toEqual({
        defaultCapacity: 20,
        minQuorum: 4,
      });

      // Kids Course has default capacity 12, quorum 4
      expect(getBatchTypeDefaults({ batchType: "reguler", programId: "kids_course" })).toEqual({
        defaultCapacity: 12,
        minQuorum: 4,
      });

      // English Course has default capacity 15, quorum 4
      expect(getBatchTypeDefaults({ batchType: "reguler", programId: "english_course" })).toEqual({
        defaultCapacity: 15,
        minQuorum: 4,
      });

      // Kids School has default capacity 12, quorum 3
      expect(getBatchTypeDefaults({ batchType: "reguler", programId: "kids_school" })).toEqual({
        defaultCapacity: 12,
        minQuorum: 3,
      });
    });

    it("falls back to standard reguler defaults when no program is passed", () => {
      expect(getBatchTypeDefaults({ batchType: "reguler" })).toEqual({
        defaultCapacity: 15,
        minQuorum: 4,
      });
    });
  });

  describe("matchesBatchTypeFilter", () => {
    it("matches 'all' to any batch type", () => {
      expect(matchesBatchTypeFilter("reguler", "all")).toBe(true);
      expect(matchesBatchTypeFilter("private", "all")).toBe(true);
      expect(matchesBatchTypeFilter(undefined, "all")).toBe(true);
      expect(matchesBatchTypeFilter(null, "")).toBe(true);
    });

    it("matches exact and normalized aliases", () => {
      expect(matchesBatchTypeFilter("reguler", "regular")).toBe(true);
      expect(matchesBatchTypeFilter(undefined, "reguler")).toBe(true); // missing is reguler
      expect(matchesBatchTypeFilter("private", "privat")).toBe(true);
      expect(matchesBatchTypeFilter("the_three_rs", "3rs")).toBe(true);
      expect(matchesBatchTypeFilter("private", "reguler")).toBe(false);
    });
  });
});
