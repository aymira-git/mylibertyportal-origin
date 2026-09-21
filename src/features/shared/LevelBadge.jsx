import Badge from "./Badge";
import { LEVELS, getStars } from "./levels";
import { getProgram, getProgramLevel, normalizeProgram } from "../../constants/programs";

const LEVEL_TONES = {
  warrior: "slate",
  elite: "blue",
  master: "purple",
  grandmaster: "amber",
  epic: "rose",
};

export default function LevelBadge({
  level,
  programId = null,
  showStars = false,
  showTier = false,
}) {
  const norm = (level || "").toLowerCase();
  const progId = programId ? normalizeProgram(programId) : null;
  const progLevel = progId ? getProgramLevel(progId, norm) : null;
  const config = progLevel || LEVELS[norm];
  const stars = config?.stars || getStars(norm);
  const tone = LEVEL_TONES[norm] || (progId ? getProgram(progId)?.badgeTone : "gray") || "gray";

  return (
    <Badge tone={tone}>
      <span className="inline-flex items-center gap-1 capitalize">
        {showStars && stars && <span>{"⭐".repeat(stars)}</span>}
        <span>{config?.label || level || "Unset"}</span>
        {showTier && config?.tier && <span className="opacity-75 text-[9px]">({config.tier})</span>}
      </span>
    </Badge>
  );
}
