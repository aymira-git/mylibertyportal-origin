import { describe, it, expect } from "vitest";
import { INQUIRY_STATUSES } from "../../../schemas/deskInquirySchema";
import { createDeskInquiry } from "./deskInquiriesRepository";

describe("deskInquiriesRepository statuses", () => {
  it("defines standard desk inquiry lifecycle statuses", () => {
    expect(INQUIRY_STATUSES).toContain("inquired");
    expect(INQUIRY_STATUSES).toContain("follow_up_sent");
    expect(INQUIRY_STATUSES).toContain("enrolled");
    expect(INQUIRY_STATUSES).toContain("closed");
  });

  it("throws clear human-readable error on missing required fields", async () => {
    await expect(
      createDeskInquiry({
        parentName: "",
        studentName: "Child",
        phone: "0812345678",
      })
    ).rejects.toThrow("Parent / visitor name is required.");

    await expect(
      createDeskInquiry({
        parentName: "Parent",
        studentName: "",
        phone: "0812345678",
      })
    ).rejects.toThrow("Prospective student name is required.");

    await expect(
      createDeskInquiry({
        parentName: "Parent",
        studentName: "Child",
        phone: "123",
      })
    ).rejects.toThrow("Valid phone number is required");
  });
});
