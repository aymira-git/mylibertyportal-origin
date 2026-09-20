import { useState, useEffect, useMemo } from "react";
import { auth, db } from "../../firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { toggleTodoComplete } from "./todosRepository";

/**
 * Real-time hook for any staff dashboard to subscribe to their operational directives.
 *
 * Automatically matches directives assigned to:
 * 1. "all" (All Academy Staff)
 * 2. The specific role (e.g. "instructor", "marketing", "frontoffice", "officeboy")
 * 3. The signed-in user's UID (individual 1-on-1 assignments)
 */
export function useStaffDirectives(role) {
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(true);
  const currentUser = auth.currentUser;

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "todos"),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setTodos(list);
        setLoading(false);
      },
      (err) => {
        console.error("Staff directives listener error:", err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const directives = useMemo(() => {
    const uid = currentUser?.uid;
    return todos.filter((t) => {
      if (t.assignee === "all") return true;
      if (role && t.assignee === role) return true;
      if (uid && t.assignee === uid) return true;
      return false;
    });
  }, [todos, role, currentUser?.uid]);

  const activeDirectives = useMemo(() => {
    return directives
      .filter((d) => !d.completed)
      .sort((a, b) => {
        // Pinned first
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;

        // Urgent priority next
        const prioRank = { urgent: 3, high: 2, normal: 1 };
        const pA = prioRank[a.priority] || 1;
        const pB = prioRank[b.priority] || 1;
        if (pA !== pB) return pB - pA;

        // Due dates next (nearest first)
        if (a.dueDate && !b.dueDate) return -1;
        if (!a.dueDate && b.dueDate) return 1;
        if (a.dueDate && b.dueDate) {
          const diff = new Date(a.dueDate) - new Date(b.dueDate);
          if (diff !== 0) return diff;
        }

        // Newest createdAt
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      });
  }, [directives]);

  const completedDirectives = useMemo(() => {
    return directives
      .filter((d) => d.completed)
      .sort((a, b) => new Date(b.completedAt || 0) - new Date(a.completedAt || 0));
  }, [directives]);

  const handleToggle = async (todoId, completed) => {
    return toggleTodoComplete(todoId, completed, currentUser);
  };

  return {
    directives,
    activeDirectives,
    completedDirectives,
    pendingCount: activeDirectives.length,
    loading,
    handleToggle,
  };
}
