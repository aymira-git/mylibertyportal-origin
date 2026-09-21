import { BookOpen, Plus, ArrowRight, Calendar, MapPin, Edit2, UserPlus } from "lucide-react";
import { LevelBadge } from "../shared";
import BatchStatusPill from "./BatchStatusPill";

export default function BatchesOverviewWidget({
  augmentedBatches = [],
  stats,
  canAdminister = false,
  canEnroll = false,
  onOpenAddModal,
  onOpenEditModal,
  onNavigateToClasses,
  onSetEnrollingBatch,
}) {
  const displayList = augmentedBatches.slice(0, 4);

  return (
    <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 text-[#1a3a8f] flex items-center justify-center font-bold">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5">
              <span>Available Batches &amp; Seat Openings</span>
              {stats.totalOpenSeats > 0 && (
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                  {stats.totalOpenSeats} open seats
                </span>
              )}
            </h4>
            <p className="text-[11px] text-slate-500 font-medium">
              Live capacity across academy cohorts and intake schedules
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canAdminister && onOpenAddModal && (
            <button
              onClick={onOpenAddModal}
              className="px-3 py-1.5 bg-[#1a3a8f] hover:bg-[#122b6e] text-white text-xs font-extrabold rounded-xl shadow-xs transition flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Add Batch</span>
            </button>
          )}
          {onNavigateToClasses && (
            <button
              onClick={onNavigateToClasses}
              className="text-xs font-bold text-[#1a3a8f] hover:underline flex items-center gap-1 p-1 cursor-pointer"
            >
              <span>View All ({augmentedBatches.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Mini stats pill strip */}
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
          <p className="text-[10px] uppercase font-bold text-slate-400">Total Batches</p>
          <p className="text-base font-black text-slate-800 mt-0.5">{stats.totalBatches}</p>
        </div>
        <div className="p-2.5 bg-emerald-50/60 rounded-xl border border-emerald-100">
          <p className="text-[10px] uppercase font-bold text-emerald-700">Open Seats</p>
          <p className="text-base font-black text-emerald-800 mt-0.5">{stats.totalOpenSeats}</p>
        </div>
        <div className="p-2.5 bg-indigo-50/60 rounded-xl border border-indigo-100">
          <p className="text-[10px] uppercase font-bold text-indigo-700">School Occupancy</p>
          <p className="text-base font-black text-indigo-800 mt-0.5">{stats.overallOccupancy}%</p>
        </div>
      </div>

      {/* Mini list of top available batches */}
      {displayList.length === 0 ? (
        <div className="py-6 text-center text-slate-400 text-xs font-medium">
          No class batches scheduled yet.
        </div>
      ) : (
        <div className="space-y-2.5">
          {displayList.map((batch) => (
            <div
              key={batch.id}
              className="p-3 bg-slate-50/60 hover:bg-slate-50 rounded-2xl border border-slate-200/80 transition flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-extrabold text-slate-900 text-xs truncate">
                    {batch.className}
                  </span>
                  <LevelBadge level={batch.classLevel || "warrior"} />
                  <BatchStatusPill
                    status={batch.computedStatus}
                    seatsAvailable={batch.seatsAvailable}
                  />
                </div>
                <div className="flex items-center gap-3 text-[11px] text-slate-500 font-medium">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    <span>{batch.schedule || batch.classDay}</span>
                  </span>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    <span>{batch.classRoom || "Main Campus"}</span>
                  </span>
                  <span>·</span>
                  <span className="text-slate-600 font-semibold">{batch.instructorName}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                {/* Capacity indicator */}
                <div className="text-right">
                  <p className="text-[11px] font-black text-slate-800">
                    {batch.studentCount} / {batch.maxCapacity} seats
                  </p>
                  <div className="w-20 bg-slate-200 h-1.5 rounded-full overflow-hidden mt-0.5">
                    <div
                      className={`h-full rounded-full ${
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

                {canAdminister && onOpenEditModal && (
                  <button
                    onClick={() => onOpenEditModal(batch)}
                    title="Edit Batch"
                    className="p-1.5 text-slate-500 hover:text-[#1a3a8f] hover:bg-white rounded-lg transition border border-transparent hover:border-slate-200 cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                )}

                {canEnroll && batch.isAvailable && onSetEnrollingBatch && (
                  <button
                    onClick={() => onSetEnrollingBatch(batch)}
                    title="Enroll Student"
                    className="px-2.5 py-1.5 bg-[#1a3a8f] hover:bg-[#122b6e] text-white rounded-lg transition text-[11px] font-extrabold flex items-center gap-1 shadow-2xs cursor-pointer"
                  >
                    <UserPlus className="w-3 h-3" />
                    <span>Enroll</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
