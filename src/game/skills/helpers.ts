// Shared building blocks for skill implementations.
import { vnorm, vrotate, type Vec2 } from '../../core/math';
import type { DamageType, LightDef, StatusId } from '../../data/schema';
import type { GameCtx, SkillCastInfo } from '../api';
import type { Actor, DamageSpec, Projectile } from '../types';

export const ELEMENT_COLOR: Record<DamageType, number> = {
  physical: 0xffe0b0,
  fire: 0xff7a20,
  cold: 0x7ac8ff,
  lightning: 0xb8b0ff,
  poison: 0x8ae040,
  arcane: 0xd070ff,
};

export const ELEMENT_PARTICLES: Record<DamageType, string> = {
  physical: 'sparks',
  fire: 'fire',
  cold: 'ice',
  lightning: 'lightning',
  poison: 'poison',
  arcane: 'arcane',
};

/** Damage spec for a skill cast (coefficient * mult). */
export function sd(ctx: GameCtx, c: SkillCastInfo, mult = 1, extra: Partial<DamageSpec> = {}, type: DamageType = c.damageType): DamageSpec {
  return { amount: ctx.combat.skillDamage(c.caster, c.coefficient * mult, type, c.def.id), type, sourceId: c.caster.id, skillId: c.def.id, ...extra };
}

export function status(id: StatusId, duration: number, magnitude: number, chance?: number): DamageSpec['status'] {
  return { id, duration, magnitude, chance };
}

/** Evenly spread directions around `dir` (total spread in degrees). */
export function fan(dir: Vec2, count: number, spreadDeg: number): Vec2[] {
  if (count <= 1) return [dir];
  const out: Vec2[] = [];
  const total = (spreadDeg * Math.PI) / 180;
  for (let i = 0; i < count; i++) out.push(vrotate(dir, -total / 2 + (total * i) / (count - 1)));
  return out;
}

export interface ShootOpts {
  dir?: Vec2;
  from?: Vec2;
  visual: string;
  speed: number;
  radius?: number;
  range?: number;
  mult?: number;
  pierce?: number;
  explode?: number;
  tint?: number;
  scale?: number;
  light?: LightDef;
  trail?: string;
  impactParticles?: string;
  impactFx?: string;
  knockback?: number;
  status?: DamageSpec['status'];
  homing?: number;
  targetId?: number | null;
  type?: DamageType;
  onHit?: Projectile['onHit'];
  onExpire?: Projectile['onExpire'];
}

export function shoot(ctx: GameCtx, c: SkillCastInfo, o: ShootOpts): Projectile {
  const dir = o.dir ?? c.dir;
  const from = o.from ?? { x: c.caster.pos.x + dir.x * 0.35, y: c.caster.pos.y + dir.y * 0.35 };
  const type = o.type ?? c.damageType;
  return ctx.combat.spawnProjectile({
    owner: c.caster,
    from,
    dir,
    speed: o.speed,
    radius: o.radius ?? 0.2,
    range: o.range ?? c.def.range,
    visual: o.visual,
    tint: o.tint,
    scale: o.scale,
    light: o.light,
    trail: o.trail,
    impactParticles: o.impactParticles ?? ELEMENT_PARTICLES[type],
    impactFx: o.impactFx,
    pierce: o.pierce ?? c.params.pierce,
    explodeRadius: o.explode,
    homing: o.homing,
    targetId: o.targetId,
    damage: sd(ctx, c, o.mult ?? 1, { isRanged: true, knockback: o.knockback ?? 1.5, status: o.status }, type),
    onHit: o.onHit,
    onExpire: o.onExpire,
  });
}

/** Nearest hostile to `from` within range, optionally excluding ids. */
export function nearestEnemy(ctx: GameCtx, faction: Actor['faction'], from: Vec2, range: number, exclude?: Set<number>): Actor | null {
  let best: Actor | null = null;
  let bd = Infinity;
  for (const e of ctx.world.enemiesOf(faction, from.x, from.y, range)) {
    if (exclude?.has(e.id)) continue;
    const d = Math.hypot(e.pos.x - from.x, e.pos.y - from.y);
    if (d < bd && ctx.world.lineOfSight(from, e.pos)) {
      bd = d;
      best = e;
    }
  }
  return best;
}

/** Chain lightning style bounce. Returns hit actors. */
export function chainHit(ctx: GameCtx, c: SkillCastInfo, first: Actor | null, count: number, jump: number, mult: number, ramp = 0, extra: Partial<DamageSpec> = {}): Actor[] {
  const hit: Actor[] = [];
  const seen = new Set<number>();
  let from: Vec2 = { x: c.caster.pos.x, y: c.caster.pos.y };
  let target = first;
  const color = ELEMENT_COLOR[c.damageType];
  for (let i = 0; i < count && target; i++) {
    seen.add(target.id);
    ctx.fx.beam(from, target.pos, { color, width: 7, duration: 0.22, jagged: c.damageType === 'lightning' });
    ctx.combat.dealDamage(target, sd(ctx, c, mult * (1 + ramp * i), extra));
    ctx.fx.burst(ELEMENT_PARTICLES[c.damageType], target.pos, { count: 8, z: 0.6 });
    hit.push(target);
    from = { x: target.pos.x, y: target.pos.y };
    target = nearestEnemy(ctx, c.caster.faction, from, jump, seen);
  }
  return hit;
}

/** First enemy roughly along the aim direction (for chain/beam skills). */
export function aimTarget(ctx: GameCtx, c: SkillCastInfo, range: number): Actor | null {
  const t = ctx.world.getActor(c.targetId);
  if (t?.alive && Math.hypot(t.pos.x - c.caster.pos.x, t.pos.y - c.caster.pos.y) <= range + 1) return t;
  let best: Actor | null = null;
  let bs = Infinity;
  for (const e of ctx.world.enemiesOf(c.caster.faction, c.caster.pos.x, c.caster.pos.y, range)) {
    const d = vnorm({ x: e.pos.x - c.caster.pos.x, y: e.pos.y - c.caster.pos.y });
    const dot = d.x * c.dir.x + d.y * c.dir.y;
    if (dot < 0.55) continue;
    const dist = Math.hypot(e.pos.x - c.target.x, e.pos.y - c.target.y);
    if (dist < bs && ctx.world.lineOfSight(c.caster.pos, e.pos)) {
      bs = dist;
      best = e;
    }
  }
  return best;
}

/** Ring of sprite fx / particles for novas. */
export function novaFx(ctx: GameCtx, center: Vec2, radius: number, particles: string, color?: number): void {
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.fx.burst(particles, { x: center.x + Math.cos(a) * radius * 0.8, y: center.y + Math.sin(a) * radius * 0.8 }, { count: 4, color, z: 0.2 });
  }
  ctx.fx.shockwave(center, { radius: radius * 1.1, duration: 0.4 });
}

/** Per-actor scratch values for skills (stacks, timers). */
const scratch = new WeakMap<Actor, Record<string, number>>();
export function mem(a: Actor): Record<string, number> {
  let m = scratch.get(a);
  if (!m) {
    m = {};
    scratch.set(a, m);
  }
  return m;
}
