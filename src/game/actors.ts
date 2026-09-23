// Actor factories.
import { Data } from '../data';
import type { DifficultyDef, EnemyDef, MonsterRank, NpcDef } from '../data/schema';
import { monsterDamage, monsterLife, RANK_DAMAGE, RANK_LIFE, RANK_XP } from '../formulas/scaling';
import type { Vec2 } from '../core/math';
import { computePlayerStats, emptyStats } from './stats/aggregate';
import type { Actor, ActorVisual, CharacterState } from './types';

const RANK_OUTLINE: Partial<Record<MonsterRank, number>> = {
  champion: 0x5a8cff,
  rare: 0xffd84a,
  unique: 0xc07aff,
  boss: 0xff7a1a,
  guardian: 0xff3a3a,
};

export function baseActor(id: number, pos: Vec2): Actor {
  return {
    id,
    kind: 'monster',
    faction: 'enemy',
    name: '',
    level: 1,
    pos: { x: pos.x, y: pos.y },
    prevPos: { x: pos.x, y: pos.y },
    vel: { x: 0, y: 0 },
    radius: 0.25,
    mass: 1,
    facing: Math.PI / 4,
    baseMoveSpeed: 2,
    moveSpeed: 2,
    life: 1,
    maxLife: 1,
    resource: 0,
    maxResource: 0,
    shield: 0,
    stats: emptyStats(),
    state: 'idle',
    stateTime: 0,
    anim: { name: 'stance', time: 0, speed: 1, loop: true, serial: 0 },
    statuses: [],
    cooldowns: {},
    charges: {},
    path: null,
    pathIndex: 0,
    moveTarget: null,
    knockback: { x: 0, y: 0 },
    dash: null,
    cast: null,
    flash: 0,
    lastDamagedAt: -99,
    lastCombatAt: -99,
    alive: true,
    deathAt: 0,
    invulnerable: 0,
    corpseTimer: 0,
    visual: { kind: 'sheet', scale: 1, alpha: 1 },
    tags: new Set(),
  };
}

/** Avatar visual from appearance + equipped items + class defaults. */
export function playerVisual(c: CharacterState): ActorVisual {
  const cls = Data.classDef(c.classId);
  const layers: ActorVisual['layers'] = { ...cls.appearance.defaultLayers, head: c.appearance.head };
  for (const item of Object.values(c.equipment)) {
    if (!item) continue;
    const vis = Data.tryItemBase(item.baseId)?.visual;
    if (vis) layers[vis.layer] = vis.sprite;
  }
  return {
    kind: 'avatar',
    body: c.appearance.body,
    layers,
    scale: 1,
    alpha: 1,
    skinTone: c.appearance.skinTone,
    hairColor: c.appearance.hairColor,
    armorTint: c.appearance.armorTint,
  };
}

export type PlayerActor = Actor;

export function createPlayerActor(id: number, c: CharacterState, pos: Vec2): PlayerActor {
  const a = baseActor(id, pos) as PlayerActor;
  const cls = Data.classDef(c.classId);
  a.kind = 'player';
  a.faction = 'player';
  a.name = c.name;
  a.character = c;
  a.radius = 0.22;
  a.mass = 1.5;
  a.baseMoveSpeed = cls.moveSpeed;
  a.moveSpeed = cls.moveSpeed;
  a.visual = playerVisual(c);
  a.tags.add('player');
  applyPlayerStats(a, true);
  a.resource = cls.resource.startFull ? a.maxResource : 0;
  return a;
}

/** Recomputes derived stats; keeps life/resource ratio. */
export function applyPlayerStats(a: PlayerActor, fill = false): void {
  const c = a.character!;
  const d = computePlayerStats(c);
  const lifeRatio = a.maxLife > 1 ? a.life / a.maxLife : 1;
  a.level = c.level;
  a.stats = d.stats;
  a.maxLife = d.maxLife;
  a.maxResource = d.maxResource;
  a.weapon = d.weapon;
  a.mainStat = d.mainStat;
  a.life = fill ? a.maxLife : Math.max(1, Math.min(a.maxLife, Math.round(lifeRatio * a.maxLife)));
  a.resource = Math.min(a.resource, a.maxResource);
}

export function createMonsterActor(id: number, def: EnemyDef, pos: Vec2, level: number, rank: MonsterRank, diff: DifficultyDef): Actor {
  const a = baseActor(id, pos);
  const isBoss = rank === 'boss' || rank === 'guardian';
  a.kind = 'monster';
  a.faction = 'enemy';
  a.name = def.name;
  a.level = level;
  a.radius = def.radius;
  a.mass = def.mass;
  a.baseMoveSpeed = def.speed * (rank === 'champion' ? 1.1 : 1);
  a.moveSpeed = a.baseMoveSpeed;
  a.facing = Math.random() * Math.PI * 2;
  const life = monsterLife(level) * def.lifeMult * diff.lifeMult * RANK_LIFE[rank];
  a.maxLife = Math.max(1, Math.round(life));
  a.life = a.maxLife;
  a.stats.armor = (def.armorMult ?? 1) * level * 4;
  for (const [t, v] of Object.entries(def.resist ?? {})) {
    const key = ('res' + t[0].toUpperCase() + t.slice(1)) as keyof Actor['stats'];
    a.stats[key] = v ?? 0; // monsters: resist stored directly as a fraction reduction
  }
  a.stats.critChance = 0.03;
  a.stats.critDamage = 0.5;
  a.visual = {
    kind: 'sheet',
    sheet: def.sprite.sheet,
    scale: (def.sprite.scale ?? 1) * (rank === 'rare' || rank === 'unique' ? 1.12 : rank === 'champion' ? 1.06 : 1),
    tint: def.sprite.tint,
    hue: def.sprite.hue,
    alpha: 1,
    outline: RANK_OUTLINE[rank],
    light: def.light,
  };
  if (isBoss) a.tags.add('boss');
  if (rank === 'champion' || rank === 'rare' || rank === 'unique') a.tags.add('elite');
  a.monster = {
    defId: def.id,
    rank,
    eliteMods: [],
    packId: 0,
    leaderId: null,
    displayName: def.name,
    xp: Math.round((10 + level * 4) * def.xpMult * RANK_XP[rank]),
    baseDamage: monsterDamage(level) * def.damageMult * diff.damageMult * RANK_DAMAGE[rank],
    bossPhase: 0,
    riftProgress: 0,
    spawnedBy: null,
    dropsLoot: true,
    modState: {},
  };
  a.ai = { behavior: def.ai, mode: 'idle', targetId: null, timer: Math.random(), home: { ...pos }, aggro: false, mem: {}, repathTimer: 0 };
  if (def.spawnAnim) {
    a.state = 'spawning';
    a.anim = { name: def.spawnAnim, time: 0, speed: 1, loop: false, serial: 1 };
  }
  return a;
}

export function createNpcActor(id: number, def: NpcDef, pos: Vec2, facing = Math.PI * 0.75): Actor {
  const a = baseActor(id, pos);
  a.kind = 'npc';
  a.faction = 'neutral';
  a.name = def.name;
  a.radius = 0.3;
  a.mass = 99;
  a.baseMoveSpeed = 0;
  a.moveSpeed = 0;
  a.maxLife = a.life = 1;
  a.facing = facing;
  a.invulnerable = 1e9;
  a.visual = { kind: 'sheet', sheet: def.sprite.sheet, scale: def.sprite.scale ?? 1, tint: def.sprite.tint, alpha: 1 };
  a.npc = { defId: def.id };
  return a;
}
