import { useState } from "react";
import schoolLogo from "../../assets/school-logo.webp";
import { Sparkles, ArrowLeft, HelpCircle, Loader2, ExternalLink } from "lucide-react";
import { REGISTRATION_GOOGLE_FORM_URL } from "../../constants/externalLinks";

const GOOGLE_FORM_EMBED_URL = REGISTRATION_GOOGLE_FORM_URL;

export default function RegistrationPage() {
  const [iframeLoading, setIframeLoading] = useState(true);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 font-sans selection:bg-indigo-100 selection:text-indigo-900 pb-16">
      {/* ── Top Header Navigation Bar ── */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-8 py-3.5">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src={schoolLogo}
              alt="My Liberty International English School"
              className="w-10 h-10 object-contain rounded-xl p-1 bg-slate-50 border border-slate-100 shadow-xs"
            />
            <div>
              <h1 className="text-base font-extrabold text-[#1a3a8f] leading-none tracking-tight">
                MY LIBERTY
              </h1>
              <p className="text-[11px] font-bold text-[#1a3a8f]/80 mt-0.5">
                Fresh, Fun and Elegant
              </p>
              <p className="text-[10px] text-slate-500 font-medium">International English School</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-[#1a3a8f] px-3 py-1.5 rounded-lg hover:bg-slate-100 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Staff Login</span>
            </a>
          </div>
        </div>
      </header>

      {/* ── Main Hero Content ── */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12">
        {/* Hero Title Section */}
        <div className="text-center space-y-4 mb-10 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-xs font-bold text-[#1a3a8f]">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Admissions &amp; Course Enrollment</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Start Your Journey with MY LIBERTY
          </h2>
          <p className="text-slate-500 text-sm sm:text-base leading-relaxed font-normal">
            Complete the official registration form below to apply for our international English
            language programs, Cambridge CEFR assessment tracks, and intensive cohorts.
          </p>
        </div>

        {/* 3 Steps Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mb-8">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-[#1a3a8f] font-bold text-xs flex items-center justify-center shrink-0 border border-indigo-100">
              1
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-800">Submit Application</h3>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-normal">
                Fill student background, contact, and current education details below.
              </p>
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-[#1a3a8f] font-bold text-xs flex items-center justify-center shrink-0 border border-indigo-100">
              2
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-800">Placement Consultation</h3>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-normal">
                Our front office reaches out to confirm level placement and scheduling.
              </p>
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-[#1a3a8f] font-bold text-xs flex items-center justify-center shrink-0 border border-indigo-100">
              3
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-800">Welcome &amp; Student ID</h3>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-normal">
                Receive your digital ID pass, curriculum kit, and join your cohort.
              </p>
            </div>
          </div>
        </div>

        {/* Form Container */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xl overflow-hidden relative">
          {/* Form Header Bar */}
          <div className="bg-slate-50/80 border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold text-slate-700">Official Admissions Form</span>
            </div>
            <a
              href={GOOGLE_FORM_EMBED_URL.replace("&embedded=true", "")}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-[#1a3a8f] font-bold hover:underline"
            >
              <span>Open in new tab</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* Loading Indicator */}
          {iframeLoading && (
            <div className="p-12 text-center flex flex-col items-center justify-center gap-3 bg-white min-h-[300px]">
              <Loader2 className="w-8 h-8 text-[#1a3a8f] animate-spin" />
              <p className="text-xs font-bold text-slate-600">
                Loading student registration form...
              </p>
              <p className="text-[11px] text-slate-400">
                Please wait a moment while the secure form initializes.
              </p>
            </div>
          )}

          {/* Embed */}
          <iframe
            src={GOOGLE_FORM_EMBED_URL}
            title="MY LIBERTY REGISTRATION FORM"
            width="100%"
            height="2700"
            className={`w-full border-0 transition-opacity duration-300 ${
              iframeLoading ? "opacity-0 h-0" : "opacity-100 min-h-[2700px]"
            }`}
            onLoad={() => setIframeLoading(false)}
          >
            Loading form...
          </iframe>
        </div>

        {/* Help & Contact Banner */}
        <div className="mt-8 bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-lg">
          <div className="space-y-1.5 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-2 text-indigo-300 text-xs font-bold uppercase tracking-wider">
              <HelpCircle className="w-4 h-4" />
              <span>Need Immediate Admissions Support?</span>
            </div>
            <h4 className="text-lg font-bold text-white">Have questions before submitting?</h4>
            <p className="text-xs text-indigo-200/80 max-w-md">
              Visit our front office desk or contact our admissions coordinator during school hours
              for placement consultation.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
            <a
              href="/"
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-white text-[#1a3a8f] font-bold text-xs hover:bg-indigo-50 transition text-center shadow-xs"
            >
              Back to Portal
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
