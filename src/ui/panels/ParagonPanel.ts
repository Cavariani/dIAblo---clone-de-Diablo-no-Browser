// Paragon board (D3-style): 4 categories, one point per paragon level, capped nodes. Shift+click = 10 points.
import { Data } from '../../data';
import type { ParagonNodeDef } from '../../data/schema';
import { paragonPointsSpent, paragonPointsTotal } from '../../game/progression/passives';
import { el } from '../components/el';
import { fmtByFormat } from '../format';
import { registerPanel } from '../UIRoot';
import { panelFrame } from './common';

const CATS: { id: ParagonNodeDef['category']; name: string }[] = [
  { id: 'core', name: 'Núcleo' },
  { id: 'offense', name: 'Ataque' },
  { id: 'defense', name: 'Defesa' },
  { id: 'utility', name: 'Utilidade' },
];

registerPanel('paragon', (ui, ctx) => {
  let cat: ParagonNodeDef['category'] = 'core';
  const body = el('div', { class: 'paragon' });
  const root = panelFrame('Paragon', 'Um ponto por nível de Paragon · Shift+clique = 10', () => ui.closePanel('paragon'), body);
  root.classList.add('paragon-panel');
  const render = () => {
    const c = ctx.character;
    const free = paragonPointsTotal(c) - paragonPointsSpent(c);
    const change = (n: ParagonNodeDef, delta: number) => {
      const cur = c.paragonAlloc[n.id] ?? 0;
      const room = n.maxPoints > 0 ? n.maxPoints - cur : Infinity;
      const d = delta > 0 ? Math.min(delta, free, room) : Math.max(delta, -cur);
      if (!d) return;
      c.paragonAlloc[n.id] = cur + d;
      if (!c.paragonAlloc[n.id]) delete c.paragonAlloc[n.id];
      ctx.audio.play(d > 0 ? 'ui_confirm' : 'ui_click');
      ctx.refreshPlayerStats();
      render();
    };
    const label = (n: ParagonNodeDef) => (n.stat === 'mainStat' ? `${Data.classDef(c.classId).mainStat === 'str' ? 'Força' : Data.classDef(c.classId).mainStat === 'dex' ? 'Destreza' : 'Inteligência'}` : n.name);
    body.replaceChildren(
      el('div', { class: `paragon__head ${free > 0 ? 'has' : ''}` }, el('span', { class: 'paragon__lvl' }, `Paragon ${c.paragonLevel}`), el('span', free > 0 ? `${free} ponto(s) disponível(is)` : c.paragonLevel ? 'Todos os pontos distribuídos' : 'Alcance o nível 50 para ganhar níveis de Paragon')),
      el('div', { class: 'tabs__bar' }, ...CATS.map((k) => el('button', { class: 'tab', 'aria-selected': String(k.id === cat), onclick: () => { cat = k.id; ctx.audio.play('ui_click'); render(); } } as never, k.name))),
      el(
        'div',
        { class: 'paragon__nodes' },
        ...Data.paragonNodes
          .filter((n) => n.category === cat)
          .map((n) => {
            const pts = c.paragonAlloc[n.id] ?? 0;
            const cap = n.maxPoints > 0 ? `${pts}/${n.maxPoints}` : String(pts);
            const minus = el('button', { class: 'btn btn--sm btn--icon', disabled: pts <= 0, onclick: (e: MouseEvent) => change(n, e.shiftKey ? -10 : -1) } as never, '−');
            const plus = el('button', { class: 'btn btn--sm btn--icon', disabled: free <= 0 || (n.maxPoints > 0 && pts >= n.maxPoints), onclick: (e: MouseEvent) => change(n, e.shiftKey ? 10 : 1) } as never, '+');
            return el(
              'div',
              { class: `paragon__node ${pts > 0 ? 'on' : ''}` },
              el('div', {}, el('div', { class: 'paragon__name' }, label(n)), el('div', { class: 'paragon__val' }, `+${fmtByFormat(n.perPoint * pts, n.format)} · ${cap}`), n.maxPoints > 0 ? el('div', { class: 'paragon__bar' }, el('i', { style: `width:${(pts / n.maxPoints) * 100}%` })) : null),
              el('div', { class: 'paragon__btns' }, minus, plus),
            );
          }),
      ),
      el('div', { class: 'panel-actions' }, el('button', { class: 'btn btn--sm btn--ghost', disabled: paragonPointsSpent(c) === 0, onclick: () => { c.paragonAlloc = {}; ctx.refreshPlayerStats(); ctx.audio.play('ui_click'); render(); } } as never, 'Redistribuir')),
    );
  };
  ctx.events.on('paragonUp', () => render());
  return { el: root, side: 'left', onOpen: render };
});
