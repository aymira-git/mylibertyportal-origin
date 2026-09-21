/**
 * Academic Model Constants: Levels & Tiers (Single Source of Truth)
 *
 * CORE PRINCIPLE:
 * Level is the stored academic fact. Tier is a derived label.
 * Never store both as independently editable fields in Firestore.
 */

export const LEVELS = {
  warrior: {
    id: "warrior",
    label: "Warrior",
    tier: "beginner",
    stars: 1,
    order: 1,
  },
  elite: {
    id: "elite",
    label: "Elite",
    tier: "beginner",
    stars: 1,
    order: 2,
  },
  master: {
    id: "master",
    label: "Master",
    tier: "intermediate",
    stars: 2,
    order: 3,
  },
  grandmaster: {
    id: "grandmaster",
    label: "Grandmaster",
    tier: "intermediate",
    stars: 2,
    order: 4,
  },
  epic: {
    id: "epic",
    label: "Epic",
    tier: "fluent",
    stars: 3,
    order: 5,
  },
};

export const LEVEL_KEYS = Object.keys(LEVELS);
export const LEVEL_LIST = Object.values(LEVELS);

export const TIERS = {
  beginner: {
    id: "beginner",
    label: "Beginner",
    stars: 1,
    starText: "⭐",
    levels: ["warrior", "elite"],
    tone: "blue",
  },
  intermediate: {
    id: "intermediate",
    label: "Intermediate",
    stars: 2,
    starText: "⭐⭐",
    levels: ["master", "grandmaster"],
    tone: "purple",
  },
  fluent: {
    id: "fluent",
    label: "Fluent",
    stars: 3,
    starText: "⭐⭐⭐",
    levels: ["epic"],
    tone: "rose",
  },
};

export const TIER_KEYS = Object.keys(TIERS);
export const TIER_LIST = Object.values(TIERS);

import {
  getBatchProgram,
  getProgramLevel,
  getProgramLevels,
  normalizeProgram,
} from "./programs.js";

export function getTier(level) {
  return LEVELS[level]?.tier || null;
}

export function getStars(level) {
  return LEVELS[level]?.stars || null;
}

export function getStarText(level) {
  const stars = getStars(level);
  if (!stars) return "";
  return "⭐".repeat(stars);
}

export function getNextLevel(level) {
  const current = LEVELS[level];
  if (!current) return null;
  const next = LEVEL_LIST.find((lvl) => lvl.order === current.order + 1);
  return next ? next.id : null;
}

/**
 * Option B Compatibility Rule:
 * If batch specifies minLevel / maxLevel, compares studentOrder within that range.
 * If batch only specifies classLevel, falls back to exact match.
 *
 * Program Rule 3:
 * If studentProgram is provided, student and batch must belong to the same program.
 */
export function isCompatible(studentLevel, batch, studentProgram = null) {
  if (!studentLevel || !batch) return true;

  const batchProg = getBatchProgram(batch);

  if (studentProgram) {
    const normStudentProg = normalizeProgram(studentProgram);
    if (batchProg !== normStudentProg) {
      return false;
    }
  }

  const studentLvlObj = getProgramLevel(batchProg, studentLevel) || LEVELS[studentLevel];
  if (!studentLvlObj) return true;

  const studentOrder = studentLvlObj.order;

  if (batch.minLevel || batch.maxLevel) {
    const progLevels = getProgramLevels(batchProg);
    const minLvlObj = batch.minLevel
      ? getProgramLevel(batchProg, batch.minLevel) || LEVELS[batch.minLevel]
      : null;
    const maxLvlObj = batch.maxLevel
      ? getProgramLevel(batchProg, batch.maxLevel) || LEVELS[batch.maxLevel]
      : null;

    const minOrder = minLvlObj ? minLvlObj.order : 1;
    const maxOrder = maxLvlObj ? maxLvlObj.order : progLevels.length || 5;

    return studentOrder >= minOrder && studentOrder <= maxOrder;
  }

  if (batch.classLevel) {
    return String(batch.classLevel).toLowerCase() === String(studentLevel).toLowerCase();
  }

  return true;
}
