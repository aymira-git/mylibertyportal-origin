import { useState, useEffect } from "react";
import { auth } from "../../firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import schoolLogo from "../../assets/school-logo.webp";
import { fetchInviteByToken, completeStaffSignup } from "./authRepository";
import { AlertCircle, CheckCircle2, Mail, ArrowRight, Loader2 } from "lucide-react";

/**
 * Runs `commit` and retries it on Firestore permission errors only. Right
 * after signup the Firestore client can still be carrying the signed-out
 * auth state for a moment, which looks identical to a genuine rules
 * rejection. Anything that isn't a permission problem is thrown straight
 * away — retrying a bad write three times just delays the error.
 */
async function commitWithRetry(commit, attempts = 3) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await commit();
    } catch (err) {
      const isPermission = err.code === "permission-denied" || err.code === "unauthenticated";
      if (!isPermission || attempt >= attempts) throw err;
      await new Promise(resolve => setTimeout(resolve, 400 * attempt));
    }
  }
}

export default function StaffSignup() {
  // Read once, at mount, via a lazy initializer rather than an effect —
  // the token is either present in the URL or it isn't, and that fact
  // doesn't change without a full navigation. Deriving it (and the "no
  // token" error) as initial state means there's no synchronous setState
  // to run in an effect on the very first render.
  const [inviteToken] = useState(() => {
    const parts = window.location.pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] || null;
  });

  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(() => Boolean(inviteToken));
  const [submitting, setSubmitting] = useState(false);
  // Two separate errors on purpose. `inviteError` means the link itself is
  // no good, so there's nothing to fill in and we show a dead-end page.
  // `submitError` means the link was fine but this attempt failed (bad
  // password, network, etc.) — the form has to stay on screen so they can
  // fix it and try again. Sharing one state made every failure, including a
  // six-character password, wipe the form and say "Invalid Invitation".
  //
  // A missing token is known synchronously at mount (see inviteToken
  // above), so its error message is set as the initial value here rather
  // than inside the effect below.
  const [inviteError, setInviteError] = useState(() =>
    inviteToken ? "" : "This page needs an invitation link. Ask an administrator to send you one."
  );
  const [submitError, setSubmitError] = useState("");
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    nickname: "",
    gender: "male",
    phone: "",
    dob: "",
    educationLevel: "Universitas",
    password: ""
  });

  // The no-token case is fully handled above, in initial state — nothing
  // left for this effect to do when there's no token to look up.
  useEffect(() => {
    if (!inviteToken) return;

    (async () => {
      try {
        const foundInvite = await fetchInviteByToken(inviteToken);
        if (!foundInvite || foundInvite.used) {
          setInviteError("This invitation link is invalid or has already been used.");
        } else {
          setInvite(foundInvite);
        }
      } catch (err) {
        setInviteError("Error verifying invitation: " + err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [inviteToken]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError("");

    let uid = null; // set once the Auth account exists — see the catch below

    try {
      // 1. Create Auth Account
      const cred = await createUserWithEmailAndPassword(auth, invite.email, formData.password);
      uid = cred.user.uid;

      // Force the brand-new ID token to be minted before we write anything.
      // Firestore's rules need it to see this request as a signed-in user.
      // This replaces the old fixed 800ms sleep, which was a guess that
      // could be both too long (slow signup) and too short (slow device).
      await cred.user.getIdToken(true);

      // 2. Create the Firestore profile and clear the used invite together,
      // atomically — see completeStaffSignup for why.
      const userProfile = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        nickname: formData.nickname,
        gender: formData.gender,
        displayName: `${formData.firstName} ${formData.lastName}`.trim(),
        email: invite.email,
        role: invite.role,
        phone: formData.phone,
        dob: formData.dob,
        educationLevel: formData.educationLevel,
        createdAt: new Date().toISOString()
      };

      // The Firestore client can briefly still be using the pre-signup
      // (signed-out) auth state even after the token above resolves, which
      // shows up as a one-off permission-denied. Retry a couple of times
      // before treating it as a real failure.
      await commitWithRetry(() => completeStaffSignup(uid, userProfile, invite.id));

      setSuccess(true);
    } catch (err) {
      if (err.code === "auth/email-already-in-use") {
        setSubmitError("An account with this email already exists in our system. If you've already registered, please try logging in. If you were recently deleted and are trying to re-register, an administrator must manually clear your old account from the Firebase Console first.");
      } else if (err.code === "auth/weak-password") {
        setSubmitError("That password is too short. Please use at least 6 characters.");
      } else if (err.code === "auth/network-request-failed") {
        setSubmitError("Couldn't reach the server. Check your internet connection and try again.");
      } else if (uid) {
        // The Auth account was created but the profile write didn't land.
        // Firebase Auth and Firestore are separate systems with no shared
        // transaction, so this gap can't be closed from the browser — but
        // the person in front of the screen should at least be told what
        // state they're in and what to ask for, instead of a raw SDK error.
        setSubmitError(
          "Your login was created, but saving your profile failed: " + err.message +
          " Please don't register again — ask an administrator to finish setting up your profile, then log in with the password you just chose."
        );
      } else {
        setSubmitError(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-[#1a3a8f] animate-spin" />
          <p className="text-slate-600 font-bold text-sm">Verifying invitation credentials...</p>
        </div>
      </div>
    );
  }

  if (inviteError) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-4 text-center">
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl max-w-md w-full">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4 border border-rose-100">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 mb-2">Invalid Invitation</h2>
          <p className="text-slate-500 text-xs mb-6 leading-relaxed">{inviteError}</p>
          <a
            href="/"
            className="w-full inline-flex items-center justify-center gap-2 bg-[#1a3a8f] hover:bg-[#122b6e] text-white py-3 px-4 rounded-xl font-bold text-xs transition shadow-md"
          >
            Return to Login
          </a>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-4 text-center">
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl max-w-md w-full">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4 border border-emerald-100">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 mb-2">Welcome to the Team!</h2>
          <p className="text-slate-500 text-xs mb-6 leading-relaxed">
            Your staff account has been provisioned and registered in our database. You can now sign in with your credentials.
          </p>
          <a
            href="/"
            className="w-full inline-flex items-center justify-center gap-2 bg-[#1a3a8f] hover:bg-[#122b6e] text-white py-3.5 px-4 rounded-xl font-bold text-xs transition shadow-md"
          >
            <span>Sign In to Dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center py-10 px-4">
      <div className="text-center mb-6">
        <img
          src={schoolLogo}
          alt="My Liberty School Logo"
          className="w-16 h-16 mx-auto mb-3 object-contain rounded-2xl bg-white p-1 border border-slate-200 shadow-xs"
        />
        <h1 className="text-2xl font-extrabold text-[#1a3a8f] tracking-tight">Staff Onboarding</h1>
        <p className="text-slate-500 text-xs mt-1">
          Complete your staff dossier to join the{" "}
          <span className="font-bold text-indigo-900 capitalize px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-100">
            {invite.role}
          </span>{" "}
          team.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xl space-y-4"
      >
        <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/80 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-[#1a3a8f] shrink-0">
            <Mail className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Authorized Email
            </label>
            <p className="font-bold text-slate-800 text-xs truncate">{invite.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              First Name
            </label>
            <input
              type="text"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-medium focus:border-[#1a3a8f] focus:ring-1 focus:ring-[#1a3a8f] outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Last Name
            </label>
            <input
              type="text"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-medium focus:border-[#1a3a8f] focus:ring-1 focus:ring-[#1a3a8f] outline-none"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Nickname / Preferred Name
            </label>
            <input
              type="text"
              placeholder="e.g. Ms. Sarah"
              value={formData.nickname}
              onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
              className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-medium focus:border-[#1a3a8f] focus:ring-1 focus:ring-[#1a3a8f] outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Gender
            </label>
            <select
              value={formData.gender}
              onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
              className="w-full p-2.5 border border-slate-200 rounded-xl text-xs bg-white font-semibold text-slate-700 focus:border-[#1a3a8f] focus:ring-1 focus:ring-[#1a3a8f] outline-none"
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
            WhatsApp / Mobile Phone
          </label>
          <input
            type="tel"
            placeholder="+62 812-xxxx-xxxx"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-medium focus:border-[#1a3a8f] focus:ring-1 focus:ring-[#1a3a8f] outline-none"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Date of Birth
            </label>
            <input
              type="date"
              value={formData.dob}
              onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
              className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-medium focus:border-[#1a3a8f] focus:ring-1 focus:ring-[#1a3a8f] outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Education Level
            </label>
            <select
              value={formData.educationLevel}
              onChange={(e) => setFormData({ ...formData, educationLevel: e.target.value })}
              className="w-full p-2.5 border border-slate-200 rounded-xl text-xs bg-white font-semibold text-slate-700 focus:border-[#1a3a8f] focus:ring-1 focus:ring-[#1a3a8f] outline-none"
            >
              <option value="SMA/SMK">SMA/SMK</option>
              <option value="Universitas">Universitas (S1)</option>
              <option value="S2">Master Degree (S2)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
            Create Password
          </label>
          <input
            type="password"
            placeholder="At least 6 characters"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-medium focus:border-[#1a3a8f] focus:ring-1 focus:ring-[#1a3a8f] outline-none"
            minLength="6"
            required
          />
        </div>

        {submitError && (
          <div
            className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl flex items-center gap-2"
            role="alert"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{submitError}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-[#1a3a8f] hover:bg-[#122b6e] text-white p-3.5 rounded-xl font-bold text-xs transition duration-150 shadow-md shadow-indigo-950/10 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Registering Staff Credentials...</span>
            </>
          ) : (
            <>
              <span>Complete Registration</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
