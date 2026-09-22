import { beforeEach, describe, expect, it, vi } from "vitest";
import { fake } from "../../../test/firestoreFake.js";
import {
  addSchool,
  updateSchool,
  createSchoolVisit,
  seedInitialSchoolsIfEmpty,
  listenToOutreachVisits,
  getStartOfWeekWita,
  getEndOfWeekWita,
} from "./schoolOutreachRepository.js";

vi.mock(
  "firebase/firestore",
  async () => (await import("../../../test/firestoreFake.js")).firestoreModule
);
vi.mock("../../../firebase", () => ({ db: {}, auth: {} }));

beforeEach(() => fake.reset());

describe("schoolOutreachRepository", () => {
  describe("addSchool", () => {
    it("creates a new school master record with validated fields", async () => {
      await addSchool(
        {
          name: "SMAN 1 Gorontalo",
          municipality: "Kota Gorontalo",
          district: "Kota Tengah",
          address: "Jl. Jend. Sudirman No. 37",
          lat: 0.5512,
          lng: 123.0583,
          tier: "SMA",
        },
        "marketing-user-1"
      );

      const op = fake.opsOf("add")[0];
      expect(op.path.startsWith("schoolOutreach/")).toBe(true);
      expect(op.data).toMatchObject({
        name: "SMAN 1 Gorontalo",
        municipality: "Kota Gorontalo",
        district: "Kota Tengah",
        address: "Jl. Jend. Sudirman No. 37",
        lat: 0.5512,
        lng: 123.0583,
        tier: "SMA",
        active: true,
        status: "pending",
        createdBy: "marketing-user-1",
        updatedBy: "marketing-user-1",
      });
    });

    it("rejects invalid latitude or longitude", async () => {
      await expect(
        addSchool(
          {
            name: "Invalid School",
            lat: 105.0, // Lat > 90
            lng: 123.0,
          },
          "user-1"
        )
      ).rejects.toThrow();

      await expect(
        addSchool(
          {
            name: "Invalid School",
            lat: 0.5,
            lng: 200.0, // Lng > 180
          },
          "user-1"
        )
      ).rejects.toThrow();
    });

    it("rejects empty school name", async () => {
      await expect(
        addSchool(
          {
            name: "   ",
            lat: 0.5,
            lng: 123.0,
          },
          "user-1"
        )
      ).rejects.toThrow();
    });
  });

  describe("updateSchool", () => {
    it("updates school fields and forbids overwriting createdBy/createdAt", async () => {
      await updateSchool(
        "school-123",
        {
          status: "scheduled",
          scheduledDate: "2026-09-25",
          createdBy: "hacker-uid",
          createdAt: "2020-01-01",
        },
        "officer-456"
      );

      const op = fake.opsOf("update")[0];
      expect(op.path).toBe("schoolOutreach/school-123");
      expect(op.data.status).toBe("scheduled");
      expect(op.data.scheduledDate).toBe("2026-09-25");
      expect(op.data.updatedBy).toBe("officer-456");
      expect(op.data.createdBy).toBeUndefined();
      expect(op.data.createdAt).toBeUndefined();
    });
  });

  describe("createSchoolVisit", () => {
    it("atomically writes visit subcollection doc and updates parent summary", async () => {
      const visitId = await createSchoolVisit(
        "school-100",
        {
          visitDate: "2026-09-23",
          contactName: "Ibu Nurhayati, S.Pd",
          contactRole: "Guru BK",
          phone: "081234567890",
          flyersHandedOut: 50,
          leadsCollected: 12,
          outcome: "Presentation scheduled for next week",
          notes: "Met in teachers lounge, very welcoming",
          nextActionDate: "2026-09-30",
          statusAfterVisit: "visited",
        },
        "officer-777"
      );

      expect(typeof visitId).toBe("string");

      const sets = fake.opsOf("set");
      const updates = fake.opsOf("update");

      expect(sets.length).toBe(1);
      expect(updates.length).toBe(1);

      // 1. Check visit subcollection write
      expect(sets[0].path).toMatch(/^schoolOutreach\/school-100\/visits\//);
      expect(sets[0].via).toBe("batch");
      expect(sets[0].data).toMatchObject({
        visitDate: "2026-09-23",
        contactName: "Ibu Nurhayati, S.Pd",
        contactRole: "Guru BK",
        phone: "081234567890",
        flyersHandedOut: 50,
        leadsCollected: 12,
        outcome: "Presentation scheduled for next week",
        notes: "Met in teachers lounge, very welcoming",
        nextActionDate: "2026-09-30",
        statusAfterVisit: "visited",
        createdBy: "officer-777",
      });

      // 2. Check parent summary update
      expect(updates[0].path).toBe("schoolOutreach/school-100");
      expect(updates[0].via).toBe("batch");
      expect(updates[0].data).toMatchObject({
        status: "visited",
        lastVisitDate: "2026-09-23",
        lastContactName: "Ibu Nurhayati, S.Pd",
        lastContactRole: "Guru BK",
        lastOutcome: "Presentation scheduled for next week",
        nextActionDate: "2026-09-30",
        updatedBy: "officer-777",
      });
    });

    it("rejects negative flyer or lead counts", async () => {
      await expect(
        createSchoolVisit(
          "school-100",
          {
            visitDate: "2026-09-23",
            contactName: "Pak Rahman",
            contactRole: "Kepala Sekolah",
            flyersHandedOut: -5,
            leadsCollected: 10,
          },
          "officer-777"
        )
      ).rejects.toThrow();

      await expect(
        createSchoolVisit(
          "school-100",
          {
            visitDate: "2026-09-23",
            contactName: "Pak Rahman",
            contactRole: "Kepala Sekolah",
            flyersHandedOut: 10,
            leadsCollected: -2,
          },
          "officer-777"
        )
      ).rejects.toThrow();
    });

    it("rejects invalid visitDate format", async () => {
      await expect(
        createSchoolVisit(
          "school-100",
          {
            visitDate: "23-09-2026", // Invalid, should be YYYY-MM-DD
            contactName: "Pak Rahman",
            contactRole: "Kepala Sekolah",
          },
          "officer-777"
        )
      ).rejects.toThrow();
    });
  });

  describe("seedInitialSchoolsIfEmpty", () => {
    it("seeds default schools when collection is empty", async () => {
      const result = await seedInitialSchoolsIfEmpty("admin-seed");
      expect(result.seeded).toBe(true);
      expect(result.count).toBeGreaterThan(0);

      const setOps = fake.opsOf("set");
      expect(setOps.length).toBe(result.count);
      expect(setOps[0].path.startsWith("schoolOutreach/")).toBe(true);
      expect(setOps[0].data.municipality).toBe("Kota Gorontalo");
    });

    it("does not seed if collection already has documents", async () => {
      fake.seed("schoolOutreach", [{ id: "existing-1", name: "Existing High" }]);

      const result = await seedInitialSchoolsIfEmpty("admin-seed");
      expect(result.seeded).toBe(false);
      expect(result.count).toBe(1);

      expect(fake.opsOf("set").length).toBe(0);
    });
  });

  describe("listenToOutreachVisits", () => {
    it("subscribes to all visits across schools via collectionGroup", () => {
      fake.seed("schoolOutreach/school-1/visits", [
        { id: "v1", visitDate: "2026-09-21", contactName: "Ibu Siti", flyersHandedOut: 20 },
      ]);
      fake.seed("schoolOutreach/school-2/visits", [
        { id: "v2", visitDate: "2026-09-22", contactName: "Pak Budi", flyersHandedOut: 30 },
      ]);

      let receivedVisits = [];
      const unsub = listenToOutreachVisits((visits) => {
        receivedVisits = visits;
      });

      expect(receivedVisits.length).toBe(2);
      expect(receivedVisits[0].id).toBe("v2"); // Sorted descending
      expect(receivedVisits[1].id).toBe("v1");
      unsub();
    });
  });

  describe("WITA week calculations", () => {
    it("calculates correct Monday and Sunday for WITA dates", () => {
      // Tuesday 2026-09-22 10:00 WITA -> Monday is 2026-09-21, Sunday is 2026-09-27
      const tuesday = new Date("2026-09-22T02:00:00.000Z"); // 10:00 WITA
      expect(getStartOfWeekWita(tuesday)).toBe("2026-09-21");
      expect(getEndOfWeekWita(tuesday)).toBe("2026-09-27");

      // Sunday 2026-09-27 20:00 WITA
      const sunday = new Date("2026-09-27T12:00:00.000Z"); // 20:00 WITA
      expect(getStartOfWeekWita(sunday)).toBe("2026-09-21");
      expect(getEndOfWeekWita(sunday)).toBe("2026-09-27");
    });
  });
});
