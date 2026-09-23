// Random affixes. Value range = base + perLevel * (ilvl - 1). Fractions for % stats.
import type { AffixDef, ClassId, ItemSlotType, StatKey } from '../schema';

type Slots = ItemSlotType[] | 'all';
const ARMOR: ItemSlotType[] = ['head', 'chest', 'hands', 'legs', 'feet', 'belt'];
const JEWEL: ItemSlotType[] = ['ring', 'amulet'];
const WEAPON: ItemSlotType[] = ['mainhand'];
const OFF: ItemSlotType[] = ['offhand'];

function a(
  id: string,
  kind: 'prefix' | 'suffix',
  stat: StatKey,
  text: string,
  format: AffixDef['format'],
  base: [number, number],
  perLevel: [number, number],
  slots: Slots,
  magicName: string,
  tag: AffixDef['tag'],
  o: Partial<AffixDef> = {},
): AffixDef {
  return { id, kind, group: o.group ?? stat, stat, text, format, base, perLevel, slots, weight: o.weight ?? 10, minLevel: o.minLevel ?? 1, magicName, tag, ...o };
}

const skillRank = (classId: ClassId, name: string): AffixDef => ({
  id: `rank_${classId}`,
  kind: 'suffix',
  group: 'skillRank',
  stat: 'skillRank',
  classId,
  text: '+{v} Graduação em {skill}',
  format: 'int',
  base: [1, 1],
  perLevel: [0.02, 0.04],
  slots: ['amulet', 'head', 'mainhand', 'offhand', 'chest'],
  weight: 4,
  minLevel: 10,
  magicName: name,
  tag: 'offense',
});

const skillDmg = (classId: ClassId): AffixDef => ({
  id: `skilldmg_${classId}`,
  kind: 'prefix',
  group: 'skillDamage',
  stat: 'skillDamage',
  classId,
  text: '+{v} de Dano de {skill}',
  format: 'pct',
  base: [0.08, 0.12],
  perLevel: [0.002, 0.003],
  slots: ['head', 'chest', 'hands', 'legs', 'feet', 'amulet', 'ring'],
  weight: 5,
  minLevel: 5,
  magicName: 'Devoto',
  tag: 'offense',
});

export const AFFIXES: AffixDef[] = [
  // ------------------------------------------------ primary attributes
  a('str', 'prefix', 'str', '+{v} de Força', 'int', [2, 4], [0.9, 1.6], 'all', 'Robusto', 'primary', { weight: 14 }),
  a('dex', 'prefix', 'dex', '+{v} de Destreza', 'int', [2, 4], [0.9, 1.6], 'all', 'Ágil', 'primary', { weight: 14 }),
  a('int', 'prefix', 'int', '+{v} de Inteligência', 'int', [2, 4], [0.9, 1.6], 'all', 'Sábio', 'primary', { weight: 14 }),
  a('vit', 'suffix', 'vit', '+{v} de Vitalidade', 'int', [2, 4], [0.9, 1.6], 'all', 'do Urso', 'primary', { weight: 14 }),
  // ------------------------------------------------ life
  a('lifePct', 'suffix', 'lifePct', '+{v} de Vida', 'pct', [0.03, 0.06], [0.0015, 0.0025], [...ARMOR, 'amulet', 'offhand'], 'da Baleia', 'defense'),
  a('maxLife', 'suffix', 'maxLife', '+{v} de Vida', 'int', [5, 10], [3, 6], [...ARMOR, ...JEWEL], 'do Colosso', 'defense'),
  a('lifeRegen', 'suffix', 'lifeRegen', '+{v} de Regeneração de Vida por segundo', 'dec1', [0.5, 1.2], [0.4, 0.8], [...ARMOR, ...JEWEL], 'da Regeneração', 'defense'),
  a('lifeOnHit', 'suffix', 'lifeOnHit', '+{v} de Vida por Acerto', 'int', [1, 3], [0.6, 1.2], [...WEAPON, ...JEWEL, 'hands'], 'do Vampiro', 'defense'),
  a('lifePerKill', 'suffix', 'lifePerKill', '+{v} de Vida por Abate', 'int', [3, 6], [2, 4], [...WEAPON, 'belt', 'ring'], 'da Colheita', 'defense'),
  a('lifeSteal', 'suffix', 'lifeSteal', '{v} do Dano causado é convertido em Vida', 'pct1', [0.01, 0.02], [0.0001, 0.0003], WEAPON, 'da Sanguessuga', 'defense', { minLevel: 12, weight: 5 }),
  // ------------------------------------------------ defense
  a('armor', 'prefix', 'armor', '+{v} de Armadura', 'int', [5, 12], [3, 7], [...ARMOR, 'offhand'], 'Reforçado', 'defense'),
  a('allRes', 'suffix', 'allRes', '+{v} de Resistência a Todos os Elementos', 'int', [2, 5], [1, 2], [...ARMOR, ...JEWEL, 'offhand'], 'do Prisma', 'defense', { weight: 8 }),
  a('resFire', 'suffix', 'resFire', '+{v} de Resistência a Fogo', 'int', [4, 8], [1.5, 3], [...ARMOR, ...JEWEL], 'da Salamandra', 'defense', { group: 'res1' }),
  a('resCold', 'suffix', 'resCold', '+{v} de Resistência a Frio', 'int', [4, 8], [1.5, 3], [...ARMOR, ...JEWEL], 'do Inverno', 'defense', { group: 'res2' }),
  a('resLightning', 'suffix', 'resLightning', '+{v} de Resistência a Raio', 'int', [4, 8], [1.5, 3], [...ARMOR, ...JEWEL], 'da Tempestade', 'defense', { group: 'res3' }),
  a('resPoison', 'suffix', 'resPoison', '+{v} de Resistência a Veneno', 'int', [4, 8], [1.5, 3], [...ARMOR, ...JEWEL], 'da Serpente', 'defense', { group: 'res4' }),
  a('blockChance', 'suffix', 'blockChance', '+{v} de Chance de Bloqueio', 'pct', [0.03, 0.06], [0.0003, 0.0006], OFF, 'da Muralha', 'defense'),
  a('dodgeChance', 'suffix', 'dodgeChance', '+{v} de Chance de Esquiva', 'pct', [0.02, 0.04], [0.0002, 0.0005], ['feet', 'legs', 'hands'], 'da Sombra', 'defense', { weight: 6 }),
  a('thorns', 'suffix', 'thorns', 'Atacantes corpo a corpo sofrem {v} de dano', 'int', [3, 8], [2, 5], ['chest', 'offhand', 'belt'], 'dos Espinhos', 'defense', { weight: 6 }),
  a('eliteDR', 'suffix', 'eliteDamageReduction', 'Reduz em {v} o dano recebido de Elites', 'pct', [0.04, 0.07], [0.0006, 0.001], ['chest', 'amulet', 'offhand'], 'do Desafiante', 'defense', { minLevel: 15, weight: 5 }),
  a('ccReduction', 'suffix', 'ccReduction', 'Reduz em {v} a duração de efeitos de controle', 'pct', [0.08, 0.14], [0.001, 0.002], ['head', 'amulet', 'belt'], 'da Vontade', 'defense', { weight: 5 }),
  // ------------------------------------------------ offense
  a('critChance', 'prefix', 'critChance', '+{v} de Chance de Acerto Crítico', 'pct1', [0.01, 0.02], [0.0006, 0.0012], ['head', 'hands', 'ring', 'amulet', 'offhand'], 'Preciso', 'offense'),
  a('critDamage', 'prefix', 'critDamage', '+{v} de Dano Crítico', 'pct', [0.08, 0.15], [0.005, 0.009], ['hands', 'ring', 'amulet', 'mainhand'], 'Cruel', 'offense'),
  a('attackSpeed', 'prefix', 'attackSpeed', '+{v} de Velocidade de Ataque', 'pct', [0.03, 0.05], [0.0005, 0.0008], ['hands', 'ring', 'amulet', 'mainhand'], 'Veloz', 'offense'),
  a('cdr', 'prefix', 'cooldownReduction', 'Reduz em {v} as recargas', 'pct', [0.03, 0.05], [0.0006, 0.0009], ['head', 'hands', 'ring', 'amulet', 'offhand', 'mainhand'], 'Incansável', 'offense', { minLevel: 6 }),
  a('damagePct', 'prefix', 'damagePct', '+{v} de Dano', 'pct', [0.04, 0.08], [0.0015, 0.0025], [...WEAPON, 'amulet', 'offhand'], 'Mortal', 'offense'),
  a('minDamage', 'prefix', 'minDamage', '+{v} de Dano Mínimo', 'int', [1, 2], [0.4, 0.8], [...WEAPON, ...JEWEL], 'Afiado', 'offense', { group: 'flatdmg' }),
  a('maxDamage', 'prefix', 'maxDamage', '+{v} de Dano Máximo', 'int', [2, 4], [0.8, 1.4], [...WEAPON, ...JEWEL], 'Brutal', 'offense', { group: 'flatdmg2' }),
  a('dmgFire', 'prefix', 'dmgFire', '+{v} de Dano de Fogo', 'pct', [0.06, 0.1], [0.002, 0.003], ['amulet', 'offhand', 'mainhand', 'hands'], 'Ardente', 'offense', { group: 'elem' }),
  a('dmgCold', 'prefix', 'dmgCold', '+{v} de Dano de Frio', 'pct', [0.06, 0.1], [0.002, 0.003], ['amulet', 'offhand', 'mainhand', 'hands'], 'Gélido', 'offense', { group: 'elem' }),
  a('dmgLightning', 'prefix', 'dmgLightning', '+{v} de Dano de Raio', 'pct', [0.06, 0.1], [0.002, 0.003], ['amulet', 'offhand', 'mainhand', 'hands'], 'Trovejante', 'offense', { group: 'elem' }),
  a('dmgPhysical', 'prefix', 'dmgPhysical', '+{v} de Dano Físico', 'pct', [0.06, 0.1], [0.002, 0.003], ['amulet', 'offhand', 'mainhand', 'hands'], 'Esmagador', 'offense', { group: 'elem' }),
  a('dmgPoison', 'prefix', 'dmgPoison', '+{v} de Dano de Veneno', 'pct', [0.06, 0.1], [0.002, 0.003], ['amulet', 'offhand', 'mainhand', 'hands'], 'Pestilento', 'offense', { group: 'elem' }),
  a('dmgArcane', 'prefix', 'dmgArcane', '+{v} de Dano Arcano', 'pct', [0.06, 0.1], [0.002, 0.003], ['amulet', 'offhand', 'mainhand', 'hands'], 'Místico', 'offense', { group: 'elem' }),
  a('eliteDamage', 'prefix', 'eliteDamage', '+{v} de Dano contra Elites', 'pct', [0.05, 0.08], [0.0015, 0.0025], ['ring', 'amulet', 'mainhand', 'offhand'], 'Caçador', 'offense', { minLevel: 10 }),
  a('areaDamage', 'prefix', 'areaDamage', '+{v} de Dano em Área', 'pct', [0.05, 0.1], [0.0015, 0.0025], ['head', 'chest', 'ring', 'amulet', 'mainhand'], 'Devastador', 'offense', { minLevel: 8, weight: 6 }),
  a('summonDamage', 'prefix', 'summonDamage', '+{v} de Dano de Lacaios', 'pct', [0.06, 0.1], [0.002, 0.003], ['amulet', 'hands', 'offhand', 'mainhand'], 'Senhorial', 'offense', { classId: 'bonemancer', weight: 5 }),
  // ------------------------------------------------ resource
  a('maxResource', 'suffix', 'maxResource', '+{v} de Recurso Máximo', 'int', [5, 10], [0.2, 0.4], ['chest', 'head', 'offhand', 'amulet', 'belt'], 'do Poço', 'utility'),
  a('resourceRegen', 'suffix', 'resourceRegen', '+{v} de Regeneração de Recurso por segundo', 'dec1', [0.5, 1], [0.03, 0.05], ['head', 'offhand', 'mainhand', 'amulet', 'ring'], 'da Fonte', 'utility'),
  a('resourceCost', 'suffix', 'resourceCostReduction', 'Reduz em {v} o custo de recursos', 'pct', [0.03, 0.06], [0.0006, 0.001], ['head', 'hands', 'ring', 'amulet', 'offhand'], 'da Frugalidade', 'utility', { minLevel: 8 }),
  a('resourceOnHit', 'suffix', 'resourceOnHit', '+{v} de Recurso por Acerto', 'dec1', [0.5, 1], [0.02, 0.04], ['mainhand', 'ring'], 'da Colheita Arcana', 'utility', { minLevel: 10, weight: 5 }),
  // ------------------------------------------------ utility
  a('moveSpeed', 'suffix', 'moveSpeed', '+{v} de Velocidade de Movimento', 'pct', [0.04, 0.08], [0.0005, 0.0009], ['feet'], 'do Guepardo', 'utility', { weight: 16 }),
  a('goldFind', 'suffix', 'goldFind', '+{v} de Ouro Encontrado', 'pct', [0.08, 0.15], [0.003, 0.005], ['ring', 'amulet', 'belt', 'head', 'hands'], 'da Ganância', 'utility'),
  a('magicFind', 'suffix', 'magicFind', '+{v} de Chance de Encontrar Itens Mágicos', 'pct', [0.05, 0.1], [0.002, 0.004], ['ring', 'amulet', 'belt', 'head', 'hands'], 'da Fortuna', 'utility'),
  a('pickupRadius', 'suffix', 'pickupRadius', '+{v} de Raio de Coleta de Ouro', 'dec1', [0.5, 1], [0.02, 0.04], ['belt', 'feet', 'ring'], 'do Ímã', 'utility', { weight: 6 }),
  a('xpBonus', 'suffix', 'xpBonus', '+{v} de Experiência', 'pct', [0.03, 0.06], [0.001, 0.002], ['ring', 'amulet', 'head'], 'do Estudioso', 'utility', { weight: 5 }),
  a('potionHeal', 'suffix', 'potionHeal', '+{v} de Cura de Poções', 'pct', [0.08, 0.15], [0.002, 0.004], ['belt', 'amulet'], 'do Boticário', 'utility'),
  // ------------------------------------------------ skills
  skillRank('berserker', 'do Berserker'),
  skillRank('arcanist', 'do Arcanista'),
  skillRank('stalker', 'do Espreitador'),
  skillRank('bonemancer', 'do Ossomante'),
  skillDmg('berserker'),
  skillDmg('arcanist'),
  skillDmg('stalker'),
  skillDmg('bonemancer'),
];
