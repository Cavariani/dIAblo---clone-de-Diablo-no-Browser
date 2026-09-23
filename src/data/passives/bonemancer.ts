// Bonemancer passives: stat nodes unlocked by points spent in the class tree (ClassDef.treeTiers).
import type { PassiveDef } from '../schema';

const P = (id: string, name: string, description: string, icon: number, tier: number, maxRank: number, statsPerRank: PassiveDef['statsPerRank']): PassiveDef => ({ id: `bonemancer.${id}`, classId: 'bonemancer', name, description, icon, tier, maxRank, statsPerRank });

export const BONEMANCER_PASSIVES: PassiveDef[] = [
  P('grave_bond', 'Laço Sepulcral', '+{v} de dano e +{v2} de vida dos lacaios.', 12, 0, 5, { summonDamage: 0.08, summonLife: 0.08 }),
  P('bone_armor', 'Armadura de Ossos', '+{v} de Armadura.', 4, 1, 5, { armorPct: 0.06 }),
  P('soul_harvest', 'Colheita de Almas', '+{v} de Vida por abate e +{v2} de Essência por acerto.', 25, 1, 5, { lifePerKill: 6, resourceOnHit: 0.6 }),
  P('necrotic_will', 'Vontade Necrótica', '+{v} de Dano.', 27, 2, 5, { damagePct: 0.05 }),
  P('death_ward', 'Égide da Morte', '-{v} de todo dano recebido.', 11, 2, 5, { damageReduction: 0.025 }),
  P('plaguebearer', 'Portador da Praga', '+{v} de dano Venenoso e +{v2} de dano em área.', 42, 3, 5, { dmgPoison: 0.06, areaDamage: 0.05 }),
  P('lord_of_bones', 'Senhor dos Ossos', '+{v} de dano dos lacaios e -{v2} de tempo de recarga.', 38, 4, 3, { summonDamage: 0.15, cooldownReduction: 0.04 }),
];
