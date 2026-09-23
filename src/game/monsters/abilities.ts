// Generic executor for data-driven monster abilities (EnemyAbilityDef.kind).
import { vnorm, type Vec2 } from '../../core/math';
import { Data } from '../../data';
import type { EnemyAbilityDef } from '../../data/schema';
import type { GameCtx } from '../api';
import type { Actor, DamageSpec } from '../types';

function dmg(ctx: GameCtx, a: Actor, ab: EnemyAbilityDef, extra: Partial<DamageSpec> = {}): DamageSpec {
  return { amount: ctx.combat.monsterDamage(a, ab.damageMult), type: ab.damageType, sourceId: a.id, status: ab.status, ...extra };
}

const ELEMENT_COLOR: Record<string, number> = { fire: 0xff5a1a, cold: 0x6ac8ff, lightning: 0xb8b0ff, poison: 0x7ad030, arcane: 0xd070ff, physical: 0xff2a1a };

/** Draw the wind-up warning shape for telegraphed abilities. */
export function telegraphAbility(ctx: GameCtx, a: Actor, ab: EnemyAbilityDef, target: Vec2): void {
  const aoe = ab.aoe;
  if (!aoe) return;
  const color = ELEMENT_COLOR[ab.damageType] ?? 0xff2a1a;
  const angle = Math.atan2(target.y - a.pos.y, target.x - a.pos.x);
  if (aoe.shape === 'line') {
    ctx.combat.spawnGroundEffect({ owner: a, faction: a.faction, pos: { ...a.pos }, shape: 'line', angle, length: aoe.length ?? ab.range, width: aoe.width ?? 1, delay: ab.windup, duration: 0, telegraph: true, color });
  } else if (aoe.shape === 'cone') {
    ctx.combat.spawnGroundEffect({ owner: a, faction: a.faction, pos: { ...a.pos }, shape: 'cone', angle, arcDeg: aoe.arcDeg ?? 90, radius: aoe.radius, delay: ab.windup, duration: 0, telegraph: true, color });
  } else {
    const center = ab.kind === 'explode' || ab.kind === 'nova' ? a.pos : target;
    ctx.combat.spawnGroundEffect({ owner: a, faction: a.faction, pos: { ...center }, shape: 'circle', radius: aoe.radius, delay: ab.windup, duration: 0, telegraph: true, color, followId: ab.kind === 'explode' ? a.id : null });
  }
}

export function executeAbility(ctx: GameCtx, a: Actor, ab: EnemyAbilityDef, target: Vec2, targetId: number | null): void {
  if (ab.sfx) ctx.audio.play(ab.sfx, { pos: a.pos, pitchVar: 0.1 });
  const dir = vnorm({ x: target.x - a.pos.x, y: target.y - a.pos.y });
  const angle = Math.atan2(dir.y, dir.x);
  switch (ab.kind) {
    case 'melee': {
      if (ab.aoe?.shape === 'cone') {
        ctx.combat.cone(a, a.pos, angle, ab.aoe.arcDeg ?? 90, ab.aoe.radius, { damage: dmg(ctx, a, ab, { isMelee: true, knockback: 3 }) });
        ctx.fx.burst('dust', { x: a.pos.x + dir.x * 0.8, y: a.pos.y + dir.y * 0.8 }, { count: 10 });
      } else {
        ctx.combat.melee(a, { angle, arcDeg: 80, range: ab.range + 0.25, maxTargets: 1, damage: dmg(ctx, a, ab, { isMelee: true, knockback: 1 }) });
      }
      ctx.audio.play('monster_attack', { pos: a.pos, pitchVar: 0.15, volume: 0.6 });
      break;
    }
    case 'projectile': {
      const spec = ab.projectile!;
      const count = spec.count ?? 1;
      const spread = ((spec.spreadDeg ?? 12) * Math.PI) / 180;
      for (let i = 0; i < count; i++) {
        const off = count > 1 ? (i / (count - 1) - 0.5) * spread : 0;
        const d = { x: Math.cos(angle + off), y: Math.sin(angle + off) };
        ctx.combat.spawnProjectile({
          owner: a,
          from: { x: a.pos.x + d.x * 0.35, y: a.pos.y + d.y * 0.35 },
          dir: d,
          speed: spec.speed,
          radius: spec.radius,
          range: spec.range,
          visual: spec.visual,
          light: spec.light,
          trail: spec.trail,
          homing: spec.homing,
          targetId,
          explodeRadius: spec.explodeRadius,
          lobTo: spec.gravityArc ? { ...target } : undefined,
          damage: dmg(ctx, a, ab, { isRanged: true }),
        });
      }
      break;
    }
    case 'aoe':
    case 'nova':
    case 'explode': {
      const r = ab.aoe?.radius ?? 1.5;
      const center = ab.kind === 'aoe' ? target : a.pos;
      ctx.combat.aoe(a, a.faction, center, r, { damage: dmg(ctx, a, ab, { knockback: 3 }) });
      const fire = ab.damageType === 'fire';
      ctx.fx.burst(fire ? 'fire' : ab.damageType === 'cold' ? 'ice' : 'dust', center, { count: 30, scale: r });
      ctx.fx.light(center, { radius: r * 2.5, color: ELEMENT_COLOR[ab.damageType] ?? 0xffa040, intensity: 1.6 }, 0.35);
      ctx.fx.decal(fire ? 'scorch' : 'crack', center, { scale: r });
      ctx.fx.shake(0.25, 0.2);
      ctx.audio.play(fire ? 'explosion' : 'ground_stomp', { pos: center, pitchVar: 0.1 });
      if (ab.kind === 'explode') ctx.combat.kill(a, null);
      break;
    }
    case 'charge':
    case 'leap': {
      const len = Math.min(ab.aoe?.length ?? ab.range, ab.range);
      const to = { x: a.pos.x + dir.x * len, y: a.pos.y + dir.y * len };
      const hit = new Set<number>();
      ctx.combat.dash(a, to, len / 9, {
        arc: ab.kind === 'leap' ? 1.2 : 0,
        onStep: () => {
          ctx.combat.aoe(a, a.faction, a.pos, (ab.aoe?.width ?? 0.8) / 2 + 0.3, { damage: dmg(ctx, a, ab, { knockback: 5 }), exclude: hit, onHit: (t) => hit.add(t.id) });
        },
        onArrive: () => ctx.fx.burst('dust', a.pos, { count: 14 }),
      });
      break;
    }
    case 'summon': {
      const s = ab.summon!;
      const alive = ctx.world.actors.filter((m) => m.alive && m.monster?.spawnedBy === a.id).length;
      const n = Math.min(s.count, s.maxAlive - alive);
      for (let i = 0; i < n; i++) {
        const p = { x: a.pos.x + (Math.random() - 0.5) * 2.5, y: a.pos.y + (Math.random() - 0.5) * 2.5 };
        const m = ctx.combat.summon({ enemyId: s.enemyId, pos: p, faction: a.faction, owner: a, level: a.level });
        if (m) ctx.fx.burst('portal', m.pos, { count: 16, color: 0x7affb0 });
      }
      break;
    }
    case 'teleport': {
      const away = { x: a.pos.x - dir.x * ab.range + (Math.random() - 0.5) * 2, y: a.pos.y - dir.y * ab.range + (Math.random() - 0.5) * 2 };
      ctx.fx.burst('arcane', a.pos, { count: 16 });
      ctx.combat.teleport(a, away);
      ctx.fx.burst('arcane', a.pos, { count: 16 });
      break;
    }
    case 'buff': {
      if (ab.status) ctx.combat.applyStatus(a, ab.status, a.id);
      break;
    }
    case 'beam': {
      const to = { x: a.pos.x + dir.x * ab.range, y: a.pos.y + dir.y * ab.range };
      ctx.combat.line(a, a.pos, to, ab.aoe?.width ?? 0.6, { damage: dmg(ctx, a, ab) });
      ctx.fx.beam(a.pos, to, { color: ELEMENT_COLOR[ab.damageType] ?? 0xffffff, width: 10, duration: 0.25, jagged: ab.damageType === 'lightning' });
      break;
    }
  }
  void Data;
}
