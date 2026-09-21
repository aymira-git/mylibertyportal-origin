import { describe, expect, it } from "vitest";
import {
  inviteSchema,
  paymentRecordSchema,
  studentIdSchema,
  batchSchema,
  applicationSchema,
} from "./index.js";

describe("inviteSchema", () => {
  it("validates a valid invite payload and normalizes email", () => {
    const result = inviteSchema.parse({
      email: "  NewInstructor@MyLiberty.id  ",
      role: "instructor",
    });
    expect(result.email).toBe("newinstructor@myliberty.id");
    expect(result.role).toBe("instructor");
    expect(result.branch).toBe("Kota Gorontalo");
  });

  it("rejects invalid emails", () => {
    expect(() =>
      inviteSchema.parse({
        email: "not-an-email",
        role: "instructor",
      })
    ).toThrow(/valid email/);
  });

  it("rejects unsupported roles", () => {
    expect(() =>
      inviteSchema.parse({
        email: "valid@myliberty.id",
        role: "superadmin_hacker",
      })
    ).toThrow(/Role must be one of/);
  });
});

describe("paymentRecordSchema & studentIdSchema", () => {
  it("validates valid payment record and coerces numeric amount", () => {
    const parsed = paymentRecordSchema.parse({
      amount: "450000",
      period: "October 2026",
      method: "transfer",
      planId: "monthly",
    });
    expect(parsed.amount).toBe(450000);
    expect(parsed.period).toBe("October 2026");
    expect(parsed.method).toBe("transfer");
    expect(parsed.planId).toBe("monthly");
  });

  it("rejects zero or negative payment amount", () => {
    expect(() =>
      paymentRecordSchema.parse({
        amount: 0,
        period: "October 2026",
        method: "transfer",
        planId: "monthly",
      })
    ).toThrow(/greater than 0/);

    expect(() =>
      paymentRecordSchema.parse({
        amount: -50000,
        period: "October 2026",
        method: "transfer",
        planId: "monthly",
      })
    ).toThrow(/greater than 0/);
  });

  it("rejects empty studentId", () => {
    expect(() => studentIdSchema.parse("")).toThrow();
    expect(() => studentIdSchema.parse("   ")).toThrow();
    expect(studentIdSchema.parse("student-123")).toBe("student-123");
  });
});

describe("batchSchema", () => {
  it("validates a valid batch creation payload with defaults", () => {
    const parsed = batchSchema.parse({
      className: "  Warrior Kids A  ",
      classLevel: "warrior",
    });
    expect(parsed.className).toBe("Warrior Kids A");
    expect(parsed.classLevel).toBe("warrior");
    expect(parsed.maxCapacity).toBe(15);
    expect(parsed.minQuorum).toBe(4);
    expect(parsed.status).toBe("open");
    expect(parsed.branch).toBe("Kota Gorontalo");
  });

  it("rejects batch missing name or level", () => {
    expect(() =>
      batchSchema.parse({
        className: "",
        classLevel: "warrior",
      })
    ).toThrow(/Batch name is required/);

    expect(() =>
      batchSchema.parse({
        className: "Class 1",
        classLevel: "",
      })
    ).toThrow(/Class level is required/);
  });
});

describe("applicationSchema", () => {
  it("validates a valid student application record", () => {
    const parsed = applicationSchema.parse({
      displayName: "  John Doe  ",
      phone: "08123456789",
      currentLevel: "elite",
    });
    expect(parsed.displayName).toBe("John Doe");
    expect(parsed.phone).toBe("08123456789");
    expect(parsed.currentLevel).toBe("elite");
    expect(parsed.role).toBe("student");
    expect(parsed.status).toBe("active");
  });

  it("rejects empty student displayName", () => {
    expect(() =>
      applicationSchema.parse({
        displayName: "   ",
      })
    ).toThrow(/Student name is required/);
  });
});
