// Temporary player buffs that modify stats (war cry, wrath, shrines...). Expire automatically.
import type { PartialStats } from '../../data/schema';
import type { GameCtx, System } from '../api';
import { registerSystem } from '../hooks';
import { addStats, registerStatContributor } from '../stats/aggregate';

interface Buff {
  id: string;
  name: string;
  stats: PartialStats;
  until: number;
  duration: number;
}

const buffs = new Map<string, Buff>();
let clock = 0;

export function addBuff(ctx: GameCtx, id: string, name: string, stats: PartialStats, duration: number): void {
  buffs.set(id, { id, name, stats, until: ctx.time + duration, duration });
  ctx.refreshPlayerStats();
}

export function hasBuff(id: string): boolean {
  return buffs.has(id);
}

export function removeBuff(ctx: GameCtx, id: string): void {
  if (buffs.delete(id)) ctx.refreshPlayerStats();
}

export function activeBuffs(): Buff[] {
  return [...buffs.values()];
}

export function clearBuffs(): void {
  buffs.clear();
}

registerStatContributor((_c, s) => {
  for (const b of buffs.values()) addStats(s, b.stats);
});

class BuffSystem implements System {
  readonly name = 'buffs';
  update(ctx: GameCtx): void {
    clock = ctx.time;
    let changed = false;
    for (const [id, b] of buffs) {
      if (clock >= b.until) {
        buffs.delete(id);
        changed = true;
      }
    }
    if (changed) ctx.refreshPlayerStats();
  }
}

registerSystem(75, () => new BuffSystem());
