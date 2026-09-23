// Elite modifier implementation registry: EliteModDef.id -> EliteModImpl.
import type { EliteModImpl } from '../api';

const mods = new Map<string, EliteModImpl>();

export function registerEliteMods(map: Record<string, EliteModImpl>): void {
  for (const [id, m] of Object.entries(map)) mods.set(id, m);
}

export function getEliteModImpl(id: string): EliteModImpl | undefined {
  return mods.get(id);
}
