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
  const rawStatus = (shift.punctualityStatus || "ON_TIME").toUpperCase().replace(/\s+/g, "_");
  const mins = shift.minutesEarlyOrLate;
  const absMins = mins != null && Number.isFinite(Number(mins)) ? Math.abs(Math.round(mins)) : null;

  if (rawStatus === "LATE") {
    return {
      label: absMins ? `${absMins}m late` : "Late",
      classes: "bg-rose-100 text-rose-800 border-rose-200",
    };
  }
  if (rawStatus === "EARLY") {
    return {
      label: absMins ? `${absMins}m early` : "Early",
      classes: "bg-blue-100 text-blue-800 border-blue-200",
    };
  }
  return {
    label: "On Time",
    classes: "bg-emerald-100 text-emerald-800 border-emerald-200",
  };
}
