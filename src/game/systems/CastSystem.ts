// Skill casting (player & minions) and monster abilities: costs, cooldowns, wind-ups, firing.
import { vnorm, type Vec2 } from '../../core/math';
import { Data } from '../../data';
import type { EnemyAbilityDef, SkillDef } from '../../data/schema';
import { cooldownAfterCdr } from '../../formulas/damage';
import type { GameCtx, SkillCastInfo, System } from '../api';
import { playAnim } from '../combat/Combat';
import { activePowers } from '../items/powers/active';
import { executeAbility, telegraphAbility } from '../monsters/abilities';
import { BASIC_ATTACK } from '../skills/fallback';
import { getSkillImpl } from '../skills/registry';
import type { Actor } from '../types';

const ANIM_LEN = 0.4; // hero swing/cast/shoot animations are 400 ms

export function skillDef(id: string): SkillDef | undefined {
  return id === BASIC_ATTACK.id ? BASIC_ATTACK : Data.trySkill(id);
}

export function skillRank(actor: Actor, id: string): number {
  if (id === BASIC_ATTACK.id) return 1;
  return actor.character?.skillRanks[id] ?? 1;
}

export function buildCastInfo(ctx: GameCtx, caster: Actor, def: SkillDef, target: Vec2, targetId: number | null): SkillCastInfo {
  const rank = Math.max(1, skillRank(caster, def.id));
  const runeId = caster.character?.runes[def.id] ?? null;
  const rune = runeId ? def.runes.find((r) => r.id === runeId) : undefined;
  const params = { ...def.params, ...(rune?.params ?? {}) };
  const dir = vnorm({ x: target.x - caster.pos.x, y: target.y - caster.pos.y });
  if (dir.x === 0 && dir.y === 0) {
    dir.x = Math.cos(caster.facing);
    dir.y = Math.sin(caster.facing);
  }
  const info: SkillCastInfo = {
    caster,
    def,
    rank,
    rune: rune?.id ?? null,
    params,
    coefficient: def.damage + def.damagePerRank * (rank - 1),
    damageType: rune?.damageType ?? def.damageType,
    target: { ...target },
    targetId,
    dir,
  };
  if (caster.kind === 'player') for (const p of activePowers()) p.hooks.modifySkill?.(p.value, info, ctx);
  return info;
}

export function skillCost(actor: Actor, def: SkillDef): number {
  return (def.cost ?? 0) * (1 - Math.min(0.5, actor.stats.resourceCostReduction));
}

/** Seconds of cooldown remaining for a skill (0 = ready). */
export const cooldownLeft = (actor: Actor, id: string): number => actor.cooldowns[id] ?? 0;

/** Attempts to start a player/minion skill. Returns false (and emits skillFailed) when not possible. */
export function tryStartSkill(ctx: GameCtx, actor: Actor, skillId: string, target: Vec2, targetId: number | null, slot?: SkillCastInfo['def']['defaultSlot']): boolean {
  const def = skillDef(skillId);
  if (!def || !actor.alive) return false;
  if (actor.cast || actor.dash || actor.state === 'stunned' || actor.state === 'frozen') return false;
  if (cooldownLeft(actor, def.id) > 0) {
    ctx.events.emit('skillFailed', { caster: actor, skillId, reason: 'cooldown' });
    return false;
  }
  const cost = skillCost(actor, def);
  if (cost > 0 && actor.resource + 1e-6 < cost) {
    ctx.events.emit('skillFailed', { caster: actor, skillId, reason: 'resource' });
    return false;
  }
  const impl = getSkillImpl(def.id);
  if (!impl) return false;
  const info = buildCastInfo(ctx, actor, def, target, targetId);
  if (impl.canCast && !impl.canCast(ctx, info)) {
    ctx.events.emit('skillFailed', { caster: actor, skillId, reason: 'blocked' });
    return false;
  }
  if (cost > 0) actor.resource -= cost;
  if (def.cooldown) actor.cooldowns[def.id] = cooldownAfterCdr(def.cooldown, actor.stats.cooldownReduction);
  const isAttack = def.anim === 'swing' || def.anim === 'shoot';
  const speed = isAttack ? (actor.weapon?.aps ?? 1.2) / 1.2 : 1 + actor.stats.attackSpeed;
  const fireAt = def.castTime / speed;
  const duration = Math.max(fireAt + 0.08, (def.castTime * 1.55) / speed);
  actor.cast = {
    skillId: def.id,
    isAbility: false,
    slot,
    time: 0,
    fireAt,
    duration,
    fired: false,
    target: { ...target },
    targetId,
    rune: info.rune ?? undefined,
    channel: !!def.channel,
    channelTick: 0,
  };
  actor.facing = Math.atan2(info.dir.y, info.dir.x);
  actor.state = def.channel ? 'channeling' : 'attacking';
  actor.stateTime = 0;
  actor.path = null;
  actor.moveTarget = null;
  playAnim(actor, def.anim, !!def.channel, ANIM_LEN / duration);
  if (def.sfx?.cast) ctx.audio.play(def.sfx.cast, { pos: actor.pos, pitchVar: 0.08 });
  if (actor.kind === 'player') for (const p of activePowers()) p.hooks.onCast?.(p.value, info, ctx);
  ctx.events.emit('skillCast', { caster: actor, skillId: def.id, target });
  return true;
}

export function startAbility(ctx: GameCtx, actor: Actor, ab: EnemyAbilityDef, target: Vec2, targetId: number | null): void {
  actor.cast = {
    skillId: ab.id,
    isAbility: true,
    time: 0,
    fireAt: ab.windup,
    duration: ab.windup + ab.recovery,
    fired: false,
    target: { ...target },
    targetId,
    channel: false,
    channelTick: 0,
  };
  actor.cooldowns[ab.id] = ab.cooldown;
  actor.facing = Math.atan2(target.y - actor.pos.y, target.x - actor.pos.x);
  actor.state = 'attacking';
  actor.stateTime = 0;
  actor.vel.x = actor.vel.y = 0;
  const animName = ab.anim === 'run' ? 'stance' : ab.anim;
  playAnim(actor, animName, false, Math.max(0.6, 0.5 / Math.max(0.2, ab.windup + ab.recovery * 0.3)));
  if (ab.telegraph) telegraphAbility(ctx, actor, ab, target);
}

export class CastSystem implements System {
  readonly name = 'cast';

  update(ctx: GameCtx, dt: number): void {
    for (const a of ctx.world.actors) {
      for (const k in a.cooldowns) {
        const v = a.cooldowns[k] - dt;
        if (v <= 0) delete a.cooldowns[k];
        else a.cooldowns[k] = v;
      }
      const c = a.cast;
      if (!c || !a.alive) continue;
      c.time += dt;
      if (c.isAbility) {
        if (!c.fired && c.time >= c.fireAt) {
          c.fired = true;
          const def = a.monster ? Data.tryEnemy(a.monster.defId) : undefined;
          const ab = def?.abilities.find((x) => x.id === c.skillId);
          if (ab) executeAbility(ctx, a, ab, c.target, c.targetId);
        }
      } else {
        const def = skillDef(c.skillId);
        const impl = def ? getSkillImpl(def.id) : undefined;
        if (!def || !impl) {
          a.cast = null;
          continue;
        }
        if (!c.fired && c.time >= c.fireAt) {
          c.fired = true;
          // re-aim at a moving target
          const t = ctx.world.getActor(c.targetId);
          if (t?.alive) {
            c.target.x = t.pos.x;
            c.target.y = t.pos.y;
          }
          impl.fire(ctx, buildCastInfo(ctx, a, def, c.target, c.targetId));
          if (def.generate && a.kind === 'player') ctx.combat.addResource(a, def.generate);
        }
        if (c.channel && c.fired) {
          c.channelTick += dt;
          const info = buildCastInfo(ctx, a, def, c.target, c.targetId);
          impl.channel?.(ctx, info, dt);
          if (c.channelTick >= 0.25) {
            const cost = skillCost(a, def) * c.channelTick;
            c.channelTick = 0;
            if (a.resource < cost) {
              impl.endChannel?.(ctx, info);
              a.cast = null;
              a.state = 'idle';
              continue;
            }
            a.resource -= cost;
          }
          continue; // channels end when the controller releases them
        }
      }
      if (c.time >= c.duration && !c.channel) {
        a.cast = null;
        if (a.state === 'attacking') a.state = 'idle';
      }
    }
  }
}

/** Ends a player channel (button released). */
export function endChannel(ctx: GameCtx, a: Actor): void {
  const c = a.cast;
  if (!c?.channel) return;
  const def = skillDef(c.skillId);
  if (def) getSkillImpl(def.id)?.endChannel?.(ctx, buildCastInfo(ctx, a, def, c.target, c.targetId));
  a.cast = null;
  a.state = 'idle';
}
