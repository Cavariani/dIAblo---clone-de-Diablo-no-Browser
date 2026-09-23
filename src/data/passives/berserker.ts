// Berserker passives: stat nodes unlocked by points spent in the class tree (ClassDef.treeTiers).
import type { PassiveDef } from '../schema';

const P = (id: string, name: string, description: string, icon: number, tier: number, maxRank: number, statsPerRank: PassiveDef['statsPerRank']): PassiveDef => ({ id: `berserker.${id}`, classId: 'berserker', name, description, icon, tier, maxRank, statsPerRank });

export const BERSERKER_PASSIVES: PassiveDef[] = [
  P('iron_skin', 'Pele de Ferro', '+{v} de Armadura.', 4, 0, 5, { armorPct: 0.06 }),
  P('bloodlust', 'Sede de Sangue', '{v} do dano causado vira vida.', 38, 1, 5, { lifeSteal: 0.006 }),
  P('ruthless', 'Implacável', '+{v} de Chance Crítica e +{v2} de Dano Crítico.', 22, 1, 5, { critChance: 0.012, critDamage: 0.06 }),
  P('unstoppable', 'Inabalável', '-{v} de duração de controle e -{v2} de dano corpo a corpo recebido.', 13, 2, 5, { ccReduction: 0.06, meleeDamageReduction: 0.025 }),
  P('juggernaut', 'Colosso', '+{v} de Vida máxima.', 25, 2, 5, { lifePct: 0.05 }),
  P('rampage', 'Massacre', '+{v} de Velocidade de Ataque e +{v2} de Dano.', 44, 3, 5, { attackSpeed: 0.03, damagePct: 0.04 }),
  P('warlord', 'Senhor da Guerra', '+{v} de dano contra Elites e +{v2} contra Chefes.', 40, 4, 3, { eliteDamage: 0.08, bossDamage: 0.06 }),
];
