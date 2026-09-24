import { useState } from "react";
import schoolLogo from "../../assets/school-logo.webp";
import { formatIDR } from "../finance/receiptMessages";
import {
  lookupStudentForParent,
  getStudentParentPortalBundle,
} from "./parentPortalRepository";
import LevelBadge from "../shared/LevelBadge";
import Badge from "../shared/Badge";
import {
  Search,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Phone,
  MessageSquare,
  ArrowLeft,
  GraduationCap,
  Sparkles,
  HelpCircle,
} from "lucide-react";

/**
 * ParentPortalPage
 * Read-only, zero-broker cost portal for parents and guardians.
 * Allows quick lookup of student attendance, level progression, and tuition status.
 * Provides a 1-click WhatsApp query link to Front Desk staff.
 */
export default function ParentPortalPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [portalData, setPortalData] = useState(null);
  const [loadingData, setLoadingData] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSearch = async (e) => {
    e?.preventDefault();
    if (!searchTerm.trim() || searchTerm.trim().length < 2) {
      setErrorMessage("Please enter at least 2 characters (Student ID, Name, or Phone).");
      return;
    }

    setSearching(true);
    setErrorMessage("");
    setSearchResults([]);
    setSelectedStudentId(null);
    setPortalData(null);

    try {
      const results = await lookupStudentForParent(searchTerm);
      if (results.length === 0) {
        setErrorMessage("No matching student records found. Please check the spelling or contact Front Desk.");
      } else if (results.length === 1) {
        setSearchResults(results);
        handleSelectStudent(results[0].id);
      } else {
        setSearchResults(results);
      }
    } catch (err) {
      console.error("Parent search error:", err);
      setErrorMessage("Search failed. Please try again or reach out to Front Desk.");
    } finally {
      setSearching(false);
    }
  };

  const handleSelectStudent = async (studentId) => {
    setSelectedStudentId(studentId);
    setLoadingData(true);
    setErrorMessage("");
    try {
      const bundle = await getStudentParentPortalBundle(studentId);
      setPortalData(bundle);
    } catch (err) {
      console.error("Bundle load error:", err);
      setErrorMessage("Failed to load student details. Please try again.");
    } finally {
      setLoadingData(false);
    }
  };

  const student = portalData?.student;
  const paymentSummary = portalData?.paymentSummary;
  const batchInfo = portalData?.batchInfo;

  const formatSummaryDate = (value) =>
    value ? new Date(value).toLocaleDateString("id-ID") : null;

  // Front Desk WhatsApp Contact link helper
  const getWhatsAppHelpLink = () => {
    const studentName = student?.displayName || student?.name || "my child";
    const text = encodeURIComponent(
      `Halo Front Desk My Liberty, saya orang tua/wali dari ${studentName} (ID: ${student?.studentId || student?.id || "-"}). Saya ingin menanyakan terkait program belajar dan informasi administrasi.`
    );
    return `https://wa.me/6281234567890?text=${text}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 select-none font-sans">
      {/* Brand Header */}
      <header className="w-full max-w-3xl mx-auto flex items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <img
            src={schoolLogo}
            alt="My Liberty Logo"
            className="w-10 h-10 rounded-xl object-contain bg-white/10 p-1 border border-white/10 shadow-md"
          />
          <div>
            <h1 className="text-base font-black tracking-tight leading-none text-white">
              MY LIBERTY
            </h1>
            <p className="text-[11px] font-bold text-indigo-300 mt-0.5">
              Parent &amp; Student Information Portal
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            window.location.href = "/";
          }}
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition font-bold cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Staff Login</span>
        </button>
      </header>

      {/* Main Search & Results Body */}
      <main className="w-full max-w-3xl mx-auto my-6 space-y-6">
        {/* Search Box Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl backdrop-blur-md">
          <div className="flex items-center gap-2 mb-3">
            <GraduationCap className="w-5 h-5 text-indigo-400" />
            <h2 className="text-sm font-extrabold text-white">
              Student Record Lookup
            </h2>
          </div>
          <p className="text-xs text-slate-400 mb-4">
            Enter Student ID (NIS), registered Parent WhatsApp number, or Student Full Name.
          </p>

          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="e.g. ML-2026-001, 08123456789, or Sarah"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-700/80 rounded-2xl text-sm font-bold text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition"
              />
            </div>
            <button
              type="submit"
              disabled={searching}
              className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {searching ? (
                <span>Searching...</span>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>Lookup</span>
                </>
              )}
            </button>
          </form>

          {errorMessage && (
            <p className="text-xs text-rose-400 mt-3 font-medium flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </p>
          )}

          {/* Multiple Candidates Selection */}
          {searchResults.length > 1 && (
            <div className="mt-4 pt-4 border-t border-slate-800 space-y-2">
              <p className="text-xs font-bold text-slate-400">
                Found {searchResults.length} matching students. Please select:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {searchResults.map((res) => (
                  <button
                    key={res.id}
                    type="button"
                    onClick={() => handleSelectStudent(res.id)}
                    className={`text-left p-3 rounded-2xl border transition cursor-pointer flex items-center justify-between ${
                      selectedStudentId === res.id
                        ? "bg-indigo-900/40 border-indigo-500 text-white"
                        : "bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300"
                    }`}
                  >
                    <div>
                      <p className="text-xs font-black text-white">
                        {res.displayName || res.name}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        NIS: {res.studentId || "-"} • Level: {res.level || "Unassigned"}
                      </p>
                    </div>
                    <ArrowLeft className="w-4 h-4 rotate-180 text-slate-500" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Loading Indicator */}
        {loadingData && (
          <div className="text-center py-10">
            <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-400 font-bold">Loading student records...</p>
          </div>
        )}

        {/* Student Details Card */}
        {portalData && student && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Overview Card */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center font-black text-indigo-300 text-lg">
                    {(student.displayName || student.name || "S").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white flex items-center gap-2">
                      <span>{student.displayName || student.name}</span>
                      <Badge tone={student.status === "active" ? "emerald" : "slate"}>
                        {student.status || "Active"}
                      </Badge>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Student NIS: <strong className="text-slate-200">{student.studentId || student.id}</strong>
                      {student.branch && ` • Branch: ${student.branch}`}
                    </p>
                  </div>
                </div>

                {/* Level Badge */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-bold">Current Level:</span>
                  <LevelBadge level={student.level || "General"} />
                </div>
              </div>

              {/* Quick Info Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
                <div className="p-3 bg-slate-950/60 rounded-2xl border border-slate-800/80">
                  <span className="text-[11px] font-bold text-slate-400 block">Class / Batch</span>
                  <p className="text-xs font-black text-white mt-1">
                    {batchInfo?.name || student.batchName || "Regular Batch"}
                  </p>
                </div>

                <div className="p-3 bg-slate-950/60 rounded-2xl border border-slate-800/80">
                  <span className="text-[11px] font-bold text-slate-400 block">Schedule</span>
                  <p className="text-xs font-black text-white mt-1">
                    {batchInfo?.schedule || "Mon & Wed (16:00 WITA)"}
                  </p>
                </div>

                <div className="p-3 bg-slate-950/60 rounded-2xl border border-slate-800/80 col-span-2 sm:col-span-1">
                  <span className="text-[11px] font-bold text-slate-400 block">Tuition Status</span>
                  {paymentSummary?.status === "paid" && (
                    <p className="text-xs font-black text-emerald-400 mt-1 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{paymentSummary.paidUntil ? `Paid until ${formatSummaryDate(paymentSummary.paidUntil)}` : "Up to Date"}</span>
                    </p>
                  )}
                  {paymentSummary?.status === "pending" && (
                    <p className="text-xs font-black text-amber-400 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>Payment Pending</span>
                    </p>
                  )}
                  {(!paymentSummary || paymentSummary.status === "none") && (
                    <p className="text-xs font-black text-slate-400 mt-1">No Records</p>
                  )}
                </div>
              </div>
            </div>

            {/* Placement Tests & Academic Progression */}
            {Array.isArray(student.placementTests) && student.placementTests.length > 0 && (
              <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-indigo-300 mb-3 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  <span>Academic Level Assessments &amp; Tests</span>
                </h4>
                <div className="space-y-2">
                  {student.placementTests.map((pt, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div>
                        <p className="font-extrabold text-white">
                          {pt.program || "English Proficiency"} • Score: {pt.rawScore ?? pt.score ?? "-"}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Recommended Level: <strong className="text-indigo-300">{pt.recommendedLevel || "-"}</strong>
                          {pt.administeredBy && ` • Examiner: ${pt.administeredBy}`}
                        </p>
                      </div>
                      <span className="text-[10px] text-slate-500">
                        {pt.testedAt ? new Date(pt.testedAt).toLocaleDateString("id-ID") : "Recorded"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tuition Payment Summary */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-emerald-400" />
                <span>Tuition Payment Summary</span>
              </h4>

              {(!paymentSummary || paymentSummary.status === "none") ? (
                <p className="text-xs text-slate-500 py-3 text-center">
                  No payment records found. Please contact Front Desk for details.
                </p>
              ) : (
                <div className="space-y-2">
                  <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-black text-emerald-300">
                        {paymentSummary.lastPaymentAmount != null
                          ? formatIDR(paymentSummary.lastPaymentAmount)
                          : "—"}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {paymentSummary.lastPaymentPeriod || "Tuition"}
                        {paymentSummary.lastPaymentMethod && ` • ${paymentSummary.lastPaymentMethod}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold block mb-0.5 border ${
                          paymentSummary.status === "paid"
                            ? "bg-emerald-950 text-emerald-400 border-emerald-800"
                            : "bg-amber-950 text-amber-400 border-amber-800"
                        }`}
                      >
                        {paymentSummary.status === "paid" ? "Paid" : "Pending"}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {formatSummaryDate(paymentSummary.lastPaymentDate) || "-"}
                      </span>
                    </div>
                  </div>

                  {paymentSummary.paidUntil && (
                    <p className="text-[11px] text-slate-400 px-1">
                      Payment coverage valid through{" "}
                      <strong className="text-slate-200">{formatSummaryDate(paymentSummary.paidUntil)}</strong>.
                    </p>
                  )}
                  <p className="text-[11px] text-slate-500 px-1">
                    For full receipts and payment history, please contact Front Desk via WhatsApp below.
                  </p>
                </div>
              )}
            </div>

            {/* Direct Front Desk Contact WhatsApp Banner */}
            <div className="p-4 rounded-3xl bg-gradient-to-r from-emerald-950/80 via-slate-900 to-indigo-950/80 border border-emerald-800/60 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-white">Need help or want to ask about schedule?</h4>
                  <p className="text-[11px] text-slate-300">
                    Connect directly with My Liberty Front Desk on WhatsApp (No robot / live human desk).
                  </p>
                </div>
              </div>

              <a
                href={getWhatsAppHelpLink()}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-sm"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>WhatsApp Front Desk</span>
              </a>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full max-w-3xl mx-auto flex items-center justify-between text-xs text-slate-500 pt-4 border-t border-slate-800/80">
        <p className="text-[11px]">
          &copy; {new Date().getFullYear()} My Liberty English Academy. All rights reserved.
        </p>
        <p className="text-[11px] font-mono text-slate-600">
          WITA (Asia/Makassar)
        </p>
      </footer>
    </div>
  );
}
