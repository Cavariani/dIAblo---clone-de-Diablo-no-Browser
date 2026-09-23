// Affix value ranges & rolls (pure).
import type { AffixDef } from '../data/schema';

const PCT = new Set(['pct', 'pct1']);

/** [min, max] value range of an affix at item level. */
export function affixRange(def: Pick<AffixDef, 'base' | 'perLevel' | 'format'>, ilvl: number): [number, number] {
  const k = Math.max(0, ilvl - 1);
  const lo = def.base[0] + def.perLevel[0] * k;
  const hi = def.base[1] + def.perLevel[1] * k;
  return [roundFor(def.format, lo), roundFor(def.format, Math.max(lo, hi))];
}

export function roundFor(format: AffixDef['format'], v: number): number {
  if (format === 'int') return Math.max(1, Math.round(v));
  if (format === 'dec1') return Math.round(v * 10) / 10;
  if (PCT.has(format)) return Math.round(v * 1000) / 1000; // 0.1% precision
  return v;
}

/** Rolls inside [min, max]; ancestral items roll at the top 30% and get +30%. */
export function rollAffixValue(def: Pick<AffixDef, 'base' | 'perLevel' | 'format'>, ilvl: number, r: number, ancestral = false): { value: number; min: number; max: number } {
  let [min, max] = affixRange(def, ilvl);
  if (ancestral) {
    min = roundFor(def.format, min * 1.3);
    max = roundFor(def.format, max * 1.3);
    r = 0.7 + r * 0.3;
  }
  return { value: roundFor(def.format, min + (max - min) * r), min, max };
}

/** Required level for an item level. */
export const requiredLevel = (ilvl: number): number => Math.max(1, Math.min(50, ilvl - Math.floor(ilvl / 10)));

/** Magic find with diminishing returns (D2-like): effective = MF*200/(MF+200) using percent points. */
export const effectiveMagicFind = (mf: number): number => {
  const p = mf * 100;
  return (p * 200) / (p + 200) / 100;
};
