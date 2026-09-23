// Skill tree (D4-like simplified): 1 point per level, ranks 1-5, runes unlocked by rank, hotbar binding.
import { Data } from '../../data';
import { HOTBAR_SLOTS, type HotbarSlot, type PassiveDef, type SkillDef } from '../../data/schema';
import { passiveTierReq, passiveUnlocked, treePointsSpent } from '../../game/progression/passives';
import type { GameCtx } from '../../game/api';
import { el, setText } from '../components/el';
import { hideTooltip, simpleTip } from '../components/Tooltip';
import { applyIcon } from '../icons';
import { registerPanel, type UIRoot } from '../UIRoot';
import { panelFrame } from './common';

const KEY: Record<HotbarSlot, string> = { lmb: 'E', rmb: 'D', k1: '1', k2: '2', k3: '3', k4: '4' };

/** Flat stats shown as numbers; everything else in statsPerRank is a fraction shown as %. */
const FLAT_STATS = new Set(['str', 'dex', 'int', 'vit', 'maxLife', 'lifeRegen', 'lifeOnHit', 'lifePerKill', 'maxResource', 'resourceRegen', 'resourceOnHit', 'armor', 'allRes', 'thorns', 'blockAmount', 'minDamage', 'maxDamage']);

/** Passive description with {v}/{v2}… filled from statsPerRank × rank. */
export function passiveText(p: PassiveDef, rank: number): string {
  const vals = Object.entries(p.statsPerRank ?? {}).map(([k, v]) => {
    const x = (v ?? 0) * rank;
    return FLAT_STATS.has(k) ? String(Math.round(x * 10) / 10) : `${Math.round(x * 1000) / 10}%`;
  });
  return p.description.replace(/\{v(\d?)\}/g, (_, n: string) => vals[n ? Number(n) - 1 : 0] ?? '?');
}

export function skillPointsTotal(ctx: GameCtx): number {
  const c = ctx.character;
  return (c.level - 1) * Data.progression.skillPointsPerLevel + c.bonusSkillPoints + Data.classDef(c.classId).startingSkills.length;
}
export function skillPointsSpent(ctx: GameCtx): number {
  return Object.values(ctx.character.skillRanks).reduce((a, b) => a + b, 0) + Object.values(ctx.character.passiveRanks).reduce((a, b) => a + b, 0);
}
export const skillPointsFree = (ctx: GameCtx): number => Math.max(0, skillPointsTotal(ctx) - skillPointsSpent(ctx));

function describe(d: SkillDef, rank: number, rune: string | null): string {
  const rd = rune ? d.runes.find((r) => r.id === rune) : undefined;
  const params = { ...d.params, ...(rd?.params ?? {}) };
  let t = d.description.replace('{dmg}', `${Math.round((d.damage + d.damagePerRank * (Math.max(1, rank) - 1)) * 100)}%`);
  for (const [k, v] of Object.entries(params)) t = t.split(`{${k}}`).join(String(v));
  return t.replace('{generate}', String(d.generate ?? ''));
}

class SkillsPanel {
  readonly el: HTMLElement;
  private list = el('div', { class: 'skill-list' });
  private points = el('div', { class: 'skill-points' });
  private dirty = true;

  constructor(
    ui: UIRoot,
    private ctx: GameCtx,
  ) {
    this.el = panelFrame('Habilidades', 'Clique em + para graduar · escolha uma runa · atribua às teclas', () => ui.closePanel('skills'), this.points, this.list);
    this.el.classList.add('skills-panel');
    ctx.events.on('levelUp', () => (this.dirty = true));
    ctx.events.on('skillsChanged', () => (this.dirty = true));
    ctx.events.on('hotbarChanged', () => (this.dirty = true));
  }

  private render(): void {
    this.dirty = false;
    const ctx = this.ctx;
    const c = ctx.character;
    const free = skillPointsFree(ctx);
    setText(this.points, free > 0 ? `Pontos de habilidade: ${free}` : 'Sem pontos disponíveis');
    this.points.classList.toggle('has', free > 0);
    this.list.replaceChildren();
    const cls = Data.classDef(c.classId);
    for (const id of cls.skills) {
      const d = Data.trySkill(id);
      if (!d) continue;
      const rank = c.skillRanks[id] ?? 0;
      const locked = c.level < d.unlockLevel;
      const ico = el('div', { class: 'sk-ico' });
      const icon = el('span', { class: 'ico' });
      applyIcon(icon, d.icon, '✦');
      ico.append(icon);
      simpleTip(ico, () => `<h4>${d.name}</h4><p>${describe(d, rank, c.runes[id] ?? null)}</p>${d.cost ? `<p class="kv">Custo: ${d.cost}</p>` : ''}${d.cooldown ? `<p class="kv">Recarga: ${d.cooldown}s</p>` : ''}`);
      const pips = el('div', { class: 'ranks' }, ...Array.from({ length: d.maxRank }, (_, i) => el('i', { class: i < rank ? 'on' : '' })));
      const runes = el('div', { class: 'runes' });
      for (const r of d.runes) {
        const b = el('button', { class: `rune-btn ${c.runes[id] === r.id ? 'on' : ''}`, disabled: rank < r.unlockRank }, r.name) as HTMLButtonElement;
        simpleTip(b, () => `<h4>${r.name}</h4><p>${describe({ ...d, description: r.description }, rank, r.id)}</p><p class="kv">Requer graduação ${r.unlockRank}</p>`);
        b.onclick = () => {
          c.runes[id] = c.runes[id] === r.id ? '' : r.id;
          if (!c.runes[id]) delete c.runes[id];
          ctx.audio.play('ui_click');
          ctx.events.emit('skillsChanged', {});
        };
        runes.append(b);
      }
      const plus = el('button', { class: 'btn btn--sm', disabled: locked || free <= 0 || rank >= d.maxRank }, '+') as HTMLButtonElement;
      plus.onclick = () => {
        if (skillPointsFree(ctx) <= 0) return;
        c.skillRanks[id] = rank + 1;
        if (rank === 0) {
          // auto-bind to the first empty slot
          const empty = HOTBAR_SLOTS.find((s) => !c.hotbar[s]);
          if (empty) c.hotbar[empty] = id;
          ctx.audio.play('skill_unlock');
        } else ctx.audio.play('ui_confirm');
        ctx.events.emit('skillsChanged', {});
        ctx.events.emit('hotbarChanged', { slot: null });
      };
      const keys = el('div', { class: 'bind-keys' });
      for (const s of HOTBAR_SLOTS) {
        const b = el('button', { class: c.hotbar[s] === id ? 'on' : '', title: `Atribuir a ${s.toUpperCase()}`, disabled: rank === 0 }, KEY[s]) as HTMLButtonElement;
        b.onclick = () => {
          for (const o of HOTBAR_SLOTS) if (c.hotbar[o] === id) c.hotbar[o] = null;
          c.hotbar[s] = id;
          ctx.audio.play('ui_click');
          ctx.events.emit('hotbarChanged', { slot: s });
        };
        keys.append(b);
      }
      const info = el('div', {}, el('h4', `${d.name}${locked ? ` (nível ${d.unlockLevel})` : ''}`), el('p', `${categoryName(d)} · ${rank}/${d.maxRank}`), pips, runes);
      this.list.append(el('div', { class: `skill-row ${locked ? 'locked' : ''}` }, ico, info, el('div', { class: 'bind' }, plus, keys)));
    }
    // passives: unlocked by total points spent in the tree
    const spent = treePointsSpent(c);
    this.list.append(el('h3', { class: 'section-title' }, `Passivas · ${spent} pontos na árvore`));
    for (const p of Data.passivesOf(c.classId)) {
      const rank = c.passiveRanks[p.id] ?? 0;
      const unlocked = passiveUnlocked(c, p);
      const ico = el('div', { class: 'sk-ico sk-ico--passive' });
      const icon = el('span', { class: 'ico' });
      applyIcon(icon, p.icon, '✦');
      ico.append(icon);
      const now = passiveText(p, Math.max(1, rank));
      simpleTip(ico, () => `<h4>${p.name}</h4><p>${now}</p>${rank > 0 && rank < p.maxRank ? `<p class="kv">Próxima: ${passiveText(p, rank + 1)}</p>` : ''}`);
      const pips = el('div', { class: 'ranks' }, ...Array.from({ length: p.maxRank }, (_, i) => el('i', { class: i < rank ? 'on' : '' })));
      const plus = el('button', { class: 'btn btn--sm', disabled: !unlocked || free <= 0 || rank >= p.maxRank }, '+') as HTMLButtonElement;
      plus.onclick = () => {
        if (skillPointsFree(ctx) <= 0) return;
        c.passiveRanks[p.id] = rank + 1;
        ctx.audio.play(rank === 0 ? 'skill_unlock' : 'ui_confirm');
        ctx.refreshPlayerStats();
        ctx.events.emit('skillsChanged', {});
      };
      const lock = unlocked ? `${rank}/${p.maxRank}` : `Requer ${passiveTierReq(c, p)} pontos na árvore`;
      this.list.append(el('div', { class: `skill-row ${unlocked ? '' : 'locked'}` }, ico, el('div', {}, el('h4', p.name), el('p', now), el('p', { class: 'kv' }, lock), pips), el('div', { class: 'bind' }, plus)));
    }
    const respec = el('button', { class: 'btn btn--sm btn--ghost' }, 'Redistribuir pontos') as HTMLButtonElement;
    respec.onclick = () => {
      hideTooltip();
      const cls2 = Data.classDef(c.classId);
      c.skillRanks = {};
      c.passiveRanks = {};
      c.runes = {};
      ctx.refreshPlayerStats();
      for (const s of cls2.startingSkills) c.skillRanks[s.skillId] = 1;
      for (const s of HOTBAR_SLOTS) if (c.hotbar[s] && !c.skillRanks[c.hotbar[s]!]) c.hotbar[s] = null;
      ctx.events.emit('skillsChanged', {});
      ctx.events.emit('hotbarChanged', { slot: null });
    };
    this.list.append(el('div', { class: 'panel-actions' }, respec));
  }

  update(): void {
    if (this.dirty) this.render();
  }
}

function categoryName(d: SkillDef): string {
  return { primary: 'Primária', secondary: 'Secundária', defensive: 'Defensiva', mobility: 'Mobilidade', summon: 'Invocação', utility: 'Utilidade', ultimate: 'Suprema' }[d.category];
}

registerPanel('skills', (ui, ctx) => {
  const p = new SkillsPanel(ui, ctx);
  return { el: p.el, side: 'left', update: () => p.update(), onOpen: () => p.update() };
});
