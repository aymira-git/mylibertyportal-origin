/**
 * InvitesPanel.jsx
 * Staff invitation system for the staff feature.
 * Lets admins generate unique sign-up links, select campus branch,
 * check for existing accounts, and dispatch via WhatsApp.
 */

import { useState, useMemo } from "react";
import { useToast } from "../shared";
import { getDistinctStaffBranches } from "./staffUtils";
import { DEFAULT_BRANCH } from "../../constants/branches.js";
import { copyText } from "../../utils/copyText";
import {
  Mail,
  UserPlus,
  Send,
  Copy,
  Trash2,
  AlertCircle,
  Clock,
  Building2,
  Search,
  MessageCircle,
} from "lucide-react";

const ROLE_BADGES = {
  instructor: { label: "Instructor", tone: "bg-blue-50 text-blue-700 border-blue-200" },
  manager: { label: "Manager", tone: "bg-purple-50 text-purple-700 border-purple-200" },
  marketing: { label: "Marketing", tone: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  frontoffice: { label: "Front Office", tone: "bg-amber-50 text-amber-700 border-amber-200" },
  officeboy: { label: "Office Support", tone: "bg-slate-100 text-slate-600 border-slate-200" },
};

function getExpiryInfo(expiresAt) {
  if (!expiresAt) {
    return {
      label: "No expiry",
      tone: "bg-slate-50 text-slate-500 border-slate-200",
      isExpired: false,
    };
  }
  const expMillis = Number(expiresAt) || new Date(expiresAt).getTime();
  const diffMillis = expMillis - Date.now();

  if (diffMillis <= 0) {
    return { label: "Expired", tone: "bg-rose-50 text-rose-700 border-rose-200", isExpired: true };
  }
  const diffDays = Math.ceil(diffMillis / (1000 * 60 * 60 * 24));
  if (diffDays <= 1) {
    return {
      label: "Expires today",
      tone: "bg-amber-50 text-amber-700 border-amber-200",
      isExpired: false,
    };
  }
  return {
    label: `Expires in ${diffDays}d`,
    tone: "bg-emerald-50 text-emerald-700 border-emerald-200",
    isExpired: false,
  };
}

function buildWhatsAppInviteMessage(invite, origin) {
  const link = `${origin}/join/${invite.token}`;
  const roleDisplay = ROLE_BADGES[invite.role]?.label || invite.role;
  return (
    `Halo! Berikut adalah tautan resmi untuk melengkapi pendaftaran akun staf Anda sebagai *${roleDisplay}* di *MYLIBERTY International English School*:\n\n` +
    `${link}\n\n` +
    `_Catatan: Tautan berlaku selama 7 hari. Silakan lengkapi data profil dan buat kata sandi akun Anda._`
  );
}

export default function InvitesPanel({ invites = [], users = [], onCreateInvite, onDeleteInvite }) {
  const toast = useToast();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("instructor");
  const [inviteBranch, setInviteBranch] = useState(DEFAULT_BRANCH);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Available branches from staff list
  const branchOptions = useMemo(() => getDistinctStaffBranches(users), [users]);

  // Duplicate email detection
  const cleanEmail = inviteEmail.toLowerCase().trim();
  const existingUser = useMemo(() => {
    if (!cleanEmail || !cleanEmail.includes("@")) return null;
    return users.find((u) => (u.email || "").toLowerCase().trim() === cleanEmail);
  }, [cleanEmail, users]);

  const existingPendingInvite = useMemo(() => {
    if (!cleanEmail || !cleanEmail.includes("@")) return null;
    return invites.find(
      (inv) => !inv.used && (inv.email || "").toLowerCase().trim() === cleanEmail
    );
  }, [cleanEmail, invites]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!cleanEmail) return;

    setIsSubmitting(true);
    try {
      const ok = await onCreateInvite(cleanEmail, inviteRole, inviteBranch);
      if (ok) {
        setInviteEmail("");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const pendingInvites = useMemo(() => {
    return invites.filter((inv) => !inv.used);
  }, [invites]);

  const filteredInvites = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return pendingInvites;
    return pendingInvites.filter((inv) => {
      const email = (inv.email || "").toLowerCase();
      const role = (inv.role || "").toLowerCase();
      const branch = (inv.branch || "").toLowerCase();
      return email.includes(q) || role.includes(q) || branch.includes(q);
    });
  }, [pendingInvites, searchQuery]);

  const handleCopyLink = async (token) => {
    const link = `${window.location.origin}/join/${token}`;
    const res = await copyText(link);
    if (res.ok) {
      toast("Link copied to clipboard!", "success");
    } else {
      toast("Failed to copy link to clipboard", "error");
    }
  };

  const handleWhatsAppShare = (inv) => {
    const text = buildWhatsAppInviteMessage(inv, window.location.origin);
    const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(waUrl, "_blank");
  };

  return (
    <div className="bg-white p-4 sm:p-6 rounded-3xl shadow-sm border border-slate-150 w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-extrabold text-slate-800 text-lg">Staff Invitations</h3>
            <span className="bg-indigo-50 text-[#1a3a8f] text-xs font-black px-2 py-0.5 rounded-full border border-indigo-100">
              {pendingInvites.length} Pending
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Generate secure 7-day onboarding links for new instructors, managers, and operational
            staff.
          </p>
        </div>
      </div>

      {/* Creation Form */}
      <form
        onSubmit={handleSubmit}
        className="bg-slate-50/70 p-4 sm:p-5 rounded-2xl border border-slate-200/80 space-y-3"
      >
        <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
          <UserPlus className="w-3.5 h-3.5 text-[#1a3a8f]" />
          <span>Generate New Invitation</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div className="sm:col-span-2 md:col-span-2">
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              Staff Email Address *
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
              <input
                type="email"
                placeholder="staff.name@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:border-[#1a3a8f] outline-none transition"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              Assigned Role *
            </label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="w-full py-2.5 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:border-[#1a3a8f] outline-none cursor-pointer transition"
            >
              <option value="instructor">Instructor / Teacher</option>
              <option value="manager">Campus Manager</option>
              <option value="marketing">Marketing Specialist</option>
              <option value="frontoffice">Front Office / Admin</option>
              <option value="officeboy">Office Support Staff</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              Campus Branch *
            </label>
            <select
              value={inviteBranch}
              onChange={(e) => setInviteBranch(e.target.value)}
              className="w-full py-2.5 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:border-[#1a3a8f] outline-none cursor-pointer transition"
            >
              {branchOptions.map((br) => (
                <option key={br} value={br}>
                  {br}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Duplicate warning hints */}
        {existingUser && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs p-2.5 rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
            <span>
              <strong>Note:</strong> An account with this email is already registered as{" "}
              <strong>{existingUser.displayName || existingUser.email}</strong> ({existingUser.role}
              ). If they re-register, Firebase Auth will require their account to be cleared first.
            </span>
          </div>
        )}

        {existingPendingInvite && !existingUser && (
          <div className="bg-blue-50 border border-blue-200 text-blue-800 text-xs p-2.5 rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-blue-600" />
            <span>
              <strong>Note:</strong> An active pending invitation already exists for this email.
              Generating another link will create an additional token.
            </span>
          </div>
        )}

        <div className="flex justify-end pt-1">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto bg-[#1a3a8f] hover:bg-[#122b6e] text-white px-5 py-2.5 rounded-xl font-bold text-xs transition shadow-xs flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isSubmitting ? "Generating..." : "Generate Invitation Link"}</span>
          </button>
        </div>
      </form>

      {/* Pending Invites List */}
      <div className="space-y-3 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wider">
            Pending Staff Invitations ({pendingInvites.length})
          </h4>

          {pendingInvites.length > 3 && (
            <div className="relative w-full sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search invites..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:bg-white focus:border-[#1a3a8f] outline-none"
              />
            </div>
          )}
        </div>

        {pendingInvites.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
            <Mail className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-600">No pending invitations</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Enter a staff email above to create an onboarding link.
            </p>
          </div>
        ) : filteredInvites.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-400">
            No invitations match "{searchQuery}".
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2.5">
            {filteredInvites.map((inv) => {
              const roleConfig = ROLE_BADGES[inv.role] || {
                label: inv.role,
                tone: "bg-slate-100 text-slate-600 border-slate-200",
              };
              const expiry = getExpiryInfo(inv.expiresAt);
              const createdStr = inv.createdAt
                ? new Date(inv.createdAt).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : "—";

              return (
                <div
                  key={inv.id}
                  className="flex flex-col md:flex-row justify-between items-start md:items-center p-3.5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:border-indigo-200 transition gap-3"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-extrabold text-slate-900 text-xs sm:text-sm truncate">
                        {inv.email}
                      </p>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${roleConfig.tone}`}
                      >
                        {roleConfig.label}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${expiry.tone}`}
                      >
                        {expiry.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-slate-400" />
                        <span>{inv.branch || DEFAULT_BRANCH}</span>
                      </span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>Created {createdStr}</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 w-full md:w-auto shrink-0 pt-1 md:pt-0">
                    <button
                      type="button"
                      onClick={() => handleWhatsAppShare(inv)}
                      className="flex-1 md:flex-none inline-flex items-center justify-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition shadow-2xs"
                      title="Share via WhatsApp"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopyLink(inv.token)}
                      className="flex-1 md:flex-none inline-flex items-center justify-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition shadow-2xs"
                      title="Copy signup link"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Link</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteInvite(inv.id, inv.email)}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 hover:text-rose-700 rounded-xl border border-transparent hover:border-rose-200 transition"
                      title="Revoke invitation"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
