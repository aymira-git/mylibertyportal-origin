// Split out of ConfirmProvider.jsx so that file can export only the
// component (react-refresh/fast-refresh requires component files to export
// nothing else — the context and hook live here instead).
import { createContext, useContext } from "react";

export const ConfirmContext = createContext(null);

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return ctx;
}
