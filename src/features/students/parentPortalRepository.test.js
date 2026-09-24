import { describe, it, expect } from "vitest";
import { normalizePhoneDigits, lookupStudentForParent } from "./parentPortalRepository";

describe("Parent Portal Repository", () => {
  it("normalizes phone numbers to standard country code format", () => {
    expect(normalizePhoneDigits("081234567890")).toBe("6281234567890");
    expect(normalizePhoneDigits("+62 812-3456-7890")).toBe("6281234567890");
    expect(normalizePhoneDigits("")).toBe("");
  });

  it("handles short or empty search terms gracefully", async () => {
    const results = await lookupStudentForParent("a");
    expect(results).toEqual([]);
  });
});
