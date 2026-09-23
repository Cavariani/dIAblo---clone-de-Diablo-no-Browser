// Difficulty tiers (docs/research/diablo-mechanics.md §12: ~x1.7 life and x1.45 damage per step).
import type { DifficultyDef } from './schema';

export const DIFFICULTIES: DifficultyDef[] = [
  { id: 'normal', name: 'Normal', order: 0, requiredLevel: 1, lifeMult: 1, damageMult: 1, xpBonus: 0, goldBonus: 0, magicFindBonus: 0, legendaryChanceMult: 1, levelOffset: 0, scaleToPlayer: false, color: 0xc8c4bc },
  { id: 'nightmare', name: 'Pesadelo', order: 1, requiredLevel: 1, lifeMult: 1.7, damageMult: 1.45, xpBonus: 0.5, goldBonus: 0.5, magicFindBonus: 0.25, legendaryChanceMult: 1.3, levelOffset: 2, scaleToPlayer: true, color: 0xb070ff },
  { id: 'torment1', name: 'Tormento I', order: 2, requiredLevel: 30, lifeMult: 2.9, damageMult: 2.1, xpBonus: 1.2, goldBonus: 1, magicFindBonus: 0.5, legendaryChanceMult: 1.8, levelOffset: 3, scaleToPlayer: true, color: 0xff6a3a },
  { id: 'torment2', name: 'Tormento II', order: 3, requiredLevel: 35, lifeMult: 4.9, damageMult: 3.05, xpBonus: 2, goldBonus: 1.5, magicFindBonus: 0.75, legendaryChanceMult: 2.4, levelOffset: 3, scaleToPlayer: true, color: 0xff4a2a },
  { id: 'torment3', name: 'Tormento III', order: 4, requiredLevel: 40, lifeMult: 8.4, damageMult: 4.4, xpBonus: 3, goldBonus: 2, magicFindBonus: 1, legendaryChanceMult: 3.2, levelOffset: 4, scaleToPlayer: true, color: 0xff2a1a },
  { id: 'torment4', name: 'Tormento IV', order: 5, requiredLevel: 45, lifeMult: 14.2, damageMult: 6.4, xpBonus: 4.5, goldBonus: 2.5, magicFindBonus: 1.5, legendaryChanceMult: 4.2, levelOffset: 4, scaleToPlayer: true, color: 0xe01010 },
  { id: 'torment5', name: 'Tormento V', order: 6, requiredLevel: 50, lifeMult: 24, damageMult: 9, xpBonus: 6.5, goldBonus: 3, magicFindBonus: 2, legendaryChanceMult: 5.5, levelOffset: 5, scaleToPlayer: true, color: 0xb00000 },
];
