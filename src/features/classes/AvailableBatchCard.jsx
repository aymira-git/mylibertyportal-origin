import {
  Calendar,
  Clock,
  MapPin,
  User,
  Users,
  ExternalLink,
  Check,
  Share2,
  Edit2,
  Trash2,
  UserPlus,
} from "lucide-react";
import { LevelBadge } from "../shared";
import BatchStatusPill from "./BatchStatusPill";

export default function AvailableBatchCard({
  batch,
  isAssignedToCurrentUser = false,
  canAdminister = false,
  canEnroll = false,
  role = "admin",
  copiedBatchId = null,
  onOpenEditModal,
  onDeleteBatch,
  onCopyMarketingBlurb,
  onSetEnrollingBatch,
}) {
  return (
    <div
      className={`bg-white rounded-3xl border p-5 transition-all flex flex-col justify-between space-y-4 hover:shadow-md ${
        isAssignedToCurrentUser
          ? "border-indigo-300 bg-indigo-50/20 shadow-xs"
          : "border-slate-200/90 shadow-2xs"
      }`}
    >
      {/* Card Top: Level, Status & Actions */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <LevelBadge level={batch.classLevel || "warrior"} />
          <div className="flex items-center gap-1.5">
            <BatchStatusPill
              status={batch.computedStatus}
              seatsAvailable={batch.seatsAvailable}
            />

            {/* Edit / Delete strictly for Admin */}
            {canAdminister && (
              <div className="flex items-center gap-1 ml-1">
                {onOpenEditModal && (
                  <button
                    onClick={() => onOpenEditModal(batch)}
                    title="Edit Batch"
                    className="p-1.5 text-slate-400 hover:text-[#1a3a8f] hover:bg-slate-100 rounded-lg transition cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                )}
                {onDeleteBatch && (
                  <button
                    onClick={() => onDeleteBatch(batch)}
                    title="Delete Batch"
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Title & Intake */}
        <div>
          <h4 className="font-extrabold text-slate-900 text-base leading-snug">
            {batch.className}
          </h4>
          <p className="text-[11px] text-slate-400 font-semibold mt-0.5 flex items-center gap-1">
            <Calendar className="w-3 h-3 text-slate-400" />
            <span>Intake: {batch.classStartDate || "Rolling Admission"}</span>
          </p>
        </div>

        {/* Details Grid: Schedule, Room, Instructor */}
        <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100 space-y-1.5 text-xs">
          <div className="flex items-center justify-between text-slate-600">
            <span className="text-[11px] font-bold text-slate-400 uppercase flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>Schedule</span>
            </span>
            <span className="font-extrabold text-slate-800 text-right">
              {batch.schedule || `${batch.classDay} @ ${batch.startTime} - ${batch.endTime}`}
            </span>
          </div>

          <div className="flex items-center justify-between text-slate-600">
            <span className="text-[11px] font-bold text-slate-400 uppercase flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              <span>Classroom</span>
            </span>
            <span className="font-bold text-slate-800">
              {batch.classRoom || "Main Campus"}
            </span>
          </div>

          <div className="flex items-center justify-between text-slate-600">
            <span className="text-[11px] font-bold text-slate-400 uppercase flex items-center gap-1">
              <User className="w-3 h-3" />
              <span>Instructor</span>
            </span>
            <span
              className={`font-bold truncate max-w-[140px] text-right ${
                batch.instructorId ? "text-slate-800" : "text-amber-700"
              }`}
            >
              {batch.instructorName}
            </span>
          </div>
        </div>

        {/* Notes / Description (if available) */}
        {batch.notes && (
          <p className="text-[11px] text-slate-600 bg-amber-50/60 p-2.5 rounded-xl border border-amber-100/80 line-clamp-2">
            <span className="font-bold text-amber-900">Note: </span>
            {batch.notes}
          </p>
        )}
      </div>

      {/* Card Bottom: Capacity Bar & Action Buttons */}
      <div className="space-y-3 pt-2 border-t border-slate-100">
        {/* Capacity Progress Bar */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-extrabold text-slate-700 flex items-center gap-1">
              <Users className="w-3 h-3 text-[#1a3a8f]" />
              <span>{batch.studentCount} / {batch.maxCapacity} Enrolled</span>
            </span>
            <span
              className={`font-black text-xs ${
                batch.seatsAvailable === 0
                  ? "text-rose-600"
                  : batch.seatsAvailable <= 3
                  ? "text-amber-600"
                  : "text-emerald-700"
              }`}
            >
              {batch.seatsAvailable} seat{batch.seatsAvailable === 1 ? "" : "s"} left
            </span>
          </div>

          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                batch.seatsAvailable === 0
                  ? "bg-rose-500"
                  : batch.seatsAvailable <= 3
                  ? "bg-amber-500"
                  : "bg-emerald-500"
              }`}
              style={{ width: `${batch.occupancyRate}%` }}
            />
          </div>
        </div>

        {/* Syllabus link or Actions */}
        <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
          {batch.worksheetUrl ? (
            <a
              href={batch.worksheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-bold text-slate-600 hover:text-[#1a3a8f] inline-flex items-center gap-1"
            >
              <span>Syllabus</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          ) : (
            <span className="text-[11px] text-slate-400 font-medium">Standard Syllabus</span>
          )}

          {/* Actions container */}
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {/* Marketing Action */}
            {role === "marketing" && onCopyMarketingBlurb && (
              <button
                onClick={() => onCopyMarketingBlurb(batch)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-extrabold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                {copiedBatchId === batch.id ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Share for Leads</span>
                  </>
                )}
              </button>
            )}

            {/* Admin Edit Batch */}
            {canAdminister && onOpenEditModal && (
              <button
                onClick={() => onOpenEditModal(batch)}
                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-[#1a3a8f] rounded-xl text-[11px] font-extrabold transition flex items-center gap-1 border border-indigo-100 cursor-pointer"
              >
                <Edit2 className="w-3 h-3" />
                <span>Edit</span>
              </button>
            )}

            {/* Operational Enrollment Action (Admin + Front Office) */}
            {canEnroll && onSetEnrollingBatch && (
              <button
                onClick={() => onSetEnrollingBatch(batch)}
                disabled={!batch.isAvailable}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-extrabold transition flex items-center gap-1.5 ${
                  batch.isAvailable
                    ? "bg-[#1a3a8f] hover:bg-[#122b6e] text-white shadow-xs cursor-pointer"
                    : "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>
                  {batch.isAvailable
                    ? "Enroll Student"
                    : batch.computedStatus === "full"
                    ? "Batch Full"
                    : batch.computedStatus === "cancelled"
                    ? "Cancelled"
                    : batch.computedStatus === "completed"
                    ? "Completed"
                    : "Unavailable"}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
