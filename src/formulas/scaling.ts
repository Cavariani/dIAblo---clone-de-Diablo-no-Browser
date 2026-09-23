// Level scaling curves (pure). Tuned for a level-50 game (see docs/research/diablo-mechanics.md §12).
import type { MonsterRank } from '../data/schema';

/** Base life of a 1.0x monster at `level`. ~10% growth per level: L1 ≈ 30, L50 ≈ 3200. */
export const monsterLife = (level: number): number => 30 * Math.pow(1.1, Math.max(0, level - 1));

/** Base damage of a 1.0x monster hit at `level`. L1 ≈ 4, L50 ≈ 220. */
export const monsterDamage = (level: number): number => 4 * Math.pow(1.085, Math.max(0, level - 1));

/** Item power scale for weapon damage and armor at item level `ilvl` (1 at ilvl 1, ~50x at 50). */
export const itemScale = (ilvl: number): number => Math.pow(1.083, Math.max(0, ilvl - 1));

export const RANK_LIFE: Record<MonsterRank, number> = {
  normal: 1,
  minion: 1.4,
  champion: 3,
  rare: 5,
  unique: 8,
  boss: 1,
  guardian: 1,
};

export const RANK_DAMAGE: Record<MonsterRank, number> = {
  normal: 1,
  minion: 1.1,
  champion: 1.35,
  rare: 1.5,
  unique: 1.8,
  boss: 1,
  guardian: 1,
};

export const RANK_XP: Record<MonsterRank, number> = {
  normal: 1,
  minion: 1.5,
  champion: 4,
  rare: 6,
  unique: 10,
  boss: 30,
  guardian: 40,
};

/** Player life: class base + per level + vitality (vit worth more at higher level). */
export const playerLife = (baseLife: number, lifePerLevel: number, level: number, vit: number): number =>
  baseLife + lifePerLevel * (level - 1) + vit * (4 + level * 0.3);

/** Expected monster level from area level + difficulty rules. */
export const monsterLevel = (areaLevel: number, playerLevel: number, levelOffset: number, scaleToPlayer: boolean): number =>
  Math.max(1, scaleToPlayer ? Math.max(areaLevel + levelOffset, playerLevel) : areaLevel + levelOffset);
