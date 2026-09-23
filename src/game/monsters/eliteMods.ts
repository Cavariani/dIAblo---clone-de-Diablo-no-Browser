// Elite modifier behaviours.
import type { GameCtx } from '../api';
import type { Actor } from '../types';
import { registerEliteMods } from './eliteModRegistry';

const dmg = (a: Actor, mult: number) => (a.monster?.baseDamage ?? 5) * mult;
const timer = (a: Actor, key: string, dt: number, every: number): boolean => {
  const s = a.monster!.modState;
  s[key] = (s[key] ?? every * (0.3 + Math.random() * 0.7)) - dt;
  if (s[key] <= 0) {
    s[key] = every;
    return true;
  }
  return false;
};
const engaged = (ctx: GameCtx, a: Actor, range = 10) => a.ai?.aggro && Math.hypot(ctx.player.pos.x - a.pos.x, ctx.player.pos.y - a.pos.y) < range && ctx.player.alive;

function explodeLater(ctx: GameCtx, a: Actor, radius: number, mult: number, type: 'fire' | 'physical'): void {
  ctx.combat.spawnGroundEffect({
    owner: null,
    faction: 'enemy',
    pos: { ...a.pos },
    radius,
    delay: 1,
    duration: 0,
    telegraph: true,
    color: 0xff5010,
    damage: { amount: dmg(a, mult), type, sourceId: null },
    onActivate: (g) => {
      ctx.fx.spriteFx('fx/blast', g.pos, { scale: radius / 3 });
      ctx.fx.burst('fire', g.pos, { count: 30, scale: radius });
      ctx.fx.shake(0.3, 0.25);
      ctx.fx.light(g.pos, { radius: radius * 3, color: 0xff6020, intensity: 1.8 }, 0.4);
      ctx.audio.play('explosion', { pos: g.pos });
    },
  });
}

registerEliteMods({
  shielding: {
    tick(ctx, a, dt) {
      if (!engaged(ctx, a)) return;
      if (timer(a, 'shield', dt, 8)) {
        a.invulnerable = 3;
        ctx.fx.spriteFx('fx/immunity', a.pos, { followId: a.id, duration: 3, scale: 0.7, alpha: 0.9 });
      }
    },
  },
  vampiric: {
    onHitTarget(ctx, a, _t, r) {
      ctx.combat.heal(a, r.amount * 0.25);
      ctx.fx.burst('blood', a.pos, { count: 4, z: 0.8 });
    },
  },
  explosive: {
    onDeath(ctx, a) {
      explodeLater(ctx, a, 2.2, 2.2, 'fire');
    },
  },
  molten: {
    tick(ctx, a, dt) {
      if (!engaged(ctx, a, 14)) return;
      if (timer(a, 'trail', dt, 0.45) && (Math.abs(a.vel.x) + Math.abs(a.vel.y) > 0.1))
        ctx.combat.spawnGroundEffect({ owner: null, faction: 'enemy', pos: { ...a.pos }, radius: 0.6, duration: 3.5, tickInterval: 0.5, hitOnce: false, damage: { amount: dmg(a, 0.25), type: 'fire', sourceId: null, isDot: true }, particles: 'fire', light: { radius: 1.2, color: 0xff5010, intensity: 0.6, flicker: 0.4 }, showArea: true, color: 0xff4010 });
    },
    onDeath(ctx, a) {
      explodeLater(ctx, a, 2, 1.8, 'fire');
    },
  },
  frozen: {
    tick(ctx, a, dt) {
      if (!engaged(ctx, a)) return;
      if (!timer(a, 'orb', dt, 6)) return;
      for (let i = 0; i < 3; i++) {
        const p = { x: ctx.player.pos.x + (Math.random() - 0.5) * 3, y: ctx.player.pos.y + (Math.random() - 0.5) * 3 };
        ctx.combat.spawnGroundEffect({
          owner: null,
          faction: 'enemy',
          pos: p,
          radius: 1.3,
          delay: 1.6,
          duration: 0,
          telegraph: true,
          color: 0x7ac8ff,
          damage: { amount: dmg(a, 1), type: 'cold', sourceId: a.id, status: { id: 'freeze', duration: 1.2, magnitude: 1 } },
          fx: 'fx/freeze',
          onActivate: (g) => {
            ctx.fx.spriteFx('fx/freeze', g.pos, { scale: 0.9 });
            ctx.fx.burst('ice', g.pos, { count: 20 });
            ctx.audio.play('ice_shatter', { pos: g.pos });
          },
        });
      }
    },
  },
  arcane: {
    tick(ctx, a, dt) {
      if (!engaged(ctx, a)) return;
      if (!timer(a, 'beam', dt, 5)) return;
      const base = Math.random() * Math.PI * 2;
      for (let i = 0; i < 3; i++) {
        const ang = base + (i * Math.PI * 2) / 3;
        ctx.combat.spawnGroundEffect({ owner: a, faction: 'enemy', pos: { ...a.pos }, shape: 'line', angle: ang, length: 6, width: 0.7, delay: 1.1, duration: 0, telegraph: true, color: 0xd070ff, damage: { amount: dmg(a, 1.3), type: 'arcane', sourceId: a.id }, onActivate: (g) => ctx.fx.beam(g.pos, { x: g.pos.x + Math.cos(ang) * 6, y: g.pos.y + Math.sin(ang) * 6 }, { color: 0xd070ff, width: 12, duration: 0.35 }) });
      }
    },
  },
  teleporter: {
    tick(ctx, a, dt) {
      if (!engaged(ctx, a, 12) || a.cast) return;
      if (!timer(a, 'tp', dt, 6)) return;
      const p = ctx.player.pos;
      ctx.fx.burst('arcane', a.pos, { count: 16 });
      ctx.combat.teleport(a, { x: p.x + (Math.random() - 0.5) * 2, y: p.y + (Math.random() - 0.5) * 2 });
      ctx.fx.burst('arcane', a.pos, { count: 16 });
      ctx.audio.play('teleport', { pos: a.pos });
    },
  },
  vortex: {
    tick(ctx, a, dt) {
      if (!engaged(ctx, a, 9)) return;
      if (!timer(a, 'vortex', dt, 8)) return;
      const p = ctx.player;
      ctx.fx.beam(a.pos, p.pos, { color: 0x8060ff, width: 8, duration: 0.3 });
      ctx.combat.dash(p, { x: a.pos.x + (p.pos.x - a.pos.x) * 0.15, y: a.pos.y + (p.pos.y - a.pos.y) * 0.15 }, 0.25);
      ctx.audio.play('teleport', { pos: a.pos });
    },
  },
  desecrator: {
    tick(ctx, a, dt) {
      if (!engaged(ctx, a)) return;
      if (!timer(a, 'pool', dt, 5)) return;
      ctx.combat.spawnGroundEffect({ owner: null, faction: 'enemy', pos: { ...ctx.player.pos }, radius: 1.2, delay: 0.8, duration: 4, tickInterval: 0.5, hitOnce: false, telegraph: false, damage: { amount: dmg(a, 0.35), type: 'fire', sourceId: null, isDot: true }, particles: 'fire', light: { radius: 2, color: 0xff4010, intensity: 0.9, flicker: 0.4 }, showArea: true, color: 0xff3010 });
    },
  },
  nightmarish: {
    onHitTarget(ctx, a, t) {
      if (Math.random() < 0.2 && t.kind === 'player') {
        ctx.combat.applyStatus(t, { id: 'slow', duration: 1.5, magnitude: 0.5 }, a.id);
        ctx.fx.burst('shadow', t.pos, { count: 12 });
      }
    },
  },
  electrified: {
    onDamaged(ctx, a) {
      if (Math.random() > 0.35) return;
      const ang = Math.random() * Math.PI * 2;
      ctx.combat.spawnProjectile({ owner: a, from: { ...a.pos }, dir: { x: Math.cos(ang), y: Math.sin(ang) }, speed: 4, radius: 0.2, range: 5, visual: 'fx/lightning', scale: 0.4, damage: { amount: dmg(a, 0.5), type: 'lightning', sourceId: a.id }, light: { radius: 1.5, color: 0xb0b0ff, intensity: 0.8 } });
    },
  },
  mortar: {
    tick(ctx, a, dt) {
      if (!engaged(ctx, a, 12) || a.cast) return;
      if (!timer(a, 'mortar', dt, 4)) return;
      const p = ctx.player.pos;
      for (let i = 0; i < 2; i++) {
        const to = { x: p.x + (Math.random() - 0.5) * 2.5, y: p.y + (Math.random() - 0.5) * 2.5 };
        ctx.combat.spawnGroundEffect({ owner: null, faction: 'enemy', pos: to, radius: 1.3, delay: 1.2, duration: 0, telegraph: true, color: 0xff8a30, damage: { amount: dmg(a, 1.2), type: 'fire', sourceId: a.id } });
        ctx.combat.spawnProjectile({ owner: a, from: { ...a.pos }, dir: { x: 1, y: 0 }, speed: Math.hypot(to.x - a.pos.x, to.y - a.pos.y) / 1.2, radius: 0.1, range: 99, visual: 'fx/fireball', scale: 0.7, lobTo: to, lobHeight: 4, hitsWalls: false, pierce: -1, damage: { amount: 0, type: 'fire', sourceId: a.id, silent: true } });
      }
    },
  },
});
