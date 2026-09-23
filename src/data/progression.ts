// Level curve settings and Paragon board (D3-style: 4 categories, points per paragon level).
import type { ParagonNodeDef, ProgressionDef } from './schema';

export const PROGRESSION: ProgressionDef = { maxLevel: 50, xpTable: [], paragonXpBase: 0, paragonXpGrowth: 0, skillPointsPerLevel: 1, paragonPointsPerLevel: 1 };
const N = (id: string, category: ParagonNodeDef['category'], name: string, stat: ParagonNodeDef['stat'], perPoint: number, maxPoints: number, format: ParagonNodeDef['format']): ParagonNodeDef => ({ id, category, name, stat, perPoint, maxPoints, format });

export const PARAGON_NODES: ParagonNodeDef[] = [
  N('p_main', 'core', 'Atributo Principal', 'mainStat', 5, 0, 'int'),
  N('p_vit', 'core', 'Vitalidade', 'vit', 5, 0, 'int'),
  N('p_move', 'core', 'Velocidade de Movimento', 'moveSpeed', 0.005, 50, 'pct1'),
  N('p_res', 'core', 'Recurso Máximo', 'maxResource', 0.5, 50, 'dec1'),
  N('p_ias', 'offense', 'Velocidade de Ataque', 'attackSpeed', 0.002, 50, 'pct1'),
  N('p_cc', 'offense', 'Chance Crítica', 'critChance', 0.001, 50, 'pct1'),
  N('p_cd', 'offense', 'Dano Crítico', 'critDamage', 0.01, 50, 'pct'),
  N('p_cdr', 'offense', 'Redução de Recarga', 'cooldownReduction', 0.002, 50, 'pct1'),
  N('p_life', 'defense', 'Vida', 'lifePct', 0.005, 50, 'pct1'),
  N('p_armor', 'defense', 'Armadura', 'armor', 15, 50, 'int'),
  N('p_allres', 'defense', 'Resistência a Tudo', 'allRes', 5, 50, 'int'),
  N('p_regen', 'defense', 'Regeneração de Vida', 'lifeRegen', 6, 50, 'int'),
  N('p_area', 'utility', 'Dano em Área', 'areaDamage', 0.01, 50, 'pct'),
  N('p_rcr', 'utility', 'Redução de Custo', 'resourceCostReduction', 0.002, 50, 'pct1'),
  N('p_loh', 'utility', 'Vida por Acerto', 'lifeOnHit', 4, 50, 'int'),
  N('p_gold', 'utility', 'Ouro Encontrado', 'goldFind', 0.01, 50, 'pct'),
];
