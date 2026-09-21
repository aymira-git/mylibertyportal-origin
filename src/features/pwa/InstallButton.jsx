import { Download } from "lucide-react";
import { usePwaInstall } from "./usePwaInstall";
import IosInstallModal from "./IosInstallModal";

export default function InstallButton({
  className = "",
  variant = "pill", // "pill" | "icon" | "full" | "subtle"
  showText = true,
}) {
  const { canInstall, isInstalled, showIOSGuide, setShowIOSGuide, promptInstall } = usePwaInstall();

  if (isInstalled || !canInstall) {
    return null;
  }

  const baseStyles = {
    pill: "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-gradient-to-r from-[#1a3a8f] to-indigo-700 text-white shadow-xs hover:shadow-md hover:from-indigo-800 hover:to-indigo-900 transition-all active:scale-95 cursor-pointer",
    icon: "p-2 rounded-xl text-slate-600 hover:text-[#1a3a8f] hover:bg-indigo-50 border border-slate-200/80 transition-all cursor-pointer",
    full: "w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#1a3a8f] hover:bg-indigo-900 text-white font-bold text-xs shadow-sm transition-all cursor-pointer",
    subtle:
      "inline-flex items-center gap-1.5 text-xs font-semibold text-[#1a3a8f] hover:text-indigo-900 hover:underline cursor-pointer",
  };

  return (
    <>
      <button
        onClick={promptInstall}
        className={`${baseStyles[variant] || baseStyles.pill} ${className}`}
        title="Install MY LIBERTY Portal on your device"
        aria-label="Install App"
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        {showText && <span>Install App</span>}
      </button>

      <IosInstallModal isOpen={showIOSGuide} onClose={() => setShowIOSGuide(false)} />
    </>
  );
}
