// Replaces the native window.alert() popup used everywhere for success/error
// messages ("Success! Class scheduled.", "Error: " + err.message, etc.) with
// a small toast that appears bottom-right and auto-dismisses.
//
// SETUP (do this once): wrap the app in main.jsx, inside ConfirmProvider —
//   <ConfirmProvider><ToastProvider><App /></ToastProvider></ConfirmProvider>
//
// USAGE (per call site, later — not done yet):
//   import { useToast } from "../../features/shared";
//   const toast = useToast();
//   ...
//   toast("Success! Class scheduled.");           // default = success styling
//   toast("Error: " + err.message, "error");       // error styling
import { useCallback, useEffect, useRef, useState } from "react";
import { ToastContext } from "./useToast";

let nextId = 1;

export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const activeTimers = useRef(new Set());

  useEffect(() => {
    const timers = activeTimers.current;
    return () => {
      timers.forEach((timerId) => clearTimeout(timerId));
      timers.clear();
    };
  }, []);

  const toast = useCallback((message, type = "success") => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, type }]);
    const timerId = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      activeTimers.current.delete(timerId);
    }, 4000);
    activeTimers.current.add(timerId);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}

      <div className="fixed bottom-20 md:bottom-4 right-4 left-4 sm:left-auto z-[9999] flex flex-col gap-2 max-w-xs w-auto sm:w-full pointer-events-none pb-safe">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`p-3.5 rounded-xl shadow-xl text-sm font-semibold text-white pointer-events-auto animate-in fade-in zoom-in-95 duration-150 ${
              t.type === "error" ? "bg-rose-600" : "bg-[#1a3a8f]"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
