import StudentPhotoCapture from "./StudentPhotoCapture";
import { STAFF_STATUS_OPTIONS, STANDARD_BRANCHES } from "../staff/staffUtils";
import { normalizeBranch } from "../../constants/branches";
import { normalizeDivision } from "../../constants/divisions";

export default function StaffProfileFields({
  formData,
  field,
  handleDivisionChange,
  editId,
  isSelf,
}) {
  return (
    <div className="space-y-4">
      {/* Staff Headshot Photo Capture / Upload */}
      <StudentPhotoCapture
        photoURL={formData.photoURL}
        onPhotoChange={(url) => field("photoURL", url)}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
            First Name
          </label>
          <input
            type="text"
            placeholder="First Name"
            value={formData.firstName || ""}
            onChange={(e) => field("firstName", e.target.value)}
            className="w-full p-2.5 border rounded-xl"
            required
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
            Last Name
          </label>
          <input
            type="text"
            placeholder="Last Name"
            value={formData.lastName || ""}
            onChange={(e) => field("lastName", e.target.value)}
            className="w-full p-2.5 border rounded-xl"
            required
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
            Nickname
          </label>
          <input
            type="text"
            placeholder="Nickname"
            value={formData.nickname || ""}
            onChange={(e) => field("nickname", e.target.value)}
            className="w-full p-2.5 border rounded-xl"
            required
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
            Gender
          </label>
          <select
            value={formData.gender || "male"}
            onChange={(e) => field("gender", e.target.value)}
            className="w-full p-2.5 border rounded-xl bg-white font-bold"
          >
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
            Phone Number
          </label>
          <input
            type="tel"
            placeholder="Phone Number"
            value={formData.phone || ""}
            onChange={(e) => field("phone", e.target.value)}
            className="w-full p-2.5 border rounded-xl"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
            Date of Birth
          </label>
          <input
            type="date"
            value={formData.dob || ""}
            onChange={(e) => field("dob", e.target.value)}
            className="w-full p-2.5 border rounded-xl bg-white"
            required
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
            Education Level
          </label>
          <select
            value={formData.educationLevel || "Universitas"}
            onChange={(e) => field("educationLevel", e.target.value)}
            className="w-full p-2.5 border rounded-xl bg-white font-bold"
          >
            <option value="SMA/SMK">SMA/SMK</option>
            <option value="Universitas">Universitas</option>
            <option value="S2">S2 (Master)</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
            Branch (Cabang)
          </label>
          <select
            value={normalizeBranch(formData.branch)}
            onChange={(e) => field("branch", e.target.value)}
            className="w-full p-2.5 border rounded-xl bg-white font-bold text-xs"
          >
            {STANDARD_BRANCHES.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
            {formData.branch && !STANDARD_BRANCHES.includes(formData.branch) && (
              <option value={formData.branch}>{formData.branch}</option>
            )}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
            Division (Divisi) *
          </label>
          <select
            value={normalizeDivision(formData.division)}
            onChange={(e) => handleDivisionChange(e.target.value)}
            className="w-full p-2.5 border rounded-xl bg-white font-bold text-xs"
          >
            <option value="courses">Course Academy</option>
            <option value="kindergarten">Kids School (Kindergarten)</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-[#1a3a8f] uppercase mb-1 flex items-center gap-1">
            <span>Assigned Role (Peran Staf) *</span>
          </label>
          <select
            value={formData.role || "instructor"}
            onChange={(e) => field("role", e.target.value)}
            className="w-full p-2.5 border border-[#1a3a8f]/40 bg-indigo-50/30 rounded-xl font-bold text-xs text-slate-900 focus:border-[#1a3a8f] outline-none"
          >
            <option value="instructor">Instructor / Teacher</option>
            <option value="manager">Manager</option>
            <option value="frontoffice">Front Office</option>
            {normalizeDivision(formData.division) !== "kindergarten" && (
              <>
                <option value="marketing">Marketing Staff</option>
                <option value="officeboy">Office Support (Office Boy)</option>
              </>
            )}
          </select>
        </div>
        {editId && (
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              Employment Status{" "}
              {isSelf && (
                <span className="text-amber-600 font-semibold">(Protected Self-Account)</span>
              )}
            </label>
            <select
              value={formData.status || "active"}
              disabled={isSelf}
              onChange={(e) => field("status", e.target.value)}
              className={`w-full p-2.5 border rounded-xl font-bold text-xs ${
                isSelf ? "bg-slate-100 text-slate-500 cursor-not-allowed" : "bg-white"
              }`}
              title={
                isSelf ? "You cannot modify your own administrative status while logged in" : ""
              }
            >
              {STAFF_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
            Email Address
          </label>
          <input
            type="email"
            placeholder="staff@myliberty.com"
            autoComplete="off"
            value={formData.email || ""}
            onChange={(e) => field("email", e.target.value)}
            className="w-full p-2.5 border rounded-xl"
            required
            disabled={!!editId}
          />
        </div>
        {!editId && (
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              Initial Password
            </label>
            <input
              type="password"
              placeholder="Temporary Password (min 6 characters)"
              autoComplete="new-password"
              value={formData.password || ""}
              onChange={(e) => field("password", e.target.value)}
              className="w-full p-2.5 border rounded-xl"
              required
            />
          </div>
        )}
      </div>
    </div>
  );
}
