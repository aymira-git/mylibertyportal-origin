import { db } from "../../../firebase";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { schoolMasterSchema, schoolVisitSchema } from "../../../schemas/schoolOutreachSchema.js";
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
