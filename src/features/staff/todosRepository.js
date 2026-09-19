import { db } from "../../firebase";
import { collection, addDoc, deleteDoc, doc } from "firebase/firestore";

/**
 * All direct Firestore writes for todos/tasks live here instead of inside
 * useDashboardData.js — same pattern as the other domain repositories.
 */

export function createTodo({ text, type, isPinned, assignee }) {
  return addDoc(collection(db, "todos"), {
    text,
    type,
    isPinned,
    assignee,
    completed: false,
    createdAt: new Date().toISOString(),
  });
}

export function deleteTodo(todoId) {
  return deleteDoc(doc(db, "todos", todoId));
}
