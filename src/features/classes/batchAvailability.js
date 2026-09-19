/**
 * batchAvailability.js
 * Computes batch availability, capacity, and enrollment eligibility.
 */

export function getBatchAvailability(cls) {
  if (!cls) {
    return {
      studentCount: 0,
      capacity: 15,
      seatsAvailable: 0,
      computedStatus: "cancelled",
      canEnroll: false,
    };
  }

  const studentCount = (cls.studentIds || []).length;
  const capacity = Number(cls.maxCapacity) || 15;
  const seatsAvailable = Math.max(0, capacity - studentCount);

  // Determine computed availability status following existing academy rules
  let computedStatus = cls.status || "open";
  if (cls.status === "cancelled") {
    computedStatus = "cancelled";
  } else if (cls.status === "completed") {
    computedStatus = "completed";
  } else if (cls.status === "in_progress") {
    computedStatus = "in_progress";
  } else if (studentCount >= capacity) {
    computedStatus = "full";
  } else if (seatsAvailable <= 3 && seatsAvailable > 0 && computedStatus !== "upcoming") {
    computedStatus = "filling_fast";
  }

  // in_progress batches stay enrollable for late joiners (matching EnrollModal)
  const canEnroll =
    seatsAvailable > 0 &&
    cls.status !== "cancelled" &&
    cls.status !== "completed";

  return {
    studentCount,
    capacity,
    seatsAvailable,
    computedStatus,
    canEnroll,
  };
}
