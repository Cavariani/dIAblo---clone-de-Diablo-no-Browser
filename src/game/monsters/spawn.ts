// Monster spawning: single monsters, packs, champions and rare elites.
import { Data } from '../../data';
import { ELITE_NAME_PREFIXES, ELITE_NAME_SUFFIXES, ELITE_TITLES } from '../../data/names';
import type { MonsterRank } from '../../data/schema';
import type { Vec2 } from '../../core/math';
import type { Rng } from '../../core/rng';
import { createMonsterActor } from '../actors';
import type { GameCtx } from '../api';
import type { Actor, Faction } from '../types';
import { getEliteModImpl } from './eliteModRegistry';

export interface SpawnOpts {
  rank?: MonsterRank;
  level?: number;
  faction?: Faction;
  eliteMods?: string[];
  packId?: number;
  lifeMult?: number;
  damageMult?: number;
  name?: string;
}

let packCounter = 1;

export function spawnMonster(ctx: GameCtx, enemyId: string, pos: Vec2, o: SpawnOpts = {}): Actor | null {
  const def = Data.tryEnemy(enemyId);
  if (!def) return null;
  const w = ctx.world;
  const p = w.isWalkable(pos.x, pos.y) ? pos : w.nearestWalkable(pos, 4);
  if (!p) return null;
  const rank = o.rank ?? 'normal';
  const a = createMonsterActor(w.nextId(), def, p, o.level ?? w.info.monsterLevel, rank, ctx.difficulty);
  if (o.faction) a.faction = o.faction;
  if (o.lifeMult) {
    a.maxLife = Math.round(a.maxLife * o.lifeMult);
    a.life = a.maxLife;
  }
  if (o.damageMult && a.monster) a.monster.baseDamage *= o.damageMult;
  const gr = w.info.isRift ? w.info.greaterRiftLevel : 0;
  if (gr > 0 && a.monster && a.faction === 'enemy') {
    a.maxLife = Math.round(a.maxLife * Math.pow(1 + Data.rift.levelScaling.life, gr));
    a.life = a.maxLife;
    a.monster.baseDamage *= Math.pow(1 + Data.rift.levelScaling.damage, gr);
  }
  if (a.monster) {
    a.monster.packId = o.packId ?? 0;
    if (o.name) a.monster.displayName = o.name;
    if (o.eliteMods?.length) {
      a.monster.eliteMods = [...o.eliteMods];
      for (const id of o.eliteMods) {
        const md = Data.eliteMod(id);
        if (md.lifeMult) {
          a.maxLife = Math.round(a.maxLife * md.lifeMult);
          a.life = a.maxLife;
        }
        if (md.damageMult) a.monster.baseDamage *= md.damageMult;
        if (md.speedMult) a.baseMoveSpeed *= md.speedMult;
      }
    }
  }
  w.addActor(a);
  if (a.monster) for (const m of a.monster.eliteMods) getEliteModImpl(m)?.onSpawn?.(ctx, a);
  if (rank === 'champion' || rank === 'rare' || rank === 'unique') ctx.events.emit('eliteSpawned', { actor: a });
  return a;
}

export function rareName(rng: Rng, fallback: string): string {
  if (!ELITE_NAME_PREFIXES.length || !ELITE_NAME_SUFFIXES.length) return fallback;
  const base = rng.pick(ELITE_NAME_PREFIXES) + rng.pick(ELITE_NAME_SUFFIXES);
  return ELITE_TITLES.length && rng.chance(0.6) ? `${base}, ${rng.pick(ELITE_TITLES)}` : base;
}

function pickMods(rng: Rng, count: number, level: number): string[] {
  const pool = Data.eliteMods.filter((m) => (m.minLevel ?? 0) <= level);
  const out: string[] = [];
  for (let i = 0; i < count && pool.length; i++) {
    const m = rng.weighted(pool, (x) => (out.includes(x.id) || out.some((o) => x.incompatible?.includes(o)) ? 0 : x.weight));
    if (m) out.push(m.id);
  }
  return out;
}

/** Spawns a pack at pos: normal (mixed), champion (all champions) or rare (leader + minions). */
export function spawnPack(ctx: GameCtx, rng: Rng, pos: Vec2, size: number, kind: 'normal' | 'champion' | 'rare'): Actor[] {
  const zone = ctx.world.info.zone;
  if (!zone.monsters.length) return [];
  const packId = packCounter++;
  const out: Actor[] = [];
  const pick = () => rng.weighted(zone.monsters, (m) => m.weight)!.enemyId;
  const around = () => ({ x: pos.x + rng.range(-1.4, 1.4), y: pos.y + rng.range(-1.4, 1.4) });
  const level = ctx.world.info.monsterLevel;
  if (kind === 'normal') {
    const main = pick();
    for (let i = 0; i < size; i++) {
      const id = rng.chance(0.7) ? main : pick();
      const a = spawnMonster(ctx, id, around(), { packId });
      if (a) out.push(a);
    }
  } else if (kind === 'champion') {
    const id = pick();
    const mods = pickMods(rng, level >= 20 ? 2 : 1, level);
    const n = rng.int(3, 4);
    for (let i = 0; i < n; i++) {
      const a = spawnMonster(ctx, id, around(), { rank: 'champion', eliteMods: mods, packId });
      if (a) out.push(a);
    }
  } else {
    const id = pick();
    const mods = pickMods(rng, level >= 20 ? 3 : 2, level);
    const def = Data.enemy(id);
    const leader = spawnMonster(ctx, id, pos, { rank: 'rare', eliteMods: mods, packId, name: rareName(rng, def.name) });
    if (leader) out.push(leader);
    for (let i = 0; i < rng.int(3, 5); i++) {
      const a = spawnMonster(ctx, id, around(), { rank: 'minion', packId });
      if (a) {
        if (a.monster && leader) a.monster.leaderId = leader.id;
        out.push(a);
      }
    }
  }
  return out;
}
