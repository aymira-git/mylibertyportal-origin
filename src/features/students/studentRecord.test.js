import { describe, expect, it } from "vitest";
import { buildStudentRecord, isActiveStudent, STUDENT_STATUS_OPTIONS } from "./studentRecord.js";

describe("buildStudentRecord", () => {
  it("fills safe defaults for an empty form", () => {
    const r = buildStudentRecord();
    expect(r).toMatchObject({
      displayName: "",
      currentLevel: "warrior",
      rating: "1",
      paymentPlan: "monthly",
      status: "active",
      role: "student",
      gender: "",
      dob: "",
      joinedDate: "",
    });
  });

  it("trims text fields and stringifies numbers", () => {
    const r = buildStudentRecord({
      displayName: "  Budi  ",
      phone: 81234567890,
      address: "\n Jl. Sam Ratulangi ",
    });
    expect(r.displayName).toBe("Budi");
    expect(r.phone).toBe("81234567890");
    expect(r.address).toBe("Jl. Sam Ratulangi");
  });

  it("always sets role to student, even if a different role is passed in", () => {
    expect(buildStudentRecord({ role: "admin" }).role).toBe("student");
  });

  it("takes parent name and phone from the father, then the mother, then the legacy field", () => {
    expect(buildStudentRecord({ fatherName: "Ayah", motherName: "Ibu" }).parentName).toBe("Ayah");
    expect(buildStudentRecord({ motherName: "Ibu", parentName: "Old" }).parentName).toBe("Ibu");
    expect(buildStudentRecord({ parentName: "Old", parentPhone: "0811" })).toMatchObject({
      parentName: "Old",
      parentPhone: "0811",
    });
    expect(buildStudentRecord({ fatherPhone: "0811", motherPhone: "0822" }).parentPhone).toBe(
      "0811"
    );
  });

  it("only includes paidUntil when one was given", () => {
    expect(buildStudentRecord({})).not.toHaveProperty("paidUntil");
    expect(buildStudentRecord({ paidUntil: " 2026-12-21 " }).paidUntil).toBe("2026-12-21");
  });

  it("keeps a supplied level, plan, status and join date", () => {
    const r = buildStudentRecord({
      currentLevel: "epic",
      paymentPlan: "annual",
      status: "on_leave",
      joinedDate: "2019-06-15",
      rating: "4",
    });
    expect(r).toMatchObject({
      currentLevel: "epic",
      paymentPlan: "annual",
      status: "on_leave",
      joinedDate: "2019-06-15",
      rating: "4",
    });
  });

  it("produces the same set of fields every time, so both callers stay in step", () => {
    expect(Object.keys(buildStudentRecord({ paidUntil: "2026-12-01" })).sort()).toEqual(
      [...Object.keys(buildStudentRecord({})), "paidUntil"].sort()
    );
  });

  it("normalizes branch to DEFAULT_BRANCH and canonicalizes branch names", () => {
    expect(buildStudentRecord().branch).toBe("Kota Gorontalo");
    expect(buildStudentRecord({ branch: "Cabang Utama" }).branch).toBe("Kota Gorontalo");
    expect(buildStudentRecord({ branch: " limboto " }).branch).toBe("Limboto");
  });
});

describe("isActiveStudent", () => {
  it("treats a missing status as active, and other statuses as not", () => {
    expect(isActiveStudent({})).toBe(true);
    expect(isActiveStudent({ status: "active" })).toBe(true);
    expect(isActiveStudent({ status: "on_leave" })).toBe(false);
    expect(isActiveStudent(null)).toBe(false);
  });
});

describe("STUDENT_STATUS_OPTIONS", () => {
  it("lists the four student statuses", () => {
    expect(STUDENT_STATUS_OPTIONS.map((o) => o.value)).toEqual([
      "active",
      "on_leave",
      "graduated",
      "inactive",
    ]);
  });
});
