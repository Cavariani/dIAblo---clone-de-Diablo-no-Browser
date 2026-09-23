// Loot: drops on monster death / chests, gold & globe auto-pickup, item pickup into the grid.
import type { Vec2 } from '../../core/math';
import { Data } from '../../data';
import type { MonsterRank, Rarity } from '../../data/schema';
import type { GameCtx, System } from '../api';
import { onGameCreated, registerSystem } from '../hooks';
import type { Game } from '../Game';
import { createItem, rollRarity } from '../items/generate';
import { addToGrid } from '../items/inventory';
import type { Actor, GroundItem, ItemInstance } from '../types';
import { registerInteractHandler, registerPickupHandler } from './PlayerControlSystem';

function scatter(ctx: GameCtx, from: Vec2, spread = 1.2): Vec2 {
  const w = ctx.world;
  for (let i = 0; i < 8; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = 0.3 + Math.random() * spread;
    const p = { x: from.x + Math.cos(a) * d, y: from.y + Math.sin(a) * d };
    if (w.isWalkable(p.x, p.y)) return p;
  }
  return { ...from };
}

export function dropGround(ctx: GameCtx, from: Vec2, g: Omit<GroundItem, 'id' | 'pos' | 'radius' | 'from' | 'droppedAt' | 'dropDuration' | 'alive'>, spread = 1.2): GroundItem {
  const pos = scatter(ctx, from, spread);
  const gi: GroundItem = { ...g, id: ctx.world.nextId(), pos, radius: 0.35, from: { ...from }, droppedAt: ctx.time, dropDuration: 0.45 + Math.random() * 0.2, alive: true };
  ctx.world.addGroundItem(gi);
  return gi;
}

export function dropItem(ctx: GameCtx, from: Vec2, item: ItemInstance, spread = 1.2): GroundItem {
  const g = dropGround(ctx, from, { kind: 'item', item, amount: 1 }, spread);
  const r = item.rarity;
  ctx.events.emit('itemDropped', { ground: g, rarity: r });
  ctx.audio.play(Data.rarity(r).dropSfx, { pos: g.pos });
  if (r === 'legendary' || r === 'set') {
    ctx.fx.screenFlash(r === 'set' ? 0x2a8a3a : 0xa04a10, 0.3, 0.5);
    ctx.ui.toast(item.name, r);
    ctx.character.stats.legendariesFound++;
  }
  return g;
}

/** Rolls and drops loot for a rank at a position. */
export function dropLoot(ctx: GameCtx, pos: Vec2, rank: MonsterRank, level: number, bonus = 1): void {
  const prof = Data.dropProfile(rank);
  if (!prof) return;
  const p = ctx.player;
  const d = ctx.difficulty;
  const mf = p.stats.magicFind + d.magicFindBonus;
  const rng = ctx.rng;
  for (let i = 0; i < prof.itemRolls; i++) {
    if (!rng.chance(Math.min(1, prof.itemChance * bonus))) continue;
    const rarity: Rarity = rollRarity(rng, prof, mf, d.legendaryChanceMult);
    const item = createItem(rng, { ilvl: Math.max(1, level), rarity, classId: ctx.character.classId });
    dropItem(ctx, pos, item);
  }
  if (rng.chance(prof.goldChance)) {
    const amount = Math.max(1, Math.round((3 + level * 2.5) * prof.goldMult * (0.6 + rng.next() * 0.8) * (1 + p.stats.goldFind + d.goldBonus)));
    dropGround(ctx, pos, { kind: 'gold', gold: amount, amount });
  }
  if (rng.chance(prof.potionChance)) dropGround(ctx, pos, { kind: 'potion', amount: 1 });
  if (rng.chance(prof.globeChance)) dropGround(ctx, pos, { kind: 'globe', amount: 1 }, 0.8);
  if (rng.chance(prof.materialChance)) {
    const mat = rng.chance(0.7) ? 'arcaneDust' : 'veiledCrystal';
    dropGround(ctx, pos, { kind: 'material', materialId: mat, amount: 1 });
  }
}

function pickup(ctx: GameCtx, g: GroundItem): boolean {
  const c = ctx.character;
  const p = ctx.player;
  switch (g.kind) {
    case 'gold':
      c.gold += g.gold ?? 0;
      c.stats.goldEarned += g.gold ?? 0;
      ctx.fx.floatText(p.pos, `+${g.gold} ouro`, 'gold');
      ctx.fx.burst('gold_glint', g.pos, { count: 4 });
      ctx.audio.play('gold_pickup', { pitchVar: 0.1 });
      ctx.events.emit('goldPickedUp', { amount: g.gold ?? 0 });
      ctx.events.emit('goldChanged', { gold: c.gold });
      break;
    case 'globe':
      ctx.combat.heal(p, p.maxLife * 0.2 * (1 + p.stats.globeHeal), 'globe');
      ctx.fx.burst('heal', p.pos, { count: 14 });
      ctx.audio.play('globe_pickup');
      break;
    case 'potion':
      if (c.potions >= c.potionMax) return false;
      c.potions++;
      ctx.audio.play('potion_drop');
      ctx.fx.floatText(p.pos, '+1 Poção', 'heal');
      break;
    case 'material':
      c.materials[g.materialId!] = (c.materials[g.materialId!] ?? 0) + g.amount;
      ctx.fx.floatText(p.pos, `+${g.amount} ${Data.material(g.materialId!)?.name ?? ''}`, 'info', 0xc8a0ff);
      ctx.audio.play('item_pickup');
      break;
    case 'item': {
      if (!addToGrid(c.inventory, g.item!)) {
        ctx.ui.toast('Inventário cheio!', 'warn');
        ctx.audio.play('inventory_full');
        ctx.events.emit('inventoryFull', {});
        return false;
      }
      ctx.audio.play('item_pickup');
      ctx.events.emit('itemPickedUp', { item: g.item! });
      ctx.events.emit('inventoryChanged', {});
      break;
    }
    default:
      return false;
  }
  g.alive = false;
  return true;
}

class LootSystem implements System {
  readonly name = 'loot';
  update(ctx: GameCtx): void {
    const p = ctx.player;
    if (!p.alive) return;
    const r = 0.9 + p.stats.pickupRadius;
    for (const g of ctx.world.groundItems) {
      if (!g.alive || ctx.time - g.droppedAt < g.dropDuration) continue;
      const auto = (g.kind === 'gold' && ctx.settings.autoPickupGold) || g.kind === 'globe';
      if (!auto) continue;
      const d = Math.hypot(g.pos.x - p.pos.x, g.pos.y - p.pos.y);
      if (d < (g.kind === 'globe' ? 0.9 : r)) pickup(ctx, g);
    }
  }
}

registerSystem(100, () => new LootSystem());
registerPickupHandler((ctx, g) => {
  pickup(ctx, g);
});

onGameCreated((game: Game) => {
  game.events.on('actorDied', ({ actor, killer }) => {
    if (!actor.monster || actor.faction !== 'enemy' || !actor.monster.dropsLoot) return;
    if (actor.monster.spawnedBy !== null && actor.monster.rank === 'normal' && Math.random() < 0.6) return; // summoned fodder drops less
    void killer;
    dropLoot(game, actor.pos, actor.monster.rank, actor.level);
  });
});

registerInteractHandler('chest', (ctx, o) => {
  if (o.state !== 'idle') return;
  o.state = 'open';
  const tier = (o.data.tier as number) ?? 0;
  ctx.audio.play(tier ? 'chest_open_rare' : 'chest_open', { pos: o.pos });
  ctx.fx.burst('gold_glint', o.pos, { count: 12, z: 0.4 });
  dropLoot(ctx, o.pos, tier ? 'champion' : 'normal', ctx.world.info.monsterLevel, tier ? 2 : 6);
  if (!tier) dropLoot(ctx, o.pos, 'normal', ctx.world.info.monsterLevel, 4);
  ctx.events.emit('chestOpened', { target: o });
});

export type { Actor };
