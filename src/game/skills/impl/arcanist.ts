// Arcanista skill implementations.
import { registerSkills } from '../registry';
import { onGameCreated } from '../../hooks';
import { aimTarget, chainHit, ELEMENT_COLOR, fan, mem, novaFx, sd, shoot, status } from '../helpers';
import type { GameCtx, SkillCastInfo } from '../../api';

function meteorAt(ctx: GameCtx, c: SkillCastInfo, at: { x: number; y: number }, radius: number, mult: number, delay: number): void {
  const cold = c.damageType === 'cold';
  const color = ELEMENT_COLOR[c.damageType];
  ctx.combat.spawnGroundEffect({
    owner: c.caster,
    faction: c.caster.faction,
    pos: at,
    radius,
    delay,
    duration: 0,
    telegraph: true,
    color,
    onActivate: (g) => {
      ctx.combat.aoe(c.caster, c.caster.faction, g.pos, radius, { damage: sd(ctx, c, mult, { knockback: 5, status: cold ? status('freeze', 1.5, 1) : status('burn', 3, 0.35) }) });
      ctx.fx.spriteFx('fx/blast', g.pos, { scale: radius / 3.2, tint: cold ? 0x9ad8ff : undefined });
      ctx.fx.burst(cold ? 'ice' : 'fire', g.pos, { count: 40, scale: radius });
      ctx.fx.light(g.pos, { radius: radius * 3, color, intensity: 2 }, 0.6);
      ctx.fx.decal(cold ? 'frost' : 'scorch', g.pos, { scale: radius });
      ctx.fx.shake(0.35 * mult, 0.3);
      ctx.audio.play('meteor_impact', { pos: g.pos, pitchVar: 0.1 });
      if (!cold)
        ctx.combat.spawnGroundEffect({ owner: c.caster, faction: c.caster.faction, pos: { ...g.pos }, radius: radius * 0.8, duration: c.params.burnDuration ?? 3, tickInterval: 0.5, hitOnce: false, damage: sd(ctx, c, 0.08 * mult, { isDot: true }), particles: 'fire', light: { radius: radius * 1.6, color: 0xff6020, intensity: 0.8, flicker: 0.3 }, showArea: true, color: 0xff4010 });
    },
  });
  // visual falling meteor: lobbed projectile with no damage
  const from = { x: at.x - 3, y: at.y - 3 };
  ctx.combat.spawnProjectile({
    owner: c.caster,
    from,
    dir: { x: 0.7, y: 0.7 },
    speed: Math.hypot(3, 3) / delay,
    radius: 0.1,
    range: 99,
    visual: cold ? 'fx/icicle' : 'fx/fireball',
    scale: 1.6 * Math.min(1.2, radius / 2),
    light: { radius: 3, color, intensity: 1.3 },
    trail: cold ? 'ice' : 'fire',
    lobTo: at,
    lobHeight: 7,
    hitsWalls: false,
    damage: { amount: 0, type: c.damageType, sourceId: c.caster.id, silent: true },
    pierce: -1,
  });
}

registerSkills({
  'arcanist.firebolt': {
    fire(ctx, c) {
      const p = c.params;
      const cold = c.damageType === 'cold';
      for (const d of fan(c.dir, p.count ?? 1, 14)) {
        shoot(ctx, c, {
          dir: d,
          visual: cold ? 'fx/icicle' : 'fx/fireball',
          speed: p.speed,
          radius: 0.22,
          explode: p.explode,
          light: { radius: 2.4, color: ELEMENT_COLOR[c.damageType], intensity: 1 },
          trail: cold ? 'ice' : 'embers',
          status: cold ? status('chill', 2, 0.3) : status('burn', 3, p.burn),
        });
      }
    },
  },
  'arcanist.spark': {
    fire(ctx, c) {
      const p = c.params;
      const first = aimTarget(ctx, c, c.def.range);
      if (!first) {
        const to = { x: c.caster.pos.x + c.dir.x * c.def.range * 0.7, y: c.caster.pos.y + c.dir.y * c.def.range * 0.7 };
        ctx.fx.beam(c.caster.pos, to, { color: 0xb8b0ff, width: 5, duration: 0.15, jagged: true });
      } else chainHit(ctx, c, first, (p.chain ?? 3) + 1, 3.5, 1, 0, { status: p.stun ? status('stun', p.stun, 1) : undefined });
      ctx.combat.addResource(c.caster, p.generate ?? 0);
      ctx.fx.light(c.caster.pos, { radius: 2.5, color: 0xb8b0ff, intensity: 1 }, 0.15);
    },
  },
  'arcanist.frost_nova': {
    fire(ctx, c) {
      const p = c.params;
      const a = c.caster;
      ctx.combat.aoe(a, a.faction, a.pos, p.radius, {
        damage: sd(ctx, c, 1, { status: status('freeze', p.freeze, 1) }),
        onHit: (t) => {
          if (p.shatter) mem(t).shatter = ctx.time + p.freeze;
        },
      });
      for (let i = 0; i < 10; i++) {
        const ang = (i / 10) * Math.PI * 2;
        const r = p.radius * (0.5 + Math.random() * 0.5);
        ctx.fx.spriteFx('fx/freeze', { x: a.pos.x + Math.cos(ang) * r, y: a.pos.y + Math.sin(ang) * r }, { scale: 0.7, additive: true });
      }
      novaFx(ctx, a.pos, p.radius, 'ice');
      ctx.fx.decal('frost', a.pos, { scale: p.radius * 0.8 });
      ctx.fx.light(a.pos, { radius: p.radius * 2, color: 0x7ac8ff, intensity: 1.6 }, 0.5);
    },
  },
  'arcanist.chain_lightning': {
    fire(ctx, c) {
      const p = c.params;
      const first = aimTarget(ctx, c, c.def.range);
      if (!first) {
        const to = { x: c.caster.pos.x + c.dir.x * c.def.range, y: c.caster.pos.y + c.dir.y * c.def.range };
        ctx.fx.beam(c.caster.pos, to, { color: 0xb8b0ff, width: 8, duration: 0.2, jagged: true });
        return;
      }
      chainHit(ctx, c, first, p.chain, p.jump, 1, p.ramp ?? 0);
      ctx.fx.spriteFx('fx/thunderstrike', first.pos, { scale: 0.7 });
      ctx.fx.light(first.pos, { radius: 4, color: 0xb8b0ff, intensity: 1.8 }, 0.25);
      if (p.orb)
        ctx.combat.spawnGroundEffect({ owner: c.caster, faction: c.caster.faction, pos: { ...first.pos }, radius: 1.8, duration: 3, tickInterval: 0.5, hitOnce: false, damage: sd(ctx, c, 0.2), fx: 'fx/lightning', particles: 'lightning', light: { radius: 2.5, color: 0xb8b0ff, intensity: 1, flicker: 0.4 }, showArea: true, color: 0x9a90ff });
    },
  },
  'arcanist.teleport': {
    fire(ctx, c) {
      const p = c.params;
      const a = c.caster;
      ctx.fx.burst('arcane', a.pos, { count: 24 });
      ctx.fx.spriteFx('fx/runes_blue', a.pos, { duration: 0.6, scale: 0.8 });
      const dest = ctx.world.clampMove(a.pos, c.target, a.radius * 0.8);
      const far = ctx.world.isWalkable(c.target.x, c.target.y) ? c.target : dest;
      ctx.combat.teleport(a, far);
      ctx.fx.burst('arcane', a.pos, { count: 30 });
      ctx.fx.light(a.pos, { radius: 3.5, color: 0xd070ff, intensity: 1.6 }, 0.4);
      if (p.implode) ctx.combat.aoe(a, a.faction, a.pos, 2, { damage: sd(ctx, c, 0, { amount: ctx.combat.skillDamage(a, p.implode, 'arcane'), knockback: 4 }) });
      if (p.cdr) a.cooldowns[c.def.id] = Math.max(0, (a.cooldowns[c.def.id] ?? 0) - p.cdr);
      if (p.shield) {
        a.shield += a.maxLife * p.shield;
        ctx.combat.applyStatus(a, { id: 'shielded', duration: 4, magnitude: a.maxLife * p.shield }, a.id);
      }
    },
  },
  'arcanist.meteor': {
    fire(ctx, c) {
      const p = c.params;
      if (p.shower) {
        for (let i = 0; i < p.shower; i++) {
          const at = { x: c.target.x + (Math.random() - 0.5) * 4, y: c.target.y + (Math.random() - 0.5) * 4 };
          meteorAt(ctx, c, ctx.world.isWalkable(at.x, at.y) ? at : c.target, p.radius * 0.6, 0.35, p.delay + i * 0.18);
        }
      } else meteorAt(ctx, c, c.target, p.radius, 1, p.delay);
    },
  },
  'arcanist.arcane_ward': {
    fire(ctx, c) {
      const p = c.params;
      const a = c.caster;
      const amount = a.maxLife * (p.shield / 100);
      a.shield = Math.max(a.shield, amount);
      ctx.combat.applyStatus(a, { id: 'shielded', duration: p.duration, magnitude: amount }, a.id);
      if (p.dr) ctx.combat.applyStatus(a, { id: 'fortify', duration: p.duration, magnitude: 0.2 }, a.id);
      mem(a).wardBurst = p.burst ? ctx.time + p.duration : 0;
      ctx.fx.spriteFx('fx/shield', a.pos, { followId: a.id, loop: true, duration: p.duration, scale: 0.8, alpha: 0.85 });
      ctx.fx.burst('arcane', a.pos, { count: 24 });
    },
  },
  'arcanist.blizzard': {
    fire(ctx, c) {
      const p = c.params;
      const lightning = c.damageType === 'lightning';
      ctx.combat.spawnGroundEffect({
        owner: c.caster,
        faction: c.caster.faction,
        pos: { ...c.target },
        radius: p.radius,
        duration: p.duration,
        tickInterval: 0.5,
        hitOnce: false,
        damage: sd(ctx, c, 0.5, { status: lightning ? status('shock', 1, 0.1) : p.freezeChance ? status('freeze', 1, 1, p.freezeChance) : status('chill', 1.5, 0.4) }),
        showArea: true,
        color: lightning ? 0x9a90ff : 0x7ac8ff,
        light: { radius: p.radius * 1.8, color: lightning ? 0xb8b0ff : 0x7ac8ff, intensity: 0.8, flicker: lightning ? 0.5 : 0.1 },
        onTick: (g) => {
          for (let i = 0; i < 4; i++) {
            const ang = Math.random() * Math.PI * 2;
            const r = Math.random() * g.radius;
            const at = { x: g.pos.x + Math.cos(ang) * r, y: g.pos.y + Math.sin(ang) * r };
            if (lightning) ctx.fx.spriteFx('fx/thunderstrike', at, { scale: 0.35 });
            else ctx.fx.spriteFx('fx/icicle', at, { scale: 0.6, angle: Math.PI / 4, z: 0.2 });
            ctx.fx.burst(lightning ? 'lightning' : 'ice', at, { count: 5 });
          }
        },
      });
    },
  },
});

// Frost nova "Estilhaços": frozen enemies explode on death.
onGameCreated((game) => {
  game.events.on('actorDied', ({ actor }: { actor: import('../../types').Actor }) => {
    const m = mem(actor);
    if (m.shatter && game.time < m.shatter) {
      game.combat.aoe(game.player, 'player', actor.pos, 1.8, { damage: { amount: game.combat.skillDamage(game.player, 1.2, 'cold'), type: 'cold', sourceId: game.player.id } });
      game.fx.burst('ice', actor.pos, { count: 30 });
      game.audio.play('ice_shatter', { pos: actor.pos });
    }
  });
});
