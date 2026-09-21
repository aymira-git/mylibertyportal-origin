import { db } from "../../firebase";
import { collection, query, where, getDocs, addDoc, deleteDoc, doc } from "firebase/firestore";

/**
 * All direct Firestore reads/writes for teaching materials, pulled out of
 * TeachingMaterial.jsx — same pattern as classesRepository.js.
 */

export async function fetchMaterialsFor(uid) {
  const q = query(collection(db, "materials"), where("createdBy", "==", uid));
  const snap = await getDocs(q);
  const list = snap.docs.map((d) => /** @type {any} */ ({ id: d.id, ...d.data() }));
  list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return list;
}

export function addMaterial({ title, url, createdBy }) {
  return addDoc(collection(db, "materials"), {
    title,
    url,
    createdBy,
    createdAt: new Date().toISOString(),
  });
}

export function deleteMaterial(id) {
  return deleteDoc(doc(db, "materials", id));
}
