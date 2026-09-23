// Legendary & set powers.
import { Data } from '../../../data';
import type { GameCtx, SkillCastInfo } from '../../api';
import type { Actor } from '../../types';
import { addBuff } from '../../skills/buffs';
import { registerPowers } from './registry';
import { activePowers } from './active';
import { onGameCreated } from '../../hooks';

const cd = new Map<string, number>();
const ready = (ctx: GameCtx, key: string, every: number): boolean => {
  const t = cd.get(key) ?? -99;
  if (ctx.time - t < every) return false;
  cd.set(key, ctx.time);
  return true;
};
const wdmg = (ctx: GameCtx, mult: number, type: 'fire' | 'cold' | 'lightning' | 'physical' | 'arcane' = 'physical') => ({
  amount: ctx.combat.skillDamage(ctx.player, mult, type),
  type,
  sourceId: ctx.player.id,
  procCoef: 0,
});
const isSkill = (c: SkillCastInfo, prefix: string) => c.def.id.startsWith(prefix);
const PROJECTILE_SKILLS = new Set(['arcanist.firebolt', 'stalker.rapid_shot', 'stalker.multishot', 'bonemancer.bone_splinters', 'bonemancer.bone_spear', 'stalker.piercing_shot']);

registerPowers({
  explode_on_hit: {
    onHit(v, t, spec, _r, ctx) {
      if ((spec.procCoef ?? 1) <= 0 || Math.random() > v * (spec.procCoef ?? 1)) return;
      ctx.combat.aoe(ctx.player, 'player', t.pos, 1.6, { damage: wdmg(ctx, 1.5, 'fire') });
      ctx.fx.spriteFx('fx/blast', t.pos, { scale: 0.45 });
      ctx.fx.burst('fire', t.pos, { count: 16 });
    },
  },
  chain_on_hit: {
    onHit(v, t, spec, _r, ctx) {
      if ((spec.procCoef ?? 1) <= 0 || Math.random() > v) return;
      let from = t;
      const seen = new Set([t.id]);
      for (let i = 0; i < 4; i++) {
        const n = ctx.world.enemiesOf('player', from.pos.x, from.pos.y, 4).find((e) => !seen.has(e.id));
        if (!n) break;
        seen.add(n.id);
        ctx.fx.beam(from.pos, n.pos, { color: 0xb8b0ff, width: 6, duration: 0.2, jagged: true });
        ctx.combat.dealDamage(n, wdmg(ctx, 1.2, 'lightning'));
        from = n;
      }
    },
  },
  heal_on_kill: {
    onKill(v, _victim, ctx) {
      ctx.combat.heal(ctx.player, ctx.player.maxLife * v, 'leech');
    },
  },
  frost_retaliate: {
    onDamaged(v, _s, _a, ctx) {
      if (!ready(ctx, 'frost', 6)) return;
      const p = ctx.player;
      ctx.combat.aoe(p, 'player', p.pos, 3, { damage: { ...wdmg(ctx, v, 'cold'), status: { id: 'freeze', duration: 1.5, magnitude: 1 } } });
      ctx.fx.burst('ice', p.pos, { count: 40, scale: 2 });
      ctx.fx.shockwave(p.pos, { radius: 3 });
      ctx.audio.play('frost_nova', { pos: p.pos });
    },
  },
  dmg_per_enemy: {
    outgoingMult(v, _t, _s, ctx) {
      const n = Math.min(5, ctx.world.enemiesOf('player', ctx.player.pos.x, ctx.player.pos.y, 3).length);
      return 1 + v * n;
    },
  },
  execute: {
    outgoingMult(v, t) {
      return t.life / t.maxLife < 0.35 ? 1 + v : 1;
    },
  },
  haste_on_kill: {
    onKill(v, _victim, ctx) {
      addBuff(ctx, 'ghost_steps', 'Passos do Fantasma', { attackSpeed: v, moveSpeed: v }, 3);
    },
  },
  gold_heal: {
    stats() {
      return { goldFind: 0.25 };
    },
  },
  reflect: {
    onDamaged(v, source, amount, ctx) {
      if (source && source.alive && source.kind === 'monster') ctx.combat.dealDamage(source, { amount: amount * v, type: 'physical', sourceId: ctx.player.id, procCoef: 0 });
    },
  },
  crit_cdr: {
    onCrit(v, _t, _s, ctx) {
      if (!ready(ctx, 'critcdr', 0.25)) return;
      const cds = ctx.player.cooldowns;
      for (const k in cds) cds[k] = Math.max(0, cds[k] - v);
    },
  },
  melee_shockwave: {
    onCast(v, c, ctx) {
      if (c.def.targeting !== 'melee') return;
      const a = c.caster;
      const to = { x: a.pos.x + c.dir.x * 5, y: a.pos.y + c.dir.y * 5 };
      ctx.combat.line(a, a.pos, to, 1, { damage: wdmg(ctx, v) });
      for (let i = 1; i <= 4; i++) ctx.fx.burst('dust', { x: a.pos.x + c.dir.x * i * 1.2, y: a.pos.y + c.dir.y * i * 1.2 }, { count: 6 });
    },
  },
  fury_gen: {
    onCast(v, c, ctx) {
      if (c.def.category === 'primary') ctx.combat.addResource(c.caster, v);
    },
  },
  extra_projectile: {
    modifySkill(v, c) {
      if (PROJECTILE_SKILLS.has(c.def.id)) c.params.count = (c.params.count ?? 1) + Math.round(v);
    },
  },
  nova_on_spender: {
    onCast(v, c, ctx) {
      if (!c.def.cost) return;
      const a = c.caster;
      ctx.combat.aoe(a, 'player', a.pos, 3, { damage: wdmg(ctx, v, 'arcane') });
      ctx.fx.burst('arcane', a.pos, { count: 30, scale: 2 });
      ctx.fx.shockwave(a.pos, { radius: 3 });
    },
  },
  multishot_plus: {
    modifySkill(v, c) {
      if (c.def.id === 'stalker.multishot') {
        c.params.count += Math.round(v);
        c.params.spread = Math.min(160, c.params.spread + 20);
        c.coefficient *= 1.4;
      }
    },
  },
  pierce_all: {
    modifySkill(v, c) {
      if (PROJECTILE_SKILLS.has(c.def.id)) c.params.pierce = (c.params.pierce ?? 0) + Math.round(v);
    },
  },
  legion: {
    modifySkill(v, c) {
      if (c.def.id === 'bonemancer.raise_skeletons') c.params.max += Math.round(v);
    },
    outgoingMult(_v, _t, spec, ctx) {
      const src = ctx.world.getActor(spec.sourceId);
      return src?.minion ? 1.5 : 1;
    },
  },
  spear_burst: {
    modifySkill(v, c) {
      if (c.def.id === 'bonemancer.bone_spear') c.params.explode = Math.max(c.params.explode ?? 0, 2 * (v / 2));
    },
  },
  // ---------------------------------------------------------------- sets (4 pieces)
  set_berserker: {
    outgoingMult(v, _t, spec) {
      return spec.skillId?.startsWith('berserker.') ? 1 + v : 1;
    },
    onHit(_v, _t, spec, _r, ctx) {
      if (spec.skillId?.startsWith('berserker.')) ctx.combat.addResource(ctx.player, 2);
    },
  },
  set_arcanist: {
    onCast(v, c, ctx) {
      if (!c.def.cost || !isSkill(c, 'arcanist.')) return;
      for (let i = 0; i < 3; i++) {
        const ang = Math.atan2(c.dir.y, c.dir.x) + (i - 1) * 0.5;
        const t = ctx.world.enemiesOf('player', c.caster.pos.x, c.caster.pos.y, 9)[i];
        ctx.combat.spawnProjectile({
          owner: c.caster,
          from: { ...c.caster.pos },
          dir: { x: Math.cos(ang), y: Math.sin(ang) },
          speed: 8,
          radius: 0.25,
          range: 12,
          visual: 'fx/plasmaball',
          scale: 0.5,
          homing: 6,
          targetId: t?.id ?? null,
          light: { radius: 1.8, color: 0xd070ff, intensity: 0.9 },
          trail: 'arcane',
          damage: wdmg(ctx, v, 'arcane'),
        });
      }
    },
  },
  set_stalker: {
    modifySkill(_v, c) {
      if (c.def.category === 'primary' && isSkill(c, 'stalker.')) c.params.count = (c.params.count ?? 1) + 2;
    },
    outgoingMult(v, _t, spec) {
      return spec.skillId === 'stalker.rapid_shot' || spec.skillId === 'stalker.piercing_shot' ? 1 + v : 1;
    },
  },
  set_bonemancer: {
    outgoingMult(v, _t, spec, ctx) {
      const src = ctx.world.getActor(spec.sourceId);
      return src?.minion || spec.skillId === 'bonemancer.bone_spear' ? 1 + v : 1;
    },
  },
});

onGameCreated((game: GameCtx) => {
  game.events.on('goldPickedUp', () => {
    const p = activePowers().find((x) => x.id === 'gold_heal');
    if (p) game.combat.heal(game.player, game.player.maxLife * p.value, 'leech');
  });
});

export type { Actor };
void Data;
