import { db } from "../../firebase";
import {
  collection,
  doc,
  addDoc,
  getDocs,
  query,
  where,
  updateDoc,
  serverTimestamp,
  onSnapshot,
  orderBy,
} from "firebase/firestore";
import { corporateEventSchema } from "../../schemas/corporateEventSchema.js";

/**
 * Fetches active corporate events for a specific date (YYYY-MM-DD WITA).
 * Used at Kiosk check-in/clock-in.
 *
 * @param {string} dateStr - YYYY-MM-DD
 * @returns {Promise<Array<object>>}
 */
export async function fetchActiveCorporateEventsForDate(dateStr) {
  if (!dateStr) return [];
  const q = query(
    collection(db, "corporateEvents"),
    where("eventDate", "==", dateStr),
    where("status", "==", "active")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Fetches all corporate events ordered by date descending.
 *
 * @returns {Promise<Array<object>>}
 */
export async function fetchCorporateEvents() {
  const q = query(collection(db, "corporateEvents"), orderBy("eventDate", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Subscribes to corporate events collection with real-time updates.
 *
 * @param {(events: any[]) => void} onData
 * @param {(err: Error) => void} [onError]
 * @returns {() => void} Unsubscribe function
 */
export function subscribeCorporateEvents(onData, onError) {
  const q = query(collection(db, "corporateEvents"), orderBy("eventDate", "desc"));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      onData(items);
    },
    (err) => {
      if (onError) onError(err);
    }
  );
}

/**
 * Creates a new corporate event in Firestore.
 * Validates payload with corporateEventSchema before writing.
 *
 * @param {object} rawPayload
 * @param {string} creatorUid
 * @returns {Promise<import("firebase/firestore").DocumentReference>}
 */
export function createCorporateEvent(rawPayload, creatorUid) {
  const validated = corporateEventSchema.parse(rawPayload);

  const docData = {
    name: validated.name,
    eventDate: validated.eventDate,
    startTime: validated.startTime || null,
    endTime: validated.endTime || null,
    audienceType: validated.audienceType,
    audienceValue: validated.audienceValue || null,
    status: "active",
    createdBy: creatorUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  return addDoc(collection(db, "corporateEvents"), docData);
}

/**
 * Updates an existing corporate event.
 *
 * @param {string} eventId
 * @param {object} updates
 * @returns {Promise<void>}
 */
export function updateCorporateEvent(eventId, updates) {
  const cleanUpdates = {
    ...updates,
    updatedAt: serverTimestamp(),
  };
  return updateDoc(doc(db, "corporateEvents", eventId), cleanUpdates);
}

/**
 * Soft-cancels a corporate event (preserves history, never hard deletes).
 *
 * @param {string} eventId
 * @param {string} cancelledByUid
 * @returns {Promise<void>}
 */
export function cancelCorporateEvent(eventId, cancelledByUid) {
  return updateDoc(doc(db, "corporateEvents", eventId), {
    status: "cancelled",
    cancelledBy: cancelledByUid || null,
    cancelledAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}
