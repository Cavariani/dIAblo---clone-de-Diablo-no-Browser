// Traps and shrines.
import type { ShrineDef, TrapDef } from './schema';

export const TRAPS: TrapDef[] = [];

export const SHRINES: ShrineDef[] = [
  { id: 'fury', name: 'Santuário da Fúria', description: '+30% de dano por 60s', duration: 60, stats: { damagePct: 0.3 }, color: 0xff5020, weight: 10 },
  { id: 'protection', name: 'Santuário da Proteção', description: '-25% de dano recebido por 60s', duration: 60, stats: { damageReduction: 0.25 }, color: 0x60a0ff, weight: 10 },
  { id: 'fortune', name: 'Santuário da Fortuna', description: '+50% de ouro e itens mágicos por 120s', duration: 120, stats: { goldFind: 0.5, magicFind: 0.5 }, color: 0xffd84a, weight: 8 },
  { id: 'swiftness', name: 'Santuário da Celeridade', description: '+25% de movimento e ataque por 60s', duration: 60, stats: { moveSpeed: 0.25, attackSpeed: 0.25 }, color: 0x80ff90, weight: 10 },
  { id: 'enlightenment', name: 'Santuário da Iluminação', description: '+40% de experiência por 120s', duration: 120, stats: { xpBonus: 0.4 }, color: 0xd0a0ff, weight: 8 },
  { id: 'frenzy', name: 'Santuário do Frenesi', description: '+20% de chance crítica por 45s', duration: 45, stats: { critChance: 0.2 }, color: 0xff8080, weight: 7 },
];
