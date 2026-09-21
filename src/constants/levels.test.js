import { describe, expect, it } from "vitest";
import {
  getNextLevel,
  getStars,
  getStarText,
  getTier,
  isCompatible,
  LEVEL_KEYS,
  LEVELS,
  TIERS,
} from "./levels.js";

describe("level data", () => {
  it("keeps levels in learning order 1..5", () => {
    expect(LEVEL_KEYS).toEqual(["warrior", "elite", "master", "grandmaster", "epic"]);
    expect(LEVEL_KEYS.map((k) => LEVELS[k].order)).toEqual([1, 2, 3, 4, 5]);
  });

  it("agrees with itself: each tier lists exactly the levels that point to it", () => {
    Object.values(TIERS).forEach((tier) => {
      const fromLevels = LEVEL_KEYS.filter((k) => LEVELS[k].tier === tier.id);
      expect(fromLevels).toEqual(tier.levels);
      fromLevels.forEach((k) => expect(LEVELS[k].stars).toBe(tier.stars));
    });
  });
});

describe("level helpers", () => {
  it("looks up tier and stars", () => {
    expect(getTier("master")).toBe("intermediate");
    expect(getStars("epic")).toBe(3);
    expect(getStarText("elite")).toBe("⭐");
    expect(getStarText("epic")).toBe("⭐⭐⭐");
  });

  it("returns null or empty for unknown levels", () => {
    expect(getTier("nope")).toBeNull();
    expect(getStars(undefined)).toBeNull();
    expect(getStarText("nope")).toBe("");
  });

  it("finds the next level, and null at the top or for unknown input", () => {
    expect(getNextLevel("warrior")).toBe("elite");
    expect(getNextLevel("grandmaster")).toBe("epic");
    expect(getNextLevel("epic")).toBeNull();
    expect(getNextLevel("nope")).toBeNull();
  });
});

describe("isCompatible", () => {
  it("allows anything when there is nothing to compare", () => {
    expect(isCompatible(undefined, { classLevel: "epic" })).toBe(true);
    expect(isCompatible("elite", null)).toBe(true);
    expect(isCompatible("unknown-level", { classLevel: "epic" })).toBe(true);
    expect(isCompatible("elite", {})).toBe(true);
  });

  it("requires an exact match when the batch only has classLevel", () => {
    expect(isCompatible("elite", { classLevel: "elite" })).toBe(true);
    expect(isCompatible("elite", { classLevel: "master" })).toBe(false);
  });

  it("uses the min/max range when the batch has one, inclusive at both ends", () => {
    const batch = { classLevel: "master", minLevel: "elite", maxLevel: "grandmaster" };
    expect(isCompatible("warrior", batch)).toBe(false);
    expect(isCompatible("elite", batch)).toBe(true);
    expect(isCompatible("master", batch)).toBe(true);
    expect(isCompatible("grandmaster", batch)).toBe(true);
    expect(isCompatible("epic", batch)).toBe(false);
  });

  it("treats a missing min as the lowest level and a missing max as the highest", () => {
    expect(isCompatible("warrior", { maxLevel: "elite" })).toBe(true);
    expect(isCompatible("master", { maxLevel: "elite" })).toBe(false);
    expect(isCompatible("epic", { minLevel: "master" })).toBe(true);
    expect(isCompatible("elite", { minLevel: "master" })).toBe(false);
  });

  it("lets the range win over classLevel", () => {
    expect(
      isCompatible("elite", { classLevel: "epic", minLevel: "warrior", maxLevel: "elite" })
    ).toBe(true);
  });
});
