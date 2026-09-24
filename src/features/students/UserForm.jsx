/**
 * UserForm.jsx
 * Add / Edit user form for the students feature.
 * Handles both staff account creation/edits and comprehensive student profile edits
 * matching all Google Registration Form fields.
 */

import { auth } from "../../firebase";
import { getStars } from "../shared";
import { normalizeDivision } from "../../constants/divisions";
import StudentPersonalFields from "./StudentPersonalFields";
import StudentAcademicFields from "./StudentAcademicFields";
import StudentTuitionFields from "./StudentTuitionFields";
import StudentFamilyFields from "./StudentFamilyFields";
import StaffProfileFields from "./StaffProfileFields";
import { CreditCard } from "lucide-react";

export default function UserForm({
  formData,
  setFormData,
  editId,
  onSubmit,
  onSaveAndCollectPayment,
}) {
  const isSelf = Boolean(editId && auth.currentUser && editId === auth.currentUser.uid);
  const field = (key, value) => setFormData((prev) => ({ ...prev, [key]: value }));
  const isStudent = formData.role === "student";

  const setAcademicLevel = (level) => {
    field("currentLevel", level);
    const stars = getStars(level);
    if (stars) {
      field("rating", String(stars));
    }
  };

  const handleDivisionChange = (newDiv) => {
    field("division", newDiv);
    if (
      newDiv === "kindergarten" &&
      (formData.role === "marketing" || formData.role === "officeboy")
    ) {
      field("role", "instructor");
    }
  };

  const handleCollectPaymentClick = async (e) => {
    if (onSaveAndCollectPayment) {
      e.preventDefault();
      await onSaveAndCollectPayment(e);
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className="bg-white p-6 rounded-2xl shadow-sm text-sm border border-slate-200 w-full space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 gap-2">
        <div>
          <h3 className="font-bold text-slate-800 text-lg">
            {isStudent
              ? editId
                ? "Edit Student Profile"
                : "Student Registration"
              : editId
                ? "Edit Staff Profile"
                : "Automated Staff Account Creation"}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {isStudent
              ? "Update student registration, academic details, and tuition plan."
              : "Create credentials and set permissions for staff."}
          </p>
        </div>

        {/* Role & Division badges or edit indicators */}
        <div>
          {editId || isStudent ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="px-3 py-1 bg-indigo-50 text-indigo-700 font-bold text-xs rounded-full uppercase">
                Role: {formData.role}
              </span>
              {!isStudent && (
                <span className="px-3 py-1 bg-cyan-50 text-cyan-700 font-bold text-xs rounded-full uppercase">
                  Division:{" "}
                  {normalizeDivision(formData.division) === "kindergarten"
                    ? "Kids School"
                    : "Courses"}
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 font-medium">New Account</span>
            </div>
          )}
        </div>
      </div>

      {isStudent ? (
        <div className="space-y-6">
          <StudentPersonalFields formData={formData} field={field} />
          <hr className="border-slate-100" />
          <StudentAcademicFields
            formData={formData}
            field={field}
            setAcademicLevel={setAcademicLevel}
            editId={editId}
          />
          <hr className="border-slate-100" />
          <StudentTuitionFields formData={formData} field={field} />
          <hr className="border-slate-100" />
          <StudentFamilyFields formData={formData} field={field} />
        </div>
      ) : (
        <StaffProfileFields
          formData={formData}
          field={field}
          handleDivisionChange={handleDivisionChange}
          editId={editId}
          isSelf={isSelf}
        />
      )}

      <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
        <button
          type="submit"
          className="w-full min-h-12 bg-[#1a3a8f] text-white p-3 rounded-xl font-bold hover:bg-[#122b6e] active:scale-[0.98] transition shadow-md cursor-pointer flex-1"
        >
          {editId ? "Update Profile" : "Create Account"}
        </button>

        {isStudent && !editId && onSaveAndCollectPayment && (
          <button
            type="button"
            onClick={handleCollectPaymentClick}
            className="w-full sm:w-auto min-h-12 px-5 py-3 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white transition shadow-md flex items-center justify-center gap-2 cursor-pointer shrink-0"
          >
            <CreditCard className="w-4 h-4" />
            <span>Save &amp; Open Cashier</span>
          </button>
        )}
      </div>
    </form>
  );
}
