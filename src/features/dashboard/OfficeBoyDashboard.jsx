import { useState, useEffect } from "react";
import { db } from "../../firebase";
import { collection, query, where, doc, updateDoc, onSnapshot } from "firebase/firestore";
import { useToast, WelcomeBanner } from "../shared";
import { CheckSquare, Sparkles } from "lucide-react";

export default function OfficeBoyDashboard() {
  const toast = useToast();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // We look for tasks specifically tagged for "officeboy"
    const q = query(collection(db, "todos"), where("assignee", "==", "officeboy"));

    const unsubscribe = onSnapshot(q, (snap) => {
      const taskList = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      })).filter(t => !t.completed); // Only show active tasks

      setTasks(taskList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleComplete = async (taskId) => {
    try {
      await updateDoc(doc(db, "todos", taskId), {
        completed: true,
        completedAt: new Date().toISOString()
      });
    } catch (err) {
      toast("Error completing task: " + err.message, "error");
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <WelcomeBanner
        portalLabel="Campus Support & Facilities"
        roleLabel="General Operations Staff"
        fallbackName="Support Staff"
        subtitle="Review classroom setups, campus supplies, facility requests, and daily operational tasks."
        stats={[
          {
            label: "Pending Directives",
            value: loading ? "..." : tasks.length,
            icon: CheckSquare,
          },
          {
            label: "Campus Readiness",
            value: tasks.length === 0 ? "All Clear" : "Active Tasks",
            icon: Sparkles,
          },
        ]}
      />

      {loading ? (
        <p className="text-center text-slate-400 py-10 animate-pulse font-medium text-xs">Checking tasks...</p>
      ) : tasks.length === 0 ? (
        <div className="bg-slate-50 p-10 rounded-2xl border border-dashed border-slate-300 text-center">
          <p className="text-3xl mb-2">✨</p>
          <p className="text-sm font-bold text-slate-600">All caught up! No tasks right now.</p>
          <p className="text-xs text-slate-400 mt-1">Check back later or check in with the front desk.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Assigned Tasks</h3>
            <span className="text-[10px] font-bold text-slate-400">Tap to complete</span>
          </div>
          {tasks.map(task => (
            <button
              key={task.id}
              onClick={() => handleComplete(task.id)}
              className="w-full bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between group active:scale-[0.99] transition cursor-pointer text-left"
            >
              <div className="min-w-0 pr-3">
                <span className="text-[10px] font-bold uppercase bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full mb-1.5 inline-block">
                  {task.type || "TASK"}
                </span>
                <p className="font-bold text-slate-800 text-base leading-snug">{task.text}</p>
              </div>
              <div className="w-8 h-8 rounded-full border-2 border-slate-200 flex items-center justify-center group-hover:border-[#1a3a8f] group-hover:bg-indigo-50 transition shrink-0">
                <span className="text-transparent group-hover:text-[#1a3a8f] text-xs font-black">✓</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
