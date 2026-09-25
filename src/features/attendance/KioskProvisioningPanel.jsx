import { useState, useEffect } from "react";
import {
  ShieldCheck,
  Smartphone,
  CheckCircle,
  AlertTriangle,
  RotateCw,
  Trash2,
  Cpu,
  Key,
} from "lucide-react";
import {
  getOrCreateKioskKey,
  signKioskChallenge,
  clearKioskKey,
} from "./kioskDeviceCrypto";
import { auth, db } from "../../firebase";
import { doc, getDoc } from "firebase/firestore";
import { useToast } from "../shared";

const BRANCHES = [
  { id: "kota_gorontalo", name: "Cabang Utama / Kota Gorontalo" },
  { id: "bone_bolango", name: "Cabang Bone Bolango" },
  { id: "pohuwato", name: "Cabang Pohuwato" },
  { id: "limboto", name: "Cabang Limboto" },
];

export function KioskProvisioningPanel({ onClose }) {
  const toast = useToast();
  const [deviceInfo, setDeviceInfo] = useState(null);
  const [remoteRecord, setRemoteRecord] = useState(null);
  const [branchId, setBranchId] = useState("kota_gorontalo");
  const [label, setLabel] = useState("Reception Tablet A");
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const workerBase = import.meta.env.VITE_AI_WORKER_URL || "";

  const refreshStatus = async () => {
    try {
      setActionInProgress(true);
      const keyInfo = await getOrCreateKioskKey();
      setDeviceInfo(keyInfo);

      if (keyInfo?.deviceId) {
        const snap = await getDoc(doc(db, "kioskDevices", keyInfo.deviceId));
        if (snap.exists()) {
          setRemoteRecord(snap.data());
          if (snap.data().branchId) setBranchId(snap.data().branchId);
          if (snap.data().label) setLabel(snap.data().label);
        } else {
          setRemoteRecord(null);
        }
      }
    } catch (err) {
      console.error("Failed to load kiosk device info:", err);
      toast("Error inspecting kiosk keystore: " + err.message, "error");
    } finally {
      setActionInProgress(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    getOrCreateKioskKey()
      .then(async (keyInfo) => {
        if (!isMounted) return;
        setDeviceInfo(keyInfo);
        if (keyInfo?.deviceId) {
          const snap = await getDoc(doc(db, "kioskDevices", keyInfo.deviceId));
          if (isMounted) {
            if (snap.exists()) {
              setRemoteRecord(snap.data());
              if (snap.data().branchId) setBranchId(snap.data().branchId);
              if (snap.data().label) setLabel(snap.data().label);
            } else {
              setRemoteRecord(null);
            }
          }
        }
        if (isMounted) setLoading(false);
      })
      .catch((err) => {
        if (isMounted) {
          setLoading(false);
          console.error("Failed to load kiosk device info:", err);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleProvision = async () => {
    if (!deviceInfo?.deviceId || !deviceInfo?.publicKeyJwk) {
      toast("No cryptographic identity found to provision.", "error");
      return;
    }

    try {
      setActionInProgress(true);
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error("You must be signed in as an administrator to provision devices.");
      }
      const idToken = await currentUser.getIdToken();

      if (!workerBase) {
        throw new Error(
          "Cloudflare Worker URL is not configured. Please set VITE_AI_WORKER_URL in your environment."
        );
      }

      const res = await fetch(`${workerBase}/api/v1/kiosk/provision`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          deviceId: deviceInfo.deviceId,
          branchId,
          label,
          publicKeyJwk: deviceInfo.publicKeyJwk,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Provisioning request failed.");
      }

      toast("Kiosk terminal provisioned successfully!", "success");
      await refreshStatus();
    } catch (err) {
      toast("Provisioning failed: " + err.message, "error");
    } finally {
      setActionInProgress(false);
    }
  };

  const handleRevoke = async () => {
    if (!deviceInfo?.deviceId) return;
    try {
      setActionInProgress(true);
      const currentUser = auth.currentUser;
      const idToken = currentUser ? await currentUser.getIdToken() : "";

      if (workerBase && idToken) {
        await fetch(`${workerBase}/api/v1/kiosk/revoke`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            deviceId: deviceInfo.deviceId,
            reason: "Administrator revoked from terminal panel",
          }),
        });
      }

      await clearKioskKey();
      toast("Terminal identity cleared and revoked.", "info");
      await refreshStatus();
    } catch (err) {
      toast("Revocation failed: " + err.message, "error");
    } finally {
      setActionInProgress(false);
    }
  };

  const handleRunDiagnostic = async () => {
    try {
      setTestResult(null);
      setActionInProgress(true);
      const start = Date.now();

      if (!workerBase) {
        throw new Error("VITE_AI_WORKER_URL not configured.");
      }

      // Step 1: Challenge
      const chalRes = await fetch(`${workerBase}/api/v1/kiosk/challenge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: deviceInfo.deviceId }),
      });
      const chalData = await chalRes.json();
      if (!chalRes.ok) throw new Error(chalData?.error || "Challenge failed");

      // Step 2: Signature
      const sig = await signKioskChallenge(deviceInfo.deviceId, chalData.nonce, "test-diagnostic");

      const elapsed = Date.now() - start;
      setTestResult({
        success: true,
        nonce: chalData.nonce,
        signatureSnippet: sig.slice(0, 16) + "...",
        latencyMs: elapsed,
      });
      toast(`Diagnostic passed in ${elapsed}ms!`, "success");
    } catch (err) {
      setTestResult({ success: false, error: err.message });
      toast("Diagnostic failed: " + err.message, "error");
    } finally {
      setActionInProgress(false);
    }
  };

  const isProvisioned = remoteRecord && remoteRecord.status === "active";

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden max-w-2xl w-full mx-auto my-4 text-slate-800">
      <div className="bg-slate-900 text-white p-6 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-600/30 rounded-xl border border-blue-400/30">
            <Cpu className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h3 className="font-bold text-lg">Kiosk Cryptographic Terminal</h3>
            <p className="text-xs text-slate-400">
              Web Crypto P-256 Non-Exportable Device Identity
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg text-sm"
          >
            ✕
          </button>
        )}
      </div>

      <div className="p-6 space-y-6">
        {loading ? (
          <div className="py-8 text-center text-slate-500 flex items-center justify-center gap-2">
            <RotateCw className="w-5 h-5 animate-spin" />
            <span>Inspecting local keystore...</span>
          </div>
        ) : (
          <>
            {/* Status card */}
            <div
              className={`p-4 rounded-xl border flex items-start gap-4 ${
                isProvisioned
                  ? "bg-emerald-50 border-emerald-200"
                  : "bg-amber-50 border-amber-200"
              }`}
            >
              {isProvisioned ? (
                <CheckCircle className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
              )}
              <div className="text-sm space-y-1">
                <div className="font-semibold text-slate-900">
                  {isProvisioned
                    ? "Terminal Provisioned & Active"
                    : "Terminal Unregistered / Pending Provisioning"}
                </div>
                <div className="text-xs text-slate-600">
                  {isProvisioned
                    ? `Authorized for ${remoteRecord.branchId} as "${remoteRecord.label}". Hardware signatures verified on clock-in.`
                    : "This tablet has a local private key generated, but it has not been registered in Firestore by an administrator."}
                </div>
              </div>
            </div>

            {/* Hardware Identity Info */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 text-xs">
              <div className="flex items-center justify-between font-mono">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-slate-400" /> Device ID:
                </span>
                <span className="font-bold text-slate-800">{deviceInfo?.deviceId}</span>
              </div>
              <div className="flex items-center justify-between font-mono">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-slate-400" /> Curve / Algorithm:
                </span>
                <span className="text-slate-700">ECDSA P-256 (SHA-256)</span>
              </div>
              <div className="flex items-center justify-between font-mono">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-slate-400" /> Key Exportability:
                </span>
                <span className="text-emerald-700 font-semibold">
                  extractable: false (Hardware Isolated)
                </span>
              </div>
            </div>

            {/* Provisioning controls */}
            <div className="space-y-4 pt-2">
              <h4 className="text-sm font-semibold text-slate-900">Terminal Configuration</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Terminal Label / Location
                  </label>
                  <input
                    type="text"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. Reception Desk Kiosk"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Branch Assignment
                  </label>
                  <select
                    value={branchId}
                    onChange={(e) => setBranchId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {BRANCHES.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Diagnostic Box if run */}
            {testResult && (
              <div
                className={`p-3 rounded-xl border text-xs font-mono space-y-1 ${
                  testResult.success
                    ? "bg-slate-900 text-emerald-400 border-slate-800"
                    : "bg-rose-50 text-rose-700 border-rose-200"
                }`}
              >
                {testResult.success ? (
                  <>
                    <div>✓ Challenge Acquired: {testResult.nonce.slice(0, 16)}...</div>
                    <div>✓ P-256 Signature Generated: {testResult.signatureSnippet}</div>
                    <div className="text-slate-400">Latency: {testResult.latencyMs}ms</div>
                  </>
                ) : (
                  <div>✗ Diagnostic Failed: {testResult.error}</div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200">
              <div className="flex gap-2">
                <button
                  onClick={handleProvision}
                  disabled={actionInProgress}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50 flex items-center gap-2"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{isProvisioned ? "Re-Authorize Terminal" : "Authorize Terminal"}</span>
                </button>
                <button
                  onClick={handleRunDiagnostic}
                  disabled={actionInProgress || !isProvisioned}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Test Signature</span>
                </button>
              </div>

              {isProvisioned && (
                <button
                  onClick={handleRevoke}
                  disabled={actionInProgress}
                  className="px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-lg text-sm font-medium transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Revoke Identity</span>
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
