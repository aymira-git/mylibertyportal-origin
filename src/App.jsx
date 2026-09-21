import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { auth, db } from "./firebase";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { ProfilePanel, LoginPage } from "./features/auth";
import { useToast, ErrorBoundary, ConnectivityBanner } from "./features/shared";
import { InstallButton } from "./features/pwa";
import schoolLogo from "./assets/school-logo.webp";

// Code-split: each of these becomes its own downloaded chunk, fetched
// only when actually needed — an instructor's browser never downloads
// Admin's code, a marketing user never downloads the Kiosk/QR logic, etc.
const RegistrationPage = lazy(() => import("./features/auth/RegistrationPage"));
const StaffSignup = lazy(() => import("./features/auth/StaffSignup"));
const AdminDashboard = lazy(() => import("./features/dashboard/AdminDashboard"));
const FrontOfficeDashboard = lazy(() => import("./features/dashboard/FrontOfficeDashboard"));
const ManagerDashboard = lazy(() => import("./features/dashboard/ManagerDashboard"));
const InstructorDashboard = lazy(() => import("./features/dashboard/InstructorDashboard"));
const MarketingDashboard = lazy(() => import("./features/dashboard/MarketingDashboard"));
const OfficeBoyDashboard = lazy(() => import("./features/dashboard/OfficeBoyDashboard"));

function LoadingFallback() {
  return (
    <div className="bg-gray-50 min-h-screen flex items-center justify-center">
      <p className="text-gray-500 text-sm">Loading...</p>
    </div>
  );
}

function getInitials(name) {
  if (!name) return "?";
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase()).join("");
}

// ── IDLE TIMEOUT CONFIG ──
const IDLE_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const WARNING_TIME = 30 * 1000;      // 30 seconds

function App() {
  const toast = useToast();
  const [user, setUser] = useState(null);
  const [role, setRole] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [nickname, setNickname] = useState(""); 
  const [photoURL, setPhotoURL] = useState("");
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [idleWarning, setIdleWarning] = useState(false); // 👈 Added state for idle warning

  useEffect(() => {
    if (!user) return;

    let warningTimer;
    let logoutTimer;

    const resetTimers = () => {
      setIdleWarning(false);
      clearTimeout(warningTimer);
      clearTimeout(logoutTimer);
      
      warningTimer = setTimeout(() => setIdleWarning(true), IDLE_TIMEOUT - WARNING_TIME);
      logoutTimer = setTimeout(() => {
        signOut(auth).then(() => {
          setUser(null);
          setIdleWarning(false);
        });
      }, IDLE_TIMEOUT);
    };

    // Events to watch for activity
    const events = ["mousedown", "mousemove", "keypress", "scroll", "touchstart"];
    events.forEach(e => document.addEventListener(e, resetTimers));
    
    resetTimers(); // Initial start

    return () => {
      events.forEach(e => document.removeEventListener(e, resetTimers));
      clearTimeout(warningTimer);
      clearTimeout(logoutTimer);
    };
  }, [user]);

  const refreshProfile = useCallback(async (uid) => {
    const userDoc = await getDoc(doc(db, "users", uid));
    if (userDoc.exists()) {
      const data = userDoc.data();
      const status = data.status || "active";
      if (status === "resigned" || status === "terminated") {
        await signOut(auth);
        toast("Your account has been deactivated. Please contact academy administration.", "error");
        setUser(null);
        setRole("");
        setNickname("");
        return false;
      }
      setRole(data.role || "student");
      setDisplayName(data.displayName || "");
      setNickname(data.nickname || data.displayName || ""); 
      setPhotoURL(data.photoURL || "");
      return true;
    }
    return true;
  }, [toast]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const ok = await refreshProfile(currentUser.uid);
          if (ok) {
            setUser(currentUser);
          }
        } catch (err) {
          console.error(err);
        }
      } else {
        setUser(null);
        setRole("");
        setNickname("");
      }
      setCheckingAuth(false);
    });
    return () => unsubscribe();
  }, [refreshProfile]);

  // Live Active Session Termination Guard (R20)
  useEffect(() => {
    if (!user) return;
    const unsubDoc = onSnapshot(
      doc(db, "users", user.uid),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const status = data.status || "active";
          if (status === "resigned" || status === "terminated") {
            signOut(auth).then(() => {
              toast("Your account has been deactivated. You have been signed out.", "error");
              setUser(null);
              setRole("");
              setNickname("");
            });
          }
        }
      },
      (err) => {
        console.warn("Active session monitor warning:", err);
      }
    );
    return () => unsubDoc();
  }, [user, toast]);

  // Public route — no login required.
  if (window.location.pathname === "/register") {
    return (
      <ErrorBoundary label="Registration page">
        <Suspense fallback={<LoadingFallback />}>
          <RegistrationPage />
        </Suspense>
      </ErrorBoundary>
    );
  }

  // 👈 New Public route for staff invitation links
  if (window.location.pathname.startsWith("/join/")) {
    return (
      <ErrorBoundary label="Staff invitation page">
        <Suspense fallback={<LoadingFallback />}>
          <StaffSignup />
        </Suspense>
      </ErrorBoundary>
    );
  }

  // 👈 3. Re-engineered to receive inputs from LoginPage
  const handleLogin = async (email, password) => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) { 
      toast("Login Error: " + err.message, "error"); 
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return <LoadingFallback />;
  }

  // 👈 4. Render your beautiful, dedicated LoginPage
  if (!user) {
    return (
      <>
        <ConnectivityBanner />
        <LoginPage onLogin={handleLogin} loading={loading} />
      </>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen flex flex-col justify-between">
      <ConnectivityBanner />
      <div>
        {/* Desktop Top Navigation Bar (md and above - 100% untouched) */}
        <div className="hidden md:block bg-white p-3.5 sm:p-4 md:px-6 shadow-xs border-b border-slate-200/80">
          <div className="flex justify-between items-center w-full mx-auto gap-4">
            {/* Top Left: School Branding */}
            <div className="flex items-center gap-2.5 shrink-0">
              <img
                src={schoolLogo}
                alt="My Liberty Logo"
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl object-contain bg-slate-50 border border-slate-200/80 p-1 shadow-xs"
              />
              <div className="flex flex-col">
                <span className="font-black text-[#1a3a8f] text-sm sm:text-base leading-none tracking-tight">
                  MY LIBERTY
                </span>
                <span className="text-[10px] sm:text-[11px] font-bold text-[#1a3a8f]/80 leading-tight mt-0.5">
                  Fresh, Fun and Elegant
                </span>
              </div>
            </div>

            {/* Top Right: User Profile Button & Sign Out */}
            <div className="flex items-center gap-3">
              <InstallButton variant="pill" showText={true} />
              <button onClick={() => setProfileOpen(true)} className="flex items-center gap-2.5 text-left group min-w-0">
                {photoURL ? (
                  <img src={photoURL} alt="Profile" className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover border group-hover:ring-2 ring-[#1a3a8f] shrink-0" />
                ) : (
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#1a3a8f] text-white flex items-center justify-center font-bold text-xs sm:text-sm group-hover:ring-2 ring-offset-1 ring-[#1a3a8f] shrink-0">
                    {getInitials(nickname || displayName)}
                  </div>
                )}
                <div className="hidden sm:block min-w-0">
                  <h3 className="font-bold text-gray-800 text-xs sm:text-sm truncate max-w-[140px] md:max-w-[200px]">{nickname || displayName || user.email}</h3>
                  <span className="text-[9px] bg-indigo-100 text-indigo-800 font-bold px-1.5 py-0.5 rounded uppercase">{role}</span>
                </div>
              </button>
              <div className="h-6 w-px bg-slate-200 hidden sm:block" />
              <button onClick={() => signOut(auth).then(() => setUser(null))} className="text-xs text-[#1a3a8f] hover:underline font-bold shrink-0">Logout</button>
            </div>
          </div>
        </div>

        {/* Mobile Unified Top App Bar (< md) with safe-area support */}
        <div className="md:hidden bg-white/95 backdrop-blur-md px-3.5 py-2.5 border-b border-slate-200/80 pt-safe sticky top-0 z-30 shadow-2xs">
          <div className="flex justify-between items-center w-full gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <img
                src={schoolLogo}
                alt="My Liberty Logo"
                className="w-7 h-7 rounded-lg object-contain bg-slate-50 border border-slate-200/80 p-0.5 shadow-2xs shrink-0"
              />
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-black text-[#1a3a8f] text-xs tracking-tight truncate">
                  MY LIBERTY
                </span>
                <span className="text-[9px] bg-indigo-50 text-indigo-800 font-extrabold px-1.5 py-0.5 rounded-full border border-indigo-100 uppercase shrink-0">
                  {role}
                </span>
              </div>
            </div>

            {/* Mobile Right: Avatar Button opening ProfilePanel */}
            <button
              onClick={() => setProfileOpen(true)}
              className="flex items-center gap-1.5 text-left active:scale-95 transition shrink-0 p-0.5 cursor-pointer"
              aria-label="Open user profile"
            >
              {photoURL ? (
                <img src={photoURL} alt="Profile" className="w-7 h-7 rounded-full object-cover border border-slate-200" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-[#1a3a8f] text-white flex items-center justify-center font-extrabold text-[10px] shadow-2xs">
                  {getInitials(nickname || displayName)}
                </div>
              )}
            </button>
          </div>
        </div>

        <div className="p-3 sm:p-4 md:p-6 w-full">
          {/* Dynamic Role Router Switcher — each branch is its own chunk,
              only the matching one is ever fetched for a given user */}
          <Suspense fallback={<LoadingFallback />}>
            {role === "admin" && (
              <ErrorBoundary label="Admin dashboard"><AdminDashboard /></ErrorBoundary>
            )}
            {role === "manager" && (
              <ErrorBoundary label="Manager dashboard"><ManagerDashboard /></ErrorBoundary>
            )}
            {role === "instructor" && (
              <ErrorBoundary label="Instructor dashboard"><InstructorDashboard /></ErrorBoundary>
            )}
            {role === "frontoffice" && (
              <ErrorBoundary label="Front Office dashboard"><FrontOfficeDashboard /></ErrorBoundary>
            )}
            {role === "marketing" && (
              <ErrorBoundary label="Marketing dashboard"><MarketingDashboard /></ErrorBoundary>
            )}
            {role === "officeboy" && (
              <ErrorBoundary label="Office Boy dashboard"><OfficeBoyDashboard /></ErrorBoundary>
            )}
            {!["admin", "manager", "instructor", "marketing", "frontoffice", "officeboy"].includes(role) && (
              <div className="bg-white p-6 rounded-xl border text-center text-gray-500 text-sm max-w-md mx-auto">
                This account doesn't have dashboard access. Please contact your administrator.
              </div>
            )}
          </Suspense>
        </div>
      </div>

      {/* Global Application Footer (Desktop only) */}
      <footer className="hidden md:block mt-auto border-t border-slate-200/80 bg-white/80 py-4 px-4 sm:px-6">
        <div className="w-full mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-slate-500 text-xs">
          <div className="flex flex-col gap-0.5 text-left">
            <span>&copy; {new Date().getFullYear()} MY LIBERTY International English School</span>
            <a
              href="https://github.com/aymira-git/mylibertyportal-public"
              target="_blank"
              rel="noreferrer"
              className="text-[10px] text-slate-400 hover:text-[#1a3a8f] underline font-mono transition"
            >
              https://github.com/aymira-git/mylibertyportal-public
            </a>
          </div>
          <div className="flex items-center gap-3">
            <InstallButton variant="subtle" showText={true} />
            <div className="text-[11px] font-semibold text-slate-400">
              Internal Academic & Operations Portal
            </div>
          </div>
        </div>
      </footer>

      {profileOpen && (
        <ErrorBoundary label="Profile panel">
          <ProfilePanel
            onClose={() => setProfileOpen(false)}
            onUpdated={() => refreshProfile(user.uid)}
            onLogout={() => signOut(auth).then(() => setUser(null))}
          />
        </ErrorBoundary>
      )}

      {/* 👈 Idle Warning Overlay */}
      {idleWarning && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0c235f]/80 backdrop-blur-md p-6">
          <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-sm w-full text-center border-2 border-amber-400 animate-pulse">
            <p className="text-4xl mb-4">💤</p>
            <h2 className="text-xl font-black text-slate-800">Are you still there?</h2>
            <p className="text-slate-500 text-sm mt-2 mb-6 font-medium">You've been idle for a while. For security, you will be logged out in 30 seconds.</p>
            <button 
              onClick={() => { setIdleWarning(false); window.dispatchEvent(new Event("mousedown")); }} 
              className="w-full bg-[#1a3a8f] text-white p-3.5 rounded-xl font-bold hover:bg-[#122b6e] transition shadow-lg"
            >
              Yes, I'm still working!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
