// Arcanist passives: stat nodes unlocked by points spent in the class tree (ClassDef.treeTiers).
import type { PassiveDef } from '../schema';

const P = (id: string, name: string, description: string, icon: number, tier: number, maxRank: number, statsPerRank: PassiveDef['statsPerRank']): PassiveDef => ({ id: `arcanist.${id}`, classId: 'arcanist', name, description, icon, tier, maxRank, statsPerRank });

export const ARCANIST_PASSIVES: PassiveDef[] = [
  P('arcane_flow', 'Fluxo Arcano', '+{v} de Mana por segundo.', 15, 0, 5, { resourceRegen: 0.8 }),
  P('glass_cannon', 'Canhão de Vidro', '+{v} de Dano.', 45, 1, 5, { damagePct: 0.05 }),
  P('elemental_attunement', 'Sintonia Elemental', '+{v} de dano de Fogo, Gelo e Raio.', 36, 1, 5, { dmgFire: 0.04, dmgCold: 0.04, dmgLightning: 0.04 }),
  P('mana_shield', 'Escudo de Mana', '-{v} de todo dano recebido e +{v2} de Mana máxima.', 17, 2, 5, { damageReduction: 0.025, maxResource: 6 }),
  P('temporal_flux', 'Fluxo Temporal', '-{v} de tempo de recarga.', 26, 2, 5, { cooldownReduction: 0.03 }),
  P('prodigy', 'Prodígio', '+{v} de Chance Crítica e +{v2} de Dano Crítico.', 2, 3, 5, { critChance: 0.012, critDamage: 0.07 }),
  P('archmage', 'Arquimago', '-{v} de custo de recurso e +{v2} de dano em área.', 46, 4, 3, { resourceCostReduction: 0.06, areaDamage: 0.08 }),
];
