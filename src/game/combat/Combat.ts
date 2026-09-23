// CombatAPI implementation: damage pipeline, feedback, statuses, projectiles, ground effects.
import { angleDiff, distPointSegment, vnorm, type Vec2 } from '../../core/math';
import { fxRng } from '../../core/rng';
import { Data } from '../../data';
import { DAMAGE_TYPE_STATS, type DamageType, type StatusId } from '../../data/schema';
import { critMultiplier, mitigation, resistReduction } from '../../formulas/damage';
import type { AreaOpts, CombatAPI, GameCtx, GroundEffectInit, MeleeOpts, ProjectileInit, SummonOpts } from '../api';
import { activePowers } from '../items/powers/active';
import { getEliteModImpl } from '../monsters/eliteModRegistry';
import { spawnMonster } from '../monsters/spawn';
import type { Actor, DamageResult, DamageSpec, Faction, GroundEffect, Projectile, StatusApplySpec } from '../types';

const BLOOD_PRESET: Record<number, string> = {};
const tmpActors: Actor[] = [];

export class Combat implements CombatAPI {
  constructor(
    private ctx: () => GameCtx,
    private requestHitStop: (s: number) => void,
  ) {}

  isHostile(a: Faction, b: Faction): boolean {
    return a !== b && a !== 'neutral' && b !== 'neutral';
  }

  skillDamage(caster: Actor, coefficient: number, type: DamageType, skillId?: string): number {
    const w = caster.weapon ?? { min: 2, max: 4 };
    const roll = w.min + (w.max - w.min) * Math.random();
    const s = caster.stats;
    const main = caster.mainStat ?? 0;
    let mult = (1 + main / 100) * (1 + s[DAMAGE_TYPE_STATS[type].bonus] + s.damagePct);
    if (caster.kind === 'minion') mult *= 1 + s.summonDamage;
    void skillId;
    return roll * coefficient * mult;
  }

  monsterDamage(caster: Actor, mult: number): number {
    const base = caster.monster?.baseDamage ?? 5;
    return base * mult * (0.85 + Math.random() * 0.3);
  }

  dealDamage(target: Actor, spec: DamageSpec): DamageResult | null {
    if (!target.alive || target.kind === 'npc') return null;
    const ctx = this.ctx();
    const source = ctx.world.getActor(spec.sourceId) ?? null;
    const res: DamageResult = { amount: 0, crit: false, blocked: false, dodged: false, absorbed: 0, killed: false, overkill: 0 };
    if (target.invulnerable > 0 || this.hasStatus(target, 'invulnerable')) {
      if (!spec.silent) ctx.fx.floatText(target.pos, 'Imune', 'immune');
      return res;
    }
    const s = target.stats;
    const toPlayer = target.kind === 'player';
    // dodge / block (players only; not DoTs)
    if (!spec.isDot && toPlayer) {
      if (s.dodgeChance > 0 && Math.random() < s.dodgeChance) {
        res.dodged = true;
        ctx.fx.floatText(target.pos, 'Esquiva', 'dodge');
        return res;
      }
    }
    let amount = spec.amount;
    // crit
    if (!spec.isDot && source) {
      const crit = spec.crit ?? Math.random() < source.stats.critChance;
      if (crit) {
        res.crit = true;
        amount *= critMultiplier(source.stats.critDamage);
      }
    }
    // outgoing power hooks (player / minions of player)
    if (source && (source.kind === 'player' || source.minion)) {
      for (const p of activePowers()) if (p.hooks.outgoingMult) amount *= p.hooks.outgoingMult(p.value, target, spec, ctx);
      if (target.tags.has('elite')) amount *= 1 + source.stats.eliteDamage;
      if (target.tags.has('boss')) amount *= 1 + source.stats.bossDamage + source.stats.eliteDamage;
    }
    if (this.hasStatus(target, 'vulnerable')) amount *= 1.2;
    if (source && this.hasStatus(source, 'weaken')) amount *= 0.75;
    // mitigation
    const attackerLevel = source?.level ?? target.level;
    if (toPlayer) {
      const resStat = DAMAGE_TYPE_STATS[spec.type].res;
      const resist = s[resStat] + s.allRes;
      let extra = 0;
      if (source?.tags.has('elite')) extra += s.eliteDamageReduction;
      if (spec.isMelee) extra += s.meleeDamageReduction;
      if (spec.isRanged) extra += s.rangedDamageReduction;
      amount *= mitigation({ armor: s.armor, resist, attackerLevel, damageReduction: s.damageReduction, extra, isDot: spec.isDot });
      for (const p of activePowers()) if (p.hooks.incomingMult) amount *= p.hooks.incomingMult(p.value, source, spec, ctx);
      if (this.hasStatus(target, 'fortify')) amount *= 0.8;
      // block
      if (!spec.isDot && s.blockChance > 0 && Math.random() < s.blockChance) {
        res.blocked = true;
        amount = Math.max(0, amount - s.blockAmount);
      }
    } else {
      // monsters: resist values are direct fractions; armor mitigates physical lightly
      const r = s[DAMAGE_TYPE_STATS[spec.type].res];
      amount *= 1 - Math.min(0.9, r);
      if (spec.type === 'physical' && !spec.isDot) amount *= 1 - resistReduction(s.armor * 0.1, attackerLevel) * 0.5;
    }
    amount = Math.max(1, Math.round(amount));
    // shields
    if (target.shield > 0) {
      const ab = Math.min(target.shield, amount);
      target.shield -= ab;
      amount -= ab;
      res.absorbed = ab;
    }
    target.life -= amount;
    res.amount = amount;
    target.lastDamagedAt = ctx.time;
    target.lastCombatAt = ctx.time;
    if (source) source.lastCombatAt = ctx.time;
    if (target.life <= 0) {
      res.killed = true;
      res.overkill = -target.life;
      target.life = 0;
    }

    // feedback
    const fromPlayerSide = !!source && (source.kind === 'player' || !!source.minion);
    if (!spec.silent || res.crit) {
      if (ctx.settings.damageNumbers || toPlayer) ctx.fx.damageNumber(target.pos, amount + res.absorbed, res.crit, spec.type, toPlayer);
    }
    if (!spec.silent) {
      target.flash = 0.09;
      target.flashColor = spec.type === 'cold' ? 0x9ad8ff : spec.type === 'fire' ? 0xffb070 : undefined;
      const dir = spec.dir ?? (source ? vnorm({ x: target.pos.x - source.pos.x, y: target.pos.y - source.pos.y }) : { x: 0, y: 0 });
      if (target.kind === 'monster') {
        const def = Data.tryEnemy(target.monster!.defId);
        const blood = def?.deathParticles === 'bone' ? 'bone' : blood_for(def?.bloodColor);
        ctx.fx.burst(blood, target.pos, { count: res.crit ? 14 : 7, dir, z: 0.6, color: def?.bloodColor });
        if (spec.type !== 'physical') ctx.fx.burst(`hit_${spec.type}`, target.pos, { count: 6, z: 0.6 });
        ctx.audio.play(res.crit ? 'hit_crit' : `hit_${spec.type}`, { pos: target.pos, pitchVar: 0.12, volume: 0.8 });
        // hit reaction (D2-like: only if not casting, chance scaled by damage)
        if (!res.killed && !target.cast && target.state !== 'dashing' && !target.tags.has('boss') && amount > target.maxLife * 0.08) {
          target.state = 'hitstun';
          target.stateTime = 0;
          playAnim(target, 'hit', false);
        }
      } else if (toPlayer) {
        ctx.fx.burst('blood', target.pos, { count: 6, dir, z: 0.7 });
        ctx.audio.play('hit_player', { pos: target.pos, pitchVar: 0.1 });
        ctx.fx.shake(Math.min(0.6, 0.15 + (amount / target.maxLife) * 2), 0.18);
        if (amount > target.maxLife * 0.15) ctx.fx.screenFlash(0x8a0000, 0.25, 0.25);
      }
      if (spec.knockback && !(Data.tryEnemy(target.monster?.defId ?? '')?.flags?.noKnockback) && !target.tags.has('boss')) {
        const f = (spec.knockback * (1 + (source?.stats.knockbackPower ?? 0))) / Math.max(0.5, target.mass);
        target.knockback.x += dir.x * f;
        target.knockback.y += dir.y * f;
      }
      if (fromPlayerSide && (res.crit || spec.hitstop)) this.hitStop(spec.hitstop ?? 0.035);
      if (fromPlayerSide && res.crit) ctx.fx.shake(0.12, 0.08);
    }
    // status
    if (spec.status && !res.killed && (spec.status.chance === undefined || Math.random() < spec.status.chance)) {
      this.applyStatus(target, spec.status, spec.sourceId);
    }
    // on-hit effects for attacker
    if (source && fromPlayerSide && source.kind === 'player') {
      const proc = spec.procCoef ?? 1;
      if (source.stats.lifeOnHit) this.heal(source, source.stats.lifeOnHit * proc, 'leech');
      if (source.stats.lifeSteal) this.heal(source, amount * source.stats.lifeSteal, 'leech');
      if (source.stats.resourceOnHit) this.addResource(source, source.stats.resourceOnHit * proc);
      for (const p of activePowers()) {
        p.hooks.onHit?.(p.value, target, spec, res, ctx);
        if (res.crit) p.hooks.onCrit?.(p.value, target, spec, ctx);
      }
    }
    if (toPlayer) {
      for (const p of activePowers()) p.hooks.onDamaged?.(p.value, source, amount, ctx);
      if (source && spec.isMelee && s.thorns > 0) this.dealDamage(source, { amount: s.thorns, type: 'physical', sourceId: target.id, silent: false });
    }
    if (source?.monster) for (const m of source.monster.eliteMods) getEliteModImpl(m)?.onHitTarget?.(ctx, source, target, res);
    if (target.monster) for (const m of target.monster.eliteMods) getEliteModImpl(m)?.onDamaged?.(ctx, target, res);

    ctx.events.emit('damage', { source, target, spec, result: res });
    if (res.killed) this.kill(target, source);
    return res;
  }

  kill(target: Actor, killer: Actor | null): void {
    if (!target.alive) return;
    const ctx = this.ctx();
    target.alive = false;
    target.life = 0;
    target.state = 'dead';
    target.cast = null;
    target.dash = null;
    target.vel.x = target.vel.y = 0;
    target.deathAt = ctx.time;
    target.corpseTimer = target.kind === 'player' ? 1e9 : 6;
    const def = target.monster ? Data.tryEnemy(target.monster.defId) : undefined;
    const sheetHasCrit = target.kind === 'monster';
    playAnim(target, sheetHasCrit && Math.random() < 0.4 ? 'critdie' : 'die', false);
    if (target.monster) {
      for (const m of target.monster.eliteMods) getEliteModImpl(m)?.onDeath?.(ctx, target);
      const preset = def?.deathParticles ?? 'blood';
      ctx.fx.burst(preset === 'bone' ? 'death_bone' : `death_${preset}`, target.pos, { count: 26, z: 0.5, color: def?.bloodColor });
      ctx.fx.decal(preset === 'bone' ? 'bone' : 'blood', target.pos, { color: def?.bloodColor, scale: 0.8 + Math.random() * 0.6 });
      if (def?.sounds?.die) ctx.audio.play(def.sounds.die, { pos: target.pos, pitchVar: 0.1 });
      else ctx.audio.play('monster_die', { pos: target.pos, pitchVar: 0.15 });
      if (killer?.kind === 'player') for (const p of activePowers()) p.hooks.onKill?.(p.value, target, ctx);
      if (killer?.kind === 'player' && killer.stats.lifePerKill) this.heal(killer, killer.stats.lifePerKill, 'leech');
    }
    ctx.events.emit('actorDied', { actor: target, killer });
  }

  melee(caster: Actor, o: MeleeOpts): Actor[] {
    const ctx = this.ctx();
    const hits: Actor[] = [];
    const half = ((o.arcDeg / 2) * Math.PI) / 180;
    ctx.world.enemiesOf(caster.faction, caster.pos.x, caster.pos.y, o.range + 0.6, tmpActors);
    tmpActors.sort((a, b) => (a.pos.x - caster.pos.x) ** 2 + (a.pos.y - caster.pos.y) ** 2 - ((b.pos.x - caster.pos.x) ** 2 + (b.pos.y - caster.pos.y) ** 2));
    for (const t of tmpActors) {
      const dx = t.pos.x - caster.pos.x;
      const dy = t.pos.y - caster.pos.y;
      const d = Math.hypot(dx, dy);
      if (d > o.range + t.radius) continue;
      if (o.arcDeg < 360 && d > t.radius + 0.1 && Math.abs(angleDiff(o.angle, Math.atan2(dy, dx))) > half + Math.atan2(t.radius, d)) continue;
      const r = this.dealDamage(t, { ...o.damage, isMelee: true, dir: vnorm({ x: dx, y: dy }) });
      if (r) {
        hits.push(t);
        o.onHit?.(t, r);
        if (o.hitParticles) ctx.fx.burst(o.hitParticles, t.pos, { count: 5, z: 0.6 });
      }
      if (o.maxTargets && hits.length >= o.maxTargets) break;
    }
    return hits;
  }

  private areaGeneric(caster: Actor | null, faction: Faction, center: Vec2, r: number, test: (t: Actor) => boolean, o: AreaOpts): Actor[] {
    const ctx = this.ctx();
    const hits: Actor[] = [];
    ctx.world.enemiesOf(faction, center.x, center.y, r + 0.6, tmpActors);
    const list = tmpActors.slice();
    for (const t of list) {
      if (o.exclude?.has(t.id) || !test(t)) continue;
      const dir = vnorm({ x: t.pos.x - center.x, y: t.pos.y - center.y });
      const res = this.dealDamage(t, { ...o.damage, isArea: true, dir, sourceId: o.damage.sourceId ?? caster?.id ?? null });
      if (res) {
        hits.push(t);
        o.onHit?.(t, res);
      }
      if (o.maxTargets && hits.length >= o.maxTargets) break;
    }
    return hits;
  }

  aoe(caster: Actor | null, faction: Faction, center: Vec2, radius: number, o: AreaOpts): Actor[] {
    return this.areaGeneric(caster, faction, center, radius, (t) => Math.hypot(t.pos.x - center.x, t.pos.y - center.y) <= radius + t.radius, o);
  }

  cone(caster: Actor, center: Vec2, angle: number, arcDeg: number, radius: number, o: AreaOpts): Actor[] {
    const half = ((arcDeg / 2) * Math.PI) / 180;
    return this.areaGeneric(caster, caster.faction, center, radius, (t) => {
      const dx = t.pos.x - center.x;
      const dy = t.pos.y - center.y;
      const d = Math.hypot(dx, dy);
      if (d > radius + t.radius) return false;
      return d < 0.3 || Math.abs(angleDiff(angle, Math.atan2(dy, dx))) <= half + Math.atan2(t.radius, d);
    }, o);
  }

  line(caster: Actor, from: Vec2, to: Vec2, width: number, o: AreaOpts): Actor[] {
    const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
    const r = Math.hypot(to.x - from.x, to.y - from.y) / 2 + width;
    return this.areaGeneric(caster, caster.faction, mid, r, (t) => distPointSegment(t.pos, from, to) <= width / 2 + t.radius, o);
  }

  spawnProjectile(i: ProjectileInit): Projectile {
    const ctx = this.ctx();
    const p: Projectile = {
      id: ctx.world.nextId(),
      ownerId: i.owner.id,
      faction: i.owner.faction,
      pos: { x: i.from.x, y: i.from.y },
      vel: { x: i.dir.x * i.speed, y: i.dir.y * i.speed },
      radius: i.radius,
      traveled: 0,
      maxRange: i.range,
      damage: i.damage,
      pierceLeft: i.pierce ?? 0,
      hitIds: new Set(),
      homing: i.homing ?? 0,
      targetId: i.targetId ?? null,
      lob: i.lobTo ? { from: { ...i.from }, to: { ...i.lobTo }, duration: Math.max(0.25, Math.hypot(i.lobTo.x - i.from.x, i.lobTo.y - i.from.y) / i.speed), t: 0, height: i.lobHeight ?? 2 } : null,
      explodeRadius: i.explodeRadius ?? 0,
      visual: i.visual,
      tint: i.tint,
      scale: i.scale ?? 1,
      light: i.light,
      trail: i.trail,
      impactFx: i.impactFx,
      impactParticles: i.impactParticles,
      hitsWalls: i.hitsWalls ?? true,
      onHit: i.onHit,
      onExpire: i.onExpire,
      age: 0,
      alive: true,
      z: 0.6,
    };
    return ctx.world.addProjectile(p);
  }

  spawnGroundEffect(i: GroundEffectInit): GroundEffect {
    const ctx = this.ctx();
    const g: GroundEffect = {
      id: ctx.world.nextId(),
      ownerId: i.owner?.id ?? null,
      faction: i.faction,
      pos: { x: i.pos.x, y: i.pos.y },
      shape: i.shape ?? 'circle',
      radius: i.radius ?? 1,
      innerRadius: i.innerRadius ?? 0,
      angle: i.angle ?? 0,
      arc: ((i.arcDeg ?? 90) * Math.PI) / 180,
      length: i.length ?? 0,
      width: i.width ?? 1,
      age: 0,
      delay: i.delay ?? 0,
      duration: i.duration ?? 0,
      tickInterval: i.tickInterval ?? 0.5,
      tickTimer: 0,
      damage: i.damage ?? null,
      status: i.status,
      hitOnce: i.hitOnce ?? true,
      hitIds: new Set(),
      followId: i.followId ?? null,
      visual: { telegraph: i.telegraph ?? false, color: i.color ?? 0xff3020, fx: i.fx, particles: i.particles, light: i.light, showArea: i.showArea ?? false },
      onTick: i.onTick,
      onActivate: i.onActivate,
      onExpire: i.onExpire,
      alive: true,
    };
    return ctx.world.addGroundEffect(g);
  }

  applyStatus(target: Actor, spec: StatusApplySpec, sourceId: number | null): void {
    if (!target.alive || target.kind === 'npc') return;
    let dur = spec.duration;
    const cc = spec.id === 'stun' || spec.id === 'freeze' || spec.id === 'slow' || spec.id === 'chill' || spec.id === 'root' || spec.id === 'fear';
    if (cc && target.kind === 'player') dur *= 1 - Math.min(0.7, target.stats.ccReduction);
    if (cc && target.tags.has('boss') && (spec.id === 'stun' || spec.id === 'freeze' || spec.id === 'fear')) dur *= 0.3;
    const ex = target.statuses.find((s) => s.id === spec.id);
    if (ex) {
      ex.remaining = Math.max(ex.remaining, dur);
      ex.duration = Math.max(ex.duration, dur);
      ex.magnitude = Math.max(ex.magnitude, spec.magnitude);
      if (spec.id === 'burn' || spec.id === 'poison' || spec.id === 'bleed') ex.stacks = Math.min(5, ex.stacks + 1);
    } else {
      target.statuses.push({ id: spec.id, sourceId, remaining: dur, duration: dur, magnitude: spec.magnitude, damageType: spec.damageType, tickTimer: 0, stacks: 1 });
    }
    if (spec.id === 'stun' || spec.id === 'freeze') {
      target.cast = null;
      target.state = spec.id === 'freeze' ? 'frozen' : 'stunned';
      target.stateTime = 0;
    }
    this.ctx().events.emit('statusApplied', { target, statusId: spec.id });
  }

  hasStatus(target: Actor, id: StatusId): boolean {
    for (const s of target.statuses) if (s.id === id) return true;
    return false;
  }

  removeStatus(target: Actor, id: StatusId): void {
    const i = target.statuses.findIndex((s) => s.id === id);
    if (i >= 0) target.statuses.splice(i, 1);
  }

  heal(target: Actor, amount: number, source: 'potion' | 'globe' | 'regen' | 'leech' | 'skill' | 'other' = 'other'): number {
    if (!target.alive || amount <= 0) return 0;
    const before = target.life;
    target.life = Math.min(target.maxLife, target.life + amount);
    const healed = target.life - before;
    if (healed > 0 && target.kind === 'player') {
      const ctx = this.ctx();
      if (source === 'potion' || source === 'globe' || source === 'skill') ctx.fx.floatText(target.pos, `+${Math.round(healed)}`, 'heal');
      ctx.events.emit('playerHealed', { amount: healed, source });
    }
    return healed;
  }

  addResource(actor: Actor, amount: number): void {
    actor.resource = Math.max(0, Math.min(actor.maxResource, actor.resource + amount));
  }

  spendResource(actor: Actor, amount: number): boolean {
    const cost = amount * (1 - Math.min(0.5, actor.stats.resourceCostReduction));
    if (actor.resource + 1e-6 < cost) return false;
    actor.resource -= cost;
    return true;
  }

  knockback(target: Actor, from: Vec2, force: number): void {
    if (target.tags.has('boss')) return;
    const d = vnorm({ x: target.pos.x - from.x, y: target.pos.y - from.y });
    const f = force / Math.max(0.5, target.mass);
    target.knockback.x += d.x * f;
    target.knockback.y += d.y * f;
  }

  dash(actor: Actor, to: Vec2, duration: number, opts: { arc?: number; ghost?: boolean; onArrive?: () => void; onStep?: (t: number) => void } = {}): void {
    const ctx = this.ctx();
    const dest = ctx.world.clampMove(actor.pos, to, actor.radius * 0.8);
    actor.dash = { from: { ...actor.pos }, to: dest, duration: Math.max(0.05, duration), time: 0, arc: opts.arc ?? 0, ghost: opts.ghost ?? true, onArrive: opts.onArrive, onStep: opts.onStep };
    actor.state = 'dashing';
    actor.path = null;
    actor.moveTarget = null;
  }

  teleport(actor: Actor, to: Vec2): void {
    const ctx = this.ctx();
    const p = ctx.world.isWalkable(to.x, to.y) ? to : ctx.world.nearestWalkable(to, 4);
    if (!p) return;
    actor.pos.x = p.x;
    actor.pos.y = p.y;
    actor.path = null;
    actor.moveTarget = null;
  }

  summon(o: SummonOpts): Actor | null {
    const ctx = this.ctx();
    const a = spawnMonster(ctx, o.enemyId, o.pos, { rank: 'normal', level: o.level, faction: o.faction, lifeMult: o.lifeMult, damageMult: o.damageMult });
    if (!a) return null;
    if (o.owner && o.faction === 'player') {
      a.kind = 'minion';
      a.minion = { ownerId: o.owner.id, skillId: o.skillId ?? '', expiresAt: o.duration ? ctx.time + o.duration : null };
      a.stats.summonDamage = o.owner.stats.summonDamage;
      a.weapon = o.owner.weapon;
      a.mainStat = o.owner.mainStat;
    }
    if (o.owner?.monster && a.monster) a.monster.spawnedBy = o.owner.id;
    if (o.tint !== undefined) a.visual.tint = o.tint;
    if (o.scale !== undefined) a.visual.scale *= o.scale;
    return a;
  }

  hitStop(seconds: number): void {
    if (!this.ctx().settings.hitStop) return;
    this.requestHitStop(seconds);
  }
}

function blood_for(color?: number): string {
  if (color === undefined) return 'blood';
  return BLOOD_PRESET[color] ?? 'blood';
}

export function playAnim(a: Actor, name: string, loop: boolean, speed = 1): void {
  if (a.anim.name === name && loop && a.anim.loop) {
    a.anim.speed = speed;
    return;
  }
  a.anim.name = name;
  a.anim.time = 0;
  a.anim.loop = loop;
  a.anim.speed = speed;
  a.anim.serial++;
}

void fxRng;
