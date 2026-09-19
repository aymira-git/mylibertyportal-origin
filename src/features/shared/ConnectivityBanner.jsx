import { WifiOff, Wifi } from "lucide-react";
import { useNetworkStatus } from "./useNetworkStatus";

export default function ConnectivityBanner() {
  const { isOnline, showReconnected } = useNetworkStatus();

  if (isOnline && !showReconnected) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`w-full py-2 px-4 text-xs font-semibold flex items-center justify-center gap-2 transition-all duration-300 z-50 shadow-xs ${
        !isOnline
          ? "bg-amber-600 text-white"
          : "bg-emerald-600 text-white animate-fade-in"
      }`}
    >
      {!isOnline ? (
        <>
          <WifiOff className="w-4 h-4 shrink-0 animate-pulse" />
          <span className="text-center">
            <strong>Offline Mode</strong> — Live database updates and payment processing are paused to prevent discrepancies.
          </span>
        </>
      ) : (
        <>
          <Wifi className="w-4 h-4 shrink-0 text-emerald-200" />
          <span>Back online — Connection to MY LIBERTY database restored.</span>
        </>
      )}
    </div>
  );
}
