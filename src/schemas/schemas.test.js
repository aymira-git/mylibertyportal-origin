import { describe, expect, it } from "vitest";
import {
  inviteSchema,
  paymentRecordSchema,
  studentIdSchema,
  batchSchema,
  applicationSchema,
  corporateEventSchema,
  schoolMasterSchema,
  schoolVisitSchema,
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

  it("validates invite with division and defaults to courses", () => {
    const defaultDiv = inviteSchema.parse({
      email: "staff@myliberty.id",
      role: "instructor",
    });
    expect(defaultDiv.division).toBe("courses");

    const kidsDiv = inviteSchema.parse({
      email: "kindergarten@myliberty.id",
      role: "instructor",
      division: "kindergarten",
    });
    expect(kidsDiv.division).toBe("kindergarten");
  });

  it("rejects marketing role for kindergarten division", () => {
    expect(() =>
      inviteSchema.parse({
        email: "market@myliberty.id",
        role: "marketing",
        division: "kindergarten",
      })
    ).toThrow(/Marketing role is not available for Kindergarten division/);
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
    expect(parsed.programId).toBe("english_course");
    expect(parsed.batchType).toBe("reguler");
  });

  it("normalizes batchType and accepts canonical and alias values", () => {
    const priv = batchSchema.parse({
      className: "Private 101",
      classLevel: "warrior",
      batchType: "PRIVATE",
    });
    expect(priv.batchType).toBe("private");

    const threeRs = batchSchema.parse({
      className: "Calistung Prep",
      classLevel: "starters",
      batchType: "3Rs",
    });
    expect(threeRs.batchType).toBe("the_three_rs");

    const regAlias = batchSchema.parse({
      className: "Standard Group",
      classLevel: "elite",
      batchType: "regular",
    });
    expect(regAlias.batchType).toBe("reguler");
  });

  it("normalizes programId and derives division in batch creation", () => {
    const parsed = batchSchema.parse({
      className: "TOEFL Prep 1",
      classLevel: "toefl_intermediate",
      programId: "TOEFL",
    });
    expect(parsed.programId).toBe("toefl");
    expect(parsed.division).toBe("courses");

    const kidsParsed = batchSchema.parse({
      className: "TK-A Morning Cohort",
      classLevel: "tk_a",
      programId: "kids_school",
    });
    expect(kidsParsed.programId).toBe("kids_school");
    expect(kidsParsed.division).toBe("kindergarten");
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
    expect(parsed.programId).toBe("english_course");
    expect(parsed.division).toBe("courses");
    expect(parsed.batchType).toBe("reguler");
  });

  it("normalizes batchType from classType or explicit batchType while preserving classType", () => {
    const fromClassType = applicationSchema.parse({
      displayName: "Jane Doe",
      classType: "Private",
    });
    expect(fromClassType.batchType).toBe("private");
    expect(fromClassType.classType).toBe("Private");

    const fromBatchType = applicationSchema.parse({
      displayName: "Alex Doe",
      batchType: "the_three_rs",
      classType: "Three Rs",
    });
    expect(fromBatchType.batchType).toBe("the_three_rs");
    expect(fromBatchType.classType).toBe("Three Rs");
  });

  it("normalizes program and derives division for student applications", () => {
    const parsed = applicationSchema.parse({
      displayName: "Child Student",
      program: "Kids Course",
    });
    expect(parsed.program).toBe("Kids Course");
    expect(parsed.programId).toBe("kids_course");
    expect(parsed.division).toBe("courses");

    const kindergartenApp = applicationSchema.parse({
      displayName: "Little Timmy",
      program: "Kids School",
    });
    expect(kindergartenApp.programId).toBe("kids_school");
    expect(kindergartenApp.division).toBe("kindergarten");
  });

  it("rejects empty student displayName", () => {
    expect(() =>
      applicationSchema.parse({
        displayName: "   ",
      })
    ).toThrow(/Student name is required/);
  });

  it("normalizes branch to DEFAULT_BRANCH when missing or legacy alias", () => {
    const missing = applicationSchema.parse({
      displayName: "Jane Doe",
    });
    expect(missing.branch).toBe("Kota Gorontalo");

    const legacy = applicationSchema.parse({
      displayName: "Jane Doe",
      branch: "Cabang Utama",
    });
    expect(legacy.branch).toBe("Kota Gorontalo");

    const clean = applicationSchema.parse({
      displayName: "Jane Doe",
      branch: "  bone bolango  ",
    });
    expect(clean.branch).toBe("Bone Bolango");
  });
});

describe("corporateEventSchema", () => {
  it("validates a valid corporate event with audienceType all", () => {
    const event = corporateEventSchema.parse({
      name: "All-Hands Annual Gathering",
      eventDate: "2026-10-15",
      audienceType: "all",
    });
    expect(event.name).toBe("All-Hands Annual Gathering");
    expect(event.eventDate).toBe("2026-10-15");
    expect(event.audienceType).toBe("all");
    expect(event.audienceValue).toBeNull();
    expect(event.status).toBe("active");
  });

  it("normalizes branch and division audience values", () => {
    const branchEvt = corporateEventSchema.parse({
      name: "Campus Training",
      eventDate: "2026-10-15",
      audienceType: "branch",
      audienceValue: "cabang utama",
    });
    expect(branchEvt.audienceValue).toBe("Kota Gorontalo");

    const divEvt = corporateEventSchema.parse({
      name: "Kindergarten Workshop",
      eventDate: "2026-10-15",
      audienceType: "division",
      audienceValue: "kids school",
    });
    expect(divEvt.audienceValue).toBe("kindergarten");
  });

  it("validates role audience including manager", () => {
    const roleEvt = corporateEventSchema.parse({
      name: "Management Sync",
      eventDate: "2026-10-15",
      audienceType: "role",
      audienceValue: "manager",
    });
    expect(roleEvt.audienceValue).toBe("manager");
  });

  it("rejects invalid roles for audience", () => {
    expect(() =>
      corporateEventSchema.parse({
        name: "Invalid Role Event",
        eventDate: "2026-10-15",
        audienceType: "role",
        audienceValue: "student",
      })
    ).toThrow(/Allowed roles/);
  });

  it("rejects missing audienceValue when audienceType is not all", () => {
    expect(() =>
      corporateEventSchema.parse({
        name: "Branch Event",
        eventDate: "2026-10-15",
        audienceType: "branch",
        audienceValue: "",
      })
    ).toThrow(/Audience value is required/);
  });

  it("rejects invalid date format", () => {
    expect(() =>
      corporateEventSchema.parse({
        name: "Bad Date Event",
        eventDate: "15-10-2026",
        audienceType: "all",
      })
    ).toThrow(/YYYY-MM-DD/);
  });
});

describe("schoolMasterSchema", () => {
  it("validates a valid school master payload with defaults", () => {
    const valid = schoolMasterSchema.parse({
      name: "SMAN 1 Gorontalo",
      lat: 0.5512,
      lng: 123.0583,
    });
    expect(valid.name).toBe("SMAN 1 Gorontalo");
    expect(valid.municipality).toBe("Kota Gorontalo");
    expect(valid.tier).toBe("SMA");
    expect(valid.status).toBe("pending");
    expect(valid.active).toBe(true);
  });

  it("validates SD tier successfully", () => {
    const sd = schoolMasterSchema.parse({
      name: "SDN 1 Kota Tengah Gorontalo",
      lat: 0.552,
      lng: 123.059,
      tier: "SD",
    });
    expect(sd.tier).toBe("SD");
  });

  it("rejects coordinates outside geographic limits", () => {
    expect(() =>
      schoolMasterSchema.parse({
        name: "Out of Bounds",
        lat: 91,
        lng: 123,
      })
    ).toThrow(/Latitude must be between -90 and 90/);

    expect(() =>
      schoolMasterSchema.parse({
        name: "Out of Bounds",
        lat: 0.5,
        lng: -185,
      })
    ).toThrow(/Longitude must be between -180 and 180/);
  });
});

describe("schoolVisitSchema", () => {
  it("validates a complete visit log", () => {
    const visit = schoolVisitSchema.parse({
      visitDate: "2026-09-23",
      contactName: "Ibu Nurhayati",
      contactRole: "Guru BK",
      flyersHandedOut: 40,
      leadsCollected: 15,
    });
    expect(visit.visitDate).toBe("2026-09-23");
    expect(visit.contactName).toBe("Ibu Nurhayati");
    expect(visit.flyersHandedOut).toBe(40);
    expect(visit.leadsCollected).toBe(15);
    expect(visit.statusAfterVisit).toBe("visited");
  });

  it("rejects negative flyer and lead counts", () => {
    expect(() =>
      schoolVisitSchema.parse({
        visitDate: "2026-09-23",
        contactName: "Ibu Nurhayati",
        contactRole: "Guru BK",
        flyersHandedOut: -1,
      })
    ).toThrow(/Flyers count cannot be negative/);
  });
});
