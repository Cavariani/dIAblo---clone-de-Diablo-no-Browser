// Skill implementation registry: SkillDef.id -> SkillImpl.
import type { SkillImpl } from '../api';

const impls = new Map<string, SkillImpl>();

export function registerSkills(map: Record<string, SkillImpl>): void {
  for (const [id, impl] of Object.entries(map)) impls.set(id, impl);
}

export function getSkillImpl(id: string): SkillImpl | undefined {
  return impls.get(id);
}

export function registeredSkillIds(): string[] {
  return [...impls.keys()];
}
