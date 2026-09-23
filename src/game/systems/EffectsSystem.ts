// Projectiles and ground effects (telegraphed AoEs, pools, auras).
import { angleDiff, distPointSegment } from '../../core/math';
import type { GameCtx, System } from '../api';
import type { World } from '../World';
import type { Actor, GroundEffect, Projectile } from '../types';

const hits: Actor[] = [];

export class ProjectileSystem implements System {
  readonly name = 'projectiles';

  update(ctx: GameCtx, dt: number): void {
    const w = ctx.world as World;
    for (const p of w.projectiles) {
      if (!p.alive) continue;
      p.age += dt;
      if (p.lob) {
        p.lob.t += dt / p.lob.duration;
        const t = Math.min(1, p.lob.t);
        p.pos.x = p.lob.from.x + (p.lob.to.x - p.lob.from.x) * t;
        p.pos.y = p.lob.from.y + (p.lob.to.y - p.lob.from.y) * t;
        p.z = 0.4 + Math.sin(t * Math.PI) * p.lob.height;
        if (t >= 1) this.expire(ctx, p, 'landed');
        continue;
      }
      if (p.homing > 0) {
        const t = w.getActor(p.targetId);
        if (t?.alive) {
          const cur = Math.atan2(p.vel.y, p.vel.x);
          const want = Math.atan2(t.pos.y - p.pos.y, t.pos.x - p.pos.x);
          const turn = Math.max(-p.homing * dt, Math.min(p.homing * dt, angleDiff(cur, want)));
          const sp = Math.hypot(p.vel.x, p.vel.y);
          p.vel.x = Math.cos(cur + turn) * sp;
          p.vel.y = Math.sin(cur + turn) * sp;
        }
      }
      const sx = p.vel.x * dt;
      const sy = p.vel.y * dt;
      p.pos.x += sx;
      p.pos.y += sy;
      p.traveled += Math.hypot(sx, sy);
      if (p.trail && Math.random() < 0.6) ctx.fx.burst(p.trail, p.pos, { count: 1, z: p.z });
      if (p.hitsWalls && w.blocksProjectile(Math.floor(p.pos.x), Math.floor(p.pos.y))) {
        this.expire(ctx, p, 'wall');
        continue;
      }
      w.enemiesOf(p.faction, p.pos.x, p.pos.y, p.radius, hits);
      for (const t of hits) {
        if (p.hitIds.has(t.id)) continue;
        p.hitIds.add(t.id);
        const d = Math.hypot(p.vel.x, p.vel.y) || 1;
        ctx.combat.dealDamage(t, { ...p.damage, dir: { x: p.vel.x / d, y: p.vel.y / d } });
        p.onHit?.(t, p);
        if (p.impactParticles) ctx.fx.burst(p.impactParticles, t.pos, { count: 8, z: 0.6 });
        if (p.pierceLeft-- <= 0) {
          this.expire(ctx, p, 'hit');
          break;
        }
      }
      if (p.alive && p.traveled >= p.maxRange) this.expire(ctx, p, 'range');
    }
  }

  private expire(ctx: GameCtx, p: Projectile, reason: 'range' | 'wall' | 'hit' | 'landed'): void {
    if (!p.alive) return;
    p.alive = false;
    if (p.explodeRadius > 0) {
      ctx.combat.aoe(ctx.world.getActor(p.ownerId) ?? null, p.faction, p.pos, p.explodeRadius, { damage: { ...p.damage, isArea: true } });
      ctx.fx.burst(p.damage.type === 'fire' ? 'fire' : 'sparks', p.pos, { count: 24, scale: p.explodeRadius });
      ctx.fx.light(p.pos, { radius: p.explodeRadius * 2.5, color: 0xff8a30, intensity: 1.5 }, 0.3);
    }
    if (p.impactFx) ctx.fx.spriteFx(p.impactFx, p.pos, { additive: true });
    else if (reason === 'wall') ctx.fx.burst('sparks', p.pos, { count: 4, z: p.z });
    p.onExpire?.(p, reason);
  }
}

function inside(g: GroundEffect, a: Actor): boolean {
  const dx = a.pos.x - g.pos.x;
  const dy = a.pos.y - g.pos.y;
  const d = Math.hypot(dx, dy);
  switch (g.shape) {
    case 'circle':
      return d <= g.radius + a.radius;
    case 'ring':
      return d <= g.radius + a.radius && d >= g.innerRadius - a.radius;
    case 'cone':
      return d <= g.radius + a.radius && (d < 0.3 || Math.abs(angleDiff(g.angle, Math.atan2(dy, dx))) <= g.arc / 2);
    case 'line': {
      const to = { x: g.pos.x + Math.cos(g.angle) * g.length, y: g.pos.y + Math.sin(g.angle) * g.length };
      return distPointSegment(a.pos, g.pos, to) <= g.width / 2 + a.radius;
    }
  }
}

export class GroundEffectSystem implements System {
  readonly name = 'groundEffects';

  update(ctx: GameCtx, dt: number): void {
    const w = ctx.world as World;
    for (const g of w.groundEffects) {
      if (!g.alive) continue;
      const wasDelayed = g.age < g.delay;
      g.age += dt;
      if (g.followId !== null) {
        const f = w.getActor(g.followId);
        if (f?.alive) {
          g.pos.x = f.pos.x;
          g.pos.y = f.pos.y;
        } else if (g.age < g.delay) {
          g.alive = false; // follower died before the telegraph resolved (e.g. exploder killed)
          continue;
        }
      }
      if (g.age < g.delay) continue;
      if (wasDelayed || g.delay === 0 && g.age - dt <= 0) {
        g.onActivate?.(g);
        // telegraphs drive visuals only; their damage is executed by the ability itself
        if (g.visual.telegraph && !g.damage) {
          g.alive = false;
          continue;
        }
        if (g.damage) this.hitAll(ctx, g);
        g.tickTimer = 0;
      } else if (g.damage && g.duration > 0) {
        g.tickTimer += dt;
        if (g.tickTimer >= g.tickInterval) {
          g.tickTimer -= g.tickInterval;
          this.hitAll(ctx, g);
          g.onTick?.(g);
        }
      } else g.onTick?.(g);
      if (g.age >= g.delay + g.duration) {
        g.alive = false;
        g.onExpire?.(g);
      }
    }
  }

  private hitAll(ctx: GameCtx, g: GroundEffect): void {
    const w = ctx.world as World;
    const reach = Math.max(g.radius, g.length) + 1;
    w.enemiesOf(g.faction, g.pos.x, g.pos.y, reach, hits);
    for (const t of hits.slice()) {
      if (g.hitOnce && g.hitIds.has(t.id)) continue;
      if (!inside(g, t)) continue;
      g.hitIds.add(t.id);
      ctx.combat.dealDamage(t, { ...g.damage!, isArea: true, isDot: g.duration > 0 && !g.hitOnce, status: g.status ?? g.damage!.status });
    }
  }
}
