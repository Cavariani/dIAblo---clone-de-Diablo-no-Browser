// Stalker passives: stat nodes unlocked by points spent in the class tree (ClassDef.treeTiers).
import type { PassiveDef } from '../schema';

const P = (id: string, name: string, description: string, icon: number, tier: number, maxRank: number, statsPerRank: PassiveDef['statsPerRank']): PassiveDef => ({ id: `stalker.${id}`, classId: 'stalker', name, description, icon, tier, maxRank, statsPerRank });

export const STALKER_PASSIVES: PassiveDef[] = [
  P('hunters_eye', 'Olho do Caçador', '+{v} de Chance Crítica.', 16, 0, 5, { critChance: 0.012 }),
  P('fleet_foot', 'Pés Ligeiros', '+{v} de Velocidade de Movimento e +{v2} de Esquiva.', 9, 1, 5, { moveSpeed: 0.02, dodgeChance: 0.012 }),
  P('steady_aim', 'Mira Firme', '+{v} de Dano.', 41, 1, 5, { damagePct: 0.05 }),
  P('evasion', 'Evasão', '-{v} de dano à distância recebido e +{v2} de Vida máxima.', 13, 2, 5, { rangedDamageReduction: 0.03, lifePct: 0.03 }),
  P('quick_draw', 'Saque Rápido', '+{v} de Velocidade de Ataque.', 23, 2, 5, { attackSpeed: 0.035 }),
  P('predator', 'Predador', '+{v} de Dano Crítico e +{v2} de Energia por segundo.', 27, 3, 5, { critDamage: 0.08, resourceRegen: 0.6 }),
  P('apex', 'Ápice', '+{v} de dano contra Elites e +{v2} de Chance Crítica.', 8, 4, 3, { eliteDamage: 0.08, critChance: 0.015 }),
];
