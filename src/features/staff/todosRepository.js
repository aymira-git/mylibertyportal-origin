import { db } from "../../firebase";
import { collection, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";

/**
 * All direct Firestore writes for todos/directives live here.
 */

export function createTodo({
  text,
  type = "directive",
  priority = "normal",
  isPinned = false,
  assignee = "all",
  assigneeType = "role",
  assigneeName = "Everyone",
  dueDate = null,
  createdBy = null,
  createdByName = null,
  branch = "Cabang Utama",
}) {
  return addDoc(collection(db, "todos"), {
    text: (text || "").trim(),
    type,
    priority,
    isPinned: Boolean(isPinned),
    assignee,
    assigneeType,
    assigneeName,
    dueDate: dueDate || null,
    completed: false,
    completedAt: null,
    completedBy: null,
    completedByName: null,
    createdAt: new Date().toISOString(),
    createdBy: createdBy || null,
    createdByName: createdByName || null,
    branch: branch || "Cabang Utama",
  });
}

export function toggleTodoComplete(todoId, completed, currentUser = null) {
  const updates = completed
    ? {
        completed: true,
        completedAt: new Date().toISOString(),
        completedBy: currentUser?.uid || null,
        completedByName: currentUser?.displayName || currentUser?.email || "Staff Member",
      }
    : {
        completed: false,
        completedAt: null,
        completedBy: null,
        completedByName: null,
      };

  return updateDoc(doc(db, "todos", todoId), updates);
}

export function updateTodo(todoId, updates) {
  return updateDoc(doc(db, "todos", todoId), {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

export function deleteTodo(todoId) {
  return deleteDoc(doc(db, "todos", todoId));
}
