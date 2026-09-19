// Same badge we built inside ClassManager, now promoted to the shared kit
// so StudentRoster and ReportsDashboard can show it too instead of plain text.
// (LEVELS itself now lives in ./levels.js — see comment there.)
import Badge from "./Badge";

const LEVEL_TONES = {
  warrior: "slate",
  elite: "blue",
  master: "purple",
  grandmaster: "amber",
  epic: "rose",
};

export default function LevelBadge({ level }) {
  return <Badge tone={LEVEL_TONES[level] || "gray"}>{level || "Unset"}</Badge>;
}
