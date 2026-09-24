import { useState, useEffect, useCallback } from "react";
import {
  runBranchHealthAudit,
  migrateLegacyBranchBatch,
  migrateAllLegacyCollections,
} from "./branchAuditRepository";
import {
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Wrench,
  Check,
} from "lucide-react";

export default function BranchHealthAuditCard() {
  const [loading, setLoading] = useState(true);
  const [auditData, setAuditData] = useState(null);
  const [error, setError] = useState("");
  const [migrating, setMigrating] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState(null);

  const executeAudit = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await runBranchHealthAudit(100);
      setAuditData(data);
    } catch (err) {
      console.error("Failed to run branch health audit:", err);
      setError(err instanceof Error ? err.message : "Failed to audit branch health");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleMigrateAll = async () => {
    setMigrating(true);
    setMigrationStatus(null);
    setError("");
    try {
      const res = await migrateAllLegacyCollections(50);
      setMigrationStatus(
        `Batch backfill complete: ${res.totalMigrated} legacy document(s) updated across collections.`
      );
      await executeAudit();
    } catch (err) {
      console.error("Migration error:", err);
      setError(err instanceof Error ? err.message : "Migration failed");
    } finally {
      setMigrating(false);
    }
  };

  const handleMigrateCollection = async (collectionId) => {
    setMigrating(true);
    setMigrationStatus(null);
    setError("");
    try {
      const res = await migrateLegacyBranchBatch(collectionId, 50);
      setMigrationStatus(
        `Backfilled ${res.migrated} document(s) in '${collectionId}' (${res.skipped} already canonical).`
      );
      await executeAudit();
    } catch (err) {
      console.error("Collection migration error:", err);
      setError(err instanceof Error ? err.message : `Failed to migrate ${collectionId}`);
    } finally {
      setMigrating(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    runBranchHealthAudit(100)
      .then((data) => {
        if (!cancelled) {
          setAuditData(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Failed to run branch health audit:", err);
          setError(err instanceof Error ? err.message : "Failed to audit branch health");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-slate-800 text-sm">Branch Data Isolation & Health Audit</h4>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 uppercase tracking-wider">
                Phase 2 Active Migration
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Inspect and backfill canonical branchId slugs across legacy records
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={executeAudit}
            disabled={loading || migrating}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-emerald-600" : ""}`} />
            <span>{loading ? "Inspecting..." : "Re-scan"}</span>
          </button>
          <button
            onClick={handleMigrateAll}
            disabled={loading || migrating}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
          >
            <Wrench className={`w-3.5 h-3.5 ${migrating ? "animate-spin" : ""}`} />
            <span>{migrating ? "Backfilling..." : "Backfill All (Batch)"}</span>
          </button>
        </div>
      </div>

      {migrationStatus && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{migrationStatus}</span>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {auditData && (
        <div className="space-y-4">
          {/* Top Score Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Readiness Score
              </span>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-xl font-black text-slate-800">
                  {auditData.overallReadiness}%
                </span>
                <span className="text-[11px] font-semibold text-emerald-600">partitioned</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-100">
              <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider block">
                Canonical (branchId)
              </span>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-xl font-black text-emerald-800">
                  {auditData.totalCanonical}
                </span>
                <span className="text-[11px] text-emerald-600 font-medium">docs</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-100">
              <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider block">
                Legacy (string branch)
              </span>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-xl font-black text-amber-800">
                  {auditData.totalLegacy}
                </span>
                <span className="text-[11px] text-amber-600 font-medium">backward-compatible</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Unassigned / Missing
              </span>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-xl font-black text-slate-700">
                  {auditData.totalMissing}
                </span>
                <span className="text-[11px] text-slate-400 font-medium">unscoped</span>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-semibold text-slate-600">
              <span>Overall Multi-Branch Isolation Status</span>
              <span>
                {auditData.totalCanonical} of {auditData.totalScanned} documents canonicalized
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex">
              <div
                className="bg-emerald-500 h-full transition-all duration-500"
                style={{
                  width: `${(auditData.totalCanonical / (auditData.totalScanned || 1)) * 100}%`,
                }}
                title="Canonical branchId"
              />
              <div
                className="bg-amber-400 h-full transition-all duration-500"
                style={{
                  width: `${(auditData.totalLegacy / (auditData.totalScanned || 1)) * 100}%`,
                }}
                title="Legacy branch name"
              />
              <div
                className="bg-slate-300 h-full transition-all duration-500"
                style={{
                  width: `${(auditData.totalMissing / (auditData.totalScanned || 1)) * 100}%`,
                }}
                title="Missing branch"
              />
            </div>
          </div>

          {/* Breakdown Table */}
          <div className="overflow-x-auto border border-slate-200/80 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Collection</th>
                  <th className="py-2.5 px-3 text-center">Sample Scanned</th>
                  <th className="py-2.5 px-3 text-center">Canonical (branchId)</th>
                  <th className="py-2.5 px-3 text-center">Legacy (branch)</th>
                  <th className="py-2.5 px-3 text-center">Missing</th>
                  <th className="py-2.5 px-3 text-right">Readiness</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {auditData.collections.map((col) => (
                  <tr key={col.collectionId} className="hover:bg-slate-50/50 transition">
                    <td className="py-2.5 px-3 font-semibold text-slate-800 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-slate-400" />
                      <span>{col.label}</span>
                    </td>
                    <td className="py-2.5 px-3 text-center font-medium text-slate-600">
                      {col.total}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                        {col.canonical}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-100">
                        {col.legacy}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                        {col.missing}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold">
                      <span
                        className={
                          col.readinessPercent >= 80
                            ? "text-emerald-600"
                            : col.readinessPercent >= 50
                              ? "text-amber-600"
                              : "text-rose-600"
                        }
                      >
                        {col.readinessPercent}%
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {col.legacy > 0 || col.missing > 0 ? (
                        <button
                          onClick={() => handleMigrateCollection(col.collectionId)}
                          disabled={loading || migrating}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition cursor-pointer disabled:opacity-50"
                        >
                          <Wrench className="w-3 h-3" />
                          <span>Backfill</span>
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                          <Check className="w-3 h-3" />
                          <span>Aligned</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/80 text-[11px] text-slate-500 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-700 font-semibold">Dry-Run Inspection Only:</strong> No database writes or mutations occur during this audit scan. Our security rules currently resolve legacy names seamlessly via{" "}
              <code className="bg-slate-200/60 px-1 py-0.2 rounded font-mono text-slate-800">isSameBranch()</code>, ensuring zero disruption while new records are cleanly indexed with canonical slugs.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
