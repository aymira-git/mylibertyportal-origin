import { useState } from "react";
import { X, Award, Check, UserPlus, Sparkles } from "lucide-react";
import { auth } from "../../../firebase";
import { LEVEL_LIST, TIERS, TIER_KEYS } from "../../../constants/levels";
import { getProgramLevels } from "../../../constants/programs";
import { todayWita } from "../../../utils/dateWita";

function PlacementTestModalContent({
  onClose,
  inquiry,
  division = "courses",
  onSaveTest,
  submitting = false,
  canEnrollImmediately = true,
}) {
  const isKindergarten = division === "kindergarten" || inquiry?.division === "kindergarten";
  const programId = inquiry?.programId || (isKindergarten ? "kids_school" : "english_course");
  const availableLevels = getProgramLevels(programId);

  const [score, setScore] = useState("");
  const [assessedLevel, setAssessedLevel] = useState(
    () => inquiry?.currentLevel || (isKindergarten ? "nursery" : "warrior")
  );
  const [testedBy, setTestedBy] = useState(
    () => auth.currentUser?.displayName || auth.currentUser?.email || "Front Desk Staff"
  );
  const [testedAt, setTestedAt] = useState(() => todayWita());
  const [notes, setNotes] = useState("");

  const handleLevelRecommendation = (scoreNum) => {
    if (isNaN(scoreNum) || scoreNum === "" || isKindergarten) return;
    const num = Number(scoreNum);
    if (num >= 85) {
      setAssessedLevel("epic");
    } else if (num >= 65) {
      setAssessedLevel("master");
    } else {
      setAssessedLevel("warrior");
    }
  };

  const handleScoreChange = (val) => {
    setScore(val);
    handleLevelRecommendation(val);
  };

  const handleSubmit = (e, enrollImmediately = false) => {
    e.preventDefault();
    if (!assessedLevel) return;
    onSaveTest(
      {
        score: score !== "" ? Number(score) : null,
        assessedLevel,
        testedBy: testedBy.trim(),
        testedAt,
        notes: notes.trim(),
      },
      { enrollImmediately }
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 text-xs max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black shadow-xs">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-extrabold text-sm text-slate-800">
                Log Placement Test Result
              </h4>
              <p className="text-[11px] text-slate-500 font-medium">
                Candidate: <strong className="text-slate-700">{inquiry.studentName}</strong> ({inquiry.parentName})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Existing Test History if any */}
        {Array.isArray(inquiry.placementTests) && inquiry.placementTests.length > 0 && (
          <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-1.5">
            <span className="text-[10px] font-black uppercase text-amber-900 tracking-wider">
              Previous Test Attempts ({inquiry.placementTests.length})
            </span>
            <div className="space-y-1">
              {inquiry.placementTests.map((pt, idx) => (
                <div
                  key={pt.id || idx}
                  className="flex items-center justify-between text-[11px] bg-white/80 px-2.5 py-1.5 rounded-xl border border-amber-100 font-medium text-slate-700"
                >
                  <div>
                    <span className="font-bold text-slate-900">
                      Score: {pt.score != null ? `${pt.score}/100` : "N/A"}
                    </span>
                    <span className="text-indigo-600 font-bold ml-2 capitalize">
                      {pt.assessedLevel}
                    </span>
                    {pt.notes && <span className="text-slate-500 ml-2">({pt.notes})</span>}
                  </div>
                  <span className="text-[10px] text-slate-400">{pt.testedAt || "-"}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-extrabold text-slate-700 block mb-1">
                Test Score (0 - 100)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="100"
                  placeholder="e.g. 82"
                  value={score}
                  onChange={(e) => handleScoreChange(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:bg-white focus:border-[#1a3a8f] outline-none"
                />
                {score !== "" && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-extrabold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                    pts
                  </span>
                )}
              </div>
            </div>

            <div>
              <label className="font-extrabold text-slate-700 block mb-1">
                Test Date (WITA) *
              </label>
              <input
                type="date"
                required
                value={testedAt}
                onChange={(e) => setTestedAt(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:bg-white focus:border-[#1a3a8f] outline-none"
              />
            </div>
          </div>

          {/* Assessed Level Placement */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-extrabold text-slate-700 block">
                Assessed Academic Level Recommendation *
              </label>
              {score !== "" && !isKindergarten && (
                <span className="text-[10px] text-amber-700 bg-amber-50 font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 border border-amber-200">
                  <Sparkles className="w-2.5 h-2.5 text-amber-600" />
                  <span>Auto-suggested</span>
                </span>
              )}
            </div>

            <select
              value={assessedLevel}
              onChange={(e) => setAssessedLevel(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs capitalize text-slate-900 focus:bg-white focus:border-[#1a3a8f] outline-none cursor-pointer"
            >
              {!isKindergarten && programId === "english_course" ? (
                TIER_KEYS.map((tierKey) => {
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
              ) : (
                availableLevels.map((lvl) => (
                  <option key={lvl.id} value={lvl.id}>
                    {lvl.label} {lvl.stars ? `(${"⭐".repeat(lvl.stars)})` : ""}
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="font-extrabold text-slate-700 block mb-1">
              Assessor / Tester Name *
            </label>
            <input
              type="text"
              required
              placeholder="Staff / Instructor Name"
              value={testedBy}
              onChange={(e) => setTestedBy(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:bg-white focus:border-[#1a3a8f] outline-none"
            />
          </div>

          <div>
            <label className="font-extrabold text-slate-700 block mb-1">
              Test Observations &amp; Academic Notes
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Good listening comprehension and speaking confidence. Recommended for Master level cohort."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-xl font-medium focus:bg-white focus:border-[#1a3a8f] outline-none"
            />
          </div>

          {/* Modal Action Buttons */}
          <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold shadow-xs disabled:opacity-50 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span>{submitting ? "Saving..." : "Save Test Result"}</span>
            </button>

            {canEnrollImmediately && (
              <button
                type="button"
                disabled={submitting}
                onClick={(e) => handleSubmit(e, true)}
                className="px-4 py-2.5 rounded-xl bg-[#1a3a8f] text-white hover:bg-[#153075] font-bold shadow-xs disabled:opacity-50 transition flex items-center gap-1.5 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{submitting ? "Saving..." : "Save & Enroll Candidate"}</span>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

export function PlacementTestModal(props) {
  if (!props.isOpen || !props.inquiry) return null;
  return <PlacementTestModalContent key={props.inquiry?.id || "test-modal"} {...props} />;
}

