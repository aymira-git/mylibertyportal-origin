import { describe, expect, it } from "vitest";
import {
  buildApplicantWhatsAppUrl,
  filterApplications,
  findDuplicates,
  getDistinctValues,
  getDobKey,
  getNameKey,
  getPhoneKey,
  isPending,
  sortPlacementBatches,
} from "./admissionsUtils.js";

describe("isPending", () => {
  it("treats a missing status as pending", () => {
    expect(isPending({})).toBe(true);
    expect(isPending({ status: "pending" })).toBe(true);
    expect(isPending({ status: "approved" })).toBe(false);
    expect(isPending(null)).toBe(true);
  });
});

describe("matching keys", () => {
  it("normalises phone numbers and rejects ones that are too short", () => {
    expect(getPhoneKey("0812-3456-7890")).toBe("6281234567890");
    expect(getPhoneKey("+62 812 3456 7890")).toBe("6281234567890");
    expect(getPhoneKey("12345")).toBe("");
    expect(getPhoneKey("")).toBe("");
    expect(getPhoneKey(null)).toBe("");
  });

  it("makes name keys ignore case, punctuation, spacing and word order", () => {
    expect(getNameKey("Budi  Santoso")).toBe(getNameKey("santoso, BUDI"));
    expect(getNameKey("Budi-Santoso.")).toBe("budi santoso");
    expect(getNameKey("")).toBe("");
    expect(getNameKey("123 !!!")).toBe("");
  });

  it("keeps accented letters in names", () => {
    expect(getNameKey("José Núñez")).toBe("josé núñez");
  });

  it("makes date-of-birth keys the same for different written formats", () => {
    expect(getDobKey("2010-05-03")).toBe(getDobKey("03/05/2010"));
    expect(getDobKey("5/3/2010")).toBe(getDobKey("2010-05-03"));
  });

  it("returns an empty key for unusable dates", () => {
    expect(getDobKey("")).toBe("");
    expect(getDobKey("May 2010")).toBe("");
    expect(getDobKey(null)).toBe("");
  });

  // Known trade-off: sorting the numbers makes day/month order irrelevant (good,
  // because Google Forms writes dates in the form's locale) but it also means
  // 3 May and 5 March of the same year look identical.
  it("treats 3 May 2010 and 5 March 2010 as the same key (documented trade-off)", () => {
    expect(getDobKey("2010-05-03")).toBe(getDobKey("2010-03-05"));
  });
});

describe("findDuplicates", () => {
  const app = { id: "app1", displayName: "Budi Santoso", phone: "081234567890", dob: "2010-05-03" };
  const student = (over) => ({
    id: "s1",
    role: "student",
    displayName: "Someone Else",
    phone: "",
    dob: "",
    ...over,
  });

  it("returns empty results for no application", () => {
    expect(findDuplicates(null, [student()], [])).toEqual({ students: [], pendingTwins: [] });
  });

  it("flags a student with the same phone number as a strong match", () => {
    const { students } = findDuplicates(app, [student({ phone: "+62 812-3456-7890" })]);
    expect(students).toHaveLength(1);
    expect(students[0]).toMatchObject({
      strength: "strong",
      reason: "Phone number matches existing student",
    });
  });

  it("flags same name + same date of birth as strong", () => {
    const { students } = findDuplicates(app, [
      student({ displayName: "Santoso Budi", dob: "03/05/2010" }),
    ]);
    expect(students[0]).toMatchObject({
      strength: "strong",
      reason: "Name and date of birth match existing student",
    });
  });

  it("flags the same name alone as only possible", () => {
    const { students } = findDuplicates(app, [
      student({ displayName: "budi santoso", dob: "1999-01-01" }),
    ]);
    expect(students[0].strength).toBe("possible");
  });

  it("ignores different people and staff accounts", () => {
    const { students } = findDuplicates(app, [
      student({ displayName: "Ani Wijaya" }),
      student({ id: "t1", role: "instructor", phone: "081234567890" }),
    ]);
    expect(students).toEqual([]);
  });

  it("finds twins among other pending applications, but never the application itself", () => {
    const twin = {
      id: "app2",
      status: "pending",
      displayName: "Budi Santoso",
      phone: "0812 3456 7890",
    };
    const { pendingTwins } = findDuplicates(app, [], [app, twin]);
    expect(pendingTwins).toHaveLength(1);
    expect(pendingTwins[0]).toMatchObject({ app: twin, strength: "strong" });
  });

  it("ignores applications that were already approved or rejected", () => {
    const done = [
      { id: "a2", status: "approved", displayName: "Budi Santoso" },
      { id: "a3", status: "rejected", phone: "081234567890" },
    ];
    expect(findDuplicates(app, [], done).pendingTwins).toEqual([]);
  });

  it("does not match two blank phone numbers or two blank names", () => {
    const blank = { id: "app9", displayName: "", phone: "" };
    expect(
      findDuplicates(
        blank,
        [student({ displayName: "", phone: "" })],
        [{ id: "x", displayName: "", phone: "" }]
      )
    ).toEqual({
      students: [],
      pendingTwins: [],
    });
  });
});

describe("buildApplicantWhatsAppUrl", () => {
  const app = {
    displayName: " Budi ",
    phone: "081234567890",
    fatherPhone: "",
    motherPhone: "0899 8888 7777",
    program: "IELTS",
  };

  it("builds a link to the applicant with an encoded message", () => {
    const url = buildApplicantWhatsAppUrl({ target: "applicant", app });
    expect(url.startsWith("https://wa.me/6281234567890?text=")).toBe(true);
    const text = decodeURIComponent(url.split("text=")[1]);
    expect(text).toContain("Budi");
    expect(text).toContain("IELTS");
  });

  it("uses the father's number, then the mother's, for the parent link", () => {
    expect(buildApplicantWhatsAppUrl({ target: "parent", app })).toContain("wa.me/6289988887777");
    expect(
      buildApplicantWhatsAppUrl({ target: "parent", app: { ...app, fatherPhone: "081111111111" } })
    ).toContain("wa.me/6281111111111");
  });

  it("returns null when there is no usable number, or no application", () => {
    expect(
      buildApplicantWhatsAppUrl({ target: "applicant", app: { ...app, phone: "123" } })
    ).toBeNull();
    expect(buildApplicantWhatsAppUrl({ target: "parent", app: { displayName: "X" } })).toBeNull();
    expect(buildApplicantWhatsAppUrl({ target: "applicant", app: null })).toBeNull();
  });

  it("falls back to 'General Program' when no program is given", () => {
    const url = buildApplicantWhatsAppUrl({
      target: "applicant",
      app: { phone: "081234567890", displayName: "A" },
    });
    expect(decodeURIComponent(url)).toContain("General Program");
  });
});

describe("filterApplications", () => {
  const apps = [
    {
      id: "1",
      status: "pending",
      displayName: "Ani",
      branch: "Cabang Utama",
      program: "General",
      submittedAt: "2026-09-01T00:00:00Z",
      phone: "0811",
    },
    {
      id: "2",
      status: "pending",
      displayName: "Budi",
      branch: "Cabang Timur",
      program: "IELTS",
      submittedAt: "2026-09-10T00:00:00Z",
      schoolOrJob: "SMA 1 Gorontalo",
    },
    { id: "3", displayName: "Citra", program: "general", submittedAt: "2026-09-05T00:00:00Z" }, // no status = pending
    {
      id: "4",
      status: "approved",
      displayName: "Dedi",
      approvedAt: "2026-09-12T00:00:00Z",
      submittedAt: "2026-08-01T00:00:00Z",
    },
    {
      id: "5",
      status: "approved",
      displayName: "Eka",
      approvedAt: "2026-09-15T00:00:00Z",
      submittedAt: "2026-08-02T00:00:00Z",
    },
    {
      id: "6",
      status: "rejected",
      displayName: "Fani",
      rejectedAt: "2026-09-02T00:00:00Z",
      submittedAt: "2026-08-03T00:00:00Z",
    },
  ];
  const ids = (list) => list.map((a) => a.id);

  it("shows pending applications (including ones with no status), newest submission first", () => {
    expect(ids(filterApplications({ apps }))).toEqual(["2", "3", "1"]);
  });

  it("sorts approved by approval date and rejected by rejection date", () => {
    expect(ids(filterApplications({ apps, view: "approved" }))).toEqual(["5", "4"]);
    expect(ids(filterApplications({ apps, view: "rejected" }))).toEqual(["6"]);
  });

  it("shows everything for an unknown view", () => {
    expect(filterApplications({ apps, view: "all" })).toHaveLength(6);
  });

  it("filters by branch and program, ignoring case", () => {
    expect(ids(filterApplications({ apps, branch: "cabang timur" }))).toEqual(["2"]);
    expect(ids(filterApplications({ apps, program: "GENERAL" }))).toEqual(["3", "1"]);
  });

  it("searches name, phone and school", () => {
    expect(ids(filterApplications({ apps, search: "  budi " }))).toEqual(["2"]);
    expect(ids(filterApplications({ apps, search: "0811" }))).toEqual(["1"]);
    expect(ids(filterApplications({ apps, search: "gorontalo" }))).toEqual(["2"]);
  });

  it("does not crash on an empty list", () => {
    expect(filterApplications({})).toEqual([]);
  });

  it("does not change the list passed in", () => {
    const copy = [...apps];
    filterApplications({ apps });
    expect(apps).toEqual(copy);
  });
});

describe("getDistinctValues", () => {
  it("returns sorted unique non-empty values for a field", () => {
    const apps = [
      { program: "IELTS" },
      { program: " General " },
      { program: "IELTS" },
      { program: "" },
      {},
    ];
    expect(getDistinctValues(apps, "program")).toEqual(["General", "IELTS"]);
  });
});

describe("sortPlacementBatches", () => {
  const cPohuwatoWarrior = {
    id: "p1",
    className: "Pohuwato Warrior",
    branch: "Pohuwato",
    classLevel: "warrior",
  };
  const cGorontaloWarrior = {
    id: "g1",
    className: "Gorontalo Warrior",
    branch: "Kota Gorontalo",
    classLevel: "warrior",
  };
  const cGorontaloMaster = {
    id: "g2",
    className: "Gorontalo Master",
    branch: "Kota Gorontalo",
    classLevel: "master",
  };
  const cBoneBolangoWarrior = {
    id: "b1",
    className: "Bone Bolango Warrior",
    branch: "Bone Bolango",
    classLevel: "warrior",
  };

  it("prioritizes cohorts matching the applicant's branch first", () => {
    const classes = [cGorontaloWarrior, cPohuwatoWarrior, cBoneBolangoWarrior];
    const sorted = sortPlacementBatches(classes, {
      selectedLevel: "warrior",
      appBranch: "Pohuwato",
    });
    expect(sorted.map((c) => c.id)).toEqual(["p1", "b1", "g1"]);
  });

  it("within the matching branch, prioritizes cohorts compatible with selected level", () => {
    const classes = [cGorontaloMaster, cGorontaloWarrior, cPohuwatoWarrior];
    const sorted = sortPlacementBatches(classes, {
      selectedLevel: "warrior",
      appBranch: "Kota Gorontalo",
    });
    // g1 (Gorontalo + compatible warrior) comes before g2 (Gorontalo + incompatible master), which comes before p1 (different branch)
    expect(sorted.map((c) => c.id)).toEqual(["g1", "g2", "p1"]);
  });

  it("handles legacy alias matching in appBranch", () => {
    const classes = [cPohuwatoWarrior, cGorontaloWarrior];
    const sorted = sortPlacementBatches(classes, {
      selectedLevel: "warrior",
      appBranch: "Cabang Utama", // legacy alias maps to Kota Gorontalo
    });
    expect(sorted[0].id).toBe("g1");
  });
});
