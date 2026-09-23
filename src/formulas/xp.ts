// XP curve & monster XP (pure).

/**
 * XP needed to go from level L to L+1. Early levels are quick (level 2 ≈ 7 normal kills,
 * level 5-6 around the first boss), level 50 takes several hours.
 */
export const xpToNext = (level: number): number => Math.round(70 * Math.pow(level, 1.9) + 60 * level);

export const buildXpTable = (maxLevel: number): number[] => Array.from({ length: maxLevel - 1 }, (_, i) => xpToNext(i + 1));

/** Paragon level XP (flat-ish growth). */
export const paragonXp = (paragonLevel: number, base: number, growth: number): number => Math.round(base * (1 + growth * paragonLevel));

/** D2-like level-difference modifier: monsters far below the player give much less XP. */
export const levelDiffMult = (monsterLevel: number, playerLevel: number): number => {
  const diff = monsterLevel - playerLevel;
  if (diff >= 0) return Math.min(1.25, 1 + diff * 0.05);
  if (diff >= -5) return 1 + diff * 0.08; // -40% at -5
  return Math.max(0.05, 0.6 * Math.pow(0.8, -diff - 5));
};
