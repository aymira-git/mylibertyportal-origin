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
/** @typedef {import("firebase/firestore").QueryConstraint} QueryConstraint */
import { schoolMasterSchema, schoolVisitSchema } from "../../../schemas/schoolOutreachSchema.js";
import { WITA_OFFSET_MS } from "../../../utils/dateWita.js";
import { KOTA_GORONTALO_SEEDS } from "./seedSchoolsData.js";
import { branchToId, idToBranch, DEFAULT_BRANCH_ID } from "../../../constants/branches.js";

const COLLECTION_NAME = "schoolOutreach";

/**
 * Subscribes to active school outreach records in real-time, ordered by name.
 * Filters and ordering are applied server-side to avoid an unbounded collection
 * scan and redundant client-side work.
 *
 * @param {((schools: any[]) => void)} onData
 * @param {((err: any) => void)} [onError]
 * @returns {(() => void)} Unsubscribe function
 */
/**
 * Subscribes to active school outreach records.
 * Supports an optional `options` object as the first argument for server‑side filtering.
 * Currently supported options:
 *   - `region` (string): restricts results to schools where `region` equals the provided value.
 *
 * Backwards compatible overloads:
 *   - `listenToSchools(onData, onError?)`
 *   - `listenToSchools(options, onData, onError?)`
 *
 * @param {object|((schools: any[]) => void)} arg1 - options object or onData callback.
 * @param {((err: any) => void)|((schools: any[]) => void)} [arg2] - onError callback or onData when arg1 is options.
 * @param {((err: any) => void)} [arg3] - onError when using the options‑first signature.
 * @returns {(() => void)} Unsubscribe function
 */
export function listenToSchools(arg1, arg2, arg3) {
  let onData;
  let onError;
  let options;

  if (typeof arg1 === "function") {
    // Signature: (onData, onError?)
    onData = arg1;
    onError = typeof arg2 === "function" ? arg2 : undefined;
    options = arg3 || {};
  } else if (typeof arg1 === "object" && arg1 !== null) {
    // Signature: (options, onData, onError?)
    options = arg1;
    onData = arg2;
    onError = typeof arg3 === "function" ? arg3 : undefined;
  } else {
    throw new TypeError("listenToSchools: invalid arguments");
  }

  if (typeof onData !== "function") {
    throw new TypeError("listenToSchools: onData callback is required");
  }

  const constraints = [where("active", "==", true), orderBy("name")];
  if (options.region) {
    constraints.unshift(where("region", "==", options.region)); // region filter first
  }

  const q = query(collection(db, COLLECTION_NAME), ...constraints);

  return onSnapshot(
    q,
    (snap) => {
      const schools = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
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
 * @param {((visits: any[]) => void)} onData
 * @param {((err: any) => void)} [onError]
 * @returns {(() => void)} Unsubscribe function
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
        .map((d) => /** @type {{ id: string, visitDate?: string, [key: string]: any }} */ ({ id: d.id, ...d.data() }))
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
 * @typedef {object} OutreachVisitOptions
 * @property {string}  [startDate]      - ISO date string lower bound for visitDate (inclusive).
 * @property {string}  [endDate]        - ISO date string upper bound for visitDate (inclusive).
 * @property {string}  [officerId]      - UID to filter by createdBy; pass "all" to skip.
 * @property {"asc"|"desc"} [orderDirection] - Firestore orderBy direction (default "desc").
 * @property {number}  [limitCount]     - Maximum documents to stream (default 100).
 * @property {number}  [limit]          - Alias for limitCount (deprecated; prefer limitCount).
 */

/**
 * Subscribes to outreach visits across all schools via a collectionGroup query.
 * The stream is scoped to `schoolOutreach` visits only (via the `source` discriminator
 * field) and bounded by the options you provide to prevent unbounded streaming.
 *
 * @param {OutreachVisitOptions} options - Query options (pass `{}` for defaults).
 * @param {((visits: any[]) => void)} onData - Called with the visit array on every update.
 * @param {((err: any) => void)} [onError] - Optional error handler.
 * @returns {(() => void)} Unsubscribe function.
 * @throws {TypeError} If `onData` is not a function.
 */
export function listenToOutreachVisits(options, onData, onError) {
  if (typeof onData !== "function") {
    throw new TypeError(
      "listenToOutreachVisits: second argument `onData` must be a function."
    );
  }

  const opts = options || {};

  // Discriminator: scope to only visits under the schoolOutreach parent collection.
  // collectionGroup("visits") would otherwise match any `visits` subcollection in the
  // entire database if Firestore rules ever allow broader reads.
  /** @type {QueryConstraint[]} */
  const constraints = [where("source", "==", COLLECTION_NAME)];

  // Filter by marketing officer if specified
  if (opts.officerId && opts.officerId !== "all") {
    constraints.push(where("createdBy", "==", opts.officerId));
  }

  // Filter by date range if specified
  if (opts.startDate) {
    constraints.push(where("visitDate", ">=", opts.startDate));
  }
  if (opts.endDate) {
    constraints.push(where("visitDate", "<=", opts.endDate));
  }

  // Server-side ordering by visitDate (defaults to descending)
  const orderDirection = opts.orderDirection || "desc";
  constraints.push(orderBy("visitDate", orderDirection));

  // Bound the result set to prevent unbounded streaming (defaults to 100)
  const maxLimit = opts.limitCount ?? opts.limit ?? 100;
  if (typeof maxLimit === "number" && maxLimit > 0) {
    constraints.push(limit(maxLimit));
  }

  const visitsGroup = collectionGroup(db, "visits");
  const q = query(visitsGroup, ...constraints);

  return onSnapshot(
    q,
    (snap) => {
      // Firestore already orders docs by visitDate per the orderBy constraint —
      // no client-side sort needed.
      const visits = snap.docs.map((d) => {
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
          schoolId = d.data()?.schoolId || "";
        }
        return { id: d.id, ...d.data(), schoolId };
      });
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
  const rawBranch = rawSchool.branch || rawSchool.branchId || rawSchool.municipality || DEFAULT_BRANCH_ID;
  const branchId = branchToId(rawBranch);
  const branch = idToBranch(branchId);

  const enriched = {
    ...rawSchool,
    branch,
    branchId,
  };

  const validated = schoolMasterSchema.parse(enriched);

  const docData = {
    name: validated.name,
    municipality: validated.municipality,
    branch: validated.branch || branch,
    branchId: validated.branchId || branchId,
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
    // Discriminator written at creation time so collectionGroup queries can scope
    // reads to only schoolOutreach visits without relying on path inspection.
    source: COLLECTION_NAME,
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
