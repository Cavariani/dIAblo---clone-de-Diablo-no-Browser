// Passive tree + Paragon: rules (unlock tiers, point budgets) and their stat contribution.
import { Data } from '../../data';
import type { PassiveDef, StatKey } from '../../data/schema';
import { registerStatContributor } from '../stats/aggregate';
import type { CharacterState } from '../types';

/** Points spent in the class tree (active skills + passives), which gates passive tiers. */
export function treePointsSpent(c: CharacterState): number {
  let n = 0;
  for (const v of Object.values(c.skillRanks)) n += v;
  for (const v of Object.values(c.passiveRanks)) n += v;
  return n;
}

export function passiveTierReq(c: CharacterState, p: PassiveDef): number {
  return Data.classDef(c.classId).treeTiers[p.tier] ?? 0;
}

export function passiveUnlocked(c: CharacterState, p: PassiveDef): boolean {
  return treePointsSpent(c) >= passiveTierReq(c, p) && (p.requires ?? []).every((r) => (c.passiveRanks[r] ?? 0) > 0);
}

export function paragonPointsTotal(c: CharacterState): number {
  return c.paragonLevel * (Data.progression.paragonPointsPerLevel || 1);
}

export function paragonPointsSpent(c: CharacterState): number {
  return Object.values(c.paragonAlloc).reduce((a, b) => a + b, 0);
}

registerStatContributor((c, s) => {
  for (const [id, rank] of Object.entries(c.passiveRanks)) {
    const p = Data.passives.find((x) => x.id === id);
    if (!p?.statsPerRank || rank <= 0) continue;
    for (const [k, v] of Object.entries(p.statsPerRank)) s[k as StatKey] += (v ?? 0) * rank;
  }
  const main = Data.classDef(c.classId).mainStat;
  for (const [id, pts] of Object.entries(c.paragonAlloc)) {
    const n = Data.paragonNodes.find((x) => x.id === id);
    if (!n || pts <= 0) continue;
    const stat = n.stat === 'mainStat' ? main : n.stat;
    s[stat] += n.perPoint * pts;
  }
});
