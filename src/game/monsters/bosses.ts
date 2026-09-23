// Boss AI (phase-driven), elite-mod ticking, boss arena spawning and boss death rewards.
import { Data } from '../../data';
import type { BossDef } from '../../data/schema';
import type { AIBehavior, GameCtx, System } from '../api';
import { registerBehaviors } from '../ai/registry';
import { onGameCreated, onWorldEntered, registerSystem } from '../hooks';
import { startAbility } from '../systems/CastSystem';
import { dropItem, dropLoot } from '../systems/LootSystem';
import { createItem } from '../items/generate';
import type { Actor } from '../types';
import { getEliteModImpl } from './eliteModRegistry';
import { spawnMonster } from './spawn';

const boss: AIBehavior = {
  update(ctx, a, dt) {
    const def = Data.tryEnemy(a.monster!.defId) as BossDef | undefined;
    if (!def?.phases) return;
    const ai = a.ai!;
    ai.timer -= dt;
    if (a.cast || a.dash || a.state === 'spawning') return;
    const p = ctx.player;
    if (!p.alive) {
      a.vel.x = a.vel.y = 0;
      return;
    }
    const d = Math.hypot(p.pos.x - a.pos.x, p.pos.y - a.pos.y);
    if (!ai.aggro) {
      if (d < def.aggroRange || ctx.time - a.lastDamagedAt < 1) {
        ai.aggro = true;
        ctx.events.emit('bossSpawned', { actor: a });
        ctx.ui.banner(a.monster!.displayName, def.title, 'boss');
        ctx.audio.play('boss_roar', { pos: a.pos });
        ctx.audio.playMusic(def.music ?? 'music_boss', 1);
        ctx.fx.shake(0.4, 0.5);
      } else return;
    }
    // phase transitions
    const lf = a.life / a.maxLife;
    let phase = 0;
    for (let i = 0; i < def.phases.length; i++) if (lf <= def.phases[i].lifeBelow) phase = i;
    if (phase > a.monster!.bossPhase) {
      a.monster!.bossPhase = phase;
      const ph = def.phases[phase];
      if (ph.speedMult) a.baseMoveSpeed = def.speed * ph.speedMult;
      if (ph.damageMult) a.monster!.baseDamage *= ph.damageMult;
      if (ph.transitionTime) {
        a.invulnerable = ph.transitionTime;
        ai.timer = ph.transitionTime;
      }
      if (ph.adds) for (let i = 0; i < ph.adds.count; i++) {
        const ang = (i / ph.adds.count) * Math.PI * 2;
        const m = spawnMonster(ctx, ph.adds.enemyId, { x: a.pos.x + Math.cos(ang) * 2.5, y: a.pos.y + Math.sin(ang) * 2.5 }, {});
        if (m?.monster) {
          m.monster.spawnedBy = a.id;
          m.ai!.aggro = true;
        }
      }
      ctx.events.emit('bossPhase', { actor: a, phase, announce: ph.announce });
      ctx.audio.play('boss_phase');
      ctx.fx.shockwave(a.pos, { radius: 5, duration: 0.7 });
      ctx.fx.screenFlash(0x600000, 0.25, 0.5);
      ctx.fx.shake(0.5, 0.5);
    }
    if (ai.timer > 0) {
      a.vel.x = a.vel.y = 0;
      return;
    }
    const allowed = def.phases[a.monster!.bossPhase].abilities;
    const ready = def.abilities.filter((x) => allowed.includes(x.id) && (a.cooldowns[x.id] ?? 0) <= 0 && d <= x.range + a.radius + 0.3 && d >= (x.minRange ?? 0));
    if (ready.length) {
      const ab = ready[Math.floor(Math.random() * ready.length)];
      a.vel.x = a.vel.y = 0;
      ai.timer = 0.35;
      startAbility(ctx, a, ab, p.pos, p.id);
      return;
    }
    // approach
    if (d > 1.2) {
      const f = ctx.world.lineOfSight(a.pos, p.pos) ? { x: (p.pos.x - a.pos.x) / d, y: (p.pos.y - a.pos.y) / d } : ctx.world.flowDirToPlayer(a.pos);
      if (f) {
        a.vel.x = f.x * a.moveSpeed;
        a.vel.y = f.y * a.moveSpeed;
      }
    } else a.vel.x = a.vel.y = 0;
  },
};
registerBehaviors({ boss });

/** Ticks elite modifiers. */
class EliteSystem implements System {
  readonly name = 'elites';
  update(ctx: GameCtx, dt: number): void {
    for (const a of ctx.world.actors) {
      if (!a.alive || !a.monster || !a.monster.eliteMods.length) continue;
      for (const m of a.monster.eliteMods) getEliteModImpl(m)?.tick?.(ctx, a, dt);
    }
  }
}
registerSystem(25, () => new EliteSystem());

/** Spawns the zone boss in the arena of the last floor (dormant until the player approaches). */
onWorldEntered((game: GameCtx) => {
  const w = game.world;
  const arena = w.level.bossArena;
  const bossId = w.info.zone.bossId;
  if (!arena || !bossId || w.info.isRift) return;
  const flagged = w as unknown as { bossSpawned?: boolean };
  if (flagged.bossSpawned) return;
  flagged.bossSpawned = true;
  const def = Data.boss(bossId);
  const a = spawnMonster(game, bossId, arena.center, { rank: 'boss', name: def.name });
  if (a) {
    a.monster!.displayName = def.name;
    a.facing = Math.PI * 1.25;
  }
});

function onBossDeath(game: GameCtx, a: Actor): void {
  const def = Data.boss(a.monster!.defId);
  const c = game.character;
  c.bossesKilled[def.id] = (c.bossesKilled[def.id] ?? 0) + 1;
  game.events.emit('bossDefeated', { actor: a, bossId: def.id });
  game.ui.setBossBar(null);
  game.ui.banner('Vitória', `${a.monster!.displayName} foi derrotado`, 'boss');
  game.fx.screenFlash(0xffc080, 0.4, 1);
  game.fx.shake(0.8, 0.8);
  game.fx.burst('levelup', a.pos, { count: 80 });
  game.audio.play('rift_complete');
  game.audio.playMusic(game.world.info.biome.music, 3);
  // loot explosion
  dropLoot(game, a.pos, a.monster!.rank, a.level, 1);
  const rng = game.rng;
  if (rng.chance(def.loot.legendaryChance)) {
    dropItem(game, a.pos, createItem(rng, { ilvl: a.level, rarity: rng.chance(0.25) ? 'set' : 'legendary', classId: c.classId }), 2);
  }
  // exit: stairs to the next zone (or back to town if none)
  const next = game.world.info.zone.next;
  (game as unknown as { addInteractable: (w: unknown, s: unknown) => void }).addInteractable(game.world, {
    kind: next ? 'dungeonEntrance' : 'portal',
    pos: { x: a.pos.x + 1.5, y: a.pos.y + 1.5 },
    name: next ? `Descer: ${Data.zone(next).name}` : 'Portal para Brasaluz',
    data: next ? { zoneId: next, floor: 1 } : { back: false, town: true },
  });
  if (next && !game.character.waypoints.includes(`${next}:1`)) game.character.waypoints.push(`${next}:1`);
}

onGameCreated((game: GameCtx) => {
  game.events.on('actorDied', ({ actor }) => {
    if (actor.monster && (actor.monster.rank === 'boss' || actor.monster.rank === 'guardian') && Data.isBoss(actor.monster.defId)) {
      if (!game.world.info.isRift) onBossDeath(game, actor);
    }
  });
});
