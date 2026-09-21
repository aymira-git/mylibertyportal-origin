import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDuration, getEnrollment, openWhatsAppParentChat } from "./classesUtils.js";

describe("getEnrollment", () => {
  const cls = {
    enrollments: [
      { studentId: "s1", level: "elite" },
      { studentId: "s2", level: "master" },
    ],
  };

  it("finds a student's enrollment record", () => {
    expect(getEnrollment(cls, "s2")).toEqual({ studentId: "s2", level: "master" });
  });

  it("returns an empty object when the student or the list is missing", () => {
    expect(getEnrollment(cls, "nobody")).toEqual({});
    expect(getEnrollment({}, "s1")).toEqual({});
  });
});

describe("getDuration", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-21T02:00:00Z")); // 21 Sep 2026, 10:00 WITA
  });
  afterEach(() => vi.useRealTimers());

  it.each([null, undefined, "", "not-a-date"])("says 'Not recorded' for %s", (v) => {
    expect(getDuration(v)).toBe("Not recorded");
  });

  it("says 'Joined this month' for less than one full month", () => {
    expect(getDuration("2026-09-01")).toBe("Joined this month");
    expect(getDuration("2026-08-25")).toBe("Joined this month"); // 27 days, day-of-month not reached
  });

  it("counts whole months, only once the day of month has been reached", () => {
    expect(getDuration("2026-08-21")).toBe("1 mo");
    expect(getDuration("2026-08-22")).toBe("Joined this month"); // one day short of a month
    expect(getDuration("2026-06-10")).toBe("3 mos");
  });

  it("switches to years and months", () => {
    expect(getDuration("2025-08-21")).toBe("1 yr 1 mo");
    expect(getDuration("2025-09-21")).toBe("1 yr");
    expect(getDuration("2024-09-21")).toBe("2 yrs");
  });

  it("handles long-tenured students (7+ years)", () => {
    expect(getDuration("2019-06-15")).toBe("7 yrs 3 mos");
  });
});

describe("openWhatsAppParentChat", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { open: vi.fn() });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("opens WhatsApp with a normalised number and an encoded message", () => {
    openWhatsAppParentChat("0812-3456-7890", "Budi", { className: "Warrior A" }, vi.fn());
    const [url, target] = /** @type {any} */ (window.open).mock.calls[0];
    expect(target).toBe("_blank");
    expect(url.startsWith("https://wa.me/6281234567890?text=")).toBe(true);
    expect(decodeURIComponent(url)).toContain("Budi");
    expect(decodeURIComponent(url)).toContain("Warrior A");
  });

  it("falls back to 'siswa' when the student has no name", () => {
    openWhatsAppParentChat("081234567890", "", { className: "A" }, vi.fn());
    expect(decodeURIComponent(/** @type {any} */ (window.open).mock.calls[0][0])).toContain(
      "siswa"
    );
  });

  it("shows an error toast and does not open anything when the phone is empty", () => {
    const toast = vi.fn();
    openWhatsAppParentChat("", "Budi", { className: "A" }, toast);
    expect(window.open).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith("No valid parent phone number recorded.", "error");
  });

  it("does not crash when no toast function is passed", () => {
    expect(() => openWhatsAppParentChat("", "Budi", { className: "A" })).not.toThrow();
  });
});
