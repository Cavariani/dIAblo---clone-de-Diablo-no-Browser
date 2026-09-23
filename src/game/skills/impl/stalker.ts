// Espreitador skill implementations.
import { registerSkills } from '../registry';
import { addBuff } from '../buffs';
import { ELEMENT_COLOR, fan, nearestEnemy, sd, shoot, status } from '../helpers';
import type { GameCtx, SkillCastInfo } from '../../api';
import type { GroundEffect } from '../../types';

const sentries: GroundEffect[] = [];

function caltropsAt(ctx: GameCtx, c: SkillCastInfo, at: { x: number; y: number }, radius: number, duration: number): void {
  const p = c.params;
  const poison = c.damageType === 'poison';
  ctx.combat.spawnGroundEffect({
    owner: c.caster,
    faction: c.caster.faction,
    pos: { ...at },
    radius,
    duration,
    tickInterval: 0.5,
    hitOnce: false,
    damage: sd(ctx, c, 0.5 * (p.dmgMult ?? 1), { status: p.root ? status('root', p.root, 1, 0.35) : status('slow', 1, (p.slow ?? 60) / 100), isDot: true }),
    showArea: true,
    color: poison ? 0x6ab020 : 0x8a8070,
  });
  for (let i = 0; i < 6; i++) {
    const ang = Math.random() * Math.PI * 2;
    const r = Math.random() * radius * 0.8;
    ctx.fx.spriteFx('fx/caltrops', { x: at.x + Math.cos(ang) * r, y: at.y + Math.sin(ang) * r }, { duration, additive: false, angle: ang, tint: poison ? 0xa0ff60 : undefined });
  }
}

registerSkills({
  'stalker.rapid_shot': {
    fire(ctx, c) {
      const p = c.params;
      const fire = c.damageType === 'fire';
      for (const d of fan(c.dir, p.count ?? 1, 8)) {
        shoot(ctx, c, {
          dir: d,
          visual: 'fx/arrows',
          speed: p.speed,
          radius: 0.16,
          tint: fire ? 0xffb080 : undefined,
          trail: fire ? 'embers' : undefined,
          light: fire ? { radius: 1.5, color: 0xff7a20, intensity: 0.7 } : undefined,
          status: fire ? status('burn', 3, p.burn) : undefined,
          onHit: p.bounce
            ? (t, pr) => {
                if (pr.hitIds.size > 1) return;
                const n = nearestEnemy(ctx, c.caster.faction, t.pos, 5, pr.hitIds);
                if (n) {
                  const dx = n.pos.x - t.pos.x;
                  const dy = n.pos.y - t.pos.y;
                  const l = Math.hypot(dx, dy) || 1;
                  shoot(ctx, c, { from: { ...t.pos }, dir: { x: dx / l, y: dy / l }, visual: 'fx/arrows', speed: p.speed, mult: 0.7, range: 6 });
                }
              }
            : undefined,
        });
      }
    },
  },
  'stalker.piercing_shot': {
    fire(ctx, c) {
      const p = c.params;
      const poison = c.damageType === 'poison';
      shoot(ctx, c, {
        visual: 'fx/arrows',
        speed: p.speed,
        radius: 0.2,
        scale: 1.2,
        pierce: p.pierce,
        knockback: p.knockback ?? 2,
        tint: poison ? 0xa0ff60 : 0xfff0d0,
        trail: poison ? 'poison' : undefined,
        status: poison ? status('poison', 4, p.poison) : p.vuln ? status('vulnerable', p.vuln, 0.2) : undefined,
      });
    },
  },
  'stalker.multishot': {
    fire(ctx, c) {
      const p = c.params;
      const cold = c.damageType === 'cold';
      const volley = () => {
        for (const d of fan(c.dir, p.count, p.spread))
          shoot(ctx, c, { dir: d, visual: 'fx/arrows', speed: p.speed, radius: 0.16, tint: cold ? 0x9ad8ff : undefined, trail: cold ? 'ice' : undefined, status: cold ? status('chill', 2, 0.35) : undefined });
      };
      volley();
      if (p.volley)
        ctx.combat.spawnGroundEffect({ owner: null, faction: 'neutral', pos: { ...c.caster.pos }, delay: 0.22, duration: 0, onActivate: volley });
    },
  },
  'stalker.evasive_roll': {
    fire(ctx, c) {
      const p = c.params;
      const a = c.caster;
      const start = { ...a.pos };
      const to = { x: a.pos.x + c.dir.x * p.dist, y: a.pos.y + c.dir.y * p.dist };
      a.invulnerable = Math.max(a.invulnerable, 0.35);
      ctx.combat.dash(a, to, 0.3, { onStep: () => Math.random() < 0.3 && ctx.fx.burst('dust', a.pos, { count: 2 }) });
      if (p.caltrops) caltropsAt(ctx, c, start, 1.6, 4);
      if (p.haste) addBuff(ctx, 'roll_haste', 'Salto Tático', { attackSpeed: 0.3 }, 3);
      if (p.fear) for (const e of ctx.world.enemiesOf(a.faction, start.x, start.y, 3)) ctx.combat.applyStatus(e, { id: 'fear', duration: p.fear, magnitude: 1 }, a.id);
    },
  },
  'stalker.explosive_arrow': {
    fire(ctx, c) {
      const p = c.params;
      const lightning = c.damageType === 'lightning';
      shoot(ctx, c, {
        visual: 'fx/arrows',
        speed: p.speed,
        radius: 0.2,
        explode: p.radius,
        tint: lightning ? 0xc0b0ff : 0xffa060,
        trail: lightning ? 'lightning' : 'embers',
        light: { radius: 1.8, color: ELEMENT_COLOR[c.damageType], intensity: 0.8 },
        status: p.stun ? status('stun', p.stun, 1) : status('burn', 2, 0.3),
        onExpire: (pr) => {
          ctx.fx.spriteFx('fx/blast', pr.pos, { scale: p.radius / 3.5, tint: lightning ? 0xb0a0ff : undefined });
          ctx.fx.shake(0.2, 0.2);
          ctx.audio.play('explosive_arrow', { pos: pr.pos });
          ctx.fx.decal('scorch', pr.pos, { scale: p.radius * 0.8 });
          if (p.cluster)
            for (let i = 0; i < p.cluster; i++) {
              const ang = (i / p.cluster) * Math.PI * 2;
              const at = { x: pr.pos.x + Math.cos(ang) * 1.6, y: pr.pos.y + Math.sin(ang) * 1.6 };
              ctx.combat.spawnGroundEffect({ owner: c.caster, faction: c.caster.faction, pos: at, radius: 1.1, delay: 0.25 + i * 0.07, duration: 0, damage: sd(ctx, c, 0.4), onActivate: (g) => ctx.fx.burst('fire', g.pos, { count: 14 }) });
            }
          if (p.burn)
            ctx.combat.spawnGroundEffect({ owner: c.caster, faction: c.caster.faction, pos: { ...pr.pos }, radius: p.radius * 0.8, duration: 3, tickInterval: 0.5, hitOnce: false, damage: sd(ctx, c, 0.1, { isDot: true }), particles: 'fire', light: { radius: 2.5, color: 0xff6020, intensity: 0.8, flicker: 0.3 }, showArea: true, color: 0xff5010 });
        },
      });
    },
  },
  'stalker.caltrops': {
    fire(ctx, c) {
      caltropsAt(ctx, c, c.target, c.params.radius, c.params.duration);
    },
  },
  'stalker.sentry': {
    fire(ctx, c) {
      const p = c.params;
      while (sentries.filter((s) => s.alive).length >= p.max) {
        const old = sentries.find((s) => s.alive);
        if (!old) break;
        old.alive = false;
      }
      const fire = c.damageType === 'fire';
      const handle = ctx.fx.spriteFx(fire ? 'fx/runes_orange' : 'fx/runes_blue', c.target, { loop: true, duration: p.duration, scale: 0.8 });
      let timer = 0;
      const g = ctx.combat.spawnGroundEffect({
        owner: c.caster,
        faction: 'neutral',
        pos: { ...c.target },
        radius: 0.4,
        duration: p.duration,
        tickInterval: 0.1,
        light: { radius: 2.2, color: fire ? 0xff8030 : 0x60a0ff, intensity: 0.9 },
        showArea: false,
        onTick: (ge) => {
          timer += 0.1;
          if (timer < p.rate) return;
          const t = nearestEnemy(ctx, 'player', ge.pos, p.range);
          if (!t) return;
          timer = 0;
          const dx = t.pos.x - ge.pos.x;
          const dy = t.pos.y - ge.pos.y;
          const l = Math.hypot(dx, dy) || 1;
          shoot(ctx, c, { from: { x: ge.pos.x + dx / l * 0.3, y: ge.pos.y + dy / l * 0.3 }, dir: { x: dx / l, y: dy / l }, visual: fire ? 'fx/fireball' : 'fx/arrows', speed: 13, range: p.range + 1, scale: fire ? 0.6 : 1 });
          ctx.audio.play('bow_shot', { pos: ge.pos, volume: 0.5 });
          if (p.dr && Math.hypot(ctx.player.pos.x - ge.pos.x, ctx.player.pos.y - ge.pos.y) < 4) ctx.combat.applyStatus(ctx.player, { id: 'fortify', duration: 0.6, magnitude: 0.1 }, ctx.player.id);
        },
        onExpire: () => ctx.fx.stopFx(handle),
      });
      sentries.push(g);
      if (sentries.length > 12) sentries.splice(0, sentries.length - 12);
    },
  },
  'stalker.rain_of_arrows': {
    fire(ctx, c) {
      const p = c.params;
      const fire = c.damageType === 'fire';
      ctx.combat.spawnGroundEffect({
        owner: c.caster,
        faction: c.caster.faction,
        pos: { ...c.target },
        radius: p.radius,
        duration: p.duration,
        tickInterval: p.tick,
        hitOnce: false,
        damage: sd(ctx, c, 1, { status: fire ? status('burn', 2, 0.3) : undefined }),
        showArea: true,
        color: fire ? 0xff6020 : 0xc8b890,
        onTick: (g) => {
          for (let i = 0; i < 7; i++) {
            const ang = Math.random() * Math.PI * 2;
            const r = Math.random() * g.radius;
            const at = { x: g.pos.x + Math.cos(ang) * r, y: g.pos.y + Math.sin(ang) * r };
            ctx.fx.spriteFx('fx/arrow_stuck', at, { duration: 1.2, additive: false, angle: Math.PI * 0.25 + (Math.random() - 0.5), tint: fire ? 0xffa060 : undefined });
            ctx.fx.burst(fire ? 'embers' : 'dust', at, { count: 3 });
          }
          ctx.audio.play('arrow_wall', { pos: g.pos, volume: 0.5 });
        },
      });
    },
  },
});
