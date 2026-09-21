import { describe, expect, it } from "vitest";
import { formatPunctuality, formatTime } from "./managerUtils.js";

describe("formatTime", () => {
  it("returns N/A for an empty value", () => {
    expect(formatTime(null)).toBe("N/A");
    expect(formatTime("")).toBe("N/A");
  });

  it("returns a short clock time for a valid ISO string", () => {
    expect(formatTime("2026-09-21T02:05:00.000Z")).toMatch(/\d{1,2}[:.]\d{2}/);
  });
});

describe("formatPunctuality", () => {
  it("defaults to On Time (green) when nothing is recorded", () => {
    expect(formatPunctuality({})).toMatchObject({ label: "On Time", classes: expect.stringContaining("emerald") });
  });

  it("shows the minutes for LATE (rose) and EARLY (blue)", () => {
    expect(formatPunctuality({ punctualityStatus: "LATE", minutesEarlyOrLate: 12 })).toMatchObject({
      label: "12m late", classes: expect.stringContaining("rose"),
    });
    expect(formatPunctuality({ punctualityStatus: "EARLY", minutesEarlyOrLate: -7 })).toMatchObject({
      label: "7m early", classes: expect.stringContaining("blue"),
    });
  });

  it("falls back to a plain label when minutes are missing", () => {
    expect(formatPunctuality({ punctualityStatus: "LATE" }).label).toBe("Late");
    expect(formatPunctuality({ punctualityStatus: "EARLY" }).label).toBe("Early");
  });

  // The kiosk saves punctualityStatus as "On time" / "Late" / "Unscheduled" /
  // "Present" (features/attendance/punctuality.js + shiftsRepository.js). This
  // function looks for "LATE" / "EARLY" / "ON_TIME", so a late shift is shown as
  // a green "On Time" in the Manager overview. StaffDutyTab already accepts both
  // spellings. Expectation below is a proposal — open to challenge.
  it("shows a shift the kiosk saved as 'Late' as late (rose)", () => {
    const r = formatPunctuality({ punctualityStatus: "Late", minutesEarlyOrLate: -20 });
    expect(r.classes).toContain("rose");
    expect(r.label).toBe("20m late");
  });
});
