import { describe, expect, it } from "vitest";
import {
  canDeleteStaff,
  filterStaffMembers,
  getDistinctStaffBranches,
  getInstructorWorkload,
  isActiveClass,
} from "./staffUtils.js";

describe("isActiveClass", () => {
  it("treats missing status as open, and cancelled/completed as inactive", () => {
    expect(isActiveClass({})).toBe(true);
    expect(isActiveClass({ status: "in_progress" })).toBe(true);
    expect(isActiveClass({ status: "cancelled" })).toBe(false);
    expect(isActiveClass({ status: "completed" })).toBe(false);
    expect(isActiveClass(null)).toBe(false);
  });
});

describe("getInstructorWorkload", () => {
  const classes = [
    { id: "c1", instructorId: "i1", studentIds: ["a", "b"] },
    { id: "c2", instructorId: "i1", studentIds: ["b", "c"] }, // b is in two classes
    { id: "c3", instructorId: "i1", status: "completed", studentIds: ["z"] },
    { id: "c4", instructorId: "i2", studentIds: ["q"] },
  ];

  it("counts active batches and unique students only", () => {
    const w = getInstructorWorkload("i1", classes);
    expect(w.batchCount).toBe(2);
    expect(w.studentCount).toBe(3);
    expect(w.assignedClasses.map((c) => c.id)).toEqual(["c1", "c2"]);
  });

  it("returns zeros without an instructor id or without classes", () => {
    expect(getInstructorWorkload("", classes)).toEqual({
      assignedClasses: [],
      batchCount: 0,
      studentCount: 0,
    });
    expect(getInstructorWorkload("i1")).toMatchObject({ batchCount: 0, studentCount: 0 });
  });

  it("copes with a class that has no studentIds", () => {
    expect(getInstructorWorkload("i1", [{ id: "c", instructorId: "i1" }])).toMatchObject({
      batchCount: 1,
      studentCount: 0,
    });
  });
});

describe("canDeleteStaff", () => {
  const classes = [
    { id: "c1", className: "Warrior A", instructorId: "i1" },
    { id: "c2", className: "Old", instructorId: "i2", status: "completed" },
  ];

  it("rejects a missing user", () => {
    expect(canDeleteStaff(null)).toEqual({ canDelete: false, reason: "Invalid staff user." });
  });

  it("never lets an admin delete their own account", () => {
    const r = canDeleteStaff({ id: "me" }, [], "me");
    expect(r.canDelete).toBe(false);
    expect(r.reason).toContain("own");
  });

  it("blocks deleting an instructor who still has active classes, naming them", () => {
    const r = canDeleteStaff({ id: "i1" }, classes, "admin");
    expect(r.canDelete).toBe(false);
    expect(r.reason).toContain("Warrior A");
    expect(r.reason).toContain("1 active class");
  });

  it("allows deleting an instructor whose classes are all completed or cancelled", () => {
    expect(canDeleteStaff({ id: "i2" }, classes, "admin")).toEqual({ canDelete: true, reason: "" });
  });

  it("allows deleting staff with no classes", () => {
    expect(canDeleteStaff({ id: "f1" }, classes)).toEqual({ canDelete: true, reason: "" });
  });
});

describe("filterStaffMembers", () => {
  const users = [
    {
      id: "1",
      role: "instructor",
      displayName: "Rina",
      email: "rina@x.id",
      branch: "Cabang Utama",
    },
    {
      id: "2",
      role: "frontoffice",
      displayName: "Andi",
      nickname: "Dede",
      status: "on_leave",
      branch: "cabang timur",
    },
    { id: "3", role: "student", displayName: "Budi" },
    { id: "4", role: "instructor", displayName: "Citra", phone: "0812", status: "resigned" },
  ];
  const names = (list) => list.map((u) => u.displayName);

  it("excludes students and sorts by name", () => {
    expect(names(filterStaffMembers({ users }))).toEqual(["Andi", "Citra", "Rina"]);
  });

  it("filters by role, status (missing = active) and branch (case-insensitive)", () => {
    expect(names(filterStaffMembers({ users, roleFilter: "instructor" }))).toEqual([
      "Citra",
      "Rina",
    ]);
    expect(names(filterStaffMembers({ users, statusFilter: "active" }))).toEqual(["Rina"]);
    expect(names(filterStaffMembers({ users, statusFilter: "on_leave" }))).toEqual(["Andi"]);
    expect(names(filterStaffMembers({ users, branchFilter: "Cabang Timur" }))).toEqual(["Andi"]);
  });

  it("searches name, nickname, email and phone", () => {
    expect(names(filterStaffMembers({ users, search: "dede" }))).toEqual(["Andi"]);
    expect(names(filterStaffMembers({ users, search: "RINA@" }))).toEqual(["Rina"]);
    expect(names(filterStaffMembers({ users, search: "0812" }))).toEqual(["Citra"]);
  });

  it("returns an empty list with no input", () => {
    expect(filterStaffMembers({})).toEqual([]);
  });
});

describe("getDistinctStaffBranches", () => {
  it("always includes the standard branch and adds staff branches, ignoring students", () => {
    const users = [
      { role: "instructor", branch: " Cabang Timur " },
      { role: "student", branch: "Cabang Barat" },
      { role: "manager" },
    ];
    expect(getDistinctStaffBranches(users)).toEqual(["Cabang Timur", "Cabang Utama"]);
    expect(getDistinctStaffBranches()).toEqual(["Cabang Utama"]);
  });
});
