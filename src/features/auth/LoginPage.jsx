import { useState } from "react";
import { auth } from "../../firebase";
import { sendPasswordResetEmail } from "firebase/auth";
import schoolLogo from "../../assets/school-logo.webp";
import { InstallButton } from "../pwa";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Sparkles,
  GraduationCap,
  CalendarCheck,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  UserPlus,
} from "lucide-react";

export default function LoginPage({ onLogin, loading }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Forgot Password States
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState({ text: "", type: "" });

  const handleSubmit = (e) => {
    e.preventDefault();
    onLogin(email, password);
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setResetLoading(true);
    setResetMessage({ text: "", type: "" });
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setResetMessage({
        text: "Success! Check your inbox for password reset instructions.",
        type: "success",
      });
      setTimeout(() => {
        setShowResetModal(false);
        setResetMessage({ text: "", type: "" });
        setResetEmail("");
      }, 3000);
    } catch (err) {
      setResetMessage({ text: "Error: " + err.message, type: "error" });
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#f8fafc] text-slate-800 font-sans selection:bg-indigo-100 selection:text-indigo-900 relative">
      {/* ── Forgot Password Modal Overlay ── */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md p-6 sm:p-8 rounded-2xl shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200 relative">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-[#1a3a8f] flex items-center justify-center">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Reset Password</h3>
                <p className="text-xs text-slate-500 font-medium">
                  We'll send a recovery link to your inbox
                </p>
              </div>
            </div>

            {resetMessage.text && (
              <div
                className={`p-3 rounded-xl text-xs font-semibold mb-4 flex items-center gap-2 ${
                  resetMessage.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-rose-50 text-rose-800 border border-rose-200"
                }`}
              >
                {resetMessage.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{resetMessage.text}</span>
              </div>
            )}

            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Registered Work Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    placeholder="name@myliberty.com"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-[#1a3a8f] focus:ring-2 focus:ring-[#1a3a8f]/10 transition font-medium"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  className="flex-1 py-3 px-4 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="flex-[2] bg-[#1a3a8f] text-white py-3 px-4 rounded-xl font-bold hover:bg-[#122b6e] transition text-xs shadow-md shadow-indigo-950/10 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {resetLoading ? "Sending Link..." : "Send Reset Link"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Left Showcase Panel (Hero & Atmosphere) ── */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#0a1c4a] via-[#102a70] to-[#1a3a8f] text-white p-12 xl:p-16 flex-col justify-between relative overflow-hidden">
        {/* Subtle geometric gradient orbs */}
        <div className="absolute w-[500px] h-[500px] bg-indigo-500/10 rounded-full -top-32 -left-32 blur-3xl pointer-events-none" />
        <div className="absolute w-[450px] h-[450px] bg-blue-400/10 rounded-full -bottom-24 -right-24 blur-3xl pointer-events-none" />

        {/* Brand Header */}
        <div className="relative z-10 flex items-center gap-3">
          <img
            src={schoolLogo}
            alt="My Liberty Logo"
            className="w-12 h-12 rounded-xl object-contain bg-white/10 p-1.5 backdrop-blur-sm border border-white/20 shadow-md"
          />
          <div>
            <span className="text-xs uppercase tracking-widest text-indigo-200 font-bold">
              Academic Portal
            </span>
            <h1 className="text-xl font-extrabold tracking-tight text-white leading-none">
              MY LIBERTY
            </h1>
            <p className="text-[11px] font-medium text-indigo-200/90 tracking-wide mt-0.5">
              Fresh, Fun and Elegant
            </p>
          </div>
        </div>

        {/* Centerpiece Showcase */}
        <div className="relative z-10 max-w-lg space-y-8 my-auto py-12">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs text-indigo-100 font-medium">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>International English School Management</span>
            </div>
            <h2 className="text-4xl xl:text-5xl font-extrabold text-white tracking-tight leading-[1.15]">
              Empowering global minds with structured excellence.
            </h2>
            <p className="text-indigo-100/80 text-base leading-relaxed font-normal">
              Unified workspace connecting admissions, real-time student attendance, CEFR curriculum
              tracks, and staff directives.
            </p>
          </div>

          {/* Feature Highlights Grid */}
          <div className="grid grid-cols-2 gap-3.5 pt-2">
            <div className="bg-white/5 backdrop-blur-md border border-white/10 p-3.5 rounded-xl hover:bg-white/10 transition">
              <div className="flex items-center gap-2.5 text-indigo-200 font-bold text-xs mb-1">
                <CalendarCheck className="w-4 h-4 text-emerald-300" />
                <span>Smart Attendance</span>
              </div>
              <p className="text-[11px] text-indigo-100/70 font-medium leading-normal">
                QR kiosk scanning with automated shift calculation and punctuality metrics.
              </p>
            </div>

            <div className="bg-white/5 backdrop-blur-md border border-white/10 p-3.5 rounded-xl hover:bg-white/10 transition">
              <div className="flex items-center gap-2.5 text-indigo-200 font-bold text-xs mb-1">
                <GraduationCap className="w-4 h-4 text-amber-300" />
                <span>CEFR Assessment</span>
              </div>
              <p className="text-[11px] text-indigo-100/70 font-medium leading-normal">
                Progress tracking across Starters, Movers, Flyers, KET, PET & FCE levels.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Footer info */}
        <div className="relative z-10 flex items-center justify-between text-xs text-indigo-200/70 border-t border-white/10 pt-4">
          <div className="flex flex-col gap-0.5">
            <span>&copy; {new Date().getFullYear()} MY LIBERTY International English School</span>
            <a
              href="https://github.com/aymira-git/mylibertyportal-public"
              target="_blank"
              rel="noreferrer"
              className="text-[10px] text-indigo-300/60 hover:text-indigo-200 underline font-mono transition"
            >
              https://github.com/aymira-git/mylibertyportal-public
            </a>
          </div>
          <span className="flex items-center gap-1.5 font-medium text-emerald-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Portal Active
          </span>
        </div>
      </div>

      {/* ── Right Panel: Form Card ── */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-12 lg:p-16">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile School Crest Header */}
          <div className="text-center lg:hidden space-y-1">
            <img
              src={schoolLogo}
              alt="My Liberty International English School"
              className="w-20 h-20 mx-auto drop-shadow-md rounded-2xl mb-1"
            />
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-tight">
              MY LIBERTY
            </h2>
            <p className="text-xs font-semibold text-[#1a3a8f]">Fresh, Fun and Elegant</p>
            <p className="text-slate-500 text-[11px] font-medium">
              International English School Portal
            </p>
          </div>

          {/* Form Header */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1a3a8f] uppercase tracking-wider bg-indigo-50 px-2.5 py-1 rounded-md">
                Secure Sign In
              </div>
              <InstallButton variant="pill" showText={true} />
            </div>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Welcome back
            </h3>
            <p className="text-slate-500 text-sm font-medium">
              Enter your registered staff credentials to access your workspace.
            </p>
          </div>

          {/* Sign In Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  placeholder="teacher@myliberty.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm font-medium bg-white text-slate-800 outline-none focus:border-[#1a3a8f] focus:ring-2 focus:ring-[#1a3a8f]/10 transition shadow-xs"
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowResetModal(true)}
                  className="text-xs font-bold text-[#1a3a8f] hover:underline transition"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-11 py-3 border border-slate-200 rounded-xl text-sm font-medium bg-white text-slate-800 outline-none focus:border-[#1a3a8f] focus:ring-2 focus:ring-[#1a3a8f]/10 transition shadow-xs"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition p-1"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#1a3a8f] hover:bg-[#122b6e] text-white py-3.5 px-4 rounded-xl font-bold transition duration-150 shadow-md shadow-indigo-950/10 flex items-center justify-center gap-2 group disabled:opacity-50 text-sm"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Dashboard</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* ── Public Student Application Quick Banner ── */}
          <div className="pt-2">
            <div className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50/70 to-blue-50/50 p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-white border border-indigo-200/60 shadow-xs flex items-center justify-center text-[#1a3a8f] shrink-0">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800 truncate">
                    Are you a new student?
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">
                    Register online for upcoming batches
                  </p>
                </div>
              </div>
              <a
                href="/register"
                className="shrink-0 px-3 py-1.5 bg-[#1a3a8f] hover:bg-[#122b6e] text-white text-xs font-bold rounded-lg transition shadow-xs"
              >
                Apply Now
              </a>
            </div>
          </div>

          {/* Quick Notice for Staff Invitation */}
          <p className="text-center text-xs text-slate-400 font-medium">
            Have an invitation link from administration? Open the link provided in your email to
            activate your account.
          </p>

          <div className="lg:hidden text-center pt-2">
            <a
              href="https://github.com/aymira-git/mylibertyportal-public"
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-slate-400 hover:text-[#1a3a8f] underline font-mono transition"
            >
              https://github.com/aymira-git/mylibertyportal-public
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
