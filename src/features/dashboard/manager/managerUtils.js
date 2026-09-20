export function formatTime(isoString) {
  if (!isoString) return "N/A";
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return isoString;
  }
}

export function formatPunctuality(shift) {
  const status = shift.punctualityStatus || "ON_TIME";
  const mins = shift.minutesEarlyOrLate;
  if (status === "LATE") {
    return {
      label: mins ? `${mins}m late` : "Late",
      classes: "bg-rose-100 text-rose-800 border-rose-200",
    };
  }
  if (status === "EARLY") {
    return {
      label: mins ? `${Math.abs(mins)}m early` : "Early",
      classes: "bg-blue-100 text-blue-800 border-blue-200",
    };
  }
  return {
    label: "On Time",
    classes: "bg-emerald-100 text-emerald-800 border-emerald-200",
  };
}
