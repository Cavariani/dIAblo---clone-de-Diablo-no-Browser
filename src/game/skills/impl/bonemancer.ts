// Ossomante skill implementations.
import { registerSkills } from '../registry';
import { onGameCreated } from '../../hooks';
import { fan, mem, novaFx, sd, shoot, status } from '../helpers';
import type { Actor } from '../../types';

registerSkills({
  'bonemancer.bone_splinters': {
    fire(ctx, c) {
      const p = c.params;
      const cold = c.damageType === 'cold';
      for (const d of fan(c.dir, p.count, p.spread))
        shoot(ctx, c, { dir: d, visual: 'fx/throw_knife', speed: p.speed, radius: 0.16, tint: cold ? 0x9ad8ff : 0xf0e8d8, impactParticles: 'bone', status: cold ? status('chill', 2, 0.3) : undefined });
      ctx.combat.addResource(c.caster, p.generate);
    },
  },
  'bonemancer.siphon': {
    fire(ctx, c) {
      const p = c.params;
      const t = ctx.world.getActor(c.targetId);
      shoot(ctx, c, {
        visual: 'fx/channel',
        speed: p.speed,
        radius: 0.25,
        tint: 0xff4050,
        homing: 4,
        targetId: t?.id ?? null,
        light: { radius: 1.6, color: 0xff3040, intensity: 0.8 },
        trail: 'blood',
        status: p.poison ? status('poison', 4, p.poison) : undefined,
        onHit: (target, pr) => {
          const healAmt = pr.damage.amount * (p.heal / 100);
          ctx.combat.heal(c.caster, healAmt, 'leech');
          ctx.fx.beam(target.pos, c.caster.pos, { color: 0xff2030, width: 4, duration: 0.25 });
          if (p.minionHeal)
            for (const m of ctx.world.actors) if (m.minion?.ownerId === c.caster.id && m.alive) ctx.combat.heal(m, m.maxLife * 0.05);
        },
      });
      ctx.combat.addResource(c.caster, p.generate);
    },
  },
  'bonemancer.bone_spear': {
    fire(ctx, c) {
      const p = c.params;
      const a = c.caster;
      let mult = 1;
      if (p.blood) {
        ctx.combat.addResource(a, c.def.cost ?? 0); // refund essence, pay life instead
        a.life = Math.max(1, a.life - a.maxLife * 0.06);
        mult = 1.4;
      }
      for (const d of fan(c.dir, p.count ?? 1, 20)) {
        shoot(ctx, c, {
          dir: d,
          visual: 'fx/spear',
          speed: p.speed,
          radius: 0.25,
          pierce: p.pierce,
          mult,
          tint: p.blood ? 0xff6060 : 0xf8f0e0,
          impactParticles: 'bone',
          knockback: 3,
          light: { radius: 1.4, color: 0xe8e0ff, intensity: 0.5 },
          onExpire: p.explode
            ? (pr) => {
                ctx.combat.aoe(a, a.faction, pr.pos, p.explode, { damage: sd(ctx, c, 0.6 * mult) });
                ctx.fx.burst('death_bone', pr.pos, { count: 30 });
                ctx.fx.shake(0.15, 0.15);
              }
            : undefined,
        });
      }
    },
  },
  'bonemancer.raise_skeletons': {
    fire(ctx, c) {
      const p = c.params;
      const a = c.caster;
      const mine = ctx.world.actors.filter((m) => m.alive && m.minion?.ownerId === a.id && m.minion.skillId === c.def.id);
      for (let i = 0; i < p.count; i++) {
        if (mine.length >= p.max) {
          const old = mine.shift()!;
          ctx.combat.kill(old, null);
        }
        const at = { x: c.target.x + (Math.random() - 0.5) * 1.6, y: c.target.y + (Math.random() - 0.5) * 1.6 };
        const mage = p.mages && i % 2 === 1;
        const s = ctx.combat.summon({ enemyId: mage ? 'minion_skeleton_mage' : 'minion_skeleton', pos: at, faction: 'player', owner: a, skillId: c.def.id, level: a.level, lifeMult: p.tough ? 2 : 1 });
        if (s) {
          s.minion!.coef = c.coefficient;
          s.maxLife = Math.round(a.maxLife * 0.35 * (p.tough ? 2 : 1) * (1 + a.stats.summonLife));
          s.life = s.maxLife;
          s.state = 'spawning';
          s.stateTime = 0.6;
          mine.push(s);
          ctx.fx.spriteFx('fx/runes', s.pos, { scale: 0.7 });
          ctx.fx.burst('bone', s.pos, { count: 12 });
        }
      }
    },
  },
  'bonemancer.corpse_explosion': {
    canCast(ctx, c) {
      const ok = ctx.world.actors.some((x) => !x.alive && x.kind === 'monster' && x.corpseTimer > 0.5 && Math.hypot(x.pos.x - c.target.x, x.pos.y - c.target.y) < c.params.search + 2);
      if (!ok) ctx.ui.toast('Nenhum cadáver por perto', 'warn');
      return ok;
    },
    fire(ctx, c) {
      const p = c.params;
      const corpses = ctx.world.actors
        .filter((x) => !x.alive && x.kind === 'monster' && x.corpseTimer > 0.5)
        .map((x) => ({ x, d: Math.hypot(x.pos.x - c.target.x, x.pos.y - c.target.y) }))
        .filter((o) => o.d < p.search + 2)
        .sort((a, b) => a.d - b.d)
        .slice(0, p.max);
      const poison = c.damageType === 'poison';
      corpses.forEach(({ x }, i) => {
        ctx.combat.spawnGroundEffect({
          owner: c.caster,
          faction: c.caster.faction,
          pos: { ...x.pos },
          radius: p.radius,
          delay: i * 0.06,
          duration: 0,
          damage: sd(ctx, c, 1, { knockback: 4, status: poison ? status('poison', 3, 0.4) : undefined }),
          onActivate: (g) => {
            x.corpseTimer = 0;
            ctx.fx.burst(poison ? 'poison' : 'death_blood', g.pos, { count: 36 });
            ctx.fx.burst('bone', g.pos, { count: 14 });
            ctx.fx.decal('blood', g.pos, { scale: 1.4 });
            ctx.fx.shake(0.18, 0.15);
          },
        });
      });
    },
  },
  'bonemancer.bone_armor': {
    fire(ctx, c) {
      const p = c.params;
      const a = c.caster;
      const amt = a.maxLife * (p.shield / 100);
      a.shield = Math.max(a.shield, amt);
      ctx.combat.applyStatus(a, { id: 'shielded', duration: p.duration, magnitude: amt }, a.id);
      ctx.combat.aoe(a, a.faction, a.pos, p.radius, { damage: sd(ctx, c, 1, { knockback: 3, status: p.stun ? status('stun', p.stun, 1) : undefined }) });
      if (p.generate) ctx.combat.addResource(a, p.generate);
      ctx.fx.spriteFx('fx/shield', a.pos, { followId: a.id, loop: true, duration: p.duration, scale: 0.8, tint: 0xf0e8d0, alpha: 0.8 });
      novaFx(ctx, a.pos, p.radius, 'bone');
    },
  },
  'bonemancer.curse': {
    fire(ctx, c) {
      const p = c.params;
      for (const e of ctx.world.enemiesOf(c.caster.faction, c.target.x, c.target.y, p.radius)) {
        ctx.combat.applyStatus(e, { id: 'vulnerable', duration: p.duration, magnitude: 0.2 }, c.caster.id);
        ctx.combat.applyStatus(e, { id: 'slow', duration: p.duration, magnitude: p.slow / 100 }, c.caster.id);
        if (p.weaken) ctx.combat.applyStatus(e, { id: 'weaken', duration: p.duration, magnitude: 0.25 }, c.caster.id);
        if (p.soulHeal) mem(e).soul = ctx.time + p.duration;
      }
      ctx.fx.spriteFx('fx/dark_mist', c.target, { scale: p.radius / 3, additive: false, alpha: 0.8 });
      ctx.fx.burst('shadow', c.target, { count: 30, scale: p.radius / 2 });
    },
  },
  'bonemancer.blood_nova': {
    fire(ctx, c) {
      const p = c.params;
      const a = c.caster;
      a.life = Math.max(1, a.life - a.maxLife * (p.lifeCost / 100));
      ctx.combat.aoe(a, a.faction, a.pos, p.radius, {
        damage: sd(ctx, c, 1, { knockback: 5, status: p.bleed ? status('bleed', 4, p.bleed) : undefined }),
        onHit: () => {
          if (p.heal) ctx.combat.heal(a, a.maxLife * (p.heal / 100), 'skill');
        },
      });
      novaFx(ctx, a.pos, p.radius, 'death_blood');
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2;
        ctx.fx.decal('blood', { x: a.pos.x + Math.cos(ang) * p.radius * 0.7, y: a.pos.y + Math.sin(ang) * p.radius * 0.7 }, { scale: 1.2 });
      }
      ctx.fx.light(a.pos, { radius: p.radius * 2, color: 0xff1020, intensity: 1.8 }, 0.5);
      ctx.fx.screenFlash(0x800000, 0.2, 0.35);
      ctx.fx.shake(0.45, 0.3);
      ctx.combat.hitStop(0.06);
    },
  },
});

onGameCreated((game) => {
  game.events.on('actorDied', ({ actor }: { actor: Actor }) => {
    const m = mem(actor);
    if (m.soul && game.time < m.soul) game.combat.heal(game.player, game.player.maxLife * 0.03, 'skill');
  });
});
