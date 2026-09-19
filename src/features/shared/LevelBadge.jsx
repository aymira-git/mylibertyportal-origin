import Badge from "./Badge";
import { LEVELS, getStars } from "./levels";

const LEVEL_TONES = {
  warrior: "slate",
  elite: "blue",
  master: "purple",
  grandmaster: "amber",
  epic: "rose",
};

export default function LevelBadge({ level, showStars = false, showTier = false }) {
  const norm = (level || "").toLowerCase();
  const config = LEVELS[norm];
  const stars = getStars(norm);
  const tone = LEVEL_TONES[norm] || "gray";

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
