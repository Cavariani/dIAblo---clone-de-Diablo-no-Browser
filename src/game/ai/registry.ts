// AI behaviour registry: EnemyDef.ai -> AIBehavior.
import type { AIBehavior } from '../api';

const behaviors = new Map<string, AIBehavior>();

export function registerBehaviors(map: Record<string, AIBehavior>): void {
  for (const [id, b] of Object.entries(map)) behaviors.set(id, b);
}

export function getBehavior(id: string): AIBehavior | undefined {
  return behaviors.get(id);
}

export function registeredBehaviorIds(): string[] {
  return [...behaviors.keys()];
}
