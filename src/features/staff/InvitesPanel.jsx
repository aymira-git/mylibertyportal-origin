/**
 * InvitesPanel.jsx
 * Staff invitation system for the staff feature.
 * Lets admins generate unique sign-up links and manage pending invitations.
 */

import { useState } from "react";
import { useToast } from "../shared";

export default function InvitesPanel({ invites, onCreateInvite, onDeleteInvite }) {
  const toast = useToast();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("instructor");

  const handleSubmit = async (e) => {
    e.preventDefault();
    await onCreateInvite(inviteEmail, inviteRole);
    setInviteEmail("");
  };

  const pendingInvites = invites.filter(inv => !inv.used);

  return (
    <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-150 max-w-6xl mx-auto space-y-6">
      <div>
        <h3 className="font-bold text-slate-800 text-base">Invite Staff</h3>
        <p className="text-xs text-slate-500">Generate a unique link for new staff to set up their own accounts.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-3">
        <input
          type="email"
          placeholder="Staff Email"
          value={inviteEmail}
          onChange={e => setInviteEmail(e.target.value)}
          className="min-h-12 flex-1 p-2.5 border rounded-xl text-sm"
          required
        />
        <select
          value={inviteRole}
          onChange={e => setInviteRole(e.target.value)}
          className="min-h-12 p-2.5 border rounded-xl bg-white font-bold text-sm"
        >
          <option value="instructor">Instructor</option>
          <option value="manager">Manager</option>
          <option value="marketing">Marketing Staff</option>
          <option value="frontoffice">Front Office</option>
          <option value="officeboy">Office Boy</option>
        </select>
        <button
          type="submit"
          className="min-h-12 bg-[#1a3a8f] text-white px-6 py-2.5 rounded-xl font-bold hover:bg-[#122b6e] transition text-sm"
        >
          Generate Link
        </button>
      </form>

      <div className="space-y-2 border-t pt-4">
        <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wider">Pending Invitations</h4>
        {pendingInvites.length === 0 ? (
          <p className="text-xs text-slate-400 italic">No pending invitations.</p>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {pendingInvites.map(inv => (
              <div
                key={inv.id}
                className="flex flex-col md:flex-row justify-between items-start md:items-center p-3 bg-slate-50 rounded-xl border border-slate-150 gap-2"
              >
                <div className="text-xs">
                  <p className="font-bold text-slate-800">{inv.email}</p>
                  <p className="text-slate-500 uppercase font-bold text-[9px]">
                    {inv.role} · Created {new Date(inv.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                  <button
                    onClick={() => {
                      const link = `${window.location.origin}/join/${inv.token}`;
                      navigator.clipboard.writeText(link);
                      toast("Copied to clipboard: " + link);
                    }}
                    className="min-h-11 flex-1 md:flex-none bg-emerald-600 text-white px-3 py-1.5 rounded-xl font-bold hover:bg-emerald-700 transition text-xs"
                  >
                    📋 Copy Link
                  </button>
                  <button
                    onClick={() => onDeleteInvite(inv.id)}
                    className="min-h-11 flex-1 md:flex-none bg-red-500 text-white px-3 py-1.5 rounded-xl font-bold hover:bg-red-600 transition text-xs"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
