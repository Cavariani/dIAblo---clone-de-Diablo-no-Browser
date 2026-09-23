// The player's currently active power hooks (legendaries, set bonuses, passives, shrines).
// Recomputed by the game whenever gear / skills change (see refreshActivePowers).
import type { PowerHooks } from '../../api';
import { getPower } from './registry';

export interface ActivePower {
  id: string;
  value: number;
  hooks: PowerHooks;
  /** Source label for tooltips/debug. */
  source: string;
}

let current: ActivePower[] = [];

export const activePowers = (): readonly ActivePower[] => current;

export function setActivePowers(list: { id: string; value: number; source: string }[]): void {
  const out: ActivePower[] = [];
  for (const p of list) {
    const hooks = getPower(p.id);
    if (hooks) out.push({ ...p, hooks });
  }
  current = out;
}

/** Temporary powers (e.g. shrine buffs) are appended and removed by id. */
export function addTempPower(id: string, value: number, source: string): void {
  const hooks = getPower(id);
  if (hooks && !current.some((p) => p.id === id && p.source === source)) current = [...current, { id, value, hooks, source }];
}

export function removeTempPower(id: string, source: string): void {
  current = current.filter((p) => !(p.id === id && p.source === source));
}
