import { useState } from "react";
import { auth } from "../../firebase";
import { createProgressReport } from "./progressReportsRepository";
import {
  GraduationCap,
  CheckCircle2,
  AlertCircle,
  Award,
  ChevronRight,
  TrendingUp,
  FileCheck2
} from "lucide-react";
import { LevelBadge, LEVEL_KEYS, LEVELS } from "../shared";
const SCORE_FIELDS = [
  { field: "pronunciation", label: "Pronunciation", desc: "Clarity, phonemes, and accent neutrality" },
  { field: "fluency", label: "Fluency", desc: "Speaking pace, flow, and absence of hesitation" },
  { field: "vocabulary", label: "Vocabulary", desc: "Lexical range, idiomatic phrasing, word choice" },
  { field: "comprehension", label: "Comprehension", desc: "Context grasp, active listening, response speed" }
];

export default function StudentProgressForm({ classes, students, onSaved }) {
  const [classId, setClassId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [examDate, setExamDate] = useState(new Date().toISOString().slice(0, 10));
  const [level, setLevel] = useState("warrior");
  const [scores, setScores] = useState({ pronunciation: "", fluency: "", vocabulary: "", comprehension: "" });
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState({ message: "", type: "" });

  const selectedClass = classes.find((cls) => cls.id === classId);
  const classStudents = students.filter((student) => (selectedClass?.studentIds || []).includes(student.id));
  const selectedStudent = classStudents.find((student) => student.id === studentId);

  const numericScores = SCORE_FIELDS.map((s) => Number(scores[s.field])).filter((score) => Number.isFinite(score) && score > 0);
  const overallScore = numericScores.length === SCORE_FIELDS.length
    ? Math.round(numericScores.reduce((total, score) => total + score, 0) / SCORE_FIELDS.length)
    : null;

  const handleClassChange = (event) => {
    setClassId(event.target.value);
    setStudentId("");
  };

  const handleScoreChange = (field, value) => {
    if (value === "" || (Number(value) >= 0 && Number(value) <= 100)) {
      setScores((current) => ({ ...current, [field]: value }));
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!selectedClass || !selectedStudent || numericScores.length !== SCORE_FIELDS.length) {
      setFeedback({ message: "Please complete all score criteria (10-100).", type: "error" });
      return;
    }

    setSaving(true);
    setFeedback({ message: "", type: "" });
    try {
      const instructor = auth.currentUser;
      await createProgressReport({
        studentId: selectedStudent.id,
        studentName: selectedStudent.displayName || "",
        classId: selectedClass.id,
        className: selectedClass.className || "",
        instructorId: instructor?.uid || "",
        instructorName: instructor?.displayName || instructor?.email || "",
        examDate,
        level,
        pronunciationScore: Number(scores.pronunciation),
        fluencyScore: Number(scores.fluency),
        vocabularyScore: Number(scores.vocabulary),
        comprehensionScore: Number(scores.comprehension),
        overallScore,
        notes: notes.trim(),
        submittedAt: new Date().toISOString(),
      });
      setScores({ pronunciation: "", fluency: "", vocabulary: "", comprehension: "" });
      setNotes("");
      setFeedback({
        message: `Evaluation submitted successfully for ${selectedStudent.displayName}! Overall Band: ${overallScore}%`,
        type: "success"
      });
      onSaved?.();
    } catch (error) {
      setFeedback({ message: `Unable to save evaluation report: ${error.message}`, type: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/90 shadow-sm max-w-4xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-100 text-[#1a3a8f] flex items-center justify-center">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-900 text-lg">Academic Progress & Assessment</h3>
            <p className="text-xs text-slate-500 font-medium">Record CEFR benchmarks, skill proficiency, and pedagogical feedback</p>
          </div>
        </div>

        {overallScore !== null && (
          <div className="flex items-center gap-2.5 bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100/80 px-4 py-2 rounded-2xl">
            <Award className="w-5 h-5 text-[#1a3a8f]" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Projected Score</p>
              <p className="text-base font-extrabold text-[#1a3a8f]">{overallScore} / 100</p>
            </div>
          </div>
        )}
      </div>

      {feedback.message && (
        <div
          className={`p-4 rounded-2xl flex items-start gap-3 border text-xs font-semibold ${
            feedback.type === "error"
              ? "bg-rose-50 border-rose-200 text-rose-800"
              : "bg-emerald-50 border-emerald-200 text-emerald-800"
          }`}
        >
          {feedback.type === "error" ? (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
          )}
          <p className="flex-1">{feedback.message}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Student & Class Selection Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              Assigned Class Cohort
            </label>
            <select
              value={classId}
              onChange={handleClassChange}
              className="w-full p-3 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold bg-slate-50 focus:bg-white focus:border-[#1a3a8f] focus:ring-1 focus:ring-[#1a3a8f] outline-none transition"
              required
            >
              <option value="">Select class cohort...</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.className} ({cls.schedule || "Regular"})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              Enrolled Student
            </label>
            <div className="relative">
              <select
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="w-full p-3 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold bg-slate-50 focus:bg-white focus:border-[#1a3a8f] focus:ring-1 focus:ring-[#1a3a8f] outline-none transition disabled:opacity-50"
                disabled={!classId}
                required
              >
                <option value="">{classId ? "Select student to evaluate..." : "Select a class first"}</option>
                {classStudents.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.displayName} ({s.id.slice(0, 8)})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              Assessment Date
            </label>
            <div className="relative">
              <input
                type="date"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                className="w-full p-3 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold bg-slate-50 focus:bg-white focus:border-[#1a3a8f] focus:ring-1 focus:ring-[#1a3a8f] outline-none transition"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              CEFR / Track Level
            </label>
            <div className="flex gap-2 items-center">
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className="flex-1 p-3 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold bg-slate-50 focus:bg-white focus:border-[#1a3a8f] focus:ring-1 focus:ring-[#1a3a8f] outline-none transition capitalize"
              >
                {LEVEL_KEYS.map((opt) => (
                  <option key={opt} value={opt}>
                    {LEVELS[opt]?.label || opt.toUpperCase()}
                  </option>
                ))}
              </select>
              <div className="shrink-0">
                <LevelBadge level={level} size="md" />
              </div>
            </div>
          </div>
        </div>

        {/* ── Criteria Scoring Bento ── */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-[#1a3a8f]" />
              <span>Proficiency Benchmarks (10 – 100 Scale)</span>
            </h4>
            <span className="text-[11px] text-slate-400 font-medium">Standard passing mark: 65+</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {SCORE_FIELDS.map(({ field, label, desc }) => {
              const val = Number(scores[field]) || 0;
              const isPassing = val >= 65;

              return (
                <div
                  key={field}
                  className="rounded-2xl border border-slate-200/90 bg-slate-50/70 p-4 space-y-2.5 transition hover:border-indigo-200 hover:bg-white shadow-2xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-extrabold text-slate-800 text-xs">{label}</p>
                      <p className="text-[10px] text-slate-400 font-medium leading-tight mt-0.5">{desc}</p>
                    </div>
                    {val > 0 && (
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                          isPassing ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {isPassing ? "Pass" : "Review"}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="10"
                      max="100"
                      inputMode="numeric"
                      value={scores[field]}
                      onChange={(e) => handleScoreChange(field, e.target.value)}
                      placeholder="e.g. 85"
                      className="w-24 p-2.5 border border-slate-200 rounded-xl bg-white text-base font-extrabold text-slate-800 text-center outline-none focus:border-[#1a3a8f] focus:ring-1 focus:ring-[#1a3a8f] transition"
                      required
                    />
                    <div className="flex-1 bg-slate-200 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 rounded-full ${
                          val >= 80 ? "bg-emerald-500" : val >= 65 ? "bg-[#1a3a8f]" : val > 0 ? "bg-amber-500" : "w-0"
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, val))}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Notes & Recommendations */}
        <div className="space-y-1.5 pt-2">
          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
            Pedagogical Observations & Recommendations
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Highlight learner achievements, areas for targeted remediation, classroom engagement..."
            rows={3}
            className="w-full p-3.5 border border-slate-200 rounded-2xl text-xs sm:text-sm font-medium bg-slate-50/50 focus:bg-white focus:border-[#1a3a8f] focus:ring-1 focus:ring-[#1a3a8f] outline-none transition"
          />
        </div>

        {/* Submit Bar */}
        <button
          type="submit"
          disabled={saving || !classId || !studentId}
          className="w-full min-h-[52px] bg-[#1a3a8f] hover:bg-[#122b6e] text-white py-3.5 px-6 rounded-2xl font-bold text-sm transition duration-150 shadow-md shadow-indigo-950/15 disabled:opacity-50 flex items-center justify-center gap-2 group"
        >
          {saving ? (
            <span>Saving Assessment...</span>
          ) : (
            <>
              <FileCheck2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
              <span>Record Official Evaluation</span>
              <ChevronRight className="w-4 h-4 text-white/70" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
