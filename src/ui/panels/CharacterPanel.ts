// Character sheet: attributes, offense, defense, utility.
import { Data } from '../../data';
import { armorReduction, resistReduction } from '../../formulas/damage';
import type { GameCtx } from '../../game/api';
import { el } from '../components/el';
import { fmtDec1, fmtInt, fmtPct } from '../format';
import { registerPanel, type UIRoot } from '../UIRoot';
import { panelFrame } from './common';

class CharacterPanel {
  readonly el: HTMLElement;
  private body = el('div', { class: 'char-body' });
  private head = el('div', { class: 'char-head' });
  private key = '';

  constructor(
    ui: UIRoot,
    private ctx: GameCtx,
  ) {
    this.el = panelFrame('Personagem', null, () => ui.closePanel('character'), this.head, this.body);
    this.el.classList.add('character-panel');
  }

  update(): void {
    const p = this.ctx.player;
    const c = this.ctx.character;
    const s = p.stats;
    const key = `${c.level}|${p.maxLife}|${s.armor}|${s.critChance}|${s.str}|${s.dex}|${s.int}|${s.vit}|${p.weapon?.min}|${s.attackSpeed}|${s.damagePct}|${c.paragonLevel}`;
    if (key === this.key) return;
    this.key = key;
    const cls = Data.classDef(c.classId);
    this.head.replaceChildren(el('div', { class: 'char-name' }, c.name), el('div', { class: 'char-sub' }, `${cls.name} · Nível ${c.level}${c.paragonLevel ? ` · Paragon ${c.paragonLevel}` : ''}`));
    const w = p.weapon ?? { min: 1, max: 2, aps: 1, range: 1, ranged: false };
    const main = p.mainStat ?? 0;
    const avg = ((w.min + w.max) / 2) * (1 + main / 100) * (1 + s.damagePct);
    const dps = avg * w.aps * (1 + s.critChance * s.critDamage);
    const lvl = p.level;
    const row = (label: string, value: string, hint?: string) => el('div', { class: 'stat-row', title: hint ?? '' }, el('span', label), el('b', value));
    const sec = (t: string) => el('h3', { class: 'section-title' }, t);
    const mainName = { str: 'Força', dex: 'Destreza', int: 'Inteligência' }[cls.mainStat];
    this.body.replaceChildren(
      el('div', { class: 'char-dps' }, el('strong', fmtInt(dps)), el('span', 'Dano por segundo')),
      sec('Atributos'),
      row('Força', fmtInt(s.str), cls.mainStat === 'str' ? '+1% de dano por ponto' : '+1 armadura por ponto'),
      row('Destreza', fmtInt(s.dex), cls.mainStat === 'dex' ? '+1% de dano por ponto' : 'Aumenta a esquiva'),
      row('Inteligência', fmtInt(s.int), cls.mainStat === 'int' ? '+1% de dano por ponto' : '+0,1 resistência por ponto'),
      row('Vitalidade', fmtInt(s.vit), 'Aumenta a vida máxima'),
      sec('Ataque'),
      row('Dano da arma', `${fmtInt(w.min)}–${fmtInt(w.max)}`),
      row('Ataques por segundo', fmtDec1(w.aps)),
      row(`Bônus de ${mainName}`, fmtPct(main / 100, 0)),
      row('Chance de crítico', fmtPct(s.critChance)),
      row('Dano crítico', fmtPct(s.critDamage, 0)),
      row('Redução de recarga', fmtPct(s.cooldownReduction)),
      row('Dano contra elites', fmtPct(s.eliteDamage, 0)),
      sec('Defesa'),
      row('Vida', fmtInt(p.maxLife)),
      row('Armadura', fmtInt(s.armor), `Reduz ${fmtPct(armorReduction(s.armor, lvl))} do dano físico (monstros do seu nível)`),
      row('Resistência total', fmtInt(s.allRes), `Reduz ${fmtPct(resistReduction(s.allRes, lvl))} do dano elemental`),
      row('Chance de bloqueio', fmtPct(s.blockChance)),
      row('Esquiva', fmtPct(s.dodgeChance)),
      row('Regeneração de vida', `${fmtDec1(s.lifeRegen)}/s`),
      row('Vida por acerto', fmtInt(s.lifeOnHit)),
      sec('Utilidade'),
      row('Velocidade de movimento', fmtPct(s.moveSpeed, 0)),
      row('Ouro encontrado', fmtPct(s.goldFind, 0)),
      row('Chance de itens mágicos', fmtPct(s.magicFind, 0)),
      row('Bônus de experiência', fmtPct(s.xpBonus, 0)),
      sec('Registro'),
      row('Monstros abatidos', fmtInt(c.stats.kills)),
      row('Elites abatidos', fmtInt(c.stats.eliteKills)),
      row('Lendários encontrados', fmtInt(c.stats.legendariesFound)),
      row('Mortes', fmtInt(c.stats.deaths)),
    );
  }
}

registerPanel('character', (ui, ctx) => {
  const p = new CharacterPanel(ui, ctx);
  return { el: p.el, side: 'left', update: () => p.update(), onOpen: () => p.update() };
});
