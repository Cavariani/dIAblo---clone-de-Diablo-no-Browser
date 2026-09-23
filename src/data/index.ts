// Central content registry. All game code looks data up through here.
// Content agents fill the individual data modules; this file only indexes them.

import type {
  AffixDef,
  BiomeDef,
  BiomeId,
  BossDef,
  ClassDef,
  ClassId,
  DifficultyDef,
  DifficultyId,
  DropProfileDef,
  EliteModDef,
  EnemyDef,
  ItemBaseDef,
  LegendaryDef,
  MaterialDef,
  MonsterRank,
  NpcDef,
  ParagonNodeDef,
  PassiveDef,
  QuestDef,
  Rarity,
  RarityDef,
  SetDef,
  ShrineDef,
  SkillDef,
  TrapDef,
  ZoneDef,
  ConsumableDef,
  MaterialId,
} from './schema';
import { CLASSES } from './classes';
import { BERSERKER_SKILLS } from './skills/berserker';
import { ARCANIST_SKILLS } from './skills/arcanist';
import { STALKER_SKILLS } from './skills/stalker';
import { BONEMANCER_SKILLS } from './skills/bonemancer';
import { BERSERKER_PASSIVES } from './passives/berserker';
import { ARCANIST_PASSIVES } from './passives/arcanist';
import { STALKER_PASSIVES } from './passives/stalker';
import { BONEMANCER_PASSIVES } from './passives/bonemancer';
import { ENEMIES } from './enemies';
import { BOSSES } from './bosses';
import { ELITE_MODS } from './eliteMods';
import { ITEM_BASES } from './items/bases';
import { AFFIXES } from './items/affixes';
import { LEGENDARIES } from './items/legendaries';
import { SETS } from './items/sets';
import { RARITY_DEFS } from './items/rarities';
import { MATERIALS, CONSUMABLES } from './items/materials';
import { DROP_PROFILES } from './loot';
import { DIFFICULTIES } from './difficulties';
import { PROGRESSION, PARAGON_NODES } from './progression';
import { ZONES, BIOMES } from './zones';
import { TRAPS, SHRINES } from './worldObjects';
import { NPCS, QUESTS } from './npcs';
import { RIFT } from './rift';

const byId = <T extends { id: string }>(list: readonly T[]): Map<string, T> => new Map(list.map((x) => [x.id, x]));

export const SKILLS: SkillDef[] = [...BERSERKER_SKILLS, ...ARCANIST_SKILLS, ...STALKER_SKILLS, ...BONEMANCER_SKILLS];
export const PASSIVES: PassiveDef[] = [...BERSERKER_PASSIVES, ...ARCANIST_PASSIVES, ...STALKER_PASSIVES, ...BONEMANCER_PASSIVES];

const classMap = byId(CLASSES);
const skillMap = byId(SKILLS);
const passiveMap = byId(PASSIVES);
/** Bosses are also enemies (lookup by id works for both). */
const enemyMap = byId<EnemyDef>([...ENEMIES, ...BOSSES]);
const bossMap = byId(BOSSES);
const eliteModMap = byId(ELITE_MODS);
const baseMap = byId(ITEM_BASES);
const affixMap = byId(AFFIXES);
const legendaryMap = byId(LEGENDARIES);
const setMap = byId(SETS);
const setPieceMap = new Map<string, { set: SetDef; piece: SetDef['pieces'][number] }>();
for (const s of SETS) for (const p of s.pieces) setPieceMap.set(p.id, { set: s, piece: p });
const rarityMap = new Map<Rarity, RarityDef>(RARITY_DEFS.map((r) => [r.id, r]));
const materialMap = new Map<MaterialId, MaterialDef>(MATERIALS.map((m) => [m.id, m]));
const consumableMap = byId(CONSUMABLES);
const dropMap = new Map<MonsterRank, DropProfileDef>(DROP_PROFILES.map((d) => [d.rank, d]));
const difficultyMap = new Map<DifficultyId, DifficultyDef>(DIFFICULTIES.map((d) => [d.id, d]));
const paragonMap = byId(PARAGON_NODES);
const zoneMap = byId(ZONES);
const biomeMap = new Map<BiomeId, BiomeDef>(BIOMES.map((b) => [b.id, b]));
const trapMap = byId(TRAPS);
const shrineMap = byId(SHRINES);
const npcMap = byId(NPCS);
const questMap = byId(QUESTS);

function req<T>(map: Map<string, T>, id: string, kind: string): T {
  const v = map.get(id);
  if (!v) throw new Error(`[data] unknown ${kind} id "${id}"`);
  return v;
}

export const Data = {
  classes: CLASSES,
  skills: SKILLS,
  passives: PASSIVES,
  enemies: ENEMIES,
  bosses: BOSSES,
  eliteMods: ELITE_MODS,
  itemBases: ITEM_BASES,
  affixes: AFFIXES,
  legendaries: LEGENDARIES,
  sets: SETS,
  rarities: RARITY_DEFS,
  materials: MATERIALS,
  consumables: CONSUMABLES,
  dropProfiles: DROP_PROFILES,
  difficulties: DIFFICULTIES,
  progression: PROGRESSION,
  paragonNodes: PARAGON_NODES,
  zones: ZONES,
  biomes: BIOMES,
  traps: TRAPS,
  shrines: SHRINES,
  npcs: NPCS,
  quests: QUESTS,
  rift: RIFT,

  classDef: (id: ClassId): ClassDef => req(classMap as Map<string, ClassDef>, id, 'class'),
  skill: (id: string): SkillDef => req(skillMap, id, 'skill'),
  trySkill: (id: string): SkillDef | undefined => skillMap.get(id),
  passive: (id: string): PassiveDef => req(passiveMap, id, 'passive'),
  enemy: (id: string): EnemyDef => req(enemyMap, id, 'enemy'),
  tryEnemy: (id: string): EnemyDef | undefined => enemyMap.get(id),
  boss: (id: string): BossDef => req(bossMap, id, 'boss'),
  isBoss: (id: string): boolean => bossMap.has(id),
  eliteMod: (id: string): EliteModDef => req(eliteModMap, id, 'elite mod'),
  itemBase: (id: string): ItemBaseDef => req(baseMap, id, 'item base'),
  tryItemBase: (id: string): ItemBaseDef | undefined => baseMap.get(id),
  affix: (id: string): AffixDef => req(affixMap, id, 'affix'),
  tryAffix: (id: string): AffixDef | undefined => affixMap.get(id),
  legendary: (id: string): LegendaryDef => req(legendaryMap, id, 'legendary'),
  set: (id: string): SetDef => req(setMap, id, 'set'),
  setPiece: (pieceId: string) => setPieceMap.get(pieceId),
  rarity: (id: Rarity): RarityDef => {
    const r = rarityMap.get(id);
    if (!r) throw new Error(`[data] unknown rarity "${id}"`);
    return r;
  },
  material: (id: MaterialId): MaterialDef | undefined => materialMap.get(id),
  consumable: (id: string): ConsumableDef | undefined => consumableMap.get(id),
  dropProfile: (rank: MonsterRank): DropProfileDef | undefined => dropMap.get(rank),
  difficulty: (id: DifficultyId): DifficultyDef => {
    const d = difficultyMap.get(id);
    if (!d) throw new Error(`[data] unknown difficulty "${id}"`);
    return d;
  },
  paragonNode: (id: string): ParagonNodeDef => req(paragonMap, id, 'paragon node'),
  zone: (id: string): ZoneDef => req(zoneMap, id, 'zone'),
  tryZone: (id: string): ZoneDef | undefined => zoneMap.get(id),
  biome: (id: BiomeId): BiomeDef => {
    const b = biomeMap.get(id);
    if (!b) throw new Error(`[data] unknown biome "${id}"`);
    return b;
  },
  trap: (id: string): TrapDef => req(trapMap, id, 'trap'),
  shrine: (id: string): ShrineDef => req(shrineMap, id, 'shrine'),
  npc: (id: string): NpcDef => req(npcMap, id, 'npc'),
  quest: (id: string): QuestDef => req(questMap, id, 'quest'),
  skillsOf: (classId: ClassId): SkillDef[] => SKILLS.filter((s) => s.classId === classId),
  passivesOf: (classId: ClassId): PassiveDef[] => PASSIVES.filter((p) => p.classId === classId),
};

/** Dev-time sanity checks for cross references. Returns a list of problems (empty = OK). */
export function validateData(): string[] {
  const problems: string[] = [];
  for (const c of CLASSES) {
    for (const s of c.skills) if (!skillMap.has(s)) problems.push(`class ${c.id}: unknown skill ${s}`);
    for (const p of c.passives) if (!passiveMap.has(p)) problems.push(`class ${c.id}: unknown passive ${p}`);
    for (const it of c.startingItems) if (!baseMap.has(it.baseId)) problems.push(`class ${c.id}: unknown starting item ${it.baseId}`);
  }
  for (const l of LEGENDARIES) {
    if (!baseMap.has(l.baseId)) problems.push(`legendary ${l.id}: unknown base ${l.baseId}`);
    for (const f of l.fixedAffixes ?? []) if (!affixMap.has(f.affixId)) problems.push(`legendary ${l.id}: unknown affix ${f.affixId}`);
  }
  for (const s of SETS) for (const p of s.pieces) if (!baseMap.has(p.baseId)) problems.push(`set ${s.id}: unknown base ${p.baseId}`);
  for (const z of ZONES) {
    for (const m of z.monsters) if (!enemyMap.has(m.enemyId)) problems.push(`zone ${z.id}: unknown enemy ${m.enemyId}`);
    if (z.bossId && !bossMap.has(z.bossId)) problems.push(`zone ${z.id}: unknown boss ${z.bossId}`);
    if (!biomeMap.has(z.biome)) problems.push(`zone ${z.id}: unknown biome ${z.biome}`);
    if (z.next && !zoneMap.has(z.next)) problems.push(`zone ${z.id}: unknown next zone ${z.next}`);
  }
  for (const b of BOSSES) {
    for (const ph of b.phases) {
      for (const a of ph.abilities) if (!b.abilities.some((x) => x.id === a)) problems.push(`boss ${b.id}: phase uses unknown ability ${a}`);
      if (ph.adds && !enemyMap.has(ph.adds.enemyId)) problems.push(`boss ${b.id}: unknown add ${ph.adds.enemyId}`);
    }
  }
  for (const e of [...ENEMIES, ...BOSSES]) {
    for (const a of e.abilities) if (a.summon && !enemyMap.has(a.summon.enemyId)) problems.push(`enemy ${e.id}: summons unknown ${a.summon.enemyId}`);
  }
  for (const q of QUESTS) if (!npcMap.has(q.giver)) problems.push(`quest ${q.id}: unknown giver ${q.giver}`);
  for (const g of RIFT.guardians) if (!bossMap.has(g)) problems.push(`rift: unknown guardian ${g}`);
  return problems;
}
