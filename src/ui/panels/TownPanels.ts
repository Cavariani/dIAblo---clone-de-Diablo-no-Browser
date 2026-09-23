// Town service panels: NPC dialog & quests, vendor, blacksmith, stash, waypoints, difficulty.
import { Data } from '../../data';
import type { NpcDef } from '../../data/schema';
import type { GameCtx } from '../../game/api';
import { addToGrid, fits, itemSize, removeFromGrid } from '../../game/items/inventory';
import { buyItem, buyPotions, itemBuyPrice, refreshStock, rerollAffix, rerollCostFor, salvageItem, sellItem, upgradeCostFor, upgradeItem, vendorStock } from '../../game/items/shop';
import { acceptQuest, questAvailable, questGoal, turnIn } from '../../game/systems/QuestSystem';
import { STASH_H, STASH_W, type ItemInstance } from '../../game/types';
import { el, setText } from '../components/el';
import { hideTooltip } from '../components/Tooltip';
import { fmtInt } from '../format';
import { potionPrice } from '../../formulas/economy';
import { affixText } from '../items';
import { registerPanel, type UIRoot } from '../UIRoot';
import { getHeld, itemIcon, onHeldChange, panelFrame, popRightClick, pushRightClick, setHeld, tipFor } from './common';

const MAT_NAMES = (m: Partial<Record<string, number>>) =>
  Object.entries(m)
    .filter(([, v]) => v)
    .map(([k, v]) => `${v} ${Data.material(k as never)?.name ?? k}`)
    .join(' · ');

// ---------------------------------------------------------------------------------------- dialog
registerPanel('dialog', (ui, ctx) => {
  const body = el('div', { class: 'dialog-body', style: 'display:flex;flex-direction:column;gap:.75rem' });
  const root = panelFrame('', null, () => ui.closePanel('dialog'), body);
  let npc: NpcDef | null = null;
  const render = () => {
    if (!npc) return;
    const n = npc;
    (root.querySelector('.panel__title') as HTMLElement).textContent = n.name;
    body.replaceChildren(el('p', { class: 'panel__subtitle', style: 'text-align:center;margin:0' }, n.title), el('p', { class: 'npc-greeting' }, `“${n.greeting[Math.floor(Math.random() * n.greeting.length)]}”`));
    const actions = el('div', { class: 'panel-actions' });
    if (n.role === 'merchant') actions.append(el('button', { class: 'btn', onclick: () => ui.openPanel('vendor') }, 'Comerciar'));
    if (n.role === 'blacksmith') actions.append(el('button', { class: 'btn', onclick: () => ui.openPanel('blacksmith') }, 'Forja'));
    if (n.role === 'riftkeeper') actions.append(el('button', { class: 'btn', onclick: () => ui.openPanel('rift') }, 'Fendas'));
    body.append(actions);
    const quests = Data.quests.filter((q) => q.giver === n.id);
    for (const q of quests) {
      const st = ctx.character.quests[q.id];
      if (st?.status === 'turnedIn') continue;
      if (!st && !questAvailable(ctx, q)) continue;
      const box = el('div', { class: 'well', style: 'padding:.6rem .75rem' }, el('h4', { style: 'margin:0 0 .25rem;font:700 .95rem var(--f-title);color:var(--c-gold-3)' }, `❖ ${q.name}`), el('p', { style: 'margin:0 0 .4rem;font-size:.85rem;color:var(--c-text-muted)' }, st ? q.description : q.acceptText));
      if (!st) box.append(el('button', { class: 'btn btn--sm', onclick: () => { acceptQuest(ctx, q); render(); } }, 'Aceitar'));
      else if (st.status === 'active') box.append(el('div', { style: 'font-size:.8rem;color:var(--c-text-dim)' }, `Progresso: ${st.progress}/${questGoal(q)}`));
      else if (st.status === 'complete') box.append(el('p', { class: 'npc-greeting' }, `“${q.completeText}”`), el('button', { class: 'btn btn--sm btn--primary', onclick: () => { turnIn(ctx, q); render(); } }, `Receber recompensa (${fmtInt(q.reward.gold)} ◉, ${fmtInt(q.reward.xp)} XP)`));
      body.append(box);
    }
  };
  ctx.events.on('questCompleted', render);
  return { el: root, side: 'left', onOpen: (d) => { npc = Data.npc(d as string); render(); } };
});

// ---------------------------------------------------------------------------------------- vendor
registerPanel('vendor', (ui, ctx) => {
  const grid = el('div', { class: 'shop-grid' });
  const potions = el('button', { class: 'btn btn--sm' });
  const gold = el('div', { class: 'inv-foot' });
  const root = panelFrame('Comerciante', 'Clique direito no inventário para vender', () => ui.closePanel('vendor'), el('div', { class: 'panel-actions' }, potions, el('button', { class: 'btn btn--sm btn--ghost', onclick: () => { refreshStock(ctx); render(); } }, 'Novas mercadorias')), grid, gold);
  const render = () => {
    const c = ctx.character;
    setText(potions, `Reabastecer poções (${fmtInt(potionPrice(c.level) * Math.max(0, c.potionMax - c.potions))} ◉)`);
    potions.onclick = () => { buyPotions(ctx); render(); };
    grid.replaceChildren();
    for (const item of vendorStock(ctx).items) {
      const [w, h] = itemSize(item);
      const price = itemBuyPrice(item);
      const node = el('div', { class: `slot shop-item r-${item.rarity}` }, itemIcon(item), el('span', { class: `price ${price > c.gold ? 'bad' : ''}` }, fmtInt(price)));
      node.style.gridColumn = `span ${w}`;
      node.style.gridRow = `span ${h}`;
      node.style.height = `calc(${h} * var(--cell) + ${(h - 1) * 2}px)`;
      node.addEventListener('pointerenter', () => tipFor(ctx, item, node, { price: { value: price, label: 'Comprar', canAfford: price <= c.gold } }));
      node.addEventListener('pointerleave', hideTooltip);
      node.addEventListener('click', () => { hideTooltip(); if (buyItem(ctx, item)) render(); });
      node.addEventListener('contextmenu', (e) => { e.preventDefault(); hideTooltip(); if (buyItem(ctx, item)) render(); });
      grid.append(node);
    }
    gold.replaceChildren(el('span', { class: 'gold' }, `${fmtInt(c.gold)} ◉`));
  };
  const sell = (cx: GameCtx, item: ItemInstance, from: string) => {
    if (from !== 'inventory') return false;
    sellItem(cx, item);
    render();
    return true;
  };
  ctx.events.on('goldChanged', () => ui.isOpen('vendor') && render());
  return { el: root, side: 'left', onOpen: () => { render(); ui.openPanel('inventory'); pushRightClick(sell); }, onClose: () => popRightClick(sell) };
});

// ---------------------------------------------------------------------------------------- blacksmith
registerPanel('blacksmith', (ui, ctx) => {
  let mode: 'salvage' | 'enchant' | 'upgrade' = 'salvage';
  let target: ItemInstance | null = null;
  let sel = -1;
  const tabs = el('div', { class: 'segmented', style: 'align-self:center' });
  const body = el('div', { style: 'display:flex;flex-direction:column;gap:.6rem' });
  const root = panelFrame('Forja de Brann', 'Clique direito num item do inventário', () => ui.closePanel('blacksmith'), tabs, body);
  const mats = () => el('div', { class: 'smith-cost' }, `Materiais: ${MAT_NAMES(ctx.character.materials) || 'nenhum'} · ${fmtInt(ctx.character.gold)} ◉`);
  const render = () => {
    tabs.replaceChildren(
      ...(['salvage', 'enchant', 'upgrade'] as const).map((m) =>
        el('button', { 'aria-pressed': String(mode === m), onclick: () => { mode = m; target = null; sel = -1; render(); } } as never, m === 'salvage' ? 'Desmontar' : m === 'enchant' ? 'Reforjar' : 'Aprimorar'),
      ),
    );
    body.replaceChildren();
    if (mode === 'salvage') {
      body.append(el('p', { class: 'npc-greeting' }, 'Clique direito em um item para desmontá-lo em materiais.'));
      for (const r of ['common', 'magic', 'rare'] as const) {
        const n = ctx.character.inventory.filter((e) => e.item.rarity === r && !e.item.locked).length;
        body.append(el('button', { class: 'btn btn--sm', disabled: n === 0, onclick: () => { for (const e of ctx.character.inventory.filter((x) => x.item.rarity === r)) salvageItem(ctx, e.item); render(); } } as never, `Desmontar todos: ${Data.rarity(r).name} (${n})`));
      }
    } else {
      const slot = el('div', { class: `slot ${target ? `r-${target.rarity}` : ''}` }, target ? itemIcon(target) : null);
      if (target) {
        const t = target;
        slot.addEventListener('pointerenter', () => tipFor(ctx, t, slot));
        slot.addEventListener('pointerleave', hideTooltip);
      }
      const aff = el('div', { class: 'smith-affixes' });
      if (target) {
        const t = target;
        const enchanted = t.affixes.findIndex((a) => a.enchanted);
        t.affixes.forEach((a, i) => {
          const locked = mode === 'enchant' && enchanted >= 0 && enchanted !== i;
          aff.append(el('button', { class: `smith-affix ${sel === i ? 'sel' : ''} ${locked ? 'locked' : ''}`, onclick: () => { if (!locked) { sel = i; render(); } } }, affixText(a)));
        });
        if (!t.affixes.length) aff.append(el('p', { class: 'smith-cost' }, 'Este item não tem afixos.'));
      } else aff.append(el('p', { class: 'smith-cost' }, 'Nenhum item selecionado.'));
      body.append(el('div', { class: 'smith-target' }, slot, aff));
      if (target) {
        const t = target;
        if (mode === 'enchant') {
          const cost = rerollCostFor(t);
          body.append(el('div', { class: 'smith-cost' }, `Custo: ${fmtInt(cost.gold)} ◉ · ${MAT_NAMES(cost.mats)}`));
          body.append(el('button', { class: 'btn btn--primary', disabled: sel < 0, onclick: () => { rerollAffix(ctx, t, sel); render(); } } as never, 'Reforjar afixo'));
        } else {
          const cost = upgradeCostFor(t);
          body.append(el('div', { class: 'smith-cost' }, `Nível ${t.upgradeLevel}/5 · Custo: ${fmtInt(cost.gold)} ◉ · ${MAT_NAMES(cost.mats)}`));
          body.append(el('button', { class: 'btn btn--primary', disabled: t.upgradeLevel >= 5, onclick: () => { upgradeItem(ctx, t); render(); } } as never, 'Aprimorar (+10% em todos os afixos)'));
        }
      }
    }
    body.append(mats());
  };
  const handler = (cx: GameCtx, item: ItemInstance, from: string) => {
    if (from !== 'inventory') return false;
    if (mode === 'salvage') {
      const out = salvageItem(cx, item);
      if (out) cx.ui.toast(`Desmontado: ${MAT_NAMES(out)}`, 'info');
    } else {
      target = item;
      sel = -1;
    }
    render();
    return true;
  };
  ctx.events.on('inventoryChanged', () => ui.isOpen('blacksmith') && render());
  return { el: root, side: 'left', onOpen: () => { render(); ui.openPanel('inventory'); pushRightClick(handler); }, onClose: () => popRightClick(handler) };
});

// ---------------------------------------------------------------------------------------- stash
registerPanel('stash', (ui, ctx) => {
  let tab = 0;
  const tabs = el('div', { class: 'segmented', style: 'align-self:center' });
  const grid = el('div', { class: 'inv-grid', style: `grid-template-rows: repeat(${STASH_H}, var(--cell))` });
  const root = panelFrame('Baú Compartilhado', 'Compartilhado entre todos os personagens', () => ui.closePanel('stash'), tabs, grid);
  const entries = () => ctx.stash.tabs[tab];
  const place = (item: ItemInstance, x: number, y: number) => {
    const list = entries();
    if (!fits(list, item, x, y, STASH_W, STASH_H)) return;
    list.push({ item, x, y });
    setHeld(null);
    ctx.events.emit('stashChanged', {});
    render();
  };
  const render = () => {
    tabs.replaceChildren(...ctx.stash.tabs.map((_, i) => el('button', { 'aria-pressed': String(i === tab), onclick: () => { tab = i; render(); } } as never, `${['I', 'II', 'III', 'IV'][i]}`)));
    grid.replaceChildren();
    for (let y = 0; y < STASH_H; y++)
      for (let x = 0; x < STASH_W; x++) {
        const cell = el('div', { class: 'inv-cell' });
        cell.style.gridColumn = String(x + 1);
        cell.style.gridRow = String(y + 1);
        cell.addEventListener('click', () => {
          const h = getHeld();
          if (h) place(h.item, x, y);
        });
        grid.append(cell);
      }
    for (const e of entries()) {
      const [w, h] = itemSize(e.item);
      const node = el('div', { class: `slot inv-item r-${e.item.rarity}` }, itemIcon(e.item));
      node.style.gridColumn = `${e.x + 1} / span ${w}`;
      node.style.gridRow = `${e.y + 1} / span ${h}`;
      node.addEventListener('pointerenter', () => tipFor(ctx, e.item, node));
      node.addEventListener('pointerleave', hideTooltip);
      node.addEventListener('click', () => {
        if (getHeld()) return;
        removeFromGrid(entries(), e.item);
        setHeld({ item: e.item, from: 'stash' });
        render();
      });
      node.addEventListener('contextmenu', (ev) => {
        ev.preventDefault();
        hideTooltip();
        if (addToGrid(ctx.character.inventory, e.item)) {
          removeFromGrid(entries(), e.item);
          ctx.events.emit('inventoryChanged', {});
          ctx.events.emit('stashChanged', {});
          render();
        } else ctx.ui.toast('Inventário cheio!', 'warn');
      });
      grid.append(node);
    }
  };
  const toStash = (cx: GameCtx, item: ItemInstance, from: string) => {
    if (from !== 'inventory') return false;
    if (addToGrid(entries(), item, STASH_W, STASH_H)) {
      removeFromGrid(cx.character.inventory, item);
      cx.events.emit('inventoryChanged', {});
      cx.events.emit('stashChanged', {});
      render();
    } else cx.ui.toast('Aba do baú cheia', 'warn');
    return true;
  };
  onHeldChange(() => ui.isOpen('stash') && render());
  return { el: root, side: 'left', onOpen: () => { render(); ui.openPanel('inventory'); pushRightClick(toStash); }, onClose: () => { popRightClick(toStash); ctx.save('stash'); } };
});

// ---------------------------------------------------------------------------------------- waypoints
registerPanel('waypoints', (ui, ctx) => {
  const list = el('div', { style: 'display:flex;flex-direction:column;gap:.35rem' });
  const root = panelFrame('Pórtico de Viagem', 'Escolha um destino', () => ui.closePanel('waypoints'), list);
  const render = () => {
    list.replaceChildren();
    const c = ctx.character;
    for (const z of Data.zones) {
      const floors = z.kind === 'town' ? [1] : z.waypointFloors;
      const unlocked = floors.filter((f) => c.waypoints.includes(`${z.id}:${f}`));
      list.append(el('h3', { class: 'section-title' }, z.name));
      if (!unlocked.length) list.append(el('div', { class: 'smith-cost' }, '— ainda não descoberto —'));
      for (const f of unlocked) {
        const here = ctx.world.info.zone.id === z.id && ctx.world.info.floor === f;
        list.append(
          el('button', { class: 'menu-btn', disabled: here, onclick: () => { ui.closePanel('waypoints'); ctx.audio.play('waypoint_travel'); ctx.travel(z.kind === 'town' ? { kind: 'town' } : { kind: 'zone', zoneId: z.id, floor: f, via: 'waypoint' }); } } as never, z.kind === 'town' ? 'Brasaluz' : `Nível ${f}`, el('span', { class: 'menu-btn__hint' }, here ? 'Você está aqui' : `Nv. área ${z.baseLevel + z.levelPerFloor * (f - 1)}`)),
        );
      }
    }
  };
  return { el: root, side: 'left', onOpen: render };
});

// ---------------------------------------------------------------------------------------- difficulty
registerPanel('difficulty', (ui, ctx) => {
  const list = el('div', { style: 'display:flex;flex-direction:column;gap:.35rem' });
  const root = panelFrame('Altar do Tormento', 'Monstros mais fortes, recompensas maiores', () => ui.closePanel('difficulty'), list);
  const render = () => {
    list.replaceChildren();
    for (const d of Data.difficulties) {
      const ok = ctx.character.level >= d.requiredLevel;
      const cur = ctx.character.difficulty === d.id;
      const hint = ok ? `Vida ×${d.lifeMult} · Dano ×${d.damageMult} · XP +${Math.round(d.xpBonus * 100)}% · Lendários ×${d.legendaryChanceMult}` : `Requer nível ${d.requiredLevel}`;
      const b = el('button', { class: 'menu-btn', disabled: !ok || cur, style: `color:#${d.color.toString(16).padStart(6, '0')}` } as never, `${cur ? '▶ ' : ''}${d.name}`, el('span', { class: 'menu-btn__hint' }, hint));
      b.onclick = () => {
        ctx.character.difficulty = d.id;
        ctx.events.emit('difficultyChanged', { difficulty: d.id });
        ctx.ui.toast(`Dificuldade: ${d.name}`, 'info');
        ctx.audio.play('ui_confirm');
        render();
      };
      list.append(b);
    }
  };
  return { el: root, side: 'left', onOpen: render };
});

export type { UIRoot };
