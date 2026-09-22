import { beforeEach, describe, expect, it, vi } from "vitest";
import { fake } from "../../test/firestoreFake.js";
import {
  createCorporateEvent,
  updateCorporateEvent,
  cancelCorporateEvent,
} from "./corporateEventsRepository.js";

vi.mock(
  "firebase/firestore",
  async () => (await import("../../test/firestoreFake.js")).firestoreModule
);
vi.mock("../../firebase", () => ({ db: {}, auth: {} }));

beforeEach(() => fake.reset());

describe("corporateEventsRepository", () => {
  describe("createCorporateEvent", () => {
    it("creates an active corporate event with normalized data", async () => {
      await createCorporateEvent(
        {
          name: "Annual Gathering",
          eventDate: "2026-10-15",
          audienceType: "all",
        },
        "admin-1"
      );

      const op = fake.opsOf("add")[0];
      expect(op.path.startsWith("corporateEvents/")).toBe(true);
      expect(op.data).toMatchObject({
        name: "Annual Gathering",
        eventDate: "2026-10-15",
        audienceType: "all",
        audienceValue: null,
        status: "active",
        createdBy: "admin-1",
      });
    });

    it("normalizes branch audience on creation", async () => {
      await createCorporateEvent(
        {
          name: "Campus Workshop",
          eventDate: "2026-10-15",
          audienceType: "branch",
          audienceValue: "cabang utama",
        },
        "admin-1"
      );

      const op = fake.opsOf("add")[0];
      expect(op.data.audienceValue).toBe("Kota Gorontalo");
    });

    it("rejects invalid event payload via schema", () => {
      expect(() =>
        createCorporateEvent(
          {
            name: "",
            eventDate: "invalid-date",
            audienceType: "all",
          },
          "admin-1"
        )
      ).toThrow();
    });
  });

  describe("updateCorporateEvent", () => {
    it("updates event fields", async () => {
      await updateCorporateEvent("evt-123", { name: "Updated Name" });
      const op = fake.find("corporateEvents/evt-123");
      expect(op.data).toMatchObject({
        name: "Updated Name",
      });
    });
  });

  describe("cancelCorporateEvent", () => {
    it("soft-cancels an event without deleting it", async () => {
      await cancelCorporateEvent("evt-123", "admin-uid");
      const op = fake.find("corporateEvents/evt-123");
      expect(op.data).toMatchObject({
        status: "cancelled",
        cancelledBy: "admin-uid",
      });
    });
  });
});
