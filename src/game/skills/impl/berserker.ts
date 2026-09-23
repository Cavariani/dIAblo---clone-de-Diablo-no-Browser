// Berserker skill implementations.
import { registerSkills } from '../registry';
import { addBuff } from '../buffs';
import { mem, novaFx, sd, status, chainHit } from '../helpers';

registerSkills({
  'berserker.cleave': {
    fire(ctx, c) {
      const angle = Math.atan2(c.dir.y, c.dir.x);
      const p = c.params;
      let hits = 0;
      ctx.fx.spriteFx('fx/cleave', { x: c.caster.pos.x + c.dir.x * 0.5, y: c.caster.pos.y + c.dir.y * 0.5 }, { angle, additive: true, scale: 0.9, z: 0.6, tint: c.rune === 'c' ? 0xff6060 : undefined });
      ctx.combat.melee(c.caster, {
        angle,
        arcDeg: p.arc,
        range: c.def.range,
        damage: sd(ctx, c, 1, { knockback: p.knockback, status: p.bleed ? status('bleed', 3, p.bleed / 100) : undefined }),
        onHit: () => {
          hits++;
          if (hits <= 3) ctx.combat.addResource(c.caster, p.generate);
          if (p.heal) ctx.combat.heal(c.caster, c.caster.maxLife * (p.heal / 100), 'skill');
        },
      });
      if (p.wave) {
        ctx.combat.cone(c.caster, c.caster.pos, angle, 40, p.wave, { damage: sd(ctx, c, 0.6) });
        ctx.fx.burst('dust', { x: c.caster.pos.x + c.dir.x * 2, y: c.caster.pos.y + c.dir.y * 2 }, { count: 12, dir: c.dir });
      }
    },
  },
  'berserker.frenzy': {
    fire(ctx, c) {
      const p = c.params;
      const m = mem(c.caster);
      const hits = ctx.combat.melee(c.caster, {
        angle: Math.atan2(c.dir.y, c.dir.x),
        arcDeg: 70,
        range: c.def.range,
        maxTargets: 1,
        damage: sd(ctx, c, 1, { knockback: 1 }),
      });
      if (hits.length) {
        ctx.combat.addResource(c.caster, p.generate);
        m.frenzy = Math.min(p.maxStacks, (ctx.time - (m.frenzyAt ?? -99) < p.stackTime ? (m.frenzy ?? 0) : 0) + 1);
        m.frenzyAt = ctx.time;
        addBuff(ctx, 'frenzy', 'Frenesi', { attackSpeed: (p.stackAs / 100) * m.frenzy }, p.stackTime);
        if (p.heal) ctx.combat.heal(c.caster, c.caster.maxLife * (p.heal / 100), 'skill');
        if (p.chain && Math.random() < 0.25) chainHit(ctx, c, hits[0], p.chain + 1, 4, 0.6);
      }
    },
  },
  'berserker.seismic_slam': {
    fire(ctx, c) {
      const p = c.params;
      const angle = Math.atan2(c.dir.y, c.dir.x);
      ctx.combat.cone(c.caster, c.caster.pos, angle, p.arc, p.length, {
        damage: sd(ctx, c, 1, { knockback: p.knockback, isArea: true, status: p.stun ? status('stun', p.stun, 1) : undefined }),
      });
      for (let i = 1; i <= 4; i++) {
        const d = (p.length * i) / 4.5;
        const at = { x: c.caster.pos.x + c.dir.x * d, y: c.caster.pos.y + c.dir.y * d };
        ctx.fx.spriteFx('fx/quake', at, { scale: 0.45 + i * 0.12, additive: false, alpha: 0.9 });
        ctx.fx.burst(p.burn ? 'fire' : 'dust', at, { count: 10, scale: 1 + i * 0.2 });
        ctx.fx.decal(p.burn ? 'scorch' : 'crack', at, { scale: 0.8 });
        if (p.burn)
          ctx.combat.spawnGroundEffect({ owner: c.caster, faction: c.caster.faction, pos: at, radius: 0.9, duration: 3, tickInterval: 0.5, hitOnce: false, damage: sd(ctx, c, 0.08, { isDot: true }), particles: 'fire', light: { radius: 1.5, color: 0xff6020, intensity: 0.7 }, showArea: true, color: 0xff5010 });
      }
      ctx.fx.shake(0.3, 0.25);
      ctx.combat.hitStop(0.04);
    },
  },
  'berserker.leap': {
    fire(ctx, c) {
      const p = c.params;
      const to = c.target;
      ctx.combat.dash(c.caster, to, 0.45, {
        arc: 1.6,
        onArrive: () => {
          const a = c.caster;
          ctx.combat.aoe(a, a.faction, a.pos, p.radius, {
            damage: sd(ctx, c, 1, { knockback: 4, status: p.stun ? status('stun', p.stun, 1) : status('slow', 2, p.slow) }),
          });
          ctx.fx.spriteFx('fx/quake', a.pos, { scale: 0.9, additive: false });
          novaFx(ctx, a.pos, p.radius, 'dust');
          ctx.fx.decal(p.burn ? 'scorch' : 'crack', a.pos, { scale: 1.4 });
          ctx.fx.shake(0.45, 0.3);
          ctx.audio.play('leap_slam', { pos: a.pos });
          ctx.combat.hitStop(0.05);
          if (p.burn)
            ctx.combat.spawnGroundEffect({ owner: a, faction: a.faction, pos: { ...a.pos }, radius: p.radius, duration: 4, tickInterval: 0.5, hitOnce: false, damage: sd(ctx, c, 0.15, { isDot: true }, 'fire'), particles: 'fire', light: { radius: 3, color: 0xff6020, intensity: 1 }, showArea: true, color: 0xff5010 });
          if (p.armor) {
            addBuff(ctx, 'leap_iron', 'Salto de Ferro', { armorPct: 0.5 }, 4);
            ctx.combat.addResource(a, p.generate ?? 0);
          }
        },
      });
      c.caster.invulnerable = Math.max(c.caster.invulnerable, 0.4);
    },
  },
  'berserker.war_cry': {
    fire(ctx, c) {
      const p = c.params;
      const a = c.caster;
      addBuff(ctx, 'war_cry', 'Grito de Guerra', { armorPct: p.armor / 100, damagePct: (p.dmgBuff ?? 0) / 100 }, p.duration);
      ctx.combat.applyStatus(a, { id: 'fortify', duration: p.duration, magnitude: 0.2 }, a.id);
      ctx.combat.addResource(a, p.generate);
      if (p.heal) ctx.combat.heal(a, a.maxLife * (p.heal / 100), 'skill');
      if (p.fear) for (const e of ctx.world.enemiesOf(a.faction, a.pos.x, a.pos.y, 4)) ctx.combat.applyStatus(e, { id: 'fear', duration: p.fear, magnitude: 1 }, a.id);
      novaFx(ctx, a.pos, 3, 'embers', 0xffa040);
      ctx.fx.light(a.pos, { radius: 5, color: 0xff8030, intensity: 1.4 }, 0.6);
      ctx.fx.shake(0.2, 0.3);
    },
  },
  'berserker.whirlwind': {
    fire(ctx, c) {
      mem(c.caster).ww = 0;
    },
    channel(ctx, c, dt) {
      const m = mem(c.caster);
      const p = c.params;
      m.ww = (m.ww ?? 0) + dt;
      m.wwFx = (m.wwFx ?? 0) + dt;
      if (m.wwFx > 0.08) {
        m.wwFx = 0;
        const a = c.caster;
        const ang = ctx.time * 14;
        ctx.fx.burst(c.damageType === 'fire' ? 'fire' : 'sparks', { x: a.pos.x + Math.cos(ang) * p.radius * 0.8, y: a.pos.y + Math.sin(ang) * p.radius * 0.8 }, { count: 3, z: 0.5 });
        ctx.fx.burst('dust', a.pos, { count: 1 });
        c.caster.facing += 1.2;
      }
      if (m.ww >= p.tick) {
        m.ww -= p.tick;
        ctx.combat.aoe(c.caster, c.caster.faction, c.caster.pos, p.radius, {
          damage: sd(ctx, c, 1, { knockback: 1, procCoef: 0.4 }),
          onHit: (_t, r) => {
            if (r.crit && p.heal) ctx.combat.heal(c.caster, c.caster.maxLife * (p.heal / 100), 'leech');
          },
        });
        ctx.audio.play('whirlwind_loop', { pos: c.caster.pos, volume: 0.6 });
        if (p.tornado && Math.random() < 0.35) {
          const ang = Math.random() * Math.PI * 2;
          ctx.combat.spawnProjectile({
            owner: c.caster,
            from: { ...c.caster.pos },
            dir: { x: Math.cos(ang), y: Math.sin(ang) },
            speed: 2.5,
            radius: 0.45,
            range: 5,
            visual: 'fx/dark_mist',
            tint: 0xd8d0c0,
            scale: 0.35,
            pierce: 99,
            hitsWalls: true,
            damage: sd(ctx, c, 0.6, { procCoef: 0.2 }),
          });
        }
      }
    },
  },
  'berserker.ground_stomp': {
    fire(ctx, c) {
      const p = c.params;
      const a = c.caster;
      ctx.combat.aoe(a, a.faction, a.pos, p.radius, {
        damage: sd(ctx, c, 1, { knockback: 2, status: status('stun', p.stun, 1) }),
        onHit: (t) => {
          if (p.vuln) ctx.combat.applyStatus(t, { id: 'vulnerable', duration: p.vuln, magnitude: 0.2 }, a.id);
        },
      });
      ctx.combat.addResource(a, p.generate);
      ctx.fx.spriteFx('fx/quake', a.pos, { scale: p.radius / 2.2, additive: false });
      novaFx(ctx, a.pos, p.radius, 'dust');
      ctx.fx.decal('crack', a.pos, { scale: 1.6 });
      ctx.fx.shake(0.5, 0.35);
      ctx.combat.hitStop(0.06);
    },
  },
  'berserker.wrath': {
    fire(ctx, c) {
      const p = c.params;
      const a = c.caster;
      addBuff(ctx, 'wrath', 'Ira do Berserker', { damagePct: p.dmgBuff / 100, attackSpeed: p.asBuff / 100, moveSpeed: p.msBuff / 100, damageReduction: p.dr ? 0.25 : 0, ccReduction: p.dr ? 1 : 0 }, p.duration);
      ctx.combat.aoe(a, a.faction, a.pos, p.radius, { damage: sd(ctx, c, p.triple ? 3 : 1, { knockback: 6 }) });
      ctx.fx.spriteFx('fx/blast', a.pos, { scale: 0.8 });
      novaFx(ctx, a.pos, p.radius, 'fire');
      ctx.fx.light(a.pos, { radius: 7, color: 0xff5020, intensity: 2 }, 0.8);
      ctx.fx.screenFlash(0xff3010, 0.25, 0.4);
      ctx.fx.shake(0.6, 0.4);
      ctx.combat.hitStop(0.08);
      ctx.fx.spriteFx('fx/shield_orange', a.pos, { followId: a.id, loop: true, duration: p.duration, scale: 0.8, alpha: 0.7 });
    },
  },
});
