import { useState, useRef } from "react";
import { useToast } from "../shared";
import { uploadToCloudinary } from "../shared/cloudinaryUpload";
import { MessageCircle, RotateCcw, Download, Image as ImageIcon, Loader2 } from "lucide-react";

export default function ClassPhotoShare() {
  const toast = useToast();
  const [photo, setPhoto] = useState(null); // { file, previewUrl }
  const [cloudUrl, setCloudUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [targetPhone, setTargetPhone] = useState("");
  const fileInputRef = useRef(null);

  const handleCapture = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setPhoto({ file, previewUrl });
    setCloudUrl(null);
    setUploading(true);

    // Asynchronously upload to Cloudinary so we can include a photo link in WhatsApp
    uploadToCloudinary(file)
      .then((url) => {
        setCloudUrl(url);
        setUploading(false);
      })
      .catch((err) => {
        console.warn("Cloudinary upload failed, sharing without hosted URL:", err);
        setUploading(false);
      });
  };

  const handleRedirectWhatsApp = async () => {
    if (!photo) return;

    // On mobile devices with native file share support, allow direct WhatsApp image sharing
    if (navigator.canShare && navigator.canShare({ files: [photo.file] })) {
      try {
        await navigator.share({
          files: [photo.file],
          title: "My Liberty Class Photo",
          text: "Today's learning moments at MY LIBERTY International English School! 🌟",
        });
        return;
      } catch (err) {
        if (err.name === "AbortError") return;
      }
    }

    // Direct WhatsApp redirect
    const cleanPhone = targetPhone.replace(/[^0-9]/g, "");
    let text = "Today's learning moments at MY LIBERTY International English School! 🌟";
    if (cloudUrl) {
      text += `\n\n📸 Class Photo: ${cloudUrl}`;
    }

    const encodedText = encodeURIComponent(text);
    const waUrl = cleanPhone
      ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`
      : `https://api.whatsapp.com/send?text=${encodedText}`;

    window.open(waUrl, "_blank");
    toast("Redirecting to WhatsApp...", "success");
  };

  const handleReset = () => {
    setPhoto(null);
    setCloudUrl(null);
    setUploading(false);
    setTargetPhone("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm max-w-md mx-auto text-center space-y-4">
      <div className="flex items-center justify-center gap-2 text-indigo-900">
        <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-[#25D366]">
          <MessageCircle className="w-5 h-5" />
        </div>
        <div className="text-left">
          <h3 className="font-extrabold text-slate-900 text-sm">Classroom Moment</h3>
          <p className="text-[11px] text-slate-500 font-medium">
            Capture & redirect photo to WhatsApp
          </p>
        </div>
      </div>

      {!photo ? (
        <div className="space-y-3">
          <label className="border-2 border-dashed border-emerald-200 hover:border-[#25D366] bg-slate-50/60 hover:bg-emerald-50/30 p-6 rounded-2xl flex flex-col items-center justify-center cursor-pointer transition group">
            <ImageIcon className="w-8 h-8 text-emerald-500 group-hover:scale-110 transition-transform mb-2" />
            <p className="text-xs font-extrabold text-slate-800">Snap Classroom Activity</p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Camera access or device gallery upload
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleCapture}
              className="hidden"
            />
          </label>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-inner">
            <img
              src={photo.previewUrl}
              alt="Class activity"
              className="w-full max-h-64 object-cover"
            />
            {uploading && (
              <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Preparing photo link...</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <input
              type="tel"
              placeholder="WhatsApp Number (optional, e.g. 628123456789)"
              value={targetPhone}
              onChange={(e) => setTargetPhone(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 text-center"
            />

            <button
              onClick={handleRedirectWhatsApp}
              className="w-full bg-[#25D366] hover:bg-[#20ba59] text-white py-3.5 px-4 rounded-xl font-extrabold text-xs shadow-md transition flex items-center justify-center gap-2"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Redirect to WhatsApp</span>
            </button>

            <div className="flex items-center justify-between gap-2 pt-1 text-xs">
              <a
                href={photo.previewUrl}
                download="my-liberty-class-photo.jpg"
                className="text-[11px] text-slate-400 hover:text-slate-600 flex items-center gap-1 font-medium transition"
              >
                <Download className="w-3 h-3" />
                <span>Save copy</span>
              </a>

              <button
                onClick={handleReset}
                className="text-[11px] text-rose-500 hover:text-rose-700 flex items-center gap-1 font-medium transition"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Retake</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
