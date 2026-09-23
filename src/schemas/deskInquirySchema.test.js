import { describe, it, expect } from "vitest";
import { deskInquirySchema } from "./deskInquirySchema";

describe("deskInquirySchema", () => {
  it("validates a complete valid walk-in inquiry", () => {
    const data = {
      parentName: "Ibu Nur",
      phone: "081234567890",
      studentName: "Adit",
      ageOrGrade: "Grade 4",
      program: "Elementary English",
      branch: "Kota Gorontalo",
      division: "courses",
      status: "inquired",
      notes: "Looking for afternoon schedule",
      createdBy: "staff-123",
      createdByName: "Front Desk Sarah",
    };

    const result = deskInquirySchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("fails if parentName is missing", () => {
    const result = deskInquirySchema.safeParse({
      phone: "081234567890",
      studentName: "Adit",
    });
    expect(result.success).toBe(false);
  });

  it("fails if studentName is missing", () => {
    const result = deskInquirySchema.safeParse({
      parentName: "Ibu Nur",
      phone: "081234567890",
    });
    expect(result.success).toBe(false);
  });

  it("fails if phone is too short", () => {
    const result = deskInquirySchema.safeParse({
      parentName: "Ibu Nur",
      studentName: "Adit",
      phone: "123",
    });
    expect(result.success).toBe(false);
  });

  it("applies defaults for optional fields", () => {
    const parsed = deskInquirySchema.parse({
      parentName: "Pak Budi",
      phone: "085299998888",
      studentName: "Siti",
    });

    expect(parsed.status).toBe("inquired");
    expect(parsed.division).toBe("courses");
    expect(parsed.notes).toBe("");
    expect(parsed.ageOrGrade).toBe("");
  });

  it("safely handles null values for optional fields and normalizes division", () => {
    const parsed = deskInquirySchema.parse({
      parentName: "Pak Budi",
      phone: "085299998888",
      studentName: "Siti",
      ageOrGrade: null,
      program: null,
      notes: null,
      branch: null,
      division: "kids school",
      createdBy: null,
      createdByName: null,
    });

    expect(parsed.division).toBe("kindergarten");
    expect(parsed.branch).toBe("Kota Gorontalo");
    expect(parsed.notes).toBe("");
    expect(parsed.ageOrGrade).toBe("");
    expect(parsed.program).toBe("");
  });

  it("handles dob, fluencyTier, currentLevel, and programId fields correctly", () => {
    const parsed = deskInquirySchema.parse({
      parentName: "Ibu Maya",
      phone: "081299990000",
      studentName: "Doni",
      dob: "2018-05-15",
      fluencyTier: "intermediate",
      currentLevel: "master",
      programId: "english_course",
      program: "English Course",
    });

    expect(parsed.dob).toBe("2018-05-15");
    expect(parsed.fluencyTier).toBe("intermediate");
    expect(parsed.currentLevel).toBe("master");
    expect(parsed.programId).toBe("english_course");
  });
});
