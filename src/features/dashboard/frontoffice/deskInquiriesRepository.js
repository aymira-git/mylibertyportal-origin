import { db, auth } from "../../../firebase";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  limit,
} from "firebase/firestore";
import { deskInquirySchema } from "../../../schemas/deskInquirySchema";
import {
  isPermissionError,
  saveLocalInquiry,
  updateLocalInquiry,
  deleteLocalInquiry,
} from "./walkInUtils";

/**
 * Repository for Front Office walk-in visitor & prospect inquiries (/deskInquiries).
 */

export async function fetchRecentDeskInquiries(limitCount = 50) {
  try {
    const q = query(
      collection(db, "deskInquiries"),
      orderBy("createdAt", "desc"),
      limit(limitCount)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => /** @type {any} */ ({ id: d.id, ...d.data() }));
  } catch (err) {
    if (isPermissionError(err)) {
      throw err;
    }
    console.warn("fetchRecentDeskInquiries fallback without orderBy:", err?.message);
    const q = query(collection(db, "deskInquiries"), limit(limitCount));
    const snap = await getDocs(q);
    const list = snap.docs.map((d) => /** @type {any} */ ({ id: d.id, ...d.data() }));
    list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    return list;
  }
}

/**
 * @param {Record<string, any>} inquiryData
 * @returns {Promise<import('./walkInUtils').DeskInquiryItem>}
 */
export async function createDeskInquiry(inquiryData) {
  const currentUser = auth.currentUser;
  const parseResult = deskInquirySchema.safeParse({
    ...inquiryData,
    createdAt: new Date().toISOString(),
    createdBy: currentUser?.uid || "frontoffice",
    createdByName: currentUser?.displayName || currentUser?.email || "Front Desk",
  });

  if (!parseResult.success) {
    const firstIssue = parseResult.error.issues?.[0];
    const errorMsg = firstIssue?.message || "Invalid inquiry data provided.";
    throw new Error(errorMsg);
  }

  const validated = parseResult.data;
  try {
    const docRef = await addDoc(collection(db, "deskInquiries"), validated);
    return { id: docRef.id, ...validated };
  } catch (err) {
    if (isPermissionError(err)) {
      const localRecord = saveLocalInquiry(validated);
      return { ...localRecord, _permissionDenied: true };
    }
    throw err;
  }
}

export async function updateDeskInquiryStatus(inquiryId, newStatus) {
  if (!inquiryId) throw new Error("Inquiry ID is required");
  const currentUser = auth.currentUser;
  const updateData = {
    status: newStatus,
    updatedAt: new Date().toISOString(),
    updatedBy: currentUser?.uid || "frontoffice",
  };

  if (inquiryId.startsWith("local-")) {
    updateLocalInquiry(inquiryId, updateData);
    return { id: inquiryId, ...updateData };
  }

  try {
    await updateDoc(doc(db, "deskInquiries", inquiryId), updateData);
    return { id: inquiryId, ...updateData };
  } catch (err) {
    if (isPermissionError(err)) {
      updateLocalInquiry(inquiryId, updateData);
      return { id: inquiryId, ...updateData, _permissionDenied: true };
    }
    throw err;
  }
}

/**
 * Appends a placement test result into the inquiry's placementTests array
 * and updates its currentLevel if assessed.
 */
export async function addPlacementTestToInquiry(inquiryId, testData) {
  if (!inquiryId) throw new Error("Inquiry ID is required");
  const currentUser = auth.currentUser;
  const testRecord = {
    id: `pt-${Date.now()}`,
    score: testData.score !== "" && testData.score != null ? Number(testData.score) : null,
    assessedLevel: testData.assessedLevel?.trim() || "",
    testedBy: testData.testedBy?.trim() || currentUser?.displayName || currentUser?.email || "Staff",
    testedAt: testData.testedAt || new Date().toISOString().split("T")[0],
    notes: testData.notes?.trim() || "",
  };

  const updateData = {
    placementTests: [testRecord], // fallback will merge
    updatedAt: new Date().toISOString(),
    updatedBy: currentUser?.uid || "frontoffice",
  };

  if (testRecord.assessedLevel) {
    updateData.currentLevel = testRecord.assessedLevel;
  }

  if (inquiryId.startsWith("local-")) {
    const localInquiries = (await import("./walkInUtils")).getLocalInquiries();
    const existing = localInquiries.find((i) => i.id === inquiryId);
    const existingTests = Array.isArray(existing?.placementTests) ? existing.placementTests : [];
    updateData.placementTests = [...existingTests, testRecord];
    updateLocalInquiry(inquiryId, updateData);
    return { id: inquiryId, ...updateData };
  }

  try {
    const inqRef = doc(db, "deskInquiries", inquiryId);
    const inqSnap = await (await import("firebase/firestore")).getDoc(inqRef);
    const existingData = inqSnap.exists() ? inqSnap.data() : {};
    const existingTests = Array.isArray(existingData.placementTests) ? existingData.placementTests : [];
    const mergedTests = [...existingTests, testRecord];

    const finalUpdate = {
      ...updateData,
      placementTests: mergedTests,
    };

    await updateDoc(inqRef, finalUpdate);
    return { id: inquiryId, ...finalUpdate };
  } catch (err) {
    if (isPermissionError(err)) {
      const localInquiries = (await import("./walkInUtils")).getLocalInquiries();
      const existing = localInquiries.find((i) => i.id === inquiryId);
      const existingTests = Array.isArray(existing?.placementTests) ? existing.placementTests : [];
      updateData.placementTests = [...existingTests, testRecord];
      updateLocalInquiry(inquiryId, updateData);
      return { id: inquiryId, ...updateData, _permissionDenied: true };
    }
    throw err;
  }
}

/**
 * Marks an inquiry as converted to student, recording convertedStudentId and timestamp.
 */
export async function markInquiryConverted(inquiryId, studentId) {
  if (!inquiryId) return;
  const currentUser = auth.currentUser;
  const updateData = {
    status: "enrolled",
    convertedStudentId: studentId || null,
    convertedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    updatedBy: currentUser?.uid || "frontoffice",
  };

  if (inquiryId.startsWith("local-")) {
    updateLocalInquiry(inquiryId, updateData);
    return { id: inquiryId, ...updateData };
  }

  try {
    await updateDoc(doc(db, "deskInquiries", inquiryId), updateData);
    return { id: inquiryId, ...updateData };
  } catch (err) {
    if (isPermissionError(err)) {
      updateLocalInquiry(inquiryId, updateData);
      return { id: inquiryId, ...updateData, _permissionDenied: true };
    }
    console.warn("markInquiryConverted failed:", err);
  }
}

export async function deleteDeskInquiry(inquiryId) {
  if (!inquiryId) throw new Error("Inquiry ID is required");

  if (inquiryId.startsWith("local-")) {
    deleteLocalInquiry(inquiryId);
    return inquiryId;
  }

  try {
    await deleteDoc(doc(db, "deskInquiries", inquiryId));
    deleteLocalInquiry(inquiryId);
    return inquiryId;
  } catch (err) {
    if (isPermissionError(err)) {
      deleteLocalInquiry(inquiryId);
      return inquiryId;
    }
    throw err;
  }
}

