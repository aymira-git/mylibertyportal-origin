/**
 * Student / Staff ID badge print modal.
 * Displays a premium printable credential card with a locally-generated QR code.
 */

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import schoolLogo from "../../assets/school-logo.webp";
import { Printer, Download, X, QrCode as QrIcon, ShieldCheck } from "lucide-react";
import LevelBadge from "../shared/LevelBadge";

function getInitials(name) {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

export default function BadgeModal({ person, onClose }) {
  const [qrUrl, setQrUrl] = useState("");

  useEffect(() => {
    if (!person) return;
    let cancelled = false;
    QRCode.toDataURL(person.id, {
      width: 320,
      margin: 1,
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
    })
      .then((url) => {
        if (!cancelled) setQrUrl(url);
      })
      .catch((err) => console.error("QR generation failed:", err));
    return () => {
      cancelled = true;
    };
  }, [person]);

  if (!person) return null;

  const isStudent = person.role === "student";

  const handleDownload = () => {
    if (!qrUrl) return;
    const a = document.createElement("a");
    a.href = qrUrl;
    a.download = `${person.displayName || "person"}-qr-pass.png`;
    a.click();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-sm rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
        {/* Mobile handle indicator */}
        <div className="pt-3 pb-1 flex justify-center sm:hidden">
          <div className="h-1.5 w-12 rounded-full bg-slate-200" />
        </div>

        {/* Modal Top Bar (Screen only) */}
        <div className="no-print px-5 py-3.5 flex items-center justify-between border-b border-slate-100 bg-slate-50/60">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              {isStudent ? "Student Identification" : "Staff Credential"}
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-200/80 flex items-center justify-center text-slate-400 hover:text-slate-600 transition"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Official Printable ID Card Area ── */}
        <div className="p-5 sm:p-6 print:p-0 flex justify-center bg-slate-50/40">
          <div
            id="printable-id-card"
            className="w-full bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden text-center relative selection:bg-none"
          >
            {/* Academic Card Header Stripe */}
            <div className="bg-gradient-to-r from-[#0c235f] via-[#122b6e] to-[#1a3a8f] text-white p-4 text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-xl pointer-events-none" />
              <img
                src={schoolLogo}
                alt="My Liberty"
                className="w-10 h-10 mx-auto object-contain bg-white/10 rounded-xl p-1 backdrop-blur-xs mb-1.5 border border-white/20 shadow-xs"
              />
              <h4 className="font-extrabold text-sm tracking-wide uppercase text-white leading-tight">
                MY LIBERTY
              </h4>
              <p className="text-[10px] text-indigo-100/80 font-medium tracking-wider uppercase">
                International English School
              </p>
            </div>

            {/* Card Body */}
            <div className="p-5 space-y-4">
              {/* Member Photo or Crest Avatar */}
              <div className="flex justify-center -mt-9 relative z-10">
                {person.photoURL ? (
                  <img
                    src={person.photoURL}
                    alt={person.displayName}
                    className="w-16 h-16 rounded-2xl object-cover border-4 border-white shadow-md bg-white"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#1a3a8f] to-indigo-700 text-white font-extrabold text-xl flex items-center justify-center border-4 border-white shadow-md">
                    {getInitials(person.displayName || person.nickname)}
                  </div>
                )}
              </div>

              {/* Identity Details */}
              <div className="space-y-1">
                <h5 className="font-extrabold text-slate-900 text-base leading-snug">
                  {person.displayName}
                </h5>
                {person.nickname && person.nickname !== person.displayName && (
                  <p className="text-xs font-semibold text-indigo-900">
                    &ldquo;{person.nickname}&rdquo;
                  </p>
                )}
                <div className="flex items-center justify-center gap-1.5 pt-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                    {person.role || "Member"}
                  </span>
                  {person.level && <LevelBadge level={person.level} />}
                </div>
              </div>

              {/* QR Code Container */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 inline-flex flex-col items-center justify-center shadow-2xs mx-auto">
                <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-xs">
                  {qrUrl ? (
                    <img src={qrUrl} alt="Identity QR Code" className="w-32 h-32 object-contain" />
                  ) : (
                    <div className="w-32 h-32 flex items-center justify-center text-slate-400">
                      <QrIcon className="w-8 h-8 animate-pulse" />
                    </div>
                  )}
                </div>
                <div className="mt-2 text-center">
                  <p className="text-[10px] font-mono font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs">
                    ID: {person.id.slice(0, 14)}
                  </p>
                  <p className="text-[9px] text-slate-500 font-medium mt-1">
                    Scan for attendance &amp; verification
                  </p>
                </div>
              </div>

              {/* Academic Metadata Grid */}
              <div className="grid grid-cols-2 gap-2 text-[11px] pt-3 border-t border-slate-100 text-slate-600">
                <div className="text-left bg-slate-50/70 p-2 rounded-xl">
                  <span className="block text-[9px] uppercase font-bold text-slate-400">
                    Date of Birth
                  </span>
                  <span className="font-semibold text-slate-800">{person.dob || "—"}</span>
                </div>
                <div className="text-right bg-slate-50/70 p-2 rounded-xl">
                  <span className="block text-[9px] uppercase font-bold text-slate-400">
                    Education / Track
                  </span>
                  <span className="font-semibold text-slate-800 truncate block">
                    {person.educationLevel || person.schoolOrJob || "Active Track"}
                  </span>
                </div>
              </div>
            </div>

            {/* Card Footer Bar */}
            <div className="bg-slate-50 border-t border-slate-100 px-4 py-2 flex items-center justify-between text-[10px] text-slate-600">
              <span className="flex items-center gap-1 font-semibold text-slate-700">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Verified Credential
              </span>
              <span className="text-slate-500 font-medium">Valid {new Date().getFullYear()}</span>
            </div>
          </div>
        </div>

        {/* Modal Action Buttons (Screen only) */}
        <div className="no-print p-4 sm:p-5 bg-white border-t border-slate-100 flex gap-2.5">
          <button
            onClick={() => window.print()}
            className="flex-1 bg-[#1a3a8f] hover:bg-[#122b6e] text-white py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-indigo-950/10 transition"
          >
            <Printer className="w-4 h-4" />
            <span>Print Badge</span>
          </button>
          <button
            onClick={handleDownload}
            className="py-3 px-3 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition text-xs font-bold flex items-center justify-center gap-1.5"
            title="Download QR Code image"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Download</span>
          </button>
          <button
            onClick={onClose}
            className="py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 font-bold text-xs transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
