import { describe, expect, it } from "vitest";
import { getBatchAvailability } from "./batchAvailability.js";

const ids = (n) => Array.from({ length: n }, (_, i) => `s${i}`);

describe("getBatchAvailability", () => {
  it("treats a missing class as cancelled and closed", () => {
    expect(getBatchAvailability(null)).toEqual({
      studentCount: 0,
      capacity: 15,
      seatsAvailable: 0,
      computedStatus: "cancelled",
      canEnroll: false,
    });
  });

  it("defaults to capacity 15 and status open", () => {
    const r = getBatchAvailability({ studentIds: ids(2) });
    expect(r).toMatchObject({ studentCount: 2, capacity: 15, seatsAvailable: 13, computedStatus: "open", canEnroll: true });
  });

  it("copes with a class that has no studentIds yet", () => {
    expect(getBatchAvailability({ maxCapacity: 10 })).toMatchObject({ studentCount: 0, seatsAvailable: 10 });
  });

  it.each([undefined, null, "", "abc", 0])("falls back to 15 seats when maxCapacity is %s", (maxCapacity) => {
    expect(getBatchAvailability({ maxCapacity }).capacity).toBe(15);
  });

  it("accepts capacity stored as a numeric string", () => {
    expect(getBatchAvailability({ maxCapacity: "8", studentIds: ids(3) })).toMatchObject({ capacity: 8, seatsAvailable: 5 });
  });

  it("becomes 'filling_fast' with 3 or fewer seats left", () => {
    expect(getBatchAvailability({ maxCapacity: 10, studentIds: ids(6) }).computedStatus).toBe("open"); // 4 left
    expect(getBatchAvailability({ maxCapacity: 10, studentIds: ids(7) }).computedStatus).toBe("filling_fast"); // 3 left
    expect(getBatchAvailability({ maxCapacity: 10, studentIds: ids(9) }).computedStatus).toBe("filling_fast"); // 1 left
  });

  it("does not show 'filling_fast' for upcoming batches", () => {
    expect(getBatchAvailability({ status: "upcoming", maxCapacity: 10, studentIds: ids(8) }).computedStatus).toBe("upcoming");
  });

  it("becomes 'full' at capacity, and blocks enrolment", () => {
    const r = getBatchAvailability({ maxCapacity: 10, studentIds: ids(10) });
    expect(r).toMatchObject({ computedStatus: "full", seatsAvailable: 0, canEnroll: false });
  });

  it("never reports negative seats when over-enrolled", () => {
    const r = getBatchAvailability({ maxCapacity: 5, studentIds: ids(7) });
    expect(r.seatsAvailable).toBe(0);
    expect(r.canEnroll).toBe(false);
  });

  it("keeps in_progress batches open to late joiners while seats remain", () => {
    const r = getBatchAvailability({ status: "in_progress", maxCapacity: 10, studentIds: ids(4) });
    expect(r).toMatchObject({ computedStatus: "in_progress", canEnroll: true });
  });

  it("does not enrol into an in_progress batch that has no seats", () => {
    expect(getBatchAvailability({ status: "in_progress", maxCapacity: 4, studentIds: ids(4) }).canEnroll).toBe(false);
  });

  it.each(["cancelled", "completed"])("never allows enrolment into a %s batch", (status) => {
    const r = getBatchAvailability({ status, maxCapacity: 10, studentIds: ids(1) });
    expect(r.computedStatus).toBe(status);
    expect(r.canEnroll).toBe(false);
  });
});
