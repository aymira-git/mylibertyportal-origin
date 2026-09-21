import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fake } from "../../test/firestoreFake.js";
import { createInvite, deleteInvite, INVITE_EXPIRATION_DAYS } from "./invitesRepository.js";

vi.mock(
  "firebase/firestore",
  async () => (await import("../../test/firestoreFake.js")).firestoreModule
);
vi.mock("../../firebase", () => ({ db: {}, auth: {} }));

const MOCK_TOKEN = "12345678-1234-1234-1234-1234567890ab";

beforeEach(() => {
  fake.reset();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-21T02:00:00.000Z"));
  vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(MOCK_TOKEN);
});
afterEach(() => vi.useRealTimers());

describe("createInvite", () => {
  it("uses the random token as the document id and stores a clean, lower-case email", async () => {
    await createInvite("  Rina@School.ID ", "instructor");
    const op = fake.find(`invites/${MOCK_TOKEN}`);
    expect(op.kind).toBe("set");
    expect(op.data).toMatchObject({
      email: "rina@school.id",
      role: "instructor",
      branch: "Kota Gorontalo",
      used: false,
      token: MOCK_TOKEN,
    });
  });

  it("expires after the configured number of days", async () => {
    await createInvite("a@b.id", "instructor");
    const { createdAt, expiresAt } = fake.find(`invites/${MOCK_TOKEN}`).data;
    expect(INVITE_EXPIRATION_DAYS).toBe(7);
    expect(expiresAt - new Date(createdAt).getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("keeps a chosen branch, and defaults an empty one", async () => {
    await createInvite("a@b.id", "manager", "Cabang Timur");
    expect(fake.find(`invites/${MOCK_TOKEN}`).data.branch).toBe("Cabang Timur");
    fake.reset();
    await createInvite("a@b.id", "manager", "");
    expect(fake.find(`invites/${MOCK_TOKEN}`).data.branch).toBe("Kota Gorontalo");
  });

  it("throws validation error for invalid email or role", () => {
    expect(() => createInvite("not-an-email", "instructor")).toThrow();
    expect(() => createInvite("valid@school.id", "invalid_role")).toThrow();
  });
});

describe("deleteInvite", () => {
  it("deletes by id", async () => {
    await deleteInvite(MOCK_TOKEN);
    expect(fake.find(`invites/${MOCK_TOKEN}`).kind).toBe("delete");
  });
});
