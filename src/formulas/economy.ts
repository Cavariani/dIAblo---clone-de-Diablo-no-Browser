// Prices and crafting costs (pure).
import type { Rarity } from '../data/schema';

const RARITY_MULT: Record<Rarity, number> = { common: 1, magic: 2.2, rare: 4.5, legendary: 10, set: 10 };

export const sellPrice = (ilvl: number, rarity: Rarity): number => Math.max(1, Math.round((3 + ilvl * 2.2) * RARITY_MULT[rarity]));
export const buyPrice = (ilvl: number, rarity: Rarity): number => Math.round(sellPrice(ilvl, rarity) * 5 + 20);
/** Blacksmith enchant (reroll one affix): cost grows with each reroll of that item. */
export const rerollCost = (ilvl: number, rerolls: number): { gold: number; dust: number; crystal: number } => ({
  gold: Math.round((50 + ilvl * 25) * Math.pow(1.35, rerolls)),
  dust: 2 + Math.floor(rerolls / 2),
  crystal: ilvl >= 20 ? 1 : 0,
});
/** Blacksmith upgrade (temper): +10% to one affix per level, max 5. */
export const upgradeCost = (ilvl: number, level: number): { gold: number; scrap: number; crystal: number; soul: number } => ({
  gold: Math.round((120 + ilvl * 40) * (level + 1)),
  scrap: 4 + level * 2,
  crystal: level >= 2 ? level - 1 : 0,
  soul: level >= 4 ? 1 : 0,
});
export const potionPrice = (level: number): number => 15 + level * 3;
