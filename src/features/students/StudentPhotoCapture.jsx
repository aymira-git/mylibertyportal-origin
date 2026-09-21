import { useState, useRef, useEffect } from "react";
import { uploadToCloudinary } from "../shared";
import { Camera, Upload, Trash2, Loader2, Check } from "lucide-react";

export default function StudentPhotoCapture({ photoURL, onPhotoChange }) {
  const [uploading, setUploading] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  // Stop camera tracks cleanly
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraOpen(false);
    setCameraError("");
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const handleStartCamera = async () => {
    setCameraError("");
    setCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 640 }, facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error("Camera access error:", err);
      setCameraError("Camera access denied or unavailable. Please upload a photo instead.");
    }
  };

  const handleSnapPhoto = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 480;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    stopCamera();

    // Convert canvas to blob & upload
    canvas.toBlob(
      async (blob) => {
        if (!blob) return;
        setUploading(true);
        try {
          const file = new File([blob], `student-snap-${Date.now()}.jpg`, { type: "image/jpeg" });
          const url = await uploadToCloudinary(file);
          onPhotoChange(url);
        } catch (err) {
          console.error("Photo upload failed:", err);
          alert("Failed to upload photo: " + (err.message || "Unknown error"));
        } finally {
          setUploading(false);
        }
      },
      "image/jpeg",
      0.9
    );
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input value so re-selecting same file triggers onChange
    e.target.value = "";

    setUploading(true);
    try {
      const url = await uploadToCloudinary(file);
      onPhotoChange(url);
    } catch (err) {
      console.error("Photo upload failed:", err);
      alert("Failed to upload photo: " + (err.message || "Unknown error"));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            Student Photo (Foto Pelajar)
          </label>
          <p className="text-[11px] text-slate-400">
            For ID badges & kiosk recognition. Stored on CDN (zero Firestore weight).
          </p>
        </div>
        {photoURL && !uploading && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
            <Check className="w-3 h-3" />
            Photo Saved
          </span>
        )}
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4">
        {/* Preview box */}
        <div className="relative w-20 h-20 rounded-2xl overflow-hidden border-2 border-slate-200 bg-white flex items-center justify-center shrink-0 shadow-2xs">
          {uploading ? (
            <div className="flex flex-col items-center justify-center text-indigo-600 gap-1">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="text-[9px] font-bold uppercase tracking-wider">Uploading</span>
            </div>
          ) : photoURL ? (
            <img
              src={photoURL}
              alt="Student Preview"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="text-center p-2 text-slate-300">
              <Camera className="w-6 h-6 mx-auto mb-0.5 opacity-60" />
              <span className="text-[9px] font-bold uppercase tracking-wider block">No Photo</span>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex-1 w-full space-y-2">
          {!cameraOpen ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleStartCamera}
                disabled={uploading}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-[#1a3a8f] text-white hover:bg-[#122b6e] transition shadow-xs disabled:opacity-50"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Take Webcam Photo</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 transition shadow-2xs disabled:opacity-50"
              >
                <Upload className="w-3.5 h-3.5 text-slate-500" />
                <span>Upload Image</span>
              </button>

              {photoURL && (
                <button
                  type="button"
                  onClick={() => onPhotoChange("")}
                  disabled={uploading}
                  className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition"
                  title="Remove Photo"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove</span>
                </button>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          ) : (
            /* Live Camera Capture Panel */
            <div className="space-y-3 bg-slate-900 rounded-2xl p-3 text-white">
              {cameraError ? (
                <div className="text-xs text-rose-300 py-2">
                  <p>{cameraError}</p>
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="mt-2 text-xs font-bold text-white underline"
                  >
                    Close Camera
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative rounded-xl overflow-hidden bg-black aspect-square max-w-[200px] mx-auto">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 border-2 border-dashed border-white/40 rounded-xl pointer-events-none" />
                  </div>

                  <div className="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={handleSnapPhoto}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Snap & Upload</span>
                    </button>
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
