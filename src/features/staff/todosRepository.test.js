import { beforeEach, describe, expect, it, vi } from "vitest";
import { fake } from "../../test/firestoreFake.js";
import {
  createTodo,
  toggleTodoComplete,
  updateTodo,
  deleteTodo,
} from "./todosRepository.js";

vi.mock(
  "firebase/firestore",
  async () => (await import("../../test/firestoreFake.js")).firestoreModule
);
vi.mock("../../firebase", () => ({ db: {}, auth: {} }));

beforeEach(() => fake.reset());

describe("createTodo", () => {
  it("defaults branch to DEFAULT_BRANCH (Kota Gorontalo) when omitted", async () => {
    await createTodo({
      text: "Daily opening checklist",
      type: "directive",
      createdBy: "admin1",
      createdByName: "Admin User",
    });

    const op = fake.opsOf("add")[0];
    expect(op.path.startsWith("todos/")).toBe(true);
    expect(op.data).toMatchObject({
      text: "Daily opening checklist",
      type: "directive",
      completed: false,
      completedAt: null,
      branch: "Kota Gorontalo",
      createdBy: "admin1",
      createdByName: "Admin User",
    });
  });

  it("normalizes legacy alias 'Cabang Utama' to 'Kota Gorontalo'", async () => {
    await createTodo({
      text: "Check sound system",
      branch: "Cabang Utama",
    });

    const op = fake.opsOf("add")[0];
    expect(op.data.branch).toBe("Kota Gorontalo");
  });

  it("normalizes casing and trims whitespace for other branches", async () => {
    await createTodo({
      text: "Restock markers",
      branch: "  bone bolango  ",
    });

    const op = fake.opsOf("add")[0];
    expect(op.data.branch).toBe("Bone Bolango");
  });
});

describe("toggleTodoComplete", () => {
  it("marks todo as complete with audit info", async () => {
    await toggleTodoComplete("t1", true, { uid: "u1", displayName: "Rina" });
    const op = fake.find("todos/t1");
    expect(op.kind).toBe("update");
    expect(op.data).toMatchObject({
      completed: true,
      completedBy: "u1",
      completedByName: "Rina",
    });
    expect(op.data.completedAt).toBeDefined();
  });

  it("unmarks todo as complete and clears audit info", async () => {
    await toggleTodoComplete("t1", false);
    const op = fake.find("todos/t1");
    expect(op.kind).toBe("update");
    expect(op.data).toMatchObject({
      completed: false,
      completedAt: null,
      completedBy: null,
      completedByName: null,
    });
  });
});

describe("updateTodo", () => {
  it("updates todo fields and sets updatedAt timestamp", async () => {
    await updateTodo("t1", { text: "Updated directive", priority: "high" });
    const op = fake.find("todos/t1");
    expect(op.kind).toBe("update");
    expect(op.data).toMatchObject({
      text: "Updated directive",
      priority: "high",
    });
    expect(op.data.updatedAt).toBeDefined();
  });

  it("normalizes branch if branch is in the update payload", async () => {
    await updateTodo("t1", { branch: "pohuwato" });
    const op = fake.find("todos/t1");
    expect(op.data.branch).toBe("Pohuwato");
  });
});

describe("deleteTodo", () => {
  it("deletes the todo document by id", async () => {
    await deleteTodo("t1");
    const op = fake.find("todos/t1");
    expect(op.kind).toBe("delete");
  });
});
