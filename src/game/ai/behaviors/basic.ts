// Monster behaviours: melee swarm, ranged archer, kiter, caster, tank, charger, exploder, summoner, idle.
import { Data } from '../../../data';
import type { EnemyAbilityDef } from '../../../data/schema';
import type { AIBehavior, GameCtx } from '../../api';
import { startAbility } from '../../systems/CastSystem';
import type { World } from '../../World';
import type { Actor } from '../../types';
import { registerBehaviors } from '../registry';

/** Picks a ready ability usable at distance d (weighted). */
function readyAbility(a: Actor, d: number, filter?: (ab: EnemyAbilityDef) => boolean): EnemyAbilityDef | null {
  const def = Data.tryEnemy(a.monster!.defId);
  if (!def) return null;
  let best: EnemyAbilityDef | null = null;
  let bestScore = -1;
  for (const ab of def.abilities) {
    if ((a.cooldowns[ab.id] ?? 0) > 0) continue;
    if (d > ab.range + a.radius + 0.25 || d < (ab.minRange ?? 0)) continue;
    if (filter && !filter(ab)) continue;
    const score = (ab.weight ?? 1) * (0.5 + Math.random());
    if (score > bestScore) {
      bestScore = score;
      best = ab;
    }
  }
  return best;
}

/** Steers toward a point: direct if in LOS, otherwise flow field (player) or cached path. */
function moveToward(ctx: GameCtx, a: Actor, tx: number, ty: number, speedMult = 1, strafe = 0): void {
  const w = ctx.world as World;
  let dx = tx - a.pos.x;
  let dy = ty - a.pos.y;
  const d = Math.hypot(dx, dy) || 1;
  dx /= d;
  dy /= d;
  const target = { x: tx, y: ty };
  if (!w.clearWalk(a.pos, target, a.radius * 0.8)) {
    const f = w.flowDirToPlayer(a.pos);
    if (f) {
      dx = f.x;
      dy = f.y;
    }
  } else if (strafe) {
    // slight sideways drift so hordes wrap around the target
    const s = strafe * Math.min(1, d / 3);
    dx += -dy * s;
    dy += dx * s;
    const l = Math.hypot(dx, dy) || 1;
    dx /= l;
    dy /= l;
  }
  a.vel.x = dx * a.moveSpeed * speedMult;
  a.vel.y = dy * a.moveSpeed * speedMult;
}

function stop(a: Actor): void {
  a.vel.x = a.vel.y = 0;
}

/** Common target acquisition. Returns target (player or player minion) or null. */
function acquire(ctx: GameCtx, a: Actor): Actor | null {
  const ai = a.ai!;
  const w = ctx.world;
  let t = w.getActor(ai.targetId);
  if (t && !t.alive) t = undefined;
  const p = ctx.player;
  if (!t || ai.timer <= 0) {
    ai.timer = 0.5 + Math.random() * 0.3;
    // nearest hostile among player & minions
    let best: Actor | null = p.alive ? p : null;
    let bestD = best ? Math.hypot(p.pos.x - a.pos.x, p.pos.y - a.pos.y) : Infinity;
    const cands = w.enemiesOf(a.faction, a.pos.x, a.pos.y, 6);
    for (const c of cands) {
      const d = Math.hypot(c.pos.x - a.pos.x, c.pos.y - a.pos.y);
      if (d < bestD - 0.5) {
        bestD = d;
        best = c;
      }
    }
    t = best ?? undefined;
    ai.targetId = t?.id ?? null;
  }
  if (!t) return null;
  const d = Math.hypot(t.pos.x - a.pos.x, t.pos.y - a.pos.y);
  const def = Data.tryEnemy(a.monster!.defId);
  if (!ai.aggro) {
    const range = def?.aggroRange ?? 8;
    if ((d < range && w.lineOfSight(a.pos, t.pos)) || ctx.time - a.lastDamagedAt < 0.5) {
      ai.aggro = true;
      if (def?.sounds?.aggro && Math.random() < 0.5) ctx.audio.play(def.sounds.aggro, { pos: a.pos, pitchVar: 0.1 });
      // pack aggro
      for (const o of w.queryActors(a.pos.x, a.pos.y, 6)) if (o.ai && o.monster && o.monster.packId === a.monster!.packId) o.ai.aggro = true;
    } else return null;
  }
  return t;
}

function canAct(a: Actor): boolean {
  return !a.cast && !a.dash && a.state !== 'stunned' && a.state !== 'frozen' && a.state !== 'spawning' && a.state !== 'hitstun';
}

function wander(ctx: GameCtx, a: Actor, dt: number): void {
  const ai = a.ai!;
  ai.mem.wander = (ai.mem.wander ?? Math.random() * 3) - dt;
  if (ai.mem.wander <= 0) {
    ai.mem.wander = 2 + Math.random() * 4;
    if (Math.random() < 0.5) {
      ai.mem.wx = ai.home.x + (Math.random() - 0.5) * 3;
      ai.mem.wy = ai.home.y + (Math.random() - 0.5) * 3;
    } else ai.mem.wx = NaN;
  }
  if (!Number.isNaN(ai.mem.wx) && ai.mem.wx !== undefined && Math.hypot(ai.mem.wx - a.pos.x, ai.mem.wy - a.pos.y) > 0.3) moveToward(ctx, a, ai.mem.wx, ai.mem.wy, 0.35);
  else stop(a);
}

const melee: AIBehavior = {
  update(ctx, a, dt) {
    a.ai!.timer -= dt;
    if (!canAct(a)) return stop(a);
    const t = acquire(ctx, a);
    if (!t) return wander(ctx, a, dt);
    const d = Math.hypot(t.pos.x - a.pos.x, t.pos.y - a.pos.y) - t.radius;
    const ab = readyAbility(a, d);
    if (ab) {
      stop(a);
      return startAbility(ctx, a, ab, t.pos, t.id);
    }
    const reach = Data.tryEnemy(a.monster!.defId)?.abilities[0]?.range ?? 0.8;
    if (d > reach * 0.8) moveToward(ctx, a, t.pos.x, t.pos.y, 1, ((a.id % 7) - 3) * 0.12);
    else {
      stop(a);
      a.facing = Math.atan2(t.pos.y - a.pos.y, t.pos.x - a.pos.x);
    }
  },
};

/** Keeps preferredRange; shoots when possible; backs off when too close (kite = flee harder). */
const makeRanged = (flee: number): AIBehavior => ({
  update(ctx, a, dt) {
    const ai = a.ai!;
    ai.timer -= dt;
    if (!canAct(a)) return stop(a);
    const t = acquire(ctx, a);
    if (!t) return wander(ctx, a, dt);
    const def = Data.tryEnemy(a.monster!.defId)!;
    const pref = def.preferredRange ?? 5;
    const d = Math.hypot(t.pos.x - a.pos.x, t.pos.y - a.pos.y);
    const los = ctx.world.lineOfSight(a.pos, t.pos);
    if (ai.mode === 'flee') {
      ai.mem.flee = (ai.mem.flee ?? 0) - dt;
      if (ai.mem.flee <= 0 || d > pref) ai.mode = 'engage';
      else {
        const ax = a.pos.x - (t.pos.x - a.pos.x);
        const ay = a.pos.y - (t.pos.y - a.pos.y);
        return moveToward(ctx, a, ax, ay, 1.1);
      }
    }
    if (d < pref * 0.45 && flee > 0 && Math.random() < flee * dt * 6) {
      ai.mode = 'flee';
      ai.mem.flee = 0.9 + Math.random() * 0.6;
      return;
    }
    const ab = los ? readyAbility(a, d) : null;
    if (ab) {
      stop(a);
      return startAbility(ctx, a, ab, t.pos, t.id);
    }
    if (!los || d > pref + 0.5) moveToward(ctx, a, t.pos.x, t.pos.y);
    else if (d < pref - 1.5) moveToward(ctx, a, a.pos.x - (t.pos.x - a.pos.x), a.pos.y - (t.pos.y - a.pos.y), 0.7);
    else {
      stop(a);
      a.facing = Math.atan2(t.pos.y - a.pos.y, t.pos.x - a.pos.x);
    }
  },
});

/** Chargers: prefer charge ability at mid range, otherwise melee. */
const charger: AIBehavior = {
  update(ctx, a, dt) {
    a.ai!.timer -= dt;
    if (!canAct(a)) return stop(a);
    const t = acquire(ctx, a);
    if (!t) return wander(ctx, a, dt);
    const d = Math.hypot(t.pos.x - a.pos.x, t.pos.y - a.pos.y) - t.radius;
    const los = ctx.world.lineOfSight(a.pos, t.pos);
    const ab = readyAbility(a, d, (x) => (x.kind === 'charge' ? los : true));
    if (ab) {
      stop(a);
      return startAbility(ctx, a, ab, t.pos, t.id);
    }
    if (d > 0.7) moveToward(ctx, a, t.pos.x, t.pos.y);
    else stop(a);
  },
};

/** Exploders sprint at the target and detonate. */
const exploder: AIBehavior = {
  update(ctx, a, dt) {
    a.ai!.timer -= dt;
    if (!canAct(a)) return stop(a);
    const t = acquire(ctx, a);
    if (!t) return wander(ctx, a, dt);
    const d = Math.hypot(t.pos.x - a.pos.x, t.pos.y - a.pos.y) - t.radius;
    const ab = readyAbility(a, d);
    if (ab) {
      stop(a);
      return startAbility(ctx, a, ab, t.pos, t.id);
    }
    moveToward(ctx, a, t.pos.x, t.pos.y, 1.15);
  },
};

/** Summoners keep distance and raise minions; stationary ones (speed 0) just cast. */
const summoner: AIBehavior = {
  update(ctx, a, dt) {
    const ai = a.ai!;
    ai.timer -= dt;
    if (!canAct(a)) return stop(a);
    const t = acquire(ctx, a);
    if (!t) return stop(a);
    const d = Math.hypot(t.pos.x - a.pos.x, t.pos.y - a.pos.y);
    const ab = readyAbility(a, d);
    if (ab) {
      stop(a);
      return startAbility(ctx, a, ab, t.pos, t.id);
    }
    if (a.baseMoveSpeed <= 0) return stop(a);
    const pref = Data.tryEnemy(a.monster!.defId)?.preferredRange ?? 5;
    if (d < pref - 1) moveToward(ctx, a, a.pos.x - (t.pos.x - a.pos.x), a.pos.y - (t.pos.y - a.pos.y), 0.8);
    else if (d > pref + 2) moveToward(ctx, a, t.pos.x, t.pos.y);
    else stop(a);
  },
};

const idle: AIBehavior = {
  update(_ctx, a) {
    stop(a);
  },
};

/** Player minions: follow owner, attack nearby enemies. */
const minion: AIBehavior = {
  update(ctx, a, dt) {
    const ai = a.ai!;
    ai.timer -= dt;
    if (!canAct(a)) return stop(a);
    const owner = ctx.world.getActor(a.minion?.ownerId) ?? ctx.player;
    let t = ctx.world.getActor(ai.targetId);
    if (!t?.alive || ai.timer <= 0) {
      ai.timer = 0.4;
      const enemies = ctx.world.enemiesOf(a.faction, owner.pos.x, owner.pos.y, 7);
      let best: Actor | undefined;
      let bd = Infinity;
      for (const e of enemies) {
        const d = Math.hypot(e.pos.x - a.pos.x, e.pos.y - a.pos.y);
        if (d < bd) {
          bd = d;
          best = e;
        }
      }
      t = best;
      ai.targetId = t?.id ?? null;
    }
    const od = Math.hypot(owner.pos.x - a.pos.x, owner.pos.y - a.pos.y);
    if (od > 9) {
      ctx.combat.teleport(a, { x: owner.pos.x + (Math.random() - 0.5), y: owner.pos.y + (Math.random() - 0.5) });
      return;
    }
    if (t) {
      const d = Math.hypot(t.pos.x - a.pos.x, t.pos.y - a.pos.y) - t.radius;
      const ab = readyAbility(a, d);
      if (ab) {
        stop(a);
        return startAbility(ctx, a, ab, t.pos, t.id);
      }
      return moveToward(ctx, a, t.pos.x, t.pos.y, 1.1);
    }
    if (od > 2) moveToward(ctx, a, owner.pos.x, owner.pos.y, 1.15);
    else stop(a);
  },
};

registerBehaviors({
  melee,
  tank: melee,
  ranged: makeRanged(0.25),
  kiter: makeRanged(1),
  caster: makeRanged(0.5),
  charger,
  exploder,
  summoner,
  idle,
  minion,
});
