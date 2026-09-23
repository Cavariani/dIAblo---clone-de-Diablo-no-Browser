// Shared panel pieces: frame, held-item cursor, item icon nodes, right-click routing.
import { Data } from '../../data';
import type { GameCtx } from '../../game/api';
import type { ItemInstance } from '../../game/types';
import { el } from '../components/el';
import { hideTooltip, showTooltip } from '../components/Tooltip';
import { applyIcon } from '../icons';
import { equippedFor, itemCard } from '../items';

export function panelFrame(title: string, subtitle: string | null, onClose: () => void, ...body: HTMLElement[]): HTMLElement {
  return el(
    'section',
    { class: 'panel' },
    el('button', { class: 'close-btn', title: 'Fechar (Esc)', onclick: onClose }),
    el('header', { class: 'panel__head' }, el('h2', { class: 'panel__title' }, title), subtitle ? el('p', { class: 'panel__subtitle' }, subtitle) : null),
    el('div', { class: 'panel__body' }, ...body),
  );
}

// ------------------------------------------------------------------ held item (cursor)
export interface Held {
  item: ItemInstance;
  from: 'inventory' | 'equipment' | 'stash';
}
let held: Held | null = null;
let cursorEl: HTMLElement | null = null;
const listeners = new Set<() => void>();

export const getHeld = (): Held | null => held;
export function setHeld(h: Held | null): void {
  held = h;
  hideTooltip();
  if (!cursorEl) {
    cursorEl = el('div', { class: 'held-item' });
    document.getElementById('ui-root')?.appendChild(cursorEl);
    window.addEventListener('pointermove', (e) => {
      if (cursorEl) cursorEl.style.transform = `translate(${e.clientX - 20}px, ${e.clientY - 20}px)`;
    });
  }
  cursorEl.replaceChildren();
  if (h) {
    const [w, hh] = Data.tryItemBase(h.item.baseId)?.size ?? [1, 2];
    cursorEl.style.setProperty('--w', String(w));
    cursorEl.style.setProperty('--h', String(hh));
    cursorEl.append(itemIcon(h.item));
    cursorEl.classList.add('on');
  } else cursorEl.classList.remove('on');
  for (const l of listeners) l();
}
export const onHeldChange = (fn: () => void): void => {
  listeners.add(fn);
};

export function itemIcon(item: ItemInstance): HTMLElement {
  const base = Data.tryItemBase(item.baseId);
  const ico = el('span', { class: 'ico item-ico' });
  applyIcon(ico, base?.icon ?? null, '◆');
  return ico;
}

/** Right-click routing: vendor/stash panels override while open. */
type RightClick = (ctx: GameCtx, item: ItemInstance, from: Held['from']) => boolean;
const rightClickHandlers: RightClick[] = [];
export const pushRightClick = (fn: RightClick): void => {
  rightClickHandlers.unshift(fn);
};
export const popRightClick = (fn: RightClick): void => {
  const i = rightClickHandlers.indexOf(fn);
  if (i >= 0) rightClickHandlers.splice(i, 1);
};
export function routeRightClick(ctx: GameCtx, item: ItemInstance, from: Held['from']): boolean {
  for (const h of rightClickHandlers) if (h(ctx, item, from)) return true;
  return false;
}

/** Tooltip with comparison against the equipped item. */
export function tipFor(ctx: GameCtx, item: ItemInstance, anchor: HTMLElement, opts: { equipped?: boolean; price?: { value: number; label: string; canAfford?: boolean } } = {}): void {
  const c = ctx.character;
  if (item.isNew) item.isNew = false;
  const eq = opts.equipped ? undefined : equippedFor(c, item);
  const cards = [itemCard(item, { compare: eq, character: c, price: opts.price })];
  if (eq) cards.push(itemCard(eq, { tag: 'EQUIPADO', character: c }));
  showTooltip(cards, anchor);
}
