// Diablo-style controls: click to move/attack, hold to keep moving, hotbar skills, potion, portal.
import { screenDirToWorld } from '../../core/math';
import { HOTBAR_SLOTS, type HotbarSlot } from '../../data/schema';
import type { GameCtx, InputAction, System } from '../api';
import type { World } from '../World';
import type { Actor, GroundItem, Interactable } from '../types';
import { BASIC_ATTACK } from '../skills/fallback';
import { endChannel, skillDef, tryStartSkill } from './CastSystem';

export type InteractHandler = (ctx: GameCtx, obj: Interactable) => void;
const interactHandlers = new Map<string, InteractHandler>();
export const registerInteractHandler = (kind: Interactable['kind'], fn: InteractHandler): void => {
  interactHandlers.set(kind, fn);
};
let pickupHandler: ((ctx: GameCtx, item: GroundItem) => void) | null = null;
export const registerPickupHandler = (fn: (ctx: GameCtx, item: GroundItem) => void): void => {
  pickupHandler = fn;
};
let npcHandler: ((ctx: GameCtx, npc: Actor) => void) | null = null;
export const registerNpcHandler = (fn: (ctx: GameCtx, npc: Actor) => void): void => {
  npcHandler = fn;
};

const SLOT_ACTION: Record<HotbarSlot, InputAction> = {
  lmb: 'skill_lmb',
  rmb: 'skill_rmb',
  k1: 'skill_k1',
  k2: 'skill_k2',
  k3: 'skill_k3',
  k4: 'skill_k4',
};

type Intent =
  | { kind: 'none' }
  | { kind: 'attack'; targetId: number; slot: HotbarSlot }
  | { kind: 'item'; id: number }
  | { kind: 'interact'; id: number }
  | { kind: 'npc'; id: number };

export const POTION_COOLDOWN = 20;
const PORTAL_CHANNEL = 1.2;

export class PlayerControlSystem implements System {
  readonly name = 'playerControl';
  private intent: Intent = { kind: 'none' };
  private repath = 0;
  private lastGoal = { x: 0, y: 0 };
  /** Town-portal channel progress (s) or -1. */
  portalChannel = -1;
  potionCooldown = 0;

  reset(): void {
    this.intent = { kind: 'none' };
    this.portalChannel = -1;
  }

  update(ctx: GameCtx, dt: number): void {
    const p = ctx.player;
    const input = ctx.input;
    const w = ctx.world as World;
    if (this.potionCooldown > 0) this.potionCooldown -= dt;
    if (!p.alive) return;
    p.vel.x = p.vel.y = 0;
    if (ctx.ui.isModal()) return;
    const overUI = ctx.ui.isPointerOverUI();
    const c = p.character!;

    // --- potion & portal
    if (input.wasPressed('potion')) this.drinkPotion(ctx);
    if (input.wasPressed('portal') && !w.info.isTown) this.portalChannel = 0;
    if (this.portalChannel >= 0) {
      if (p.lastDamagedAt > ctx.time - dt * 1.5 || input.wasPressed('skill_lmb') || p.cast) {
        this.portalChannel = -1;
      } else {
        this.portalChannel += dt;
        if (Math.random() < 0.5) ctx.fx.burst('portal', p.pos, { count: 2, color: 0x6ab8ff });
        if (this.portalChannel >= PORTAL_CHANNEL) {
          this.portalChannel = -1;
          ctx.events.emit('portalOpened', { pos: { ...p.pos } });
          ctx.travel({ kind: 'town' });
        }
        return;
      }
    }

    // --- channel release / move while channeling (whirlwind)
    if (p.cast?.channel && p.cast.slot && !input.isDown(SLOT_ACTION[p.cast.slot])) endChannel(ctx, p);
    if (p.cast?.channel) {
      const d = skillDef(p.cast.skillId);
      if (d?.movingCast) {
        const m = input.mouseWorld;
        if (Math.hypot(m.x - p.pos.x, m.y - p.pos.y) > 0.3) this.walkTo(ctx, m.x, m.y, dt);
      }
      p.cast.target.x = input.mouseWorld.x;
      p.cast.target.y = input.mouseWorld.y;
      return;
    }

    const hover = input.hover;
    const mouse = input.mouseWorld;
    const forceStand = input.isDown('forceStand');

    // --- hotbar (non-LMB) skills
    for (const slot of HOTBAR_SLOTS) {
      if (slot === 'lmb') continue;
      const action = SLOT_ACTION[slot];
      if (slot === 'rmb' && overUI) continue;
      const pressed = input.wasPressed(action) || (input.isDown(action) && !p.cast);
      if (!pressed) continue;
      const id = c.hotbar[slot];
      if (!id) continue;
      this.useSkill(ctx, id, slot, hover.actorId, forceStand);
    }

    // --- LMB
    const lmbPressed = input.wasPressed('skill_lmb') && !overUI;
    const lmbDown = input.isDown('skill_lmb') && !overUI;
    if (lmbPressed) {
      if (hover.actorId !== null) {
        const t = w.getActor(hover.actorId);
        if (t?.kind === 'npc') this.intent = { kind: 'npc', id: t.id };
        else if (t && t.alive && ctx.combat.isHostile(p.faction, t.faction)) this.intent = { kind: 'attack', targetId: t.id, slot: 'lmb' };
      } else if (hover.groundItemId !== null) this.intent = { kind: 'item', id: hover.groundItemId };
      else if (hover.interactableId !== null) this.intent = { kind: 'interact', id: hover.interactableId };
      else this.intent = { kind: 'none' };
      if (forceStand) {
        this.intent = { kind: 'none' };
        this.useSkill(ctx, c.hotbar.lmb ?? BASIC_ATTACK.id, 'lmb', null, true);
      }
    } else if (lmbDown && forceStand && !p.cast) {
      this.useSkill(ctx, c.hotbar.lmb ?? BASIC_ATTACK.id, 'lmb', null, true);
    }

    // WASD movement
    let wx = 0;
    let wy = 0;
    if (ctx.settings.wasdMovement) {
      if (input.isDown('moveUp')) wy -= 1;
      if (input.isDown('moveDown')) wy += 1;
      if (input.isDown('moveLeft')) wx -= 1;
      if (input.isDown('moveRight')) wx += 1;
    }
    if (wx || wy) {
      this.intent = { kind: 'none' };
      if (!p.cast) {
        const d = screenDirToWorld(wx, wy);
        p.vel.x = d.x * p.moveSpeed;
        p.vel.y = d.y * p.moveSpeed;
        p.path = null;
      }
      return;
    }

    // --- execute intent
    switch (this.intent.kind) {
      case 'attack': {
        const t = w.getActor(this.intent.targetId);
        if (!t || !t.alive) {
          this.intent = { kind: 'none' };
          break;
        }
        const id = c.hotbar[this.intent.slot] ?? BASIC_ATTACK.id;
        const def = skillDef(id);
        const range = def?.targeting === 'melee' || def?.targeting === 'target' ? Math.max(def.range, p.weapon?.ranged ? 0 : (p.weapon?.range ?? 0.9)) : (def?.range ?? 8);
        const d = Math.hypot(t.pos.x - p.pos.x, t.pos.y - p.pos.y) - t.radius;
        const inRange = d <= range && (def?.targeting === 'melee' || w.lineOfSight(p.pos, t.pos));
        if (inRange) {
          if (!p.cast) tryStartSkill(ctx, p, id, t.pos, t.id, this.intent.slot);
          if (!lmbDown && !p.cast) this.intent = { kind: 'none' };
        } else this.walkTo(ctx, t.pos.x, t.pos.y, dt);
        return;
      }
      case 'item': {
        const g = w.groundItems.find((x) => x.id === (this.intent as { id: number }).id && x.alive);
        if (!g) {
          this.intent = { kind: 'none' };
          break;
        }
        if (Math.hypot(g.pos.x - p.pos.x, g.pos.y - p.pos.y) < 0.9) {
          pickupHandler?.(ctx, g);
          this.intent = { kind: 'none' };
        } else this.walkTo(ctx, g.pos.x, g.pos.y, dt);
        return;
      }
      case 'interact': {
        const o = w.interactables.find((x) => x.id === (this.intent as { id: number }).id && x.alive);
        if (!o) {
          this.intent = { kind: 'none' };
          break;
        }
        if (Math.hypot(o.pos.x - p.pos.x, o.pos.y - p.pos.y) < o.interactRange) {
          this.intent = { kind: 'none' };
          interactHandlers.get(o.kind)?.(ctx, o);
          ctx.events.emit('interacted', { target: o });
        } else this.walkTo(ctx, o.pos.x, o.pos.y, dt);
        return;
      }
      case 'npc': {
        const n = w.getActor(this.intent.id);
        if (!n) {
          this.intent = { kind: 'none' };
          break;
        }
        if (Math.hypot(n.pos.x - p.pos.x, n.pos.y - p.pos.y) < 1.4) {
          this.intent = { kind: 'none' };
          p.facing = Math.atan2(n.pos.y - p.pos.y, n.pos.x - p.pos.x);
          npcHandler?.(ctx, n);
        } else this.walkTo(ctx, n.pos.x, n.pos.y, dt);
        return;
      }
    }
    // plain movement toward the cursor while LMB is held
    if (lmbDown && !forceStand && this.intent.kind === 'none') {
      if (Math.hypot(mouse.x - p.pos.x, mouse.y - p.pos.y) > 0.15) this.walkTo(ctx, mouse.x, mouse.y, dt);
      else p.path = null;
    } else if (p.path && !lmbDown) {
      this.followPath(ctx);
    }
  }

  private useSkill(ctx: GameCtx, id: string, slot: HotbarSlot, hoverId: number | null, inPlace: boolean): void {
    const p = ctx.player;
    const def = skillDef(id);
    if (!def || p.cast) return;
    const t = hoverId !== null ? ctx.world.getActor(hoverId) : undefined;
    const hostile = t && t.alive && ctx.combat.isHostile(p.faction, t.faction);
    const needsTarget = def.targeting === 'melee' || def.targeting === 'target';
    if (needsTarget && hostile && !inPlace) {
      const d = Math.hypot(t.pos.x - p.pos.x, t.pos.y - p.pos.y) - t.radius;
      if (d > def.range + (p.weapon?.ranged ? 0 : 0.1)) {
        this.intent = { kind: 'attack', targetId: t.id, slot };
        return;
      }
      tryStartSkill(ctx, p, id, t.pos, t.id, slot);
      return;
    }
    if (def.targeting === 'target' && !hostile) return;
    let target = hostile ? { ...t.pos } : { ...ctx.input.mouseWorld };
    if (def.targeting === 'point') {
      const dx = target.x - p.pos.x;
      const dy = target.y - p.pos.y;
      const d = Math.hypot(dx, dy);
      if (d > def.range) target = { x: p.pos.x + (dx / d) * def.range, y: p.pos.y + (dy / d) * def.range };
    }
    this.intent = { kind: 'none' };
    tryStartSkill(ctx, p, id, target, hostile ? t.id : null, slot);
  }

  drinkPotion(ctx: GameCtx): void {
    const p = ctx.player;
    const c = p.character!;
    if (this.potionCooldown > 0 || c.potions <= 0 || p.life >= p.maxLife) {
      if (c.potions <= 0) ctx.ui.toast('Sem poções!', 'warn');
      return;
    }
    c.potions--;
    this.potionCooldown = POTION_COOLDOWN;
    ctx.combat.heal(p, p.maxLife * 0.5 * (1 + p.stats.potionHeal), 'potion');
    ctx.combat.applyStatus(p, { id: 'fortify', duration: 3, magnitude: 0.2 }, p.id);
    ctx.fx.burst('heal', p.pos, { count: 24 });
    ctx.audio.play('potion_drink');
    ctx.events.emit('potionUsed', { charges: c.potions });
  }

  private walkTo(ctx: GameCtx, x: number, y: number, dt: number): void {
    const p = ctx.player;
    const w = ctx.world as World;
    if (p.cast && !p.cast.channel) return;
    this.repath -= dt;
    const goalMoved = Math.hypot(x - this.lastGoal.x, y - this.lastGoal.y) > 0.4;
    if (w.clearWalk(p.pos, { x, y }, p.radius)) {
      p.path = [{ x, y }];
    } else if (!p.path || this.repath <= 0 || goalMoved) {
      this.repath = 0.25;
      const target = w.isWalkable(x, y) ? { x, y } : w.nearestWalkable({ x, y }, 3);
      p.path = target ? w.findPath(p.pos, target, 3000) : null;
    }
    this.lastGoal.x = x;
    this.lastGoal.y = y;
    this.followPath(ctx);
  }

  private followPath(ctx: GameCtx): void {
    const p = ctx.player;
    const path = p.path;
    if (!path || !path.length) {
      p.path = null;
      return;
    }
    let n = path[0];
    let d = Math.hypot(n.x - p.pos.x, n.y - p.pos.y);
    while (d < 0.12 && path.length > 1) {
      path.shift();
      n = path[0];
      d = Math.hypot(n.x - p.pos.x, n.y - p.pos.y);
    }
    if (d < 0.08) {
      p.path = null;
      return;
    }
    const sp = Math.min(p.moveSpeed, d * 60);
    p.vel.x = ((n.x - p.pos.x) / d) * sp;
    p.vel.y = ((n.y - p.pos.y) / d) * sp;
  }
}
