import { describe, it, expect } from "vitest";
import {
  BRANCHES,
  DEFAULT_BRANCH,
  LEGACY_BRANCH_MAP,
  normalizeBranch,
  matchesBranchFilter,
} from "./branches";

describe("branches constants and utilities", () => {
  it("defines the 4 canonical branches", () => {
    expect(BRANCHES).toEqual(["Kota Gorontalo", "Bone Bolango", "Pohuwato", "Limboto"]);
    expect(DEFAULT_BRANCH).toBe("Kota Gorontalo");
  });

  it("exports legacy branch mapping for legacy aliases", () => {
    expect(LEGACY_BRANCH_MAP["cabang utama"]).toBe("Kota Gorontalo");
    expect(LEGACY_BRANCH_MAP["utama"]).toBe("Kota Gorontalo");
  });

  it("normalizes empty or null branch values to DEFAULT_BRANCH", () => {
    expect(normalizeBranch(null)).toBe("Kota Gorontalo");
    expect(normalizeBranch(undefined)).toBe("Kota Gorontalo");
    expect(normalizeBranch("")).toBe("Kota Gorontalo");
    expect(normalizeBranch("   ")).toBe("Kota Gorontalo");
  });

  it("resolves legacy branch names to canonical names", () => {
    expect(normalizeBranch("Cabang Utama")).toBe("Kota Gorontalo");
    expect(normalizeBranch("cabang utama")).toBe("Kota Gorontalo");
    expect(normalizeBranch("utama")).toBe("Kota Gorontalo");
    expect(normalizeBranch("Main Branch")).toBe("Kota Gorontalo");
    expect(normalizeBranch("gorontalo")).toBe("Kota Gorontalo");
    expect(normalizeBranch("kota")).toBe("Kota Gorontalo");
  });

  it("normalizes case and whitespace for canonical branches", () => {
    expect(normalizeBranch("kota gorontalo")).toBe("Kota Gorontalo");
    expect(normalizeBranch("  bone bolango  ")).toBe("Bone Bolango");
    expect(normalizeBranch("POHUWATO")).toBe("Pohuwato");
    expect(normalizeBranch("limboto")).toBe("Limboto");
  });

  it("preserves unknown or custom branches as cleaned strings", () => {
    expect(normalizeBranch("Campus Alpha")).toBe("Campus Alpha");
    expect(normalizeBranch("  Online Special  ")).toBe("Online Special");
  });

  it("correctly matches branch filters with legacy alias support", () => {
    expect(matchesBranchFilter("Cabang Utama", "Kota Gorontalo")).toBe(true);
    expect(matchesBranchFilter("Kota Gorontalo", "cabang utama")).toBe(true);
    expect(matchesBranchFilter("bone bolango", "Bone Bolango")).toBe(true);
    expect(matchesBranchFilter("Limboto", "all")).toBe(true);
    expect(matchesBranchFilter("Limboto", "")).toBe(true);
    expect(matchesBranchFilter(null, "all")).toBe(true);
    expect(matchesBranchFilter(null, "Kota Gorontalo")).toBe(false);
    expect(matchesBranchFilter("   ", "Kota Gorontalo")).toBe(false);
    expect(matchesBranchFilter("Pohuwato", "Limboto")).toBe(false);
  });
});
