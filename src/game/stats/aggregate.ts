// Final player stats: class base + level + gear + paragon + passives + power hooks.
import { Data } from '../../data';
import { STAT_KEYS, type PartialStats, type StatBlock } from '../../data/schema';
import { playerLife } from '../../formulas/scaling';
import type { CharacterState, ItemInstance } from '../types';

export const emptyStats = (): StatBlock => {
  const s = {} as StatBlock;
  for (const k of STAT_KEYS) s[k] = 0;
  return s;
};

export const addStats = (into: StatBlock, add: PartialStats, mult = 1): StatBlock => {
  for (const k in add) {
    const v = add[k as keyof PartialStats];
    if (v) into[k as keyof StatBlock] += v * mult;
  }
  return into;
};

export interface WeaponInfo {
  min: number;
  max: number;
  aps: number;
  /** Melee reach in tiles. */
  range: number;
  ranged: boolean;
}

export interface DerivedPlayer {
  stats: StatBlock;
  maxLife: number;
  maxResource: number;
  weapon: WeaponInfo;
  mainStat: number;
}

/** Stats contributed by a single item (implicits + affixes). */
export function itemStats(item: ItemInstance, into: StatBlock = emptyStats()): StatBlock {
  for (const a of [...item.implicits, ...item.affixes]) {
    const stat = a.id.startsWith('implicit:') ? a.id.slice(9) : Data.tryAffix(a.id)?.stat;
    if (!stat || stat === 'skillRank' || stat === 'skillDamage') continue;
    if (stat in into) into[stat as keyof StatBlock] += a.value;
  }
  if (item.armor) into.armor += item.armor;
  return into;
}

/** Extra stat providers (passives, paragon, set bonuses, powers, buffs) register here. */
export type StatContributor = (c: CharacterState, s: StatBlock) => void;
const contributors: StatContributor[] = [];
export const registerStatContributor = (fn: StatContributor): void => {
  contributors.push(fn);
};

export function computePlayerStats(c: CharacterState, extra: PartialStats[] = []): DerivedPlayer {
  const cls = Data.classDef(c.classId);
  const s = emptyStats();
  const lvl = c.level - 1;
  s.str = cls.baseAttributes.str + cls.attributesPerLevel.str * lvl;
  s.dex = cls.baseAttributes.dex + cls.attributesPerLevel.dex * lvl;
  s.int = cls.baseAttributes.int + cls.attributesPerLevel.int * lvl;
  s.vit = cls.baseAttributes.vit + cls.attributesPerLevel.vit * lvl;
  s.critChance = 0.05;
  s.critDamage = 0.5;
  s.pickupRadius = 1.2;

  for (const item of Object.values(c.equipment)) if (item) itemStats(item, s);
  for (const fn of contributors) fn(c, s);
  for (const e of extra) addStats(s, e);

  // attribute side effects (D3-like): STR -> armor, INT -> resist, DEX -> dodge
  s.armor += s.str * 1;
  s.allRes += s.int * 0.1;
  s.dodgeChance += Math.min(0.2, s.dex * 0.0008);
  s.armor *= 1 + s.armorPct;

  const mainStat = s[cls.mainStat];
  const maxLife = Math.round(playerLife(cls.baseLife, cls.lifePerLevel, c.level, s.vit) * (1 + s.lifePct) + s.maxLife);
  const maxResource = Math.round(cls.resource.baseMax + s.maxResource);

  const w = c.equipment.mainhand;
  const base = w ? Data.tryItemBase(w.baseId) : undefined;
  let weapon: WeaponInfo;
  if (w && w.damage) {
    const ranged = base?.weaponType === 'bow' || base?.weaponType === 'greatbow' || base?.weaponType === 'slingshot';
    const wt = base?.weaponType;
    weapon = {
      min: w.damage[0] + s.minDamage,
      max: w.damage[1] + s.maxDamage,
      aps: (w.attacksPerSecond ?? 1.2) * (1 + s.attackSpeed),
      range: ranged ? 8 : wt === 'staff' || wt === 'greatsword' || wt === 'greataxe' || wt === 'maul' ? 1.05 : 0.9,
      ranged,
    };
  } else {
    // bare hands (or a bow in the offhand layer — Flare draws bows as offhand)
    weapon = { min: 2 + s.minDamage, max: 4 + s.maxDamage, aps: 1.3 * (1 + s.attackSpeed), range: 0.85, ranged: false };
  }
  return { stats: s, maxLife, maxResource, weapon, mainStat };
}
