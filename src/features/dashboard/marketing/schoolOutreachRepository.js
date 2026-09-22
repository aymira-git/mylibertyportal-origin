import { db } from "../../../firebase";
import {
  collection,
  collectionGroup,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";
import { schoolMasterSchema, schoolVisitSchema } from "../../../schemas/schoolOutreachSchema.js";
import { WITA_OFFSET_MS } from "../../../utils/dateWita.js";
import { KOTA_GORONTALO_SEEDS } from "./seedSchoolsData.js";

const COLLECTION_NAME = "schoolOutreach";

/**
 * Subscribes to all active school outreach records in real-time.
 * In-memory sorting by name to avoid composite index requirements.
 *
 * @param {function(Array<object>): void} onData
 * @param {function(Error): void} [onError]
 * @returns {function(): void} Unsubscribe function
 */
export function listenToSchools(onData, onError) {
  const colRef = collection(db, COLLECTION_NAME);
  return onSnapshot(
    colRef,
    (snap) => {
      const schools = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((s) => s.active !== false)
        .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      onData(schools);
    },
    (err) => {
      console.error("listenToSchools error:", err);
      if (onError) onError(err);
    }
  );
}

/**
 * Subscribes to visits history for a specific school.
 *
 * @param {string} schoolId
 * @param {function(Array<object>): void} onData
 * @param {function(Error): void} [onError]
 * @returns {function(): void} Unsubscribe function
 */
export function listenToSchoolVisits(schoolId, onData, onError) {
  if (!schoolId) {
    onData([]);
    return () => {};
  }

  const visitsColRef = collection(db, `${COLLECTION_NAME}/${schoolId}/visits`);
  return onSnapshot(
    visitsColRef,
    (snap) => {
      const visits = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.visitDate || "").localeCompare(a.visitDate || ""));
      onData(visits);
    },
    (err) => {
      console.error(`listenToSchoolVisits error for school ${schoolId}:`, err);
      if (onError) onError(err);
    }
  );
}

/**
 * Returns the Monday YYYY-MM-DD string for the current WITA week.
 * @param {Date} [date=new Date()]
 * @returns {string}
 */
export function getStartOfWeekWita(date = new Date()) {
  const w = new Date(date.getTime() + WITA_OFFSET_MS);
  const day = w.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(w.getTime() + diffToMonday * 86400000);
  const pad = (n) => String(n).padStart(2, "0");
  return `${monday.getUTCFullYear()}-${pad(monday.getUTCMonth() + 1)}-${pad(monday.getUTCDate())}`;
}

/**
 * Returns the Sunday YYYY-MM-DD string for the current WITA week.
 * @param {Date} [date=new Date()]
 * @returns {string}
 */
export function getEndOfWeekWita(date = new Date()) {
  const w = new Date(date.getTime() + WITA_OFFSET_MS);
  const day = w.getUTCDay();
  const diffToSunday = day === 0 ? 0 : 7 - day;
  const sunday = new Date(w.getTime() + diffToSunday * 86400000);
  const pad = (n) => String(n).padStart(2, "0");
  return `${sunday.getUTCFullYear()}-${pad(sunday.getUTCMonth() + 1)}-${pad(sunday.getUTCDate())}`;
}

/**
 * Subscribes to visits history across all schools using collectionGroup.
 * Supports date range, officer filtering, server-side ordering, and limits to prevent
 * unbounded collectionGroup streaming.
 *
 * @param {function(Array<object>): void|object} arg1 - onData callback OR options object
 * @param {function(Error): void|function(Array<object>): void|object} [arg2] - onError callback OR onData callback OR options object
 * @param {object|function(Error): void} [arg3] - options object OR onError callback
 * @returns {function(): void} Unsubscribe function
 */
export function listenToOutreachVisits(arg1, arg2, arg3) {
  let onData;
  let onError;
  let options = {};

  if (typeof arg1 === "function") {
    onData = arg1;
    if (typeof arg2 === "function") {
      onError = arg2;
      options = arg3 || {};
    } else if (typeof arg2 === "object" && arg2 !== null) {
      options = arg2;
      onError = typeof arg3 === "function" ? arg3 : undefined;
    } else {
      onError = undefined;
      options = arg3 || {};
    }
  } else if (typeof arg1 === "object" && arg1 !== null) {
    options = arg1;
    onData = arg2;
    onError = arg3;
  }

  const constraints = [];

  // Filter by marketing officer if specified
  if (options.officerId && options.officerId !== "all") {
    constraints.push(where("createdBy", "==", options.officerId));
  }

  // Filter by date range if specified
  if (options.startDate) {
    constraints.push(where("visitDate", ">=", options.startDate));
  }
  if (options.endDate) {
    constraints.push(where("visitDate", "<=", options.endDate));
  }

  // Server-side ordering by visitDate descending (or specified direction)
  const orderDirection = options.orderDirection || "desc";
  constraints.push(orderBy("visitDate", orderDirection));

  // Limit to avoid unbounded streaming (defaults to 100 unless explicitly null/false)
  const maxLimit = options.limitCount ?? options.limit ?? 100;
  if (typeof maxLimit === "number" && maxLimit > 0) {
    constraints.push(limit(maxLimit));
  }

  const visitsGroup = collectionGroup(db, "visits");
  const q = constraints.length > 0 ? query(visitsGroup, ...constraints) : visitsGroup;

  return onSnapshot(
    q,
    (snap) => {
      const visits = snap.docs
        .map((d) => {
          let schoolId = "";
          if (d.ref?.path) {
            const pathParts = d.ref.path.split("/").filter(Boolean);
            const visitsIdx = pathParts.lastIndexOf("visits");
            if (visitsIdx >= 2 && pathParts[visitsIdx - 2] === COLLECTION_NAME) {
              schoolId = pathParts[visitsIdx - 1];
            }
          } else if (
            d.ref?.parent?.id === "visits" &&
            d.ref?.parent?.parent?.parent?.id === COLLECTION_NAME
          ) {
            schoolId = d.ref.parent.parent.id;
          }
          if (!schoolId) {
            schoolId = d.data?.()?.schoolId || d.data?.schoolId || "";
          }
          return {
            id: d.id,
            ...d.data(),
            schoolId,
          };
        })
        .sort((a, b) => (b.visitDate || "").localeCompare(a.visitDate || ""));
      onData(visits);
    },
    (err) => {
      console.error("listenToOutreachVisits error:", err);
      if (onError) onError(err);
    }
  );
}

/**
 * Adds a new school master record.
 *
 * @param {object} rawSchool
 * @param {string} creatorUid
 * @returns {Promise<import("firebase/firestore").DocumentReference>}
 */
export async function addSchool(rawSchool, creatorUid) {
  const validated = schoolMasterSchema.parse(rawSchool);

  const docData = {
    name: validated.name,
    municipality: validated.municipality,
    district: validated.district || "",
    address: validated.address || "",
    lat: validated.lat,
    lng: validated.lng,
    tier: validated.tier,
    active: validated.active !== false,
    status: validated.status || "pending",
    scheduledDate: validated.scheduledDate || "",
    lastVisitDate: validated.lastVisitDate || "",
    lastVisitId: validated.lastVisitId || "",
    lastContactName: validated.lastContactName || "",
    lastContactRole: validated.lastContactRole || "",
    lastOutcome: validated.lastOutcome || "",
    nextActionDate: validated.nextActionDate || "",
    createdBy: creatorUid || "anonymous",
    createdAt: serverTimestamp(),
    updatedBy: creatorUid || "anonymous",
    updatedAt: serverTimestamp(),
  };

  return addDoc(collection(db, COLLECTION_NAME), docData);
}

/**
 * Updates an existing school master record (e.g., status, schedule date, notes).
 *
 * @param {string} schoolId
 * @param {object} updates
 * @param {string} updaterUid
 * @returns {Promise<void>}
 */
export async function updateSchool(schoolId, updates, updaterUid) {
  if (!schoolId) throw new Error("schoolId is required.");

  const safeUpdates = {
    ...updates,
    updatedBy: updaterUid || "anonymous",
    updatedAt: serverTimestamp(),
  };

  // Disallow overwriting immutable creation audit fields
  delete safeUpdates.createdBy;
  delete safeUpdates.createdAt;

  const schoolRef = doc(db, COLLECTION_NAME, schoolId);
  return updateDoc(schoolRef, safeUpdates);
}

/**
 * Creates a visit record in the subcollection and updates the school document summary
 * in an atomic batch write.
 *
 * @param {string} schoolId
 * @param {object} rawVisit
 * @param {string} creatorUid
 * @returns {Promise<string>} Created visit ID
 */
export async function createSchoolVisit(schoolId, rawVisit, creatorUid) {
  if (!schoolId) throw new Error("schoolId is required.");

  const validated = schoolVisitSchema.parse(rawVisit);

  const batch = writeBatch(db);

  // 1. Visit subcollection document
  const visitsCol = collection(db, `${COLLECTION_NAME}/${schoolId}/visits`);
  const visitRef = doc(visitsCol);

  const visitData = {
    schoolId,
    visitDate: validated.visitDate,
    contactName: validated.contactName,
    contactRole: validated.contactRole,
    phone: validated.phone || "",
    flyersHandedOut: validated.flyersHandedOut,
    leadsCollected: validated.leadsCollected,
    outcome: validated.outcome || "",
    notes: validated.notes || "",
    nextActionDate: validated.nextActionDate || "",
    statusAfterVisit: validated.statusAfterVisit,
    createdBy: creatorUid || "anonymous",
    createdAt: serverTimestamp(),
  };

  batch.set(visitRef, visitData);

  // 2. Update summary on parent school document
  const schoolRef = doc(db, COLLECTION_NAME, schoolId);
  const schoolSummaryUpdate = {
    status: validated.statusAfterVisit || "visited",
    lastVisitDate: validated.visitDate,
    lastVisitId: visitRef.id,
    lastContactName: validated.contactName,
    lastContactRole: validated.contactRole,
    lastOutcome: validated.outcome || "",
    nextActionDate: validated.nextActionDate || "",
    updatedBy: creatorUid || "anonymous",
    updatedAt: serverTimestamp(),
  };

  batch.update(schoolRef, schoolSummaryUpdate);

  await batch.commit();
  return visitRef.id;
}

/**
 * Seeds initial Kota Gorontalo schools if the collection is currently empty.
 * Intended for controlled manual or initial setup.
 *
 * @param {string} creatorUid
 * @returns {Promise<{ seeded: boolean, count: number }>}
 */
export async function seedInitialSchoolsIfEmpty(creatorUid) {
  const colRef = collection(db, COLLECTION_NAME);
  const snap = await getDocs(colRef);

  if (!snap.empty) {
    return { seeded: false, count: snap.docs.length };
  }

  const batch = writeBatch(db);
  for (const school of KOTA_GORONTALO_SEEDS) {
    const newDocRef = doc(colRef);
    batch.set(newDocRef, {
      ...school,
      scheduledDate: "",
      lastVisitDate: "",
      lastVisitId: "",
      lastContactName: "",
      lastContactRole: "",
      lastOutcome: "",
      nextActionDate: "",
      createdBy: creatorUid || "system-seed",
      createdAt: serverTimestamp(),
      updatedBy: creatorUid || "system-seed",
      updatedAt: serverTimestamp(),
    });
  }

  await batch.commit();
  return { seeded: true, count: KOTA_GORONTALO_SEEDS.length };
}
