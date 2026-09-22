import { useState, useEffect, useCallback } from "react";
import { useToast, useConfirm } from "../shared";
import {
  DEFAULT_RETENTION_DAYS,
  fetchStaleErrorLogsCount,
  purgeStaleErrorLogs,
} from "./logRetentionRepository";
import { Database, Trash2, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";

export default function LogRetentionCard() {
  const toast = useToast();
  const confirm = useConfirm();

  const [staleCount, setStaleCount] = useState(null);
  const [checking, setChecking] = useState(true);
  const [purging, setPurging] = useState(false);
  const [error, setError] = useState("");

  const refreshLogs = useCallback(async () => {
    setChecking(true);
    setError("");
    try {
      const count = await fetchStaleErrorLogsCount(DEFAULT_RETENTION_DAYS);
      setStaleCount(count);
    } catch (err) {
      console.error("Failed to check stale logs:", err);
      setError(err instanceof Error ? err.message : "Failed to query error logs");
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchStaleErrorLogsCount(DEFAULT_RETENTION_DAYS)
      .then((count) => {
        if (!cancelled) {
          setStaleCount(count);
          setChecking(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Failed to check stale logs:", err);
          setError(err instanceof Error ? err.message : "Failed to query error logs");
          setChecking(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handlePurge = async () => {
    if (staleCount === null || staleCount === 0) return;

    const ok = await confirm(
      `Permanently delete ${staleCount} error log${staleCount > 1 ? "s" : ""} older than ${DEFAULT_RETENTION_DAYS} days? This action cannot be undone.`
    );
    if (!ok) return;

    setPurging(true);
    setError("");
    try {
      const result = await purgeStaleErrorLogs(DEFAULT_RETENTION_DAYS);
      toast(`Successfully purged ${result.deleted} old error log(s).`, "success");
      await refreshLogs();
    } catch (err) {
      console.error("Purge failed:", err);
      const msg = err instanceof Error ? err.message : "Failed to purge logs";
      setError(msg);
      toast(`Purge failed: ${msg}`, "error");
    } finally {
      setPurging(false);
    }
  };

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[#1a3a8f]">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-slate-800 text-sm">Storage Maintenance & Log Retention</h4>
            <p className="text-xs text-slate-400 font-medium">
              Spark free plan quota protection · {DEFAULT_RETENTION_DAYS}-day error log window
            </p>
          </div>
        </div>

        <button
          onClick={refreshLogs}
          disabled={checking || purging}
          title="Re-scan logs"
          className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${checking ? "animate-spin text-[#1a3a8f]" : ""}`} />
        </button>
      </div>

      {error ? (
        <div className="flex items-center gap-2 text-rose-700 bg-rose-50 border border-rose-200 px-3 py-2 rounded-xl text-xs font-semibold">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 border border-slate-200/80 p-3.5 rounded-xl text-xs">
          <div className="space-y-0.5">
            <span className="text-slate-500 font-medium">Stale error logs (&gt; 38 days old):</span>
            <div className="font-black text-slate-800 text-sm flex items-center gap-2">
              {checking ? (
                <span className="text-slate-400 font-medium text-xs">Scanning collection...</span>
              ) : staleCount === 0 ? (
                <span className="text-emerald-600 flex items-center gap-1.5 text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4" /> 0 stale logs (Storage clean)
                </span>
              ) : (
                <span className="text-amber-700">{staleCount} document(s) eligible for cleanup</span>
              )}
            </div>
          </div>

          <button
            onClick={handlePurge}
            disabled={checking || purging || !staleCount || staleCount === 0}
            className="px-4 py-2 rounded-xl bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{purging ? "Purging..." : "Purge Stale Logs"}</span>
          </button>
        </div>
      )}
    </div>
  );
}
