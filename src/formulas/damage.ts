// Damage & mitigation formulas (pure, D3-style). Percentages are fractions.

/** Outgoing skill damage before target mitigation. */
export function skillDamage(opts: {
  weaponMin: number;
  weaponMax: number;
  coefficient: number;
  mainStat: number;
  elementalBonus: number;
  damageBonus: number;
  skillBonus?: number;
  roll: number; // 0..1
}): number {
  const weapon = opts.weaponMin + (opts.weaponMax - opts.weaponMin) * opts.roll;
  return weapon * opts.coefficient * (1 + opts.mainStat / 100) * (1 + opts.elementalBonus + opts.damageBonus) * (1 + (opts.skillBonus ?? 0));
}

/** Armor damage reduction vs an attacker of `attackerLevel` (D3: armor / (armor + 50 * level)), capped 75%. */
export const armorReduction = (armor: number, attackerLevel: number): number =>
  Math.min(0.75, Math.max(0, armor) / (Math.max(0, armor) + 50 * Math.max(1, attackerLevel)));

/** Resistance damage reduction (D3: res / (res + 5 * level)), capped 75%. */
export const resistReduction = (res: number, attackerLevel: number): number =>
  Math.min(0.75, Math.max(0, res) / (Math.max(0, res) + 5 * Math.max(1, attackerLevel)));

export const critMultiplier = (critDamage: number): number => 1 + Math.max(0, critDamage);

/** Full incoming mitigation multiplier (0..1). */
export function mitigation(opts: {
  armor: number;
  resist: number;
  attackerLevel: number;
  damageReduction?: number;
  extra?: number;
  isDot?: boolean;
}): number {
  const a = opts.isDot ? 0 : armorReduction(opts.armor, opts.attackerLevel);
  const r = resistReduction(opts.resist, opts.attackerLevel);
  return (1 - a) * (1 - r) * (1 - Math.min(0.8, opts.damageReduction ?? 0)) * (1 - Math.min(0.8, opts.extra ?? 0));
}

/** Multiplicative cooldown reduction stacking, capped 60%. */
export const cooldownAfterCdr = (base: number, cdr: number): number => base * (1 - Math.min(0.6, Math.max(0, cdr)));
