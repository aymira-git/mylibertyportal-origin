import { describe, expect, it, vi } from "vitest";

const joseMocks = vi.hoisted(() => ({
  jwtVerify: vi.fn(async () => ({ payload: { user_id: "fo1" } })),
  importPKCS8: vi.fn(async () => ({})),
}));

vi.mock("../../../cloudflare-worker/node_modules/jose/dist/node/esm/index.js", () => ({
  ...joseMocks,
  createRemoteJWKSet: vi.fn(() => ({})),
  SignJWT: class {
    setProtectedHeader() { return this; }
    async sign() { return "test-signed-service-token"; }
  },
}));

import worker from "../../../cloudflare-worker/worker.js";
import { isEventEligible } from "../attendance/corporateEvents.js";

const PROJECT_ID = "mylibertyies-f2f38";
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const WORKER_ENV = {
  FIREBASE_SERVICE_ACCOUNT_EMAIL: "worker-test@example.com",
  FIREBASE_SERVICE_ACCOUNT_KEY: "test-private-key",
};

function encodeValue(value) {
  if (value === null) return { nullValue: null };
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(encodeValue) } };
  }
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") return { integerValue: String(value) };
  if (typeof value === "object") {
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(value).map(([key, child]) => [key, encodeValue(child)])
        ),
      },
    };
  }
  return { stringValue: value };
}

function firestoreDocument(collection, id, data, updateTime = "update-1") {
  return {
    name: `${BASE}/${collection}/${id}`,
    updateTime,
    fields: Object.fromEntries(
      Object.entries(data).map(([key, value]) => [key, encodeValue(value)])
    ),
  };
}

function decodeValue(value) {
  if ("stringValue" in value) return value.stringValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("nullValue" in value) return null;
  if ("arrayValue" in value) return (value.arrayValue.values || []).map(decodeValue);
  if ("mapValue" in value) {
    return Object.fromEntries(
      Object.entries(value.mapValue.fields || {}).map(([key, child]) => [key, decodeValue(child)])
    );
  }
  return null;
}

function makeRequest(body) {
  return new Request("https://worker.test/api/v1/parent-link", {
    method: "POST",
    headers: { Authorization: "Bearer test-id-token", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeFirestoreFetch({
  users = {},
  parentQuery = [],
  documents = {},
  commitStatus = 200,
  commitAppliesBeforeError = false,
  beforeCommit = null,
} = {}) {
  const commits = [];
  let updateNumber = 1;
  const dataByPath = { ...documents };
  const getEntry = (path) => {
    const data = dataByPath[path] ?? users[path];
    if (!data) return null;
    return data.data
      ? data
      : { data, updateTime: "update-1" };
  };
  const applyCommit = (writes) => {
    const failedPrecondition = writes.some((write) => {
      const name = write.update?.name || write.delete;
      const path = name?.split("/documents/")[1];
      const entry = path ? getEntry(path) : null;
      if (write.currentDocument?.exists === false) return Boolean(entry);
      if (write.currentDocument?.updateTime) {
        return !entry || entry.updateTime !== write.currentDocument.updateTime;
      }
      return false;
    });
    if (failedPrecondition) return false;

    for (const write of writes) {
      const name = write.update?.name || write.delete;
      const path = name.split("/documents/")[1];
      if (write.delete) {
        delete dataByPath[path];
        delete users[path];
        continue;
      }
      const current = getEntry(path);
      const next = { ...(current?.data || {}) };
      const fields = Object.fromEntries(
        Object.entries(write.update.fields || {}).map(([key, value]) => [key, decodeValue(value)])
      );
      const mask = write.updateMask?.fieldPaths;
      for (const key of mask || Object.keys(fields)) {
        if (Object.hasOwn(fields, key)) next[key] = fields[key];
      }
      for (const transform of write.updateTransforms || []) {
        const oldValues = Array.isArray(next[transform.fieldPath]) ? next[transform.fieldPath] : [];
        if (transform.appendMissingElements) {
          const additions = transform.appendMissingElements.values.map(decodeValue);
          next[transform.fieldPath] = [...oldValues, ...additions.filter((item) => !oldValues.includes(item))];
        } else if (transform.removeAllFromArray) {
          const removals = transform.removeAllFromArray.values.map(decodeValue);
          next[transform.fieldPath] = oldValues.filter((item) => !removals.includes(item));
        }
      }
      dataByPath[path] = { data: next, updateTime: `update-${++updateNumber}` };
    }
    return true;
  };

  const runQuery = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify(
        parentQuery.map((parent) => ({
          document: firestoreDocument("users", parent.id, parent.data),
        }))
      ),
      { status: 200 }
    )
  );

  const fetchMock = vi.fn(async (input, init = {}) => {
    const url = new URL(input instanceof Request ? input.url : input);
    if (url.hostname === "oauth2.googleapis.com") {
      return new Response(JSON.stringify({ access_token: "test-service-token", expires_in: 3600 }), {
        status: 200,
      });
    }
    if (url.pathname.endsWith("/documents:commit")) {
      const body = JSON.parse(init.body);
      commits.push(body);
      beforeCommit?.(body, dataByPath);
      if (commitStatus !== 200 && !commitAppliesBeforeError) {
        return new Response(JSON.stringify({ error: { status: "UNAVAILABLE" } }), { status: commitStatus });
      }
      const applied = applyCommit(body.writes);
      if (!applied) {
        return new Response(JSON.stringify({ error: { status: "FAILED_PRECONDITION" } }), { status: 400 });
      }
      if (commitStatus !== 200) {
        return new Response(JSON.stringify({ error: { status: "UNAVAILABLE" } }), { status: commitStatus });
      }
      return new Response(JSON.stringify({ writeResults: [] }), { status: 200 });
    }
    if (url.pathname.endsWith("/documents:runQuery")) {
      const body = JSON.parse(init.body);
      if (body.structuredQuery.from[0].collectionId === "shifts") {
        const open = Object.entries({ ...users, ...dataByPath })
          .filter(([path, entry]) => path.startsWith("shifts/") && entry.data?.userId === body.structuredQuery.where.compositeFilter.filters[0].fieldFilter.value.stringValue && !entry.data?.clockOut)
          .map(([path, entry]) => ({
            document: firestoreDocument("shifts", path.split("/").pop(), entry.data, entry.updateTime),
          }));
        return new Response(JSON.stringify(open), { status: 200 });
      }
      return runQuery();
    }

    if (init.method === "POST" && url.pathname.endsWith("/documents/kioskAuditEvents")) {
      return new Response(JSON.stringify(firestoreDocument("kioskAuditEvents", "audit-1", {})), { status: 200 });
    }
    const [, collection, id] = url.pathname.match(/\/documents\/([^/]+)\/([^/]+)$/) || [];
    const path = `${collection}/${decodeURIComponent(id || "")}`;
    const entry = getEntry(path);
    if (init.method === "PATCH" && collection === "kioskChallenges" && entry) {
      const currentDocumentTime = new URL(input).searchParams.get("currentDocument.updateTime");
      if (decodeURIComponent(currentDocumentTime || "") !== entry.updateTime) {
        return new Response("", { status: 409 });
      }
      const body = JSON.parse(init.body);
      const nextData = Object.fromEntries(
        Object.entries(body.fields || {}).map(([key, value]) => [key, decodeValue(value)])
      );
      dataByPath[path] = { data: nextData, updateTime: `update-${++updateNumber}` };
      return new Response(JSON.stringify(firestoreDocument(collection, id, nextData, dataByPath[path].updateTime)), { status: 200 });
    }
    if (!entry) return new Response("", { status: 404 });
    return new Response(
      JSON.stringify(firestoreDocument(collection, decodeURIComponent(id), entry.data, entry.updateTime)),
      { status: 200 }
    );
  });

  return { fetchMock, commits, runQuery, dataByPath };
}

function makeKioskRequest(path, body) {
  return new Request(`https://worker.test${path}`, {
    method: "POST",
    headers: { Authorization: "******", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function stubKioskCrypto(shiftId = "new-shift") {
  vi.stubGlobal("crypto", {
    randomUUID: vi.fn(() => shiftId),
    subtle: {
      importKey: vi.fn(async () => ({})),
      verify: vi.fn(async () => true),
    },
  });
}

function kioskDocuments({
  nonce = "challenge-nonce",
  user = {},
  deviceBranch = "kota_gorontalo",
  previousShift = null,
  activeLock = null,
  classDoc = null,
  eventDoc = null,
} = {}) {
  const nowWita = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const documents = {
    "kioskDevices/device1": {
      data: { status: "active", branchId: deviceBranch, publicKeyJwk: {} },
      updateTime: "device-v1",
    },
    "kioskChallenges/device1": {
      data: {
        nonce,
        expiresAt: new Date(Date.now() + 60000).toISOString(),
        consumed: false,
      },
      updateTime: "challenge-v1",
    },
    "users/staff1": {
      data: {
        role: "instructor",
        status: "active",
        branchId: deviceBranch,
        division: "courses",
        displayName: "Test Staff",
        ...user,
      },
      updateTime: "staff-v1",
    },
  };
  if (previousShift) {
    documents["shifts/previous-shift"] = {
      data: {
        userId: "staff1",
        branchId: deviceBranch,
        clockIn: new Date(Date.now() - 3600000).toISOString(),
        clockOut: null,
        ...previousShift,
      },
      updateTime: "shift-v1",
    };
    documents["activeShifts/staff1"] = {
      data: {
        userId: "staff1",
        shiftId: "previous-shift",
        branchId: deviceBranch,
        status: "active",
        ...activeLock,
      },
      updateTime: "lock-v1",
    };
  } else if (activeLock) {
    documents["activeShifts/staff1"] = {
      data: activeLock,
      updateTime: "lock-v1",
    };
  }
  if (classDoc) documents["classes/class1"] = { data: classDoc, updateTime: "class-v1" };
  if (eventDoc) {
    documents["corporateEvents/event1"] = {
      data: {
        name: "Staff Event",
        eventDate: nowWita.toISOString().slice(0, 10),
        audienceType: "all",
        status: "active",
        ...eventDoc,
      },
      updateTime: "event-v1",
    };
  }
  return documents;
}

async function attemptEventClockIn({ eventDoc = {}, user = {} } = {}) {
  stubKioskCrypto();
  const firestore = makeFirestoreFetch({
    documents: kioskDocuments({ eventDoc, user }),
  });
  vi.stubGlobal("fetch", firestore.fetchMock);
  const now = new Date();
  const eventDate = new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const event = {
    name: "Staff Event",
    eventDate,
    audienceType: "all",
    status: "active",
    ...eventDoc,
  };
  const profile = {
    role: "instructor",
    branchId: "kota_gorontalo",
    division: "courses",
    ...user,
  };
  const response = await worker.fetch(
    makeKioskRequest("/api/v1/shift/clock-in", {
      deviceId: "device1",
      badgeToken: "staff1",
      nonce: "challenge-nonce",
      signature: "test-signature",
      classId: "corporate_event:event1",
      eventId: "event1",
    }),
    WORKER_ENV
  );
  return {
    response,
    firestore,
    appEligible: isEventEligible(event, profile, event.eventDate, now),
  };
}

describe("Parent-link Worker endpoint", () => {
  it("links a same-branch active student with an atomic array-union transform", async () => {
    const firestore = makeFirestoreFetch({
      users: {
        "users/fo1": { role: "frontoffice", branchId: "kota_gorontalo", status: "active" },
        "users/parent1": { role: "parent", branchId: "kota_gorontalo", childStudentIds: ["sibling1"] },
        "users/student1": { role: "student", branchId: "kota_gorontalo", status: "active" },
      },
    });
    vi.stubGlobal("fetch", firestore.fetchMock);

    const response = await worker.fetch(makeRequest({ parentUid: "parent1", studentId: "student1" }), WORKER_ENV);

    expect(response.status, JSON.stringify({
      body: await response.clone().text(),
      calls: firestore.fetchMock.mock.calls.map(([input]) => input instanceof Request ? input.url : input),
    })).toBe(200);
    expect(firestore.commits).toHaveLength(1);
    expect(firestore.commits[0].writes[0].updateTransforms[0]).toMatchObject({
      fieldPath: "childStudentIds",
      appendMissingElements: { values: [{ stringValue: "student1" }] },
    });
    expect(firestore.commits[0].writes[0].updateMask.fieldPaths).toEqual(["updatedAt"]);
  });

  it("unlinks only one child, and repeating the unlink remains successful", async () => {
    const firestore = makeFirestoreFetch({
      users: {
        "users/fo1": { role: "frontoffice", branchId: "kota_gorontalo", status: "active" },
        "users/parent1": { role: "parent", branchId: "kota_gorontalo", childStudentIds: ["student1", "sibling1"] },
        "users/student1": { role: "student", branchId: "kota_gorontalo", status: "active" },
      },
    });
    vi.stubGlobal("fetch", firestore.fetchMock);

    const first = await worker.fetch(makeRequest({ action: "unlink", parentUid: "parent1", studentId: "student1" }), WORKER_ENV);
    const retry = await worker.fetch(makeRequest({ action: "unlink", parentUid: "parent1", studentId: "student1" }), WORKER_ENV);

    expect(first.status).toBe(200);
    expect(retry.status).toBe(200);
    expect(firestore.commits).toHaveLength(2);
    for (const commit of firestore.commits) {
      expect(commit.writes[0].updateTransforms[0]).toMatchObject({
        fieldPath: "childStudentIds",
        removeAllFromArray: { values: [{ stringValue: "student1" }] },
      });
    }
    expect(firestore.dataByPath["users/parent1"].data.childStudentIds).toEqual(["sibling1"]);
  });

  it("denies callers from another branch without writing", async () => {
    const firestore = makeFirestoreFetch({
      users: {
        "users/fo1": { role: "frontoffice", branchId: "bone_bolango", status: "active" },
        "users/parent1": { role: "parent", branchId: "kota_gorontalo", childStudentIds: [] },
        "users/student1": { role: "student", branchId: "kota_gorontalo", status: "active" },
      },
    });
    vi.stubGlobal("fetch", firestore.fetchMock);

    const response = await worker.fetch(makeRequest({ parentUid: "parent1", studentId: "student1" }), WORKER_ENV);

    expect(response.status).toBe(403);
    expect(firestore.commits).toHaveLength(0);
  });

  it("allows a child's branch office to unlink a parent assigned to another branch", async () => {
    const firestore = makeFirestoreFetch({
      users: {
        "users/fo1": { role: "frontoffice", branchId: "kota_gorontalo", status: "active" },
        "users/parent1": { role: "parent", branchId: "bone_bolango", childStudentIds: ["student1"] },
        "users/student1": { role: "student", branchId: "kota_gorontalo", status: "active" },
      },
    });
    vi.stubGlobal("fetch", firestore.fetchMock);

    const response = await worker.fetch(
      makeRequest({ action: "unlink", parentUid: "parent1", studentId: "student1" }),
      WORKER_ENV
    );

    expect(response.status).toBe(200);
    expect(firestore.commits).toHaveLength(1);
  });

  it("denies Front Office access outside the caller's division", async () => {
    const firestore = makeFirestoreFetch({
      users: {
        "users/fo1": {
          role: "frontoffice",
          branchId: "kota_gorontalo",
          division: "kindergarten",
          status: "active",
        },
        "users/parent1": { role: "parent", branchId: "kota_gorontalo", childStudentIds: [] },
        "users/student1": {
          role: "student",
          branchId: "kota_gorontalo",
          division: "courses",
          status: "active",
        },
      },
    });
    vi.stubGlobal("fetch", firestore.fetchMock);

    const response = await worker.fetch(
      makeRequest({ parentUid: "parent1", studentId: "student1" }),
      WORKER_ENV
    );

    expect(response.status).toBe(403);
    expect(firestore.commits).toHaveLength(0);
  });

  it("denies unsupported roles and inactive staff without writing", async () => {
    const users = {
      "users/fo1": { role: "instructor", branchId: "kota_gorontalo", status: "active" },
      "users/parent1": { role: "parent", branchId: "kota_gorontalo", childStudentIds: [] },
      "users/student1": { role: "student", branchId: "kota_gorontalo", status: "active" },
    };
    const firestore = makeFirestoreFetch({
      users,
    });
    vi.stubGlobal("fetch", firestore.fetchMock);

    const wrongRole = await worker.fetch(makeRequest({ parentUid: "parent1", studentId: "student1" }), WORKER_ENV);
    expect(wrongRole.status).toBe(403);

    users["users/fo1"] = { role: "frontoffice", branchId: "kota_gorontalo", status: "terminated" };

    const inactive = await worker.fetch(makeRequest({ parentUid: "parent1", studentId: "student1" }), WORKER_ENV);
    expect(inactive.status).toBe(403);
    expect(firestore.commits).toHaveLength(0);
  });

  it("removes a deleted student's links from all parents via a narrow query", async () => {
    const firestore = makeFirestoreFetch({
      users: {
        "users/fo1": { role: "frontoffice", branchId: "kota_gorontalo", status: "active" },
        "users/student1": { role: "student", branchId: "kota_gorontalo", status: "active" },
      },
      parentQuery: [
        { id: "parent1", data: { role: "parent", branchId: "kota_gorontalo", childStudentIds: ["student1", "sibling1"] } },
        { id: "parent2", data: { role: "parent", branchId: "bone_bolango", childStudentIds: ["student1"] } },
      ],
    });
    vi.stubGlobal("fetch", firestore.fetchMock);

    const response = await worker.fetch(makeRequest({ action: "unlink-all", studentId: "student1" }), WORKER_ENV);

    expect(response.status).toBe(200);
    expect(firestore.runQuery).toHaveBeenCalledOnce();
    expect(firestore.commits).toHaveLength(1);
    expect(firestore.commits[0].writes).toHaveLength(2);
    expect(firestore.commits[0].writes.map((write) => write.update.name)).toEqual([
      `${BASE}/users/parent1`,
      `${BASE}/users/parent2`,
    ]);
  });
});

describe("Kiosk Worker shift contracts", () => {
  it.each([
    ["all", { audienceType: "all", audienceValue: null }, { role: "instructor" }],
    ["branch", { audienceType: "branch", audienceValue: "Kota Gorontalo" }, { role: "instructor" }],
    ["division", { audienceType: "division", audienceValue: "kindergarten" }, { role: "instructor", division: "kindergarten" }],
    ["role", { audienceType: "role", audienceValue: "instructor" }, { role: "instructorleader" }],
  ])("accepts an eligible %s audience event using server-side data", async (_name, eventDoc, user) => {
    const { response, firestore, appEligible } = await attemptEventClockIn({ eventDoc, user });
    expect(response.status).toBe(200);
    expect(appEligible).toBe(true);
    expect(firestore.commits).toHaveLength(1);
    expect(firestore.commits[0].writes).toHaveLength(2);
  });

  it.each([
    [
      "wrong branch",
      { audienceType: "branch", audienceValue: "Bone Bolango" },
      { role: "instructor" },
    ],
    [
      "wrong division",
      { audienceType: "division", audienceValue: "kindergarten" },
      { division: "courses" },
    ],
    [
      "wrong role",
      { audienceType: "role", audienceValue: "instructor" },
      { role: "frontoffice" },
    ],
    [
      "inactive event",
      { audienceType: "all", status: "cancelled" },
      { role: "instructor" },
    ],
    [
      "event outside its time window",
      (() => {
        const wita = new Date(Date.now() + 8 * 60 * 60 * 1000);
        const nowMinutes = wita.getUTCHours() * 60 + wita.getUTCMinutes();
        const startMinutes = nowMinutes < 1080 ? nowMinutes + 180 : nowMinutes - 180;
        const endMinutes = (startMinutes + 60) % 1440;
        const format = (minutes) =>
          `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
        return {
          audienceType: "all",
          startTime: format(startMinutes),
          endTime: format(endMinutes),
        };
      })(),
      { role: "instructor" },
    ],
  ])("rejects an event with %s", async (_name, eventDoc, user) => {
    const { response, firestore, appEligible } = await attemptEventClockIn({ eventDoc, user });
    expect(response.status).toBe(403);
    expect(appEligible).toBe(false);
    expect(firestore.commits).toHaveLength(0);
  });

  it("atomically closes a shift and removes its active lock only for a matching branch", async () => {
    stubKioskCrypto();
    const firestore = makeFirestoreFetch({
      documents: kioskDocuments({
        previousShift: { classId: "class0" },
        classDoc: { instructorId: "staff1", branchId: "kota_gorontalo", className: "Class 1" },
      }),
    });
    vi.stubGlobal("fetch", firestore.fetchMock);
    const response = await worker.fetch(
      makeKioskRequest("/api/v1/shift/clock-out", {
        deviceId: "device1",
        shiftId: "previous-shift",
        badgeToken: "staff1",
        nonce: "challenge-nonce",
        signature: "test-signature",
      }),
      WORKER_ENV
    );

    expect(response.status).toBe(200);
    const writes = firestore.commits[0].writes;
    expect(writes).toHaveLength(2);
    expect(writes[0].currentDocument.updateTime).toBe("shift-v1");
    expect(writes[1].delete).toContain("/activeShifts/staff1");
    expect(firestore.dataByPath["activeShifts/staff1"]).toBeUndefined();
  });

  it("rejects clock-out when the scanned device is from another branch", async () => {
    stubKioskCrypto();
    const firestore = makeFirestoreFetch({
      documents: kioskDocuments({
        deviceBranch: "bone_bolango",
        previousShift: { branchId: "kota_gorontalo" },
      }),
    });
    vi.stubGlobal("fetch", firestore.fetchMock);
    const response = await worker.fetch(
      makeKioskRequest("/api/v1/shift/clock-out", {
        deviceId: "device1",
        shiftId: "previous-shift",
        badgeToken: "staff1",
        nonce: "challenge-nonce",
        signature: "test-signature",
      }),
      WORKER_ENV
    );

    expect(response.status).toBe(403);
    expect(firestore.commits).toHaveLength(0);
  });

  it("commits the normal class switch as a single update/create/lock write", async () => {
    stubKioskCrypto("replacement-shift");
    const firestore = makeFirestoreFetch({
      documents: kioskDocuments({
        previousShift: { classId: "class0" },
        classDoc: { instructorId: "staff1", branchId: "kota_gorontalo", className: "Class 1" },
      }),
    });
    vi.stubGlobal("fetch", firestore.fetchMock);
    const response = await worker.fetch(
      makeKioskRequest("/api/v1/shift/class-switch", {
        deviceId: "device1",
        previousShiftId: "previous-shift",
        badgeToken: "staff1",
        classId: "class1",
        nonce: "challenge-nonce",
        signature: "test-signature",
      }),
      WORKER_ENV
    );

    expect(response.status).toBe(200);
    expect(firestore.commits).toHaveLength(1);
    expect(firestore.commits[0].writes).toHaveLength(3);
    expect(firestore.dataByPath["shifts/previous-shift"].data.clockOut).toBeTruthy();
    expect(firestore.dataByPath["activeShifts/staff1"].data.shiftId).toBe("replacement-shift");
  });

  it("allows at most one concurrent class switch to win", async () => {
    stubKioskCrypto("replacement-shift");
    const firestore = makeFirestoreFetch({
      documents: kioskDocuments({
        previousShift: { classId: "class0" },
        classDoc: { instructorId: "staff1", branchId: "kota_gorontalo", className: "Class 1" },
      }),
    });
    vi.stubGlobal("fetch", firestore.fetchMock);
    const body = {
      deviceId: "device1",
      previousShiftId: "previous-shift",
      badgeToken: "staff1",
      classId: "class1",
      nonce: "challenge-nonce",
      signature: "test-signature",
    };

    const responses = await Promise.all([
      worker.fetch(makeKioskRequest("/api/v1/shift/class-switch", body), WORKER_ENV),
      worker.fetch(makeKioskRequest("/api/v1/shift/class-switch", body), WORKER_ENV),
    ]);

    expect(responses.some((response) => response.status === 200)).toBe(true);
    expect(firestore.commits).toHaveLength(1);
    const openShifts = Object.entries(firestore.dataByPath)
      .filter(([path, entry]) => path.startsWith("shifts/") && entry.data.clockOut === null);
    expect(openShifts).toHaveLength(1);
  });

  it("class-switches with one preconditioned commit and safely replays a lost response", async () => {
    stubKioskCrypto("replacement-shift");
    const firestore = makeFirestoreFetch({
      documents: kioskDocuments({
        previousShift: { classId: "class0" },
        classDoc: {
          instructorId: "staff1",
          branchId: "kota_gorontalo",
          className: "Class 1",
        },
      }),
      commitStatus: 503,
      commitAppliesBeforeError: true,
    });
    vi.stubGlobal("fetch", firestore.fetchMock);
    const requestBody = {
      deviceId: "device1",
      previousShiftId: "previous-shift",
      badgeToken: "staff1",
      classId: "class1",
      nonce: "challenge-nonce",
      signature: "test-signature",
    };
    const response = await worker.fetch(
      makeKioskRequest("/api/v1/shift/class-switch", requestBody),
      WORKER_ENV
    );

    expect(response.status).toBe(200);
    expect(firestore.commits).toHaveLength(1);
    expect(firestore.commits[0].writes).toHaveLength(3);
    expect(firestore.commits[0].writes[0].currentDocument.updateTime).toBe("shift-v1");
    expect(firestore.commits[0].writes[1].currentDocument).toEqual({ exists: false });
    expect(firestore.commits[0].writes[2].currentDocument.updateTime).toBe("lock-v1");
    expect(firestore.dataByPath["shifts/previous-shift"].data.clockOut).toBeTruthy();
    expect(firestore.dataByPath["shifts/replacement-shift"].data.clockOut).toBeNull();

    const retry = await worker.fetch(
      makeKioskRequest("/api/v1/shift/class-switch", requestBody),
      WORKER_ENV
    );
    expect(retry.status).toBe(200);
    expect(firestore.commits).toHaveLength(1);
  });

  it("leaves the old open shift untouched when replacement creation fails", async () => {
    stubKioskCrypto("replacement-shift");
    const firestore = makeFirestoreFetch({
      documents: kioskDocuments({
        previousShift: { classId: "class0" },
        classDoc: { instructorId: "staff1", branchId: "kota_gorontalo", className: "Class 1" },
      }),
      commitStatus: 503,
    });
    vi.stubGlobal("fetch", firestore.fetchMock);

    await expect(
      worker.fetch(
        makeKioskRequest("/api/v1/shift/class-switch", {
          deviceId: "device1",
          previousShiftId: "previous-shift",
          badgeToken: "staff1",
          classId: "class1",
          nonce: "challenge-nonce",
          signature: "test-signature",
        }),
        WORKER_ENV
      )
    ).rejects.toThrow("Firestore commit failed");
    expect(firestore.dataByPath["shifts/previous-shift"].data.clockOut).toBeNull();
    expect(firestore.dataByPath["activeShifts/staff1"].data.shiftId).toBe("previous-shift");
    expect(firestore.dataByPath["shifts/replacement-shift"]).toBeUndefined();
  });

  it("rejects a stale class-switch lock without closing the old shift", async () => {
    stubKioskCrypto("replacement-shift");
    const firestore = makeFirestoreFetch({
      documents: kioskDocuments({
        previousShift: { classId: "class0" },
        classDoc: { instructorId: "staff1", branchId: "kota_gorontalo", className: "Class 1" },
      }),
      beforeCommit: (_body, dataByPath) => {
        dataByPath["activeShifts/staff1"].updateTime = "concurrent-lock-update";
      },
    });
    vi.stubGlobal("fetch", firestore.fetchMock);
    const response = await worker.fetch(
      makeKioskRequest("/api/v1/shift/class-switch", {
        deviceId: "device1",
        previousShiftId: "previous-shift",
        badgeToken: "staff1",
        classId: "class1",
        nonce: "challenge-nonce",
        signature: "test-signature",
      }),
      WORKER_ENV
    );

    expect(response.status).toBe(409);
    expect(firestore.dataByPath["shifts/previous-shift"].data.clockOut).toBeNull();
    expect(firestore.dataByPath["activeShifts/staff1"].data.shiftId).toBe("previous-shift");
    expect(firestore.dataByPath["shifts/replacement-shift"]).toBeUndefined();
  });

  it("rejects a stale previous-shift update without creating a replacement", async () => {
    stubKioskCrypto("replacement-shift");
    const firestore = makeFirestoreFetch({
      documents: kioskDocuments({
        previousShift: { classId: "class0" },
        classDoc: { instructorId: "staff1", branchId: "kota_gorontalo", className: "Class 1" },
      }),
      beforeCommit: (_body, dataByPath) => {
        dataByPath["shifts/previous-shift"].updateTime = "concurrent-shift-update";
      },
    });
    vi.stubGlobal("fetch", firestore.fetchMock);
    const response = await worker.fetch(
      makeKioskRequest("/api/v1/shift/class-switch", {
        deviceId: "device1",
        previousShiftId: "previous-shift",
        badgeToken: "staff1",
        classId: "class1",
        nonce: "challenge-nonce",
        signature: "test-signature",
      }),
      WORKER_ENV
    );

    expect(response.status).toBe(409);
    expect(firestore.dataByPath["shifts/previous-shift"].data.clockOut).toBeNull();
    expect(firestore.dataByPath["activeShifts/staff1"].data.shiftId).toBe("previous-shift");
    expect(firestore.dataByPath["shifts/replacement-shift"]).toBeUndefined();
  });
});
