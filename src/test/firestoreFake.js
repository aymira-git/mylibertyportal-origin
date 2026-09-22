/**
 * A tiny in-memory stand-in for `firebase/firestore`, used only by tests.
 *
 * Why it exists: the repository files (classesRepository, paymentsRepository,
 * ...) talk to Firestore. Tests must never touch the real database, so they
 * swap the real module for this fake. The fake does two things:
 *   1. serves reads from data you seed with `fake.seed(...)`
 *   2. records every write in `fake.ops` so a test can check exactly what
 *      would have been saved.
 *
 * Batches and transactions only add to `fake.ops` when they COMMIT, and a
 * transaction that throws adds nothing. That mirrors real Firestore, so
 * "all-or-nothing" behaviour can be tested honestly.
 */
import { vi } from "vitest";

const store = new Map(); // "collection" -> Map(id -> data)
let autoId = 0;

export const fake = {
  ops: [],
  failWhen: null, // (op) => Error | null — lets a test force a write to fail
  failCommit: null, // Error to throw from the next batch.commit()

  reset() {
    store.clear();
    autoId = 0;
    fake.ops = [];
    fake.failWhen = null;
    fake.failCommit = null;
  },

  seed(collectionName, docs) {
    const col = new Map();
    docs.forEach((d) => {
      const { id, ...rest } = d;
      col.set(id, rest);
    });
    store.set(collectionName, col);
  },

  opsOf(kind) {
    return fake.ops.filter((o) => o.kind === kind);
  },

  find(path) {
    return fake.ops.find((o) => o.path === path);
  },
};

const refOf = (path) => ({ path, id: path.split("/").pop() });
const newId = () => `auto-${++autoId}`;

function record(kind, ref, data, opts, via, sink) {
  const op = { kind, path: ref.path, data, opts: opts ?? null, via };
  const err = fake.failWhen?.(op);
  if (err) return Promise.reject(err);
  (sink || fake.ops).push(op);
  return Promise.resolve();
}

function snapshotOf(path) {
  const [col, id] = path.split("/");
  const data = store.get(col)?.get(id);
  return { id, exists: () => data !== undefined, data: () => data };
}

function runQuery(q) {
  let rows = [];
  if (q.isCollectionGroup) {
    for (const [colName, col] of store.entries()) {
      if (colName === q.path || colName.endsWith("/" + q.path)) {
        for (const [id, data] of col.entries()) {
          rows.push({ id, data, path: `${colName}/${id}` });
        }
      }
    }
  } else {
    const colName = q.path ?? q.collectionPath;
    const col = store.get(colName) ?? new Map();
    rows = [...col.entries()].map(([id, data]) => ({ id, data, path: `${colName}/${id}` }));
  }

  for (const c of q.constraints ?? []) {
    if (c.type !== "where") continue;
    rows = rows.filter(({ id, data }) => {
      const v = c.field?.__isDocId || c.field === "__name__" ? id : data[c.field];
      if (c.op === "==") return v === c.value;
      if (c.op === ">=") return v >= c.value;
      if (c.op === "<=") return v <= c.value;
      if (c.op === ">") return v > c.value;
      if (c.op === "<") return v < c.value;
      if (c.op === "in") return Array.isArray(c.value) ? c.value.includes(v) : false;
      return true;
    });
  }

  for (const c of q.constraints ?? []) {
    if (c.type === "orderBy") {
      rows.sort((a, b) => {
        const valA = a.data[c.field] ?? "";
        const valB = b.data[c.field] ?? "";
        const cmp = String(valA).localeCompare(String(valB));
        return c.direction === "desc" ? -cmp : cmp;
      });
    }
  }

  for (const c of q.constraints ?? []) {
    if (c.type === "limit") {
      rows = rows.slice(0, c.n);
    }
  }

  const docs = rows.map((r) => ({ id: r.id, data: () => r.data, ref: refOf(r.path) }));
  return { docs, empty: docs.length === 0 };
}

export const firestoreModule = {
  collection: vi.fn((_db, name) => ({ path: name, isCollection: true })),
  collectionGroup: vi.fn((_db, name) => ({ path: name, isCollectionGroup: true })),
  doc: vi.fn((first, ...rest) => {
    if (first?.isCollection) return refOf(`${first.path}/${newId()}`);
    return refOf(rest.join("/"));
  }),
  query: vi.fn((col, ...constraints) => ({
    collectionPath: col.path,
    path: col.path,
    isCollectionGroup: col.isCollectionGroup,
    constraints,
  })),
  where: vi.fn((field, op, value) => ({ type: "where", field, op, value })),
  orderBy: vi.fn((field, direction = "asc") => ({ type: "orderBy", field, direction })),
  limit: vi.fn((n) => ({ type: "limit", n })),
  documentId: vi.fn(() => ({ __isDocId: true })),
  onSnapshot: vi.fn((q, onNext) => {
    const res = q.path && !q.isCollectionGroup && !q.isCollection && !q.constraints
      ? snapshotOf(q.path)
      : runQuery(q);
    onNext(res);
    return () => {};
  }),
  getDocs: vi.fn(async (q) =>
    runQuery(q)
  ),
  getDoc: vi.fn(async (ref) => snapshotOf(ref.path)),
  addDoc: vi.fn((col, data) =>
    record("add", refOf(`${col.path}/${newId()}`), data, null, "direct")
  ),
  setDoc: vi.fn((ref, data, opts) => record("set", ref, data, opts, "direct")),
  updateDoc: vi.fn((ref, data) => record("update", ref, data, null, "direct")),
  deleteDoc: vi.fn((ref) => record("delete", ref, null, null, "direct")),
  arrayUnion: vi.fn((...items) => ({ __op: "arrayUnion", items })),
  deleteField: vi.fn(() => ({ __op: "deleteField" })),
  serverTimestamp: vi.fn(() => ({ __op: "serverTimestamp" })),
  writeBatch: vi.fn(() => {
    const pending = [];
    return {
      set: (ref, data, opts) =>
        void pending.push({ kind: "set", path: ref.path, data, opts: opts ?? null, via: "batch" }),
      update: (ref, data) =>
        void pending.push({ kind: "update", path: ref.path, data, opts: null, via: "batch" }),
      delete: (ref) =>
        void pending.push({ kind: "delete", path: ref.path, data: null, opts: null, via: "batch" }),
      commit: async () => {
        if (fake.failCommit) {
          const e = fake.failCommit;
          fake.failCommit = null;
          throw e;
        }
        fake.ops.push(...pending);
      },
    };
  }),
  runTransaction: vi.fn(async (_db, fn) => {
    const pending = [];
    const tx = {
      get: async (ref) => snapshotOf(ref.path),
      set: (ref, data, opts) =>
        void pending.push({
          kind: "set",
          path: ref.path,
          data,
          opts: opts ?? null,
          via: "transaction",
        }),
      update: (ref, data) =>
        void pending.push({ kind: "update", path: ref.path, data, opts: null, via: "transaction" }),
    };
    const result = await fn(tx); // if fn throws, nothing below runs -> nothing is written
    fake.ops.push(...pending);
    return result;
  }),
};
