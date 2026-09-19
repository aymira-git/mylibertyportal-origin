// Split out of ToastProvider.jsx so that file can export only the
// component (react-refresh/fast-refresh requires component files to export
// nothing else — the context and hook live here instead).
import { createContext, useContext } from "react";

export const ToastContext = createContext(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
