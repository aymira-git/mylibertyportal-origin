import StudentPhotoCapture from "./StudentPhotoCapture";

export default function StudentPersonalFields({ formData, field }) {
  return (
    <div className="space-y-3">
      <h4 className="text-xs font-black uppercase tracking-wider text-[#1a3a8f] flex items-center gap-1.5">
        <span>👤</span> Personal Information
      </h4>

      {/* Student Headshot Photo Capture / Upload */}
      <StudentPhotoCapture
        photoURL={formData.photoURL}
        onPhotoChange={(url) => field("photoURL", url)}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="md:col-span-2">
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
            Full Name (Nama Lengkap)
          </label>
          <input
            type="text"
            placeholder="Full Name"
            value={formData.displayName || ""}
            onChange={(e) => field("displayName", e.target.value)}
            className="w-full p-2.5 border rounded-xl font-semibold"
            required
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
            Nickname (Nama Panggilan)
          </label>
          <input
            type="text"
            placeholder="e.g. Alex"
            value={formData.nickname || ""}
            onChange={(e) => field("nickname", e.target.value)}
            className="w-full p-2.5 border rounded-xl"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
            Gender (Jenis Kelamin)
          </label>
          <select
            value={formData.gender || "male"}
            onChange={(e) => field("gender", e.target.value)}
            className="w-full p-2.5 border rounded-xl bg-white font-medium"
          >
            <option value="male">Laki-laki (Male)</option>
            <option value="female">Perempuan (Female)</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
            Place of Birth (Tempat Lahir)
          </label>
          <input
            type="text"
            placeholder="e.g. Jakarta"
            value={formData.placeOfBirth || ""}
            onChange={(e) => field("placeOfBirth", e.target.value)}
            className="w-full p-2.5 border rounded-xl"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
            Date of Birth (Tanggal Lahir)
          </label>
          <input
            type="date"
            value={formData.dob || ""}
            onChange={(e) => field("dob", e.target.value)}
            className="w-full p-2.5 border rounded-xl bg-white"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
            Religion (Agama)
          </label>
          <input
            type="text"
            placeholder="e.g. Islam / Kristen / Hindu / Buddha"
            value={formData.religion || ""}
            onChange={(e) => field("religion", e.target.value)}
            className="w-full p-2.5 border rounded-xl"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
            Phone / WhatsApp Pendaftar
          </label>
          <input
            type="tel"
            placeholder="0812..."
            value={formData.phone || ""}
            onChange={(e) => field("phone", e.target.value)}
            className="w-full p-2.5 border rounded-xl"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
            Full Address (Alamat Lengkap)
          </label>
          <textarea
            rows={2}
            placeholder="Street, District, City..."
            value={formData.address || ""}
            onChange={(e) => field("address", e.target.value)}
            className="w-full p-2.5 border rounded-xl"
          />
        </div>
      </div>
    </div>
  );
}
