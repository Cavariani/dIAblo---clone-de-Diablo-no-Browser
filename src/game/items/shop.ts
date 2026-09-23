// Town economy: vendor stock, buy/sell, salvage, blacksmith enchant (reroll one affix) and upgrade.
import { Rng } from '../../core/rng';
import { Data } from '../../data';
import type { MaterialId, Rarity } from '../../data/schema';
import { affixRange, roundFor } from '../../formulas/affixes';
import { buyPrice, potionPrice, rerollCost, sellPrice, upgradeCost } from '../../formulas/economy';
import type { GameCtx } from '../api';
import type { CharacterState, ItemInstance, RolledAffix } from '../types';
import { createItem, rollOne } from './generate';
import { addToGrid, removeFromGrid } from './inventory';

export interface VendorStock {
  items: ItemInstance[];
  forLevel: number;
}
let stock: VendorStock | null = null;

export function vendorStock(ctx: GameCtx): VendorStock {
  const lvl = ctx.character.level;
  if (!stock || stock.forLevel !== lvl) refreshStock(ctx);
  return stock!;
}

export function refreshStock(ctx: GameCtx): void {
  const lvl = ctx.character.level;
  const rng = new Rng();
  const items: ItemInstance[] = [];
  for (let i = 0; i < 12; i++) {
    const rarity: Rarity = i < 3 ? 'rare' : 'magic';
    items.push(createItem(rng, { ilvl: Math.max(1, lvl + rng.int(-1, 2)), rarity, classId: ctx.character.classId }));
  }
  stock = { items, forLevel: lvl };
}

export const itemBuyPrice = (item: ItemInstance): number => buyPrice(item.ilvl, item.rarity);
export const itemSellPrice = (item: ItemInstance): number => Math.round(sellPrice(item.ilvl, item.rarity) * (1 + item.upgradeLevel * 0.2));

export function sellItem(ctx: GameCtx, item: ItemInstance): boolean {
  const c = ctx.character;
  if (item.locked) return false;
  if (!removeFromGrid(c.inventory, item)) return false;
  const g = itemSellPrice(item);
  c.gold += g;
  ctx.audio.play('sell');
  ctx.fx.floatText(ctx.player.pos, `+${g} ouro`, 'gold');
  ctx.events.emit('itemSold', { item, gold: g });
  ctx.events.emit('goldChanged', { gold: c.gold });
  ctx.events.emit('inventoryChanged', {});
  return true;
}

export function buyItem(ctx: GameCtx, item: ItemInstance): boolean {
  const c = ctx.character;
  const price = itemBuyPrice(item);
  if (c.gold < price) {
    ctx.ui.toast('Ouro insuficiente', 'warn');
    ctx.audio.play('ui_error');
    return false;
  }
  if (!addToGrid(c.inventory, item)) {
    ctx.ui.toast('Inventário cheio!', 'warn');
    return false;
  }
  c.gold -= price;
  if (stock) stock.items = stock.items.filter((i) => i !== item);
  ctx.audio.play('buy');
  ctx.events.emit('itemCrafted', { item, action: 'buy' });
  ctx.events.emit('goldChanged', { gold: c.gold });
  ctx.events.emit('inventoryChanged', {});
  return true;
}

export function buyPotions(ctx: GameCtx): boolean {
  const c = ctx.character;
  const missing = c.potionMax - c.potions;
  if (missing <= 0) {
    ctx.ui.toast('Suas poções já estão cheias', 'info');
    return false;
  }
  const price = potionPrice(c.level) * missing;
  if (c.gold < price) {
    ctx.ui.toast('Ouro insuficiente', 'warn');
    return false;
  }
  c.gold -= price;
  c.potions = c.potionMax;
  ctx.audio.play('potion_drop');
  ctx.events.emit('goldChanged', { gold: c.gold });
  return true;
}

export function salvageItem(ctx: GameCtx, item: ItemInstance): Partial<Record<MaterialId, number>> | null {
  const c = ctx.character;
  if (item.locked || !removeFromGrid(c.inventory, item)) return null;
  const rng = new Rng();
  const out: Partial<Record<MaterialId, number>> = {};
  for (const s of Data.rarity(item.rarity).salvage) {
    const n = rng.int(s.amount[0], s.amount[1]) + Math.floor(item.ilvl / 20);
    out[s.material] = (out[s.material] ?? 0) + n;
    c.materials[s.material] = (c.materials[s.material] ?? 0) + n;
  }
  ctx.audio.play('salvage');
  ctx.events.emit('itemSalvaged', { item });
  ctx.events.emit('inventoryChanged', {});
  return out;
}

function hasMats(c: CharacterState, need: Partial<Record<MaterialId, number>>): boolean {
  for (const [k, v] of Object.entries(need)) if ((c.materials[k as MaterialId] ?? 0) < (v ?? 0)) return false;
  return true;
}

function payMats(c: CharacterState, need: Partial<Record<MaterialId, number>>): void {
  for (const [k, v] of Object.entries(need)) c.materials[k as MaterialId] -= v ?? 0;
}

export function rerollCostFor(item: ItemInstance): { gold: number; mats: Partial<Record<MaterialId, number>> } {
  const r = rerollCost(item.ilvl, (item as ItemInstance & { rerolls?: number }).rerolls ?? 0);
  return { gold: r.gold, mats: { arcaneDust: r.dust, veiledCrystal: r.crystal } };
}

/** D3 mystic: reroll one affix; afterwards only that affix can be rerolled on this item. */
export function rerollAffix(ctx: GameCtx, item: ItemInstance, index: number): RolledAffix | null {
  const c = ctx.character;
  const cur = item.affixes[index];
  if (!cur) return null;
  const enchanted = item.affixes.findIndex((a) => a.enchanted);
  if (enchanted >= 0 && enchanted !== index) {
    ctx.ui.toast('Apenas o afixo já reforjado pode ser alterado', 'warn');
    return null;
  }
  const cost = rerollCostFor(item);
  if (c.gold < cost.gold || !hasMats(c, cost.mats)) {
    ctx.ui.toast('Recursos insuficientes', 'warn');
    ctx.audio.play('ui_error');
    return null;
  }
  const base = Data.itemBase(item.baseId);
  const taken = new Set(item.affixes.filter((_, i) => i !== index).map((a) => Data.tryAffix(a.id)?.group));
  const pool = Data.affixes.filter((a) => (a.slots === 'all' || a.slots.includes(base.slot)) && a.minLevel <= item.ilvl && !taken.has(a.group) && (!a.classId || a.classId === c.classId));
  const rng = new Rng();
  const def = rng.weighted(pool, (a) => a.weight);
  if (!def) return null;
  c.gold -= cost.gold;
  payMats(c, cost.mats);
  const na = rollOne(rng, def, item.ilvl, c.classId, !!item.ancestral);
  na.enchanted = true;
  item.affixes[index] = na;
  (item as ItemInstance & { rerolls?: number }).rerolls = ((item as ItemInstance & { rerolls?: number }).rerolls ?? 0) + 1;
  ctx.audio.play('craft_reroll');
  ctx.events.emit('itemCrafted', { item, action: 'enchant' });
  ctx.events.emit('goldChanged', { gold: c.gold });
  ctx.refreshPlayerStats();
  return na;
}

export function upgradeCostFor(item: ItemInstance): { gold: number; mats: Partial<Record<MaterialId, number>> } {
  const u = upgradeCost(item.ilvl, item.upgradeLevel);
  return { gold: u.gold, mats: { scrap: u.scrap, veiledCrystal: u.crystal, forgottenSoul: u.soul } };
}

/** Temper/masterwork: +10% to every affix value (max 5 levels), rolling above the normal max. */
export function upgradeItem(ctx: GameCtx, item: ItemInstance): boolean {
  const c = ctx.character;
  if (item.upgradeLevel >= 5) {
    ctx.ui.toast('Aprimoramento máximo atingido', 'info');
    return false;
  }
  const cost = upgradeCostFor(item);
  if (c.gold < cost.gold || !hasMats(c, cost.mats)) {
    ctx.ui.toast('Recursos insuficientes', 'warn');
    ctx.audio.play('ui_error');
    return false;
  }
  c.gold -= cost.gold;
  payMats(c, cost.mats);
  item.upgradeLevel++;
  for (const a of item.affixes) {
    const def = Data.tryAffix(a.id);
    if (!def || def.stat === 'skillRank') continue;
    const [, max] = affixRange(def, item.ilvl);
    a.value = roundFor(def.format, a.value + Math.max(max * 0.1, def.format === 'int' ? 1 : 0));
  }
  if (item.damage) item.damage = [Math.round(item.damage[0] * 1.06), Math.round(item.damage[1] * 1.06)];
  if (item.armor) item.armor = Math.round(item.armor * 1.06);
  ctx.audio.play('craft_upgrade');
  ctx.fx.burst('levelup', ctx.player.pos, { count: 20 });
  ctx.events.emit('itemCrafted', { item, action: 'upgrade' });
  ctx.events.emit('goldChanged', { gold: c.gold });
  ctx.refreshPlayerStats();
  return true;
}
