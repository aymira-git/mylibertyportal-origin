import { describe, it, expect, beforeEach } from "vitest";
import {
  calculateAge,
  COURSE_TIER_OPTIONS,
  KINDERGARTEN_TIER_OPTIONS,
  isPermissionError,
  getLocalInquiries,
  saveLocalInquiry,
  updateLocalInquiry,
  deleteLocalInquiry,
  LOCAL_INQUIRIES_STORAGE_KEY,
} from "./walkInUtils";

describe("calculateAge helper", () => {
  it("calculates age accurately based on date of birth", () => {
    const today = new Date();
    const tenYearsAgo = `${today.getFullYear() - 10}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    expect(calculateAge(tenYearsAgo)).toBe(10);
  });

  it("handles birthday not reached yet this year", () => {
    const today = new Date();
    // If not December, test next month
    if (today.getMonth() < 11) {
      const nextMonth = today.getMonth() + 2;
      const dob = `${today.getFullYear() - 10}-${String(nextMonth).padStart(2, "0")}-15`;
      expect(calculateAge(dob)).toBe(9);
    }
  });

  it("handles empty or invalid dates gracefully", () => {
    expect(calculateAge("")).toBeNull();
    expect(calculateAge(null)).toBeNull();
    expect(calculateAge("invalid-date")).toBeNull();
  });
});

describe("Tier Options", () => {
  it("has beginner, intermediate, and fluent tiers configured for courses", () => {
    const courseTierIds = COURSE_TIER_OPTIONS.map((t) => t.id);
    expect(courseTierIds).toEqual(["beginner", "intermediate", "fluent"]);

    const beginner = COURSE_TIER_OPTIONS.find((t) => t.id === "beginner");
    expect(beginner.defaultLevel).toBe("warrior");
  });

  it("has beginner, intermediate, and fluent tiers configured for kindergarten", () => {
    const kgTierIds = KINDERGARTEN_TIER_OPTIONS.map((t) => t.id);
    expect(kgTierIds).toEqual(["beginner", "intermediate", "fluent"]);

    const beginner = KINDERGARTEN_TIER_OPTIONS.find((t) => t.id === "beginner");
    expect(beginner.defaultLevel).toBe("nursery");
  });
});

describe("isPermissionError", () => {
  it("correctly identifies Firestore permission denied errors", () => {
    expect(isPermissionError({ code: "permission-denied" })).toBe(true);
    expect(isPermissionError({ code: "PERMISSION_DENIED" })).toBe(true);
    expect(
      isPermissionError(new Error("Failed to load desk inquiries: Missing or insufficient permissions."))
    ).toBe(true);
    expect(isPermissionError(new Error("insufficient permissions"))).toBe(true);
    expect(isPermissionError({ code: "not-found", message: "Not found" })).toBe(false);
    expect(isPermissionError(null)).toBe(false);
  });
});

describe("Local Storage inquiries fallback", () => {
  beforeEach(() => {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.removeItem(LOCAL_INQUIRIES_STORAGE_KEY);
    }
  });

  it("saves, retrieves, updates, and deletes inquiries locally", () => {
    const saved = saveLocalInquiry({
      parentName: "Parent A",
      studentName: "Student A",
      phone: "08123456789",
      status: "inquired",
    });

    expect(saved.isLocal).toBe(true);
    expect(saved.id).toContain("local-");

    const list = getLocalInquiries();
    expect(list.length).toBe(1);
    expect(list[0].parentName).toBe("Parent A");

    updateLocalInquiry(saved.id, { status: "enrolled" });
    const afterUpdate = getLocalInquiries();
    expect(afterUpdate[0].status).toBe("enrolled");

    deleteLocalInquiry(saved.id);
    const afterDelete = getLocalInquiries();
    expect(afterDelete.length).toBe(0);
  });
});

