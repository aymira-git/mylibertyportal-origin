import { Camera, ScanLine, Sparkles } from "lucide-react";

export default function KioskCameraView({
  kioskScanning,
  onOpenScanner,
  onCloseScanner,
}) {
  return (
    <>
      {!kioskScanning ? (
        <div className="space-y-4">
          <div className="p-8 sm:p-10 rounded-3xl border-2 border-dashed border-indigo-200 bg-slate-50/70 flex flex-col items-center justify-center space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-indigo-100/60 text-[#1a3a8f] flex items-center justify-center shadow-xs">
              <Camera className="w-8 h-8" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">Ready to Scan Credentials</p>
              <p className="text-xs text-slate-500 max-w-xs mt-1 leading-normal">
                Tap below to open the camera, then hold your student or staff QR code in front of
                the lens.
              </p>
            </div>
          </div>

          <button
            onClick={onOpenScanner}
            className="w-full min-h-[52px] bg-[#1a3a8f] hover:bg-[#122b6e] text-white py-3.5 px-6 rounded-2xl font-bold text-sm transition duration-150 shadow-md shadow-indigo-950/15 flex items-center justify-center gap-2 group cursor-pointer"
          >
            <ScanLine className="w-4 h-4 group-hover:scale-110 transition-transform" />
            <span>Open Scanner Camera</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Viewport Frame */}
          <div className="rounded-3xl border-2 border-indigo-600/30 bg-slate-950 p-3 shadow-inner relative overflow-hidden">
            <div id="kiosk-reader" className="w-full overflow-hidden rounded-2xl bg-black" />
          </div>

          <p className="text-xs font-semibold text-slate-600 flex items-center justify-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Center your QR code inside the green border for instant recognition</span>
          </p>

          <button
            onClick={onCloseScanner}
            className="w-full py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
          >
            Close Camera Viewport
          </button>
        </div>
      )}
    </>
  );
}
