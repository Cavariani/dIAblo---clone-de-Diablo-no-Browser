// Drop profiles per monster rank. Rarity weights are adjusted by magic find and difficulty.
import type { DropProfileDef } from './schema';

export const DROP_PROFILES: DropProfileDef[] = [
  { rank: 'normal', itemRolls: 1, itemChance: 0.13, rarityWeights: { common: 45, magic: 42, rare: 11, legendary: 0.9, set: 0.35 }, goldChance: 0.32, goldMult: 1, potionChance: 0.035, globeChance: 0.1, materialChance: 0.01 },
  { rank: 'minion', itemRolls: 1, itemChance: 0.18, rarityWeights: { common: 40, magic: 44, rare: 14, legendary: 1.2, set: 0.5 }, goldChance: 0.4, goldMult: 1.2, potionChance: 0.05, globeChance: 0.18, materialChance: 0.02 },
  { rank: 'champion', itemRolls: 2, itemChance: 0.75, rarityWeights: { common: 18, magic: 52, rare: 26, legendary: 3, set: 1.2 }, goldChance: 1, goldMult: 3, potionChance: 0.2, globeChance: 0.6, materialChance: 0.08 },
  { rank: 'rare', itemRolls: 3, itemChance: 1, rarityWeights: { common: 5, magic: 40, rare: 48, legendary: 5, set: 2 }, goldChance: 1, goldMult: 5, potionChance: 0.35, globeChance: 1, materialChance: 0.15 },
  { rank: 'unique', itemRolls: 4, itemChance: 1, rarityWeights: { common: 0, magic: 30, rare: 55, legendary: 10, set: 4 }, goldChance: 1, goldMult: 8, potionChance: 0.5, globeChance: 1, materialChance: 0.3 },
  { rank: 'boss', itemRolls: 6, itemChance: 1, rarityWeights: { common: 0, magic: 25, rare: 58, legendary: 12, set: 5 }, goldChance: 1, goldMult: 20, potionChance: 1, globeChance: 1, materialChance: 1 },
  { rank: 'guardian', itemRolls: 7, itemChance: 1, rarityWeights: { common: 0, magic: 15, rare: 60, legendary: 18, set: 7 }, goldChance: 1, goldMult: 25, potionChance: 1, globeChance: 1, materialChance: 1 },
];
