// Power registry: LegendaryDef.powerId / SetDef bonus powerId / PassiveDef.powerId / ShrineDef.powerId -> PowerHooks.
import type { PowerHooks } from '../../api';

const powers = new Map<string, PowerHooks>();

export function registerPowers(map: Record<string, PowerHooks>): void {
  for (const [id, p] of Object.entries(map)) powers.set(id, p);
}

export function getPower(id: string): PowerHooks | undefined {
  return powers.get(id);
}

export function registeredPowerIds(): string[] {
  return [...powers.keys()];
}
