import { describe, it, expect } from "vitest";
import {
  BRANCHES,
  DEFAULT_BRANCH,
  DEFAULT_BRANCH_ID,
  BRANCH_MAP,
  LEGACY_BRANCH_MAP,
  normalizeBranch,
  matchesBranchFilter,
  branchToId,
  idToBranch,
} from "./branches";

describe("branches constants and utilities", () => {
  it("defines the 4 canonical branches and IDs", () => {
    expect(BRANCHES).toEqual(["Kota Gorontalo", "Bone Bolango", "Pohuwato", "Limboto"]);
    expect(DEFAULT_BRANCH).toBe("Kota Gorontalo");
    expect(DEFAULT_BRANCH_ID).toBe("kota_gorontalo");
    expect(BRANCH_MAP.kota_gorontalo).toBe("Kota Gorontalo");
  });

  it("converts branch names to branchId slugs correctly", () => {
    expect(branchToId("Kota Gorontalo")).toBe("kota_gorontalo");
    expect(branchToId("Cabang Utama")).toBe("kota_gorontalo");
    expect(branchToId("bone bolango")).toBe("bone_bolango");
    expect(branchToId("Pohuwato")).toBe("pohuwato");
    expect(branchToId("Limboto")).toBe("limboto");
    expect(branchToId(null)).toBe("kota_gorontalo");
    expect(branchToId("")).toBe("kota_gorontalo");
  });

  it("converts branchId slugs to display names correctly", () => {
    expect(idToBranch("kota_gorontalo")).toBe("Kota Gorontalo");
    expect(idToBranch("bone_bolango")).toBe("Bone Bolango");
    expect(idToBranch("pohuwato")).toBe("Pohuwato");
    expect(idToBranch("limboto")).toBe("Limboto");
    expect(idToBranch(null)).toBe("Kota Gorontalo");
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
