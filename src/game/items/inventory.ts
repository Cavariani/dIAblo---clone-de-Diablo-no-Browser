// Grid inventory / stash operations and equipping rules.
import { Data } from '../../data';
import type { EquipSlot, ItemSlotType } from '../../data/schema';
import { INVENTORY_H, INVENTORY_W, type CharacterState, type InventoryEntry, type ItemInstance } from '../types';

export const itemSize = (item: ItemInstance): [number, number] => Data.tryItemBase(item.baseId)?.size ?? [1, 2];

export function occupied(entries: InventoryEntry[], w: number, h: number, ignore?: ItemInstance): boolean[] {
  const grid = new Array<boolean>(w * h).fill(false);
  for (const e of entries) {
    if (e.item === ignore) continue;
    const [iw, ih] = itemSize(e.item);
    for (let y = e.y; y < e.y + ih; y++) for (let x = e.x; x < e.x + iw; x++) if (x < w && y < h) grid[y * w + x] = true;
  }
  return grid;
}

export function fits(entries: InventoryEntry[], item: ItemInstance, x: number, y: number, w = INVENTORY_W, h = INVENTORY_H, ignore?: ItemInstance): boolean {
  const [iw, ih] = itemSize(item);
  if (x < 0 || y < 0 || x + iw > w || y + ih > h) return false;
  const grid = occupied(entries, w, h, ignore);
  for (let yy = y; yy < y + ih; yy++) for (let xx = x; xx < x + iw; xx++) if (grid[yy * w + xx]) return false;
  return true;
}

/** Items overlapping a target rect (for swap-on-drop). */
export function overlapping(entries: InventoryEntry[], item: ItemInstance, x: number, y: number): InventoryEntry[] {
  const [iw, ih] = itemSize(item);
  return entries.filter((e) => {
    if (e.item === item) return false;
    const [ew, eh] = itemSize(e.item);
    return e.x < x + iw && e.x + ew > x && e.y < y + ih && e.y + eh > y;
  });
}

export function findSpace(entries: InventoryEntry[], item: ItemInstance, w = INVENTORY_W, h = INVENTORY_H): { x: number; y: number } | null {
  const [iw, ih] = itemSize(item);
  const grid = occupied(entries, w, h);
  for (let x = 0; x <= w - iw; x++)
    for (let y = 0; y <= h - ih; y++) {
      let ok = true;
      for (let yy = y; yy < y + ih && ok; yy++) for (let xx = x; xx < x + iw && ok; xx++) if (grid[yy * w + xx]) ok = false;
      if (ok) return { x, y };
    }
  return null;
}

export function addToGrid(entries: InventoryEntry[], item: ItemInstance, w = INVENTORY_W, h = INVENTORY_H): boolean {
  const s = findSpace(entries, item, w, h);
  if (!s) return false;
  entries.push({ item, x: s.x, y: s.y });
  return true;
}

export function removeFromGrid(entries: InventoryEntry[], item: ItemInstance): boolean {
  const i = entries.findIndex((e) => e.item === item);
  if (i < 0) return false;
  entries.splice(i, 1);
  return true;
}

export const slotsFor = (t: ItemSlotType): EquipSlot[] => (t === 'ring' ? ['ring1', 'ring2'] : [t]);

export function canEquip(c: CharacterState, item: ItemInstance): string | null {
  const base = Data.tryItemBase(item.baseId);
  if (!base) return 'Item desconhecido';
  if (base.classes && !base.classes.includes(c.classId)) return `Apenas ${base.classes.map((k) => Data.classDef(k).name).join(', ')}`;
  if (item.reqLevel > c.level) return `Requer nível ${item.reqLevel}`;
  return null;
}

/**
 * Equips an item from the inventory into its slot (or the given slot). Displaced items go back to the
 * inventory. Returns false if there's no room for displaced items.
 */
export function equipItem(c: CharacterState, item: ItemInstance, slot?: EquipSlot): boolean {
  const base = Data.tryItemBase(item.baseId);
  if (!base || canEquip(c, item)) return false;
  const options = slotsFor(base.slot);
  let target = slot && options.includes(slot) ? slot : options.find((s) => !c.equipment[s]) ?? options[0];
  const displaced: ItemInstance[] = [];
  if (c.equipment[target]) displaced.push(c.equipment[target]!);
  // two-handed rules
  if (base.twoHanded && c.equipment.offhand) {
    const off = c.equipment.offhand;
    const offBase = Data.tryItemBase(off.baseId);
    const quiverOk = base.weaponType && ['bow', 'greatbow', 'slingshot'].includes(base.weaponType) && offBase?.offhandType === 'quiver';
    if (!quiverOk) displaced.push(off);
  }
  if (target === 'offhand' && c.equipment.mainhand) {
    const mb = Data.tryItemBase(c.equipment.mainhand.baseId);
    const isBow = mb?.weaponType && ['bow', 'greatbow', 'slingshot'].includes(mb.weaponType);
    if (mb?.twoHanded && !(isBow && base.offhandType === 'quiver')) displaced.push(c.equipment.mainhand);
  }
  const inv = c.inventory.filter((e) => e.item !== item);
  for (const d of displaced) if (!addToGrid(inv, d)) return false;
  c.inventory = inv;
  for (const d of displaced) {
    for (const s of Object.keys(c.equipment) as EquipSlot[]) if (c.equipment[s] === d) delete c.equipment[s];
  }
  target = target ?? options[0];
  c.equipment[target] = item;
  item.isNew = false;
  return true;
}

export function unequip(c: CharacterState, slot: EquipSlot): boolean {
  const item = c.equipment[slot];
  if (!item) return false;
  if (!addToGrid(c.inventory, item)) return false;
  delete c.equipment[slot];
  return true;
}
