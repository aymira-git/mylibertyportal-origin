/**
 * ApplicationPlacementModal.jsx
 * Intake modal for confirming academic placement, optional batch assignment,
 * and tuition payment plan during student application approval.
 */

import { useState, useMemo } from "react";
import {
  X,
  Check,
  Loader2,
  AlertTriangle,
  Users,
  GraduationCap,
  ShieldAlert,
  Building2,
} from "lucide-react";
import { LEVEL_LIST, TIERS, TIER_KEYS } from "../../constants/levels";
import { normalizeBranch, matchesBranchFilter } from "../../constants/branches";
import { LevelBadge, PAYMENT_PLAN_LIST, isCompatible } from "../shared";
import { getBatchAvailability } from "../classes/batchAvailability";
import { sortPlacementBatches } from "./admissionsUtils";
import { getStudentProgram, getProgram, getProgramLevels } from "../../constants/programs";

function formatDobAndAge(dob) {
  if (!dob) return "—";
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dob).trim());
  if (!isoMatch) return dob;
  const birthYear = parseInt(isoMatch[1], 10);
  const birthMonth = parseInt(isoMatch[2], 10) - 1;
  const birthDay = parseInt(isoMatch[3], 10);
  const birthDate = new Date(birthYear, birthMonth, birthDay);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return `${dob} (${age} yrs)`;
}

export default function ApplicationPlacementModal({
  app,
  classes = [],
  duplicates = { students: [], pendingTwins: [] },
  submitting = false,
  onClose,
  onConfirm,
}) {
  const appProgId = useMemo(() => getStudentProgram(app), [app]);
  const appProgram = useMemo(() => getProgram(appProgId), [appProgId]);
  const appLevels = useMemo(() => getProgramLevels(appProgId), [appProgId]);

  const [selectedLevel, setSelectedLevel] = useState(
    app?.currentLevel || appLevels[0]?.id || "warrior"
  );
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedPlan, setSelectedPlan] = useState("monthly");
  const [openProfile, setOpenProfile] = useState(false);
  const [overrideDuplicate, setOverrideDuplicate] = useState(false);

  // Filter enrollable classes
  const enrollableClasses = useMemo(() => {
    return classes.filter((cls) => getBatchAvailability(cls).canEnroll);
  }, [classes]);

  // Sort batches: applicant's program first, branch, then compatible with selectedLevel, then by name
  const sortedClasses = useMemo(() => {
    return sortPlacementBatches(enrollableClasses, {
      selectedLevel,
      appBranch: app.branch,
      appProgram: appProgId,
    });
  }, [enrollableClasses, selectedLevel, app.branch, appProgId]);

  const selectedClass = useMemo(() => {
    if (!selectedClassId) return null;
    return classes.find((c) => c.id === selectedClassId) || null;
  }, [classes, selectedClassId]);

  // If a batch is chosen, its classLevel locks the effective level
  const effectiveLevel = selectedClass?.classLevel || selectedLevel;
  const levelLockedByBatch = Boolean(selectedClass?.classLevel);
  const levelDiffersFromChosen = Boolean(
    selectedClass?.classLevel && selectedClass.classLevel !== selectedLevel
  );

  // Duplicate checks
  const strongMatches = useMemo(() => {
    const fromStudents = (duplicates.students || []).filter((d) => d.strength === "strong");
    const fromTwins = (duplicates.pendingTwins || []).filter((d) => d.strength === "strong");
    return [...fromStudents, ...fromTwins];
  }, [duplicates]);

  const possibleMatches = useMemo(() => {
    const fromStudents = (duplicates.students || []).filter((d) => d.strength === "possible");
    const fromTwins = (duplicates.pendingTwins || []).filter((d) => d.strength === "possible");
    return [...fromStudents, ...fromTwins];
  }, [duplicates]);

  const hasStrongMatch = strongMatches.length > 0;
  const canSubmit = !hasStrongMatch || overrideDuplicate;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    onConfirm({
      level: effectiveLevel,
      paymentPlan: selectedPlan,
      classId: selectedClassId || null,
      openProfile,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#1a3a8f] text-white flex items-center justify-center font-black shadow-xs">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">
                Student Admission &amp; Placement
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Confirm academic level, intake cohort, and tuition plan
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 text-xs">
          {/* Section 1: Applicant Dossier Summary */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row gap-4 items-start">
            {app.photoURL ? (
              <img
                src={app.photoURL}
                alt={app.displayName}
                className="w-14 h-14 rounded-2xl object-cover border border-slate-200 shrink-0 shadow-2xs"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#1a3a8f] to-indigo-700 text-white font-black text-base flex items-center justify-center shrink-0 shadow-2xs uppercase">
                {app.displayName ? app.displayName.slice(0, 2) : "??"}
              </div>
            )}

            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-extrabold text-slate-900 text-base">
                  {app.displayName || "Unnamed Applicant"}
                </span>
                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
                  {normalizeBranch(app.branch)}
                </span>
                <span className="text-[10px] font-bold text-slate-600 bg-slate-200/80 px-2 py-0.5 rounded-full">
                  {app.classType || "Reguler"}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5 text-slate-600 text-[11px] pt-1">
                <p>
                  DOB:{" "}
                  <span className="font-semibold text-slate-800">{formatDobAndAge(app.dob)}</span>
                </p>
                <p>
                  Phone:{" "}
                  <span className="font-semibold text-slate-800">{app.phone || "No phone"}</span>
                </p>
                <p>
                  Parents:{" "}
                  <span className="font-semibold text-slate-800">
                    {app.fatherPhone || app.motherPhone || app.fatherName || app.motherName || "—"}
                  </span>
                </p>
                <p>
                  Program:{" "}
                  <span className="font-semibold text-slate-800">
                    {app.program || appProgram.label}
                  </span>
                </p>
                {app.schoolOrJob && (
                  <p className="sm:col-span-2">
                    School/Job:{" "}
                    <span className="font-semibold text-slate-800">{app.schoolOrJob}</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Duplicate Warnings */}
          {(hasStrongMatch || possibleMatches.length > 0) && (
            <div
              className={`p-4 rounded-2xl border space-y-2.5 ${hasStrongMatch ? "bg-amber-50/80 border-amber-200 text-amber-900" : "bg-blue-50/60 border-blue-200 text-blue-900"}`}
            >
              <div className="flex items-center gap-2 font-black text-xs">
                {hasStrongMatch ? (
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-blue-600 shrink-0" />
                )}
                <span>
                  {hasStrongMatch
                    ? "Strong Existing Record Match Detected"
                    : "Possible Matching Student Found"}
                </span>
              </div>

              <div className="space-y-1.5 text-[11px]">
                {duplicates.students?.map((match, idx) => (
                  <div
                    key={`stu-${idx}`}
                    className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white/80 border border-amber-200/60"
                  >
                    <div>
                      <span className="font-bold text-slate-900">{match.student.displayName}</span>
                      <span className="text-slate-500 ml-1.5">({match.reason})</span>
                    </div>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">
                      {match.strength}
                    </span>
                  </div>
                ))}

                {duplicates.pendingTwins?.map((match, idx) => (
                  <div
                    key={`twin-${idx}`}
                    className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white/80 border border-amber-200/60"
                  >
                    <div>
                      <span className="font-bold text-slate-900">{match.app.displayName}</span>
                      <span className="text-slate-500 ml-1.5">(Twin pending application)</span>
                    </div>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">
                      {match.strength}
                    </span>
                  </div>
                ))}
              </div>

              {hasStrongMatch && (
                <label className="flex items-start gap-2 pt-1 cursor-pointer font-bold text-xs text-amber-950">
                  <input
                    type="checkbox"
                    checked={overrideDuplicate}
                    onChange={(e) => setOverrideDuplicate(e.target.checked)}
                    className="mt-0.5 rounded text-[#1a3a8f] focus:ring-[#1a3a8f]"
                  />
                  <span>
                    I checked this applicant. This is a genuinely new student, not an accidental
                    duplicate.
                  </span>
                </label>
              )}
            </div>
          )}

          {/* Section 3: Academic Placement Level */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-extrabold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <span>⭐</span> Academic Placement Level *
              </label>
              <LevelBadge
                level={effectiveLevel}
                programId={appProgId}
                showStars={true}
                showTier={appProgId === "english_course"}
              />
            </div>

            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              disabled={levelLockedByBatch}
              className={`w-full p-2.5 border rounded-xl font-bold text-xs bg-white text-slate-800 focus:border-[#1a3a8f] outline-none ${levelLockedByBatch ? "opacity-60 bg-slate-100 cursor-not-allowed" : ""}`}
            >
              {appProgId === "english_course"
                ? TIER_KEYS.map((tierKey) => {
                    const tier = TIERS[tierKey];
                    const levelsInTier = LEVEL_LIST.filter((l) => l.tier === tierKey);
                    return (
                      <optgroup key={tierKey} label={`${tier.starText} ${tier.label} Tier`}>
                        {levelsInTier.map((lvl) => (
                          <option key={lvl.id} value={lvl.id}>
                            {lvl.label} ({lvl.starText} {tier.label})
                          </option>
                        ))}
                      </optgroup>
                    );
                  })
                : appLevels.map((lvl) => (
                    <option key={lvl.id} value={lvl.id}>
                      {lvl.label} {lvl.stars ? `(${"⭐".repeat(lvl.stars)})` : ""}
                    </option>
                  ))}
            </select>

            {levelLockedByBatch && (
              <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-xl border border-amber-100 font-medium">
                {levelDiffersFromChosen
                  ? `Level will be set to "${selectedClass?.classLevel?.toUpperCase()}" to match the chosen batch.`
                  : `Level is locked to the chosen batch (${selectedClass?.classLevel?.toUpperCase()}).`}
              </p>
            )}
          </div>

          {/* Section 4: Batch / Class Cohort Placement (Optional) */}
          <div className="space-y-2">
            <label className="font-extrabold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-[#1a3a8f]" />
              <span>Intake Class / Batch (Optional)</span>
            </label>

            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full p-2.5 border rounded-xl font-bold text-xs bg-white text-slate-800 focus:border-[#1a3a8f] outline-none"
            >
              <option value="">No batch yet (enroll later)</option>
              {sortedClasses.map((cls) => {
                const avail = getBatchAvailability(cls);
                const compat = isCompatible(selectedLevel, cls, appProgId);
                const branchName = normalizeBranch(cls.branch);
                return (
                  <option key={cls.id} value={cls.id}>
                    {compat ? "✓ " : ""}
                    [{branchName}] {cls.className} · {cls.classLevel?.toUpperCase() || "WARRIOR"} ·{" "}
                    {cls.classSchedule || "Flexible"} ({avail.studentCount}/{avail.capacity} seats)
                  </option>
                );
              })}
            </select>

            {selectedClass && !matchesBranchFilter(selectedClass.branch, app.branch) && (
              <p className="text-[11px] text-amber-850 bg-amber-50 p-2.5 rounded-xl border border-amber-200 font-medium flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 shrink-0 text-amber-700" />
                <span>
                  Cross-Campus Placement: This cohort is at{" "}
                  <strong>{normalizeBranch(selectedClass.branch)}</strong>, while the applicant
                  requested <strong>{normalizeBranch(app.branch)}</strong>.
                </span>
              </p>
            )}

            <p className="text-[10px] text-slate-400 font-medium">
              Only batches with open seats and active enrollment status are selectable. Cohorts
              matching the applicant&apos;s campus and academic level are listed first.
            </p>
          </div>

          {/* Section 5: Tuition Payment Plan Preference */}
          <div className="space-y-2">
            <label className="font-extrabold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <span>💳</span> Tuition Payment Plan Preference *
            </label>

            <select
              value={selectedPlan}
              onChange={(e) => setSelectedPlan(e.target.value)}
              className="w-full p-2.5 border rounded-xl font-bold text-xs bg-white text-slate-800 focus:border-[#1a3a8f] outline-none capitalize"
            >
              {PAYMENT_PLAN_LIST.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.label} ({plan.termName})
                  {plan.discountPercent > 0 ? ` — Save ${plan.discountPercent}%` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Section 6: Post-Approval Navigation */}
          <label className="flex items-center gap-2 pt-1 cursor-pointer font-bold text-slate-700">
            <input
              type="checkbox"
              checked={openProfile}
              onChange={(e) => setOpenProfile(e.target.checked)}
              className="rounded text-[#1a3a8f] focus:ring-[#1a3a8f]"
            />
            <span>Open full student profile editor after approving</span>
          </label>

          {/* Modal Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="py-2.5 px-4 rounded-xl font-bold text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !canSubmit}
              className="py-2.5 px-5 rounded-xl font-extrabold text-xs bg-[#1a3a8f] hover:bg-[#152e72] text-white shadow-sm transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              <span>{selectedClassId ? "Confirm Admission & Enroll" : "Confirm Admission"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
