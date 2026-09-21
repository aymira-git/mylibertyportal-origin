import { useState, useMemo } from "react";
import { MessageCircle, X, Copy, Check, ChevronDown, ChevronUp } from "lucide-react";
import { normalizeWhatsAppNumber } from "../finance/receiptMessages";
import { copyText } from "../../utils/copyText";

// ── Outreach Message Templates ──────────────────────────────────────

const TEMPLATES = [
  {
    id: "reminder",
    label: "🔔 Class Reminder & Room",
    build: (ctx) =>
      `Halo, Bunda/Ayah! 👋\n\nMengingatkan bahwa kelas *${ctx.className}* akan berlangsung:\n📅 Hari: ${ctx.classDay}\n⏰ Jam: ${ctx.startTime} – ${ctx.endTime}\n🏫 Ruangan: ${ctx.classRoom || "TBA"}\n👨‍🏫 Pengajar: ${ctx.instructorName || "TBA"}\n\nMohon pastikan putra/putri hadir tepat waktu. Terima kasih! 🙏\n\n— My Liberty English School`,
  },
  {
    id: "reschedule",
    label: "📅 Schedule Change",
    build: (ctx) =>
      `Halo, Bunda/Ayah! 👋\n\nMohon perhatian, jadwal kelas *${ctx.className}* telah berubah:\n📅 Hari baru: ${ctx.classDay}\n⏰ Jam baru: ${ctx.startTime} – ${ctx.endTime}\n🏫 Ruangan: ${ctx.classRoom || "TBA"}\n\nMohon maaf atas ketidaknyamanannya. Jika ada pertanyaan, silakan hubungi kami. Terima kasih! 🙏\n\n— My Liberty English School`,
  },
  {
    id: "homework",
    label: "📝 Homework / Announcement",
    build: (ctx) =>
      `Halo, Bunda/Ayah! 👋\n\nInformasi untuk kelas *${ctx.className}*:\n👨‍🏫 Pengajar: ${ctx.instructorName || "TBA"}\n\n[Tulis pesan pengumuman/PR di sini]\n\nTerima kasih! 🙏\n\n— My Liberty English School`,
  },
];

/**
 * BatchOutreachPanel — per-parent WhatsApp outreach + phone list export.
 *
 * Props:
 *   batch    — the class document { className, classDay, startTime, endTime, classRoom, instructorName, studentIds, enrollments }
 *   users    — full users array to resolve student → parent data
 *   onClose  — closes the panel
 */
export default function BatchOutreachPanel({ batch, users = [], onClose }) {
  const [selectedTemplate, setSelectedTemplate] = useState("reminder");
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(true);

  // Resolve students in this batch
  const students = useMemo(() => {
    if (!batch) return [];
    const ids = new Set(batch.studentIds || batch.enrollments?.map((e) => e.studentId) || []);
    return (users || []).filter((u) => ids.has(u.id));
  }, [batch, users]);

  // Build message context from batch
  const msgContext = useMemo(
    () => ({
      className: batch?.className || "Class",
      classDay: batch?.classDay || "",
      startTime: batch?.startTime || "",
      endTime: batch?.endTime || "",
      classRoom: batch?.classRoom || "",
      instructorName: batch?.instructorName || "",
    }),
    [batch]
  );

  const template = TEMPLATES.find((t) => t.id === selectedTemplate) || TEMPLATES[0];
  const message = template.build(msgContext);

  // Collect parent phone numbers
  const parentContacts = useMemo(() => {
    return students
      .map((s) => ({
        studentName: s.displayName || s.name || s.email || "Student",
        parentPhone: s.parentPhone || s.phone || "",
        normalized: normalizeWhatsAppNumber(s.parentPhone || s.phone || ""),
      }))
      .filter((c) => c.normalized);
  }, [students]);

  const handleCopyAll = async () => {
    const numbers = parentContacts.map((c) => `+${c.normalized}`).join("\n");
    const res = await copyText(numbers);
    if (res.ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const openWhatsApp = (normalized) => {
    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/${normalized}?text=${encoded}`, "_blank");
  };

  if (!batch) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-fadeIn">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-6">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-emerald-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-lg">Batch Outreach</h3>
              <p className="text-xs text-slate-500">
                {batch.className} — {parentContacts.length} parent
                {parentContacts.length !== 1 ? "s" : ""} reachable
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Template Selector */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              Message Template
            </label>
            <select
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold bg-slate-50 focus:bg-white focus:border-emerald-600 outline-none transition"
            >
              {TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Preview */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-[11px] font-bold text-slate-500 uppercase tracking-wider hover:text-slate-700 transition"
          >
            <span>Message Preview</span>
            {expanded ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
          {expanded && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3.5 text-xs text-slate-700 font-medium whitespace-pre-wrap leading-relaxed">
              {message}
            </div>
          )}

          {/* Parent List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                Parents ({parentContacts.length})
              </span>
              {parentContacts.length > 0 && (
                <button
                  onClick={handleCopyAll}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] rounded-lg transition"
                >
                  {copied ? (
                    <Check className="w-3 h-3 text-emerald-600" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                  <span>{copied ? "Copied!" : "Copy All Numbers"}</span>
                </button>
              )}
            </div>

            {parentContacts.length === 0 && (
              <p className="text-xs text-slate-400 italic py-4 text-center">
                No parent phone numbers found for students in this batch.
              </p>
            )}

            <div className="space-y-1.5">
              {parentContacts.map((contact, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between bg-slate-50 hover:bg-slate-100 rounded-xl px-3.5 py-2.5 transition"
                >
                  <div>
                    <p className="text-xs font-bold text-slate-800">{contact.studentName}</p>
                    <p className="text-[11px] text-slate-500">+{contact.normalized}</p>
                  </div>
                  <button
                    onClick={() => openWhatsApp(contact.normalized)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] rounded-lg transition shadow-xs"
                  >
                    <MessageCircle className="w-3 h-3" />
                    <span>Send</span>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Disclaimer */}
          <p className="text-[10px] text-slate-400 italic text-center pt-2 border-t border-slate-100">
            Each &quot;Send&quot; button opens a pre-filled WhatsApp chat — you send individually.
            For bulk messaging, use &quot;Copy All Numbers&quot; and paste into a WhatsApp broadcast
            list.
          </p>
        </div>
      </div>
    </div>
  );
}
