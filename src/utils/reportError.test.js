import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { fake } from "../test/firestoreFake.js";
import { reportError, initGlobalErrorListeners } from "./reportError.js";

vi.mock(
  "firebase/firestore",
  async () => (await import("../test/firestoreFake.js")).firestoreModule
);

vi.mock("../firebase", () => ({
  db: { fakeDb: true },
  auth: { currentUser: { uid: "test-user-123", email: "tester@myliberty.id" } },
}));

beforeEach(() => {
  fake.reset();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("reportError", () => {
  it("logs error to console and writes entry to errorLogs in Firestore", async () => {
    const error = new Error("Something went wrong");
    await reportError(error, "test_context");

    expect(console.error).toHaveBeenCalled();
    const ops = fake.opsOf("add");
    expect(ops.length).toBe(1);
    expect(ops[0].path).toMatch(/^errorLogs\//);
    expect(ops[0].data).toMatchObject({
      message: "Something went wrong",
      context: "test_context",
      userId: "test-user-123",
      userEmail: "tester@myliberty.id",
    });
    expect(ops[0].data.stack).toBeTruthy();
    expect(ops[0].data.timestamp).toBeTruthy();
    expect(ops[0].data.createdAt).toEqual({ __op: "serverTimestamp" });
  });

  it("handles non-Error objects and string messages cleanly", async () => {
    await reportError("A raw string error", "raw_context");
    let ops = fake.opsOf("add");
    expect(ops[ops.length - 1].data.message).toBe("A raw string error");
    expect(ops[ops.length - 1].data.stack).toBeNull();

    await reportError({ customCode: 500, detail: "Server error" }, "obj_context");
    ops = fake.opsOf("add");
    expect(ops[ops.length - 1].data.message).toContain("customCode");
  });

  it("deduplicates identical errors occurring within cooldown window", async () => {
    const error = new Error("Rapid loop error");
    await reportError(error, "loop_context");
    expect(fake.opsOf("add").length).toBe(1);

    // Immediate second call should be ignored by deduplication
    await reportError(error, "loop_context");
    expect(fake.opsOf("add").length).toBe(1);

    // Fast-forward 11 seconds past COOLDOWN_MS (10s)
    vi.advanceTimersByTime(11000);

    // After cooldown, should log again
    await reportError(error, "loop_context");
    expect(fake.opsOf("add").length).toBe(2);
  });

  it("never throws when Firestore persistence fails (fail-safe)", async () => {
    fake.failWhen = () => new Error("Firestore unavailable");

    await expect(
      reportError(new Error("Database disconnected"), "network_fail_safe")
    ).resolves.not.toThrow();

    expect(console.warn).toHaveBeenCalledWith(
      "[REPORT_ERROR_PERSIST_FAILED]",
      "Firestore unavailable"
    );
  });
});

describe("initGlobalErrorListeners", () => {
  const originalWindow = globalThis.window;

  afterEach(() => {
    if (originalWindow !== undefined) {
      globalThis.window = originalWindow;
    } else {
      delete globalThis.window;
    }
  });

  it("does nothing when window is undefined (SSR / Node environment)", () => {
    delete globalThis.window;
    expect(() => initGlobalErrorListeners()).not.toThrow();
  });

  it("attaches error and unhandledrejection listeners to window when available", async () => {
    const listeners = {};
    /** @type {any} */ (globalThis).window = {
      addEventListener: vi.fn((event, handler) => {
        listeners[event] = handler;
      }),
      location: { href: "http://localhost:3000" },
    };

    initGlobalErrorListeners();

    expect(globalThis.window.addEventListener).toHaveBeenCalledWith("error", expect.any(Function));
    expect(globalThis.window.addEventListener).toHaveBeenCalledWith(
      "unhandledrejection",
      expect.any(Function)
    );

    // Verify error event triggers reportError
    listeners["error"]({ error: new Error("Window error") });
    await Promise.resolve();
    expect(fake.opsOf("add").length).toBe(1);
    expect(fake.opsOf("add")[0].data.context).toBe("uncaught_window_error");

    // Verify unhandledrejection event triggers reportError
    listeners["unhandledrejection"]({ reason: new Error("Promise rejection") });
    await Promise.resolve();
    expect(fake.opsOf("add").length).toBe(2);
    expect(fake.opsOf("add")[1].data.context).toBe("unhandled_promise_rejection");
  });
});
