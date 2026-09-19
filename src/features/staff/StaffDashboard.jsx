import { useState, useEffect } from "react";
import { db } from "../../firebase";
import { collection, onSnapshot } from "firebase/firestore";

export default function StaffDashboard() {
  const [leadCount, setLeadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Counts active pending applications only. Approved and rejected applications
  // are retained in the collection with their respective status flags.
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "applications"),
      snap => {
        const pending = snap.docs.filter(d => (d.data().status || "pending") === "pending").length;
        setLeadCount(pending);
        setLoading(false);
      },
      err => { console.error("applications listener:", err); setLoading(false); }
    );
    return unsubscribe;
  }, []);

  return (
    <div className="max-w-md mx-auto space-y-4">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-center">
        <h2 className="text-xl font-bold text-slate-800">Marketing Hub</h2>
        <p className="text-xs text-slate-500 mt-1">Grow the school, one student at a time.</p>
      </div>

      <div className="bg-gradient-to-br from-[#1a3a8f] to-[#122b6e] p-8 rounded-3xl text-white text-center shadow-lg">
        <p className="text-xs font-bold uppercase tracking-widest opacity-80 mb-2">Pending Applications</p>
        <p className="text-6xl font-black">{loading ? "..." : leadCount}</p>
        <p className="text-[10px] mt-4 opacity-70 leading-relaxed">
          New students waiting for follow-up. Check the Admin Panel "Applications" tab to see their details.
        </p>
      </div>

      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
        <h3 className="font-bold text-slate-800 text-sm">Attendance Reminder</h3>
        <p className="text-xs text-slate-500 leading-relaxed">
          Staff shifts are tracked via the physical reception counter scanner. Please present your badge to the front desk station upon arrival and before leaving.
        </p>
      </div>
      
      <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 text-center">
        <p className="text-[11px] text-emerald-700 font-bold">
          🚀 Marketing Tip: Sharing the Registration Link on social media is the fastest way to get new leads!
        </p>
      </div>
    </div>
  );
}
