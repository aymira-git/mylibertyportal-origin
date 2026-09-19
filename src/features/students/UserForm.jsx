/**
 * UserForm.jsx
 * Add / Edit user form for the students feature.
 * Handles both staff account creation/edits and comprehensive student profile edits
 * matching all Google Registration Form fields.
 */

import StudentPhotoCapture from "./StudentPhotoCapture";

export default function UserForm({ formData, setFormData, editId, onSubmit }) {
  const field = (key, value) => setFormData(prev => ({ ...prev, [key]: value }));
  const isStudent = formData.role === "student";

  return (
    <form
      onSubmit={onSubmit}
      className="bg-white p-6 rounded-2xl shadow-sm text-sm border border-slate-200 max-w-4xl mx-auto space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 gap-2">
        <div>
          <h3 className="font-bold text-slate-800 text-lg">
            {isStudent
              ? (editId ? "Edit Student Profile" : "Student Registration")
              : (editId ? "Edit Staff Profile" : "Automated Staff Account Creation")}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {isStudent
              ? "Update student registration and academic details."
              : "Create credentials and set permissions for staff."}
          </p>
        </div>

        {/* Role badge or picker */}
        <div>
          {editId || isStudent ? (
            <span className="px-3 py-1 bg-indigo-50 text-indigo-700 font-bold text-xs rounded-full uppercase">
              Role: {formData.role}
            </span>
          ) : (
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Role:</label>
              <select
                value={formData.role}
                onChange={e => field("role", e.target.value)}
                className="p-2 border rounded-xl bg-white font-bold text-xs"
              >
                <option value="instructor">Instructor</option>
                <option value="manager">Manager</option>
                <option value="marketing">Marketing Staff</option>
                <option value="frontoffice">Front Office</option>
                <option value="officeboy">Office Boy</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {isStudent ? (
        /* ══════════════════════════════════════════════════════════════════
           STUDENT PROFILE FORM (Matches Google Form Structure)
           ══════════════════════════════════════════════════════════════════ */
        <div className="space-y-6">
          {/* Section 1: Personal Information */}
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
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Full Name (Nama Lengkap)</label>
                <input
                  type="text"
                  placeholder="Full Name"
                  value={formData.displayName || ""}
                  onChange={e => field("displayName", e.target.value)}
                  className="w-full p-2.5 border rounded-xl font-semibold"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nickname (Nama Panggilan)</label>
                <input
                  type="text"
                  placeholder="e.g. Alex"
                  value={formData.nickname || ""}
                  onChange={e => field("nickname", e.target.value)}
                  className="w-full p-2.5 border rounded-xl"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Gender (Jenis Kelamin)</label>
                <select
                  value={formData.gender || "male"}
                  onChange={e => field("gender", e.target.value)}
                  className="w-full p-2.5 border rounded-xl bg-white font-medium"
                >
                  <option value="male">Laki-laki (Male)</option>
                  <option value="female">Perempuan (Female)</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Place of Birth (Tempat Lahir)</label>
                <input
                  type="text"
                  placeholder="e.g. Jakarta"
                  value={formData.placeOfBirth || ""}
                  onChange={e => field("placeOfBirth", e.target.value)}
                  className="w-full p-2.5 border rounded-xl"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Date of Birth (Tanggal Lahir)</label>
                <input
                  type="date"
                  value={formData.dob || ""}
                  onChange={e => field("dob", e.target.value)}
                  className="w-full p-2.5 border rounded-xl bg-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Religion (Agama)</label>
                <input
                  type="text"
                  placeholder="e.g. Islam / Kristen / Hindu / Buddha"
                  value={formData.religion || ""}
                  onChange={e => field("religion", e.target.value)}
                  className="w-full p-2.5 border rounded-xl"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Phone / WhatsApp Pendaftar</label>
                <input
                  type="tel"
                  placeholder="0812..."
                  value={formData.phone || ""}
                  onChange={e => field("phone", e.target.value)}
                  className="w-full p-2.5 border rounded-xl"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Full Address (Alamat Lengkap)</label>
                <textarea
                  rows={2}
                  placeholder="Street, District, City..."
                  value={formData.address || ""}
                  onChange={e => field("address", e.target.value)}
                  className="w-full p-2.5 border rounded-xl"
                />
              </div>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Section 2: Academic & Enrollment */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-[#1a3a8f] flex items-center gap-1.5">
              <span>🏫</span> Academic & Enrollment Details
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Branch (Pilihan Cabang)</label>
                <input
                  type="text"
                  placeholder="e.g. Cabang Utama"
                  value={formData.branch || ""}
                  onChange={e => field("branch", e.target.value)}
                  className="w-full p-2.5 border rounded-xl"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Program</label>
                <input
                  type="text"
                  placeholder="e.g. English for Teens / VIP"
                  value={formData.program || ""}
                  onChange={e => field("program", e.target.value)}
                  className="w-full p-2.5 border rounded-xl"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Class Type (Jenis Kelas)</label>
                <input
                  type="text"
                  placeholder="e.g. Reguler / Private"
                  value={formData.classType || ""}
                  onChange={e => field("classType", e.target.value)}
                  className="w-full p-2.5 border rounded-xl"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Joined Date (Tanggal Bergabung)</label>
                <input
                  type="date"
                  value={formData.joinedDate || ""}
                  onChange={e => field("joinedDate", e.target.value)}
                  className="w-full p-2.5 border rounded-xl bg-white font-semibold"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">School / Company (Sekolah/Pekerjaan)</label>
                <input
                  type="text"
                  placeholder="e.g. SMA Negeri 1 / Universitas"
                  value={formData.schoolOrJob || ""}
                  onChange={e => field("schoolOrJob", e.target.value)}
                  className="w-full p-2.5 border rounded-xl"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Grade / Semester (Kelas/Semester)</label>
                <input
                  type="text"
                  placeholder="e.g. Kelas 10 / Semester 4"
                  value={formData.classOrSemester || ""}
                  onChange={e => field("classOrSemester", e.target.value)}
                  className="w-full p-2.5 border rounded-xl"
                />
              </div>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Section 3: Parents / Guardians */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-[#1a3a8f] flex items-center gap-1.5">
              <span>👨‍👩‍👦</span> Parents / Guardians Information
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Father Box */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                <p className="text-[11px] font-bold text-slate-700 uppercase">Father's Information (Data Ayah)</p>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Name (Nama Ayah)</label>
                  <input
                    type="text"
                    placeholder="Father's Name"
                    value={formData.fatherName || ""}
                    onChange={e => field("fatherName", e.target.value)}
                    className="w-full p-2 border rounded-lg bg-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Occupation (Pekerjaan Ayah)</label>
                  <input
                    type="text"
                    placeholder="Occupation"
                    value={formData.fatherJob || ""}
                    onChange={e => field("fatherJob", e.target.value)}
                    className="w-full p-2 border rounded-lg bg-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">WhatsApp Phone (No HP Ayah)</label>
                  <input
                    type="tel"
                    placeholder="08..."
                    value={formData.fatherPhone || ""}
                    onChange={e => field("fatherPhone", e.target.value)}
                    className="w-full p-2 border rounded-lg bg-white text-xs"
                  />
                </div>
              </div>

              {/* Mother Box */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                <p className="text-[11px] font-bold text-slate-700 uppercase">Mother's Information (Data Ibu)</p>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Name (Nama Ibu)</label>
                  <input
                    type="text"
                    placeholder="Mother's Name"
                    value={formData.motherName || ""}
                    onChange={e => field("motherName", e.target.value)}
                    className="w-full p-2 border rounded-lg bg-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Occupation (Pekerjaan Ibu)</label>
                  <input
                    type="text"
                    placeholder="Occupation"
                    value={formData.motherJob || ""}
                    onChange={e => field("motherJob", e.target.value)}
                    className="w-full p-2 border rounded-lg bg-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">WhatsApp Phone (No HP Ibu)</label>
                  <input
                    type="tel"
                    placeholder="08..."
                    value={formData.motherPhone || ""}
                    onChange={e => field("motherPhone", e.target.value)}
                    className="w-full p-2 border rounded-lg bg-white text-xs"
                  />
                </div>
              </div>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Section 4: Administrative & Notes */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-[#1a3a8f] flex items-center gap-1.5">
              <span>📝</span> Administrative & Evaluation
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Information Source (Dari Mana Tahu MyLiberty)</label>
                <input
                  type="text"
                  placeholder="e.g. Instagram, Teman, Brosur"
                  value={formData.referralSource || ""}
                  onChange={e => field("referralSource", e.target.value)}
                  className="w-full p-2.5 border rounded-xl"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Rating / Fluency</label>
                <select
                  value={formData.rating || "1"}
                  onChange={e => field("rating", e.target.value)}
                  className="w-full p-2.5 border rounded-xl bg-white font-bold"
                >
                  <option value="1">1 Star (Beginner)</option>
                  <option value="3">3 Star (Intermediate)</option>
                  <option value="5">5 Star (Fluent)</option>
                </select>
              </div>
              <div className="md:col-span-3">
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Notes / Evaluation</label>
                <textarea
                  rows={3}
                  placeholder="Internal notes, special considerations, or student progress..."
                  value={formData.notes || ""}
                  onChange={e => field("notes", e.target.value)}
                  className="w-full p-2.5 border rounded-xl"
                />
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ══════════════════════════════════════════════════════════════════
           STAFF PROFILE FORM (Account credentials & staff attributes)
           ══════════════════════════════════════════════════════════════════ */
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">First Name</label>
              <input
                type="text"
                placeholder="First Name"
                value={formData.firstName || ""}
                onChange={e => field("firstName", e.target.value)}
                className="w-full p-2.5 border rounded-xl"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Last Name</label>
              <input
                type="text"
                placeholder="Last Name"
                value={formData.lastName || ""}
                onChange={e => field("lastName", e.target.value)}
                className="w-full p-2.5 border rounded-xl"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nickname</label>
              <input
                type="text"
                placeholder="Nickname"
                value={formData.nickname || ""}
                onChange={e => field("nickname", e.target.value)}
                className="w-full p-2.5 border rounded-xl"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Gender</label>
              <select
                value={formData.gender || "male"}
                onChange={e => field("gender", e.target.value)}
                className="w-full p-2.5 border rounded-xl bg-white font-bold"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Phone Number</label>
              <input
                type="tel"
                placeholder="Phone Number"
                value={formData.phone || ""}
                onChange={e => field("phone", e.target.value)}
                className="w-full p-2.5 border rounded-xl"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Date of Birth</label>
              <input
                type="date"
                value={formData.dob || ""}
                onChange={e => field("dob", e.target.value)}
                className="w-full p-2.5 border rounded-xl bg-white"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Education Level</label>
              <select
                value={formData.educationLevel || "Universitas"}
                onChange={e => field("educationLevel", e.target.value)}
                className="w-full p-2.5 border rounded-xl bg-white font-bold"
              >
                <option value="SMA/SMK">SMA/SMK</option>
                <option value="Universitas">Universitas</option>
                <option value="S2">S2 (Master)</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Email Address</label>
              <input
                type="email"
                placeholder="staff@myliberty.com"
                autoComplete="off"
                value={formData.email || ""}
                onChange={e => field("email", e.target.value)}
                className="w-full p-2.5 border rounded-xl"
                required
                disabled={!!editId}
              />
            </div>
            {!editId && (
              <div className="md:col-span-2">
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Initial Password</label>
                <input
                  type="password"
                  placeholder="Temporary Password (min 6 characters)"
                  autoComplete="new-password"
                  value={formData.password || ""}
                  onChange={e => field("password", e.target.value)}
                  className="w-full p-2.5 border rounded-xl"
                  required
                />
              </div>
            )}
          </div>
        </div>
      )}

      <div className="pt-2">
        <button
          type="submit"
          className="w-full min-h-12 bg-[#1a3a8f] text-white p-3 rounded-xl font-bold hover:bg-[#122b6e] active:scale-[0.98] transition shadow-md"
        >
          {editId ? "Update Profile" : "Create Account"}
        </button>
      </div>
    </form>
  );
}
