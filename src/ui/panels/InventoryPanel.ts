// Inventory: paperdoll (11 slots) + 10x6 grid, pick/place/swap, right-click equip, gold & materials.
import { Data } from '../../data';
import { EQUIP_SLOTS, type EquipSlot } from '../../data/schema';
import type { GameCtx } from '../../game/api';
import { canEquip, equipItem, fits, itemSize, overlapping, slotsFor, unequip } from '../../game/items/inventory';
import { dropItem } from '../../game/systems/LootSystem';
import { INVENTORY_H, INVENTORY_W, type ItemInstance } from '../../game/types';
import { el, setText } from '../components/el';
import { hideTooltip } from '../components/Tooltip';
import { fmtInt } from '../format';
import { registerPanel, type UIRoot } from '../UIRoot';
import { getHeld, itemIcon, onHeldChange, panelFrame, routeRightClick, setHeld, tipFor } from './common';

const SLOT_LABEL: Record<EquipSlot, string> = {
  head: 'Cabeça',
  amulet: 'Amuleto',
  chest: 'Peito',
  hands: 'Mãos',
  belt: 'Cintura',
  legs: 'Pernas',
  feet: 'Pés',
  ring1: 'Anel',
  ring2: 'Anel',
  mainhand: 'Arma',
  offhand: 'Secundária',
};

function equipSound(ctx: GameCtx, item: ItemInstance): void {
  const b = Data.tryItemBase(item.baseId);
  ctx.audio.play(b?.category === 'weapon' ? 'equip_weapon' : b?.category === 'jewelry' ? 'equip_jewelry' : 'equip_armor');
}

export function doEquip(ctx: GameCtx, item: ItemInstance, slot?: EquipSlot): boolean {
  const c = ctx.character;
  const err = canEquip(c, item);
  if (err) {
    ctx.ui.toast(err, 'warn');
    ctx.audio.play('ui_error');
    return false;
  }
  if (!equipItem(c, item, slot)) {
    ctx.ui.toast('Sem espaço no inventário', 'warn');
    return false;
  }
  equipSound(ctx, item);
  ctx.refreshPlayerStats();
  ctx.events.emit('equipmentChanged', { slot: slot ?? slotsFor(Data.itemBase(item.baseId).slot)[0] });
  ctx.events.emit('inventoryChanged', {});
  return true;
}

class InventoryPanel {
  readonly el: HTMLElement;
  private grid = el('div', { class: 'inv-grid' });
  private doll = el('div', { class: 'doll' });
  private gold = el('span', { class: 'gold' });
  private mats = el('div', { class: 'mats' });
  private dirty = true;

  constructor(
    private ui: UIRoot,
    private ctx: GameCtx,
  ) {
    for (let y = 0; y < INVENTORY_H; y++)
      for (let x = 0; x < INVENTORY_W; x++) {
        const cell = el('div', { class: 'inv-cell' });
        cell.style.gridColumn = String(x + 1);
        cell.style.gridRow = String(y + 1);
        cell.addEventListener('click', () => this.clickCell(x, y));
        this.grid.append(cell);
      }
    this.el = panelFrame('Inventário', null, () => ui.closePanel('inventory'), this.doll, this.grid, el('div', { class: 'inv-foot' }, this.gold, this.mats));
    this.el.classList.add('inventory-panel');
    const refresh = () => (this.dirty = true);
    ctx.events.on('inventoryChanged', refresh);
    ctx.events.on('equipmentChanged', refresh);
    ctx.events.on('goldChanged', refresh);
    ctx.events.on('itemPickedUp', refresh);
    onHeldChange(refresh);
    // drop held item into the world by clicking outside panels
    document.getElementById('game-root')?.addEventListener('pointerdown', (e) => {
      const h = getHeld();
      if (!h || e.button !== 0 || !this.ui.isOpen('inventory')) return;
      e.stopPropagation();
      dropItem(ctx, ctx.player.pos, h.item, 0.8);
      setHeld(null);
      ctx.events.emit('inventoryChanged', {});
    }, true);
  }

  private clickCell(x: number, y: number): void {
    const h = getHeld();
    if (!h) return;
    this.place(h.item, x, y);
  }

  private place(item: ItemInstance, x: number, y: number): void {
    const c = this.ctx.character;
    const [w, hh] = itemSize(item);
    x = Math.min(x, INVENTORY_W - w);
    y = Math.min(y, INVENTORY_H - hh);
    if (fits(c.inventory, item, x, y)) {
      c.inventory.push({ item, x, y });
      setHeld(null);
    } else {
      const over = overlapping(c.inventory, item, x, y);
      if (over.length !== 1) return;
      const other = over[0];
      c.inventory.splice(c.inventory.indexOf(other), 1);
      if (!fits(c.inventory, item, x, y)) {
        c.inventory.push(other);
        return;
      }
      c.inventory.push({ item, x, y });
      setHeld({ item: other.item, from: 'inventory' });
    }
    this.ctx.audio.play('item_pickup', { volume: 0.6 });
    this.ctx.events.emit('inventoryChanged', {});
  }

  private render(): void {
    this.dirty = false;
    const ctx = this.ctx;
    const c = ctx.character;
    // paperdoll
    this.doll.replaceChildren();
    for (const s of EQUIP_SLOTS) {
      const item = c.equipment[s];
      const slot = el('div', { class: `slot doll-${s} ${item ? `r-${item.rarity}` : 'is-empty'}` });
      slot.dataset.label = SLOT_LABEL[s];
      if (item) slot.append(itemIcon(item));
      slot.addEventListener('pointerenter', () => item && tipFor(ctx, item, slot, { equipped: true }));
      slot.addEventListener('pointerleave', hideTooltip);
      slot.addEventListener('click', () => {
        const h = getHeld();
        if (h) {
          const base = Data.tryItemBase(h.item.baseId);
          if (!base || !(slotsFor(base.slot) as EquipSlot[]).includes(s)) {
            ctx.audio.play('ui_error');
            return;
          }
          if (canEquip(c, h.item)) {
            ctx.ui.toast(canEquip(c, h.item)!, 'warn');
            return;
          }
          const prev = c.equipment[s];
          c.equipment[s] = h.item;
          setHeld(prev ? { item: prev, from: 'equipment' } : null);
          equipSound(ctx, h.item);
          ctx.refreshPlayerStats();
          ctx.events.emit('equipmentChanged', { slot: s });
        } else if (item) {
          delete c.equipment[s];
          setHeld({ item, from: 'equipment' });
          ctx.refreshPlayerStats();
          ctx.events.emit('equipmentChanged', { slot: s });
        }
      });
      slot.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (item && unequip(c, s)) {
          hideTooltip();
          ctx.refreshPlayerStats();
          ctx.events.emit('equipmentChanged', { slot: s });
          ctx.events.emit('inventoryChanged', {});
        }
      });
      this.doll.append(slot);
    }
    // grid items
    for (const n of Array.from(this.grid.querySelectorAll('.inv-item'))) n.remove();
    for (const e of c.inventory) {
      const [w, h] = itemSize(e.item);
      const unusable = !!canEquip(c, e.item);
      const node = el('div', { class: `slot inv-item r-${e.item.rarity} ${e.item.isNew ? 'is-new' : ''} ${unusable ? 'is-unusable' : ''}` }, itemIcon(e.item));
      node.style.gridColumn = `${e.x + 1} / span ${w}`;
      node.style.gridRow = `${e.y + 1} / span ${h}`;
      node.addEventListener('pointerenter', () => tipFor(ctx, e.item, node));
      node.addEventListener('pointerleave', hideTooltip);
      node.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const held = getHeld();
        if (held) {
          this.place(held.item, e.x, e.y);
          return;
        }
        c.inventory.splice(c.inventory.indexOf(e), 1);
        setHeld({ item: e.item, from: 'inventory' });
        ctx.events.emit('inventoryChanged', {});
      });
      node.addEventListener('contextmenu', (ev) => {
        ev.preventDefault();
        hideTooltip();
        if (routeRightClick(ctx, e.item, 'inventory')) return;
        doEquip(ctx, e.item);
      });
      this.grid.append(node);
    }
    setText(this.gold, `${fmtInt(c.gold)} ◉`);
    this.mats.replaceChildren(
      ...Data.materials
        .filter((m) => (c.materials[m.id] ?? 0) > 0)
        .map((m) => el('span', { class: 'mat', title: m.name, style: `color:#${m.color.toString(16).padStart(6, '0')}` }, `◆ ${c.materials[m.id]}`)),
    );
  }

  update(): void {
    if (this.dirty) this.render();
  }
}

registerPanel('inventory', (ui, ctx) => {
  const p = new InventoryPanel(ui, ctx);
  return { el: p.el, side: 'right', update: () => p.update(), onOpen: () => p.update() };
});
