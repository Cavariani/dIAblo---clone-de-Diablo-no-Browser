// In-game HUD: orbs, action bar with cooldown sweeps, xp bar, target plate, boss bar, buffs, channel bar.
import { Data } from '../../data';
import { HOTBAR_SLOTS, type HotbarSlot } from '../../data/schema';
import type { GameCtx } from '../../game/api';
import type { Actor } from '../../game/types';
import { cooldownLeft, skillCost, skillDef } from '../../game/systems/CastSystem';
import { POTION_COOLDOWN } from '../../game/systems/PlayerControlSystem';
import { xpForLevel, paragonXpFor } from '../../game/progression/xp';
import { el, setText } from '../components/el';
import { hideTooltip, simpleTip } from '../components/Tooltip';
import { fmtInt } from '../format';
import { applyIcon } from '../icons';
import type { UIRoot } from '../UIRoot';
import { MapView } from '../map/MapView';
import { rift } from '../../game/rift';

const KEY_LABEL: Record<HotbarSlot, string> = { lmb: 'LMB', rmb: 'RMB', k1: '1', k2: '2', k3: '3', k4: '4' };
const RES_CLASS: Record<string, string> = { fury: 'orb--fury', mana: 'orb--mana', energy: 'orb--energy', essence: 'orb--essence' };
const STATUS_NAMES: Record<string, [string, string, boolean]> = {
  haste: ['Celeridade', '»', false],
  fortify: ['Fortificado', '⛨', false],
  shielded: ['Escudo', '◈', false],
  berserk: ['Fúria', '✹', false],
  slow: ['Lento', '↓', true],
  chill: ['Gelado', '❄', true],
  freeze: ['Congelado', '❄', true],
  stun: ['Atordoado', '✦', true],
  burn: ['Queimando', '♨', true],
  poison: ['Envenenado', '☠', true],
  bleed: ['Sangrando', '♦', true],
  vulnerable: ['Vulnerável', '!', true],
  weaken: ['Enfraquecido', '↘', true],
  root: ['Enraizado', '⌘', true],
};

function orb(kind: string, name: string) {
  const liquid = el('div', { class: 'orb__liquid', html: '<svg class="orb__wave" viewBox="0 0 240 20" preserveAspectRatio="none"><path d="M0 10 Q30 0 60 10 T120 10 T180 10 T240 10 V20 H0Z"/></svg><svg class="orb__wave orb__wave--back" viewBox="0 0 240 20" preserveAspectRatio="none"><path d="M0 10 Q30 20 60 10 T120 10 T180 10 T240 10 V20 H0Z"/></svg>' });
  const label = el('span', { class: 'orb__label' });
  const nm = el('span', { class: 'orb__name' }, name);
  const root = el('div', { class: `orb ${kind}` }, el('div', { class: 'orb__lag' }), liquid, el('div', { class: 'orb__glass' }), label, nm);
  return { root, label, name: nm, fill: -1, lag: -1 };
}

interface SlotUI {
  root: HTMLButtonElement;
  icon: HTMLSpanElement;
  cd: HTMLSpanElement;
  skill: string | null;
  cdv: number;
  ready: boolean;
  nores: boolean;
}

export class Hud {
  readonly el: HTMLElement;
  private life = orb('', 'VIDA');
  private res = orb('orb--mana', 'MANA');
  private slots = new Map<HotbarSlot, SlotUI>();
  private potion: SlotUI;
  private potionCount = el('span', { class: 'hk__count' });
  private xpFill = el('div', { class: 'xpbar__fill' });
  private xpBar = el('div', { class: 'xpbar' }, this.xpFill, el('div', { class: 'xpbar__ticks' }));
  private xpLabel = el('span', { class: 'xp-label' });
  private levelBadge = el('span', { class: 'level-badge' });
  private target = el('div', { class: 'target-plate' });
  private targetName = el('div', { class: 'target-plate__name' });
  private targetMods = el('div', { class: 'target-plate__mods' });
  private targetBar = el('div', { class: 'target-plate__bar' }, el('i'));
  private boss = el('div', { class: 'boss-bar' });
  private bossName = el('div', { class: 'boss-bar__name' });
  private bossTitle = el('div', { class: 'boss-bar__title' });
  private bossFrame = el('div', { class: 'boss-bar__frame' });
  private bossPct = el('span', { class: 'boss-bar__pct' });
  private bossActor: Actor | null = null;
  private bossScan = 0;
  private zoneName = el('div', { class: 'zone-plate__name' });
  private zoneSub = el('div', { class: 'zone-plate__sub' });
  private buffs = el('div', { class: 'buffs' });
  private channel = el('div', { class: 'channel-bar' }, el('div', { class: 'channel-bar__label' }, 'Abrindo Portal...'), el('div', { class: 'channel-bar__track' }, el('i')));
  private lowLife = el('div', { class: 'low-life-vignette' });
  private fps = el('div', { class: 'fps' });
  readonly minimapRoot = el('div', { class: 'minimap' });
  readonly bigmapRoot = el('div', { class: 'bigmap' });
  readonly riftRoot = el('div', { class: 'rift-bar' });
  private lastKey = '';
  private lastTargetKey = '';
  private buffKey = '';

  constructor(
    private ui: UIRoot,
    private ctx: GameCtx,
  ) {
    const cls = Data.classDef(ctx.character.classId);
    this.res.root.className = `orb ${RES_CLASS[cls.resource.kind]}`;
    setText(this.res.name, cls.resource.name.toUpperCase());
    const slotRow = el('div', { class: 'hud-slots' });
    this.potion = this.makeSlot('Q', 'hk--potion');
    this.potion.root.append(this.potionCount);
    this.potion.icon.classList.add('is-glyph');
    this.potion.icon.style.background = 'radial-gradient(circle at 45% 40%, #ff8080, #b3121b 45%, #3a0508 75%)';
    this.potion.icon.style.borderRadius = '50% 50% 45% 45%';
    this.potion.icon.style.inset = '10px 12px 6px';
    this.potion.root.onclick = () => ctx.events.emit('toast', { text: 'Use Q para beber uma poção', kind: 'info' });
    simpleTip(this.potion.root, () => `<h4>Poção de Vida</h4><p>Restaura 50% da vida e concede Fortificado.</p><p class="kv">Recarga: ${POTION_COOLDOWN}s</p>`);
    slotRow.append(this.potion.root, el('span', { class: 'hud-sep' }));
    for (const s of HOTBAR_SLOTS) {
      const ui = this.makeSlot(KEY_LABEL[s]);
      this.slots.set(s, ui);
      slotRow.append(ui.root);
      simpleTip(ui.root, () => this.skillTip(ui.skill));
    }
    const menu = el('div', { class: 'hud-menu interactive' });
    const btn = (glyph: string, key: string, title: string, fn: () => void) => {
      const b = el('button', { title, onclick: fn }, glyph, el('kbd', key));
      menu.append(b);
      return b;
    };
    btn('⚔', 'C', 'Personagem (C)', () => ui.togglePanel('character'));
    btn('✦', 'K', 'Habilidades (K)', () => ui.togglePanel('skills'));
    btn('▣', 'I', 'Inventário (I)', () => ui.togglePanel('inventory'));
    btn('❖', 'J', 'Missões (J)', () => ui.togglePanel('quests'));
    btn('☰', 'Esc', 'Menu (Esc)', () => ui.onEscape?.());

    const bar = el('div', { class: 'hud-bar interactive' }, this.levelBadge, this.xpLabel, this.xpBar, el('div', { style: 'display:flex;gap:.75rem;align-items:center' }, slotRow, menu));
    const bottom = el('div', { class: 'hud-bottom' }, this.life.root, bar, this.res.root);
    this.target.append(this.targetName, this.targetMods, this.targetBar);
    this.bossFrame.append(el('div', { class: 'boss-bar__lag' }), el('div', { class: 'boss-bar__fill' }), el('div', { class: 'boss-bar__marks' }), this.bossPct);
    this.boss.append(this.bossName, this.bossTitle, this.bossFrame);
    const zone = el('div', { class: 'zone-plate' }, this.zoneName, this.zoneSub);
    this.el = el('div', { class: 'hud' }, this.lowLife, bottom, this.buffs, this.target, this.boss, this.minimapRoot, zone, this.riftRoot, this.channel, this.bigmapRoot, this.fps);
    ctx.events.on('zoneEntered', () => this.refreshZone());
    this.refreshZone();
    this.mini = new MapView(ctx, { big: false });
    this.big = new MapView(ctx, { big: true });
    this.minimapRoot.append(this.mini.canvas);
    this.bigmapRoot.append(this.big.canvas);
    ui.onToggleMap = () => {
      this.bigmapOn = !this.bigmapOn;
      this.bigmapRoot.classList.toggle('on', this.bigmapOn);
      this.minimapRoot.style.display = this.bigmapOn ? 'none' : '';
    };
  }

  private mini!: MapView;
  private big!: MapView;
  private bigmapOn = false;

  private makeSlot(key: string, extra = ''): SlotUI {
    const icon = el('span', { class: 'hk__icon' });
    const cd = el('span', { class: 'hk__cd' });
    const root = el('button', { class: `hk ${extra}` }, icon, cd, el('kbd', key));
    return { root, icon, cd, skill: null, cdv: -1, ready: true, nores: false };
  }

  private skillTip(id: string | null): string {
    if (!id) return '<h4>Vazio</h4><p>Atribua uma habilidade no painel de Habilidades (K).</p>';
    const d = skillDef(id);
    if (!d) return '';
    const cls = Data.classDef(this.ctx.character.classId);
    const rank = this.ctx.character.skillRanks[id] ?? 1;
    const dmg = Math.round((d.damage + d.damagePerRank * (rank - 1)) * 100);
    let desc = d.description.replace('{dmg}', `${dmg}%`);
    for (const [k, v] of Object.entries(d.params)) desc = desc.split(`{${k}}`).join(String(v));
    const parts = [`<h4>${d.name}</h4>`, `<p>${desc}</p>`];
    if (d.cost) parts.push(`<p class="kv">Custo: ${d.cost} ${cls.resource.name}</p>`);
    if (d.generate) parts.push(`<p class="kv">Gera: ${d.generate} ${cls.resource.name}</p>`);
    if (d.cooldown) parts.push(`<p class="kv">Recarga: ${d.cooldown}s</p>`);
    return parts.join('');
  }

  private refreshZone(): void {
    const w = this.ctx.world;
    if (!w) return;
    setText(this.zoneName, w.info.zone.name);
    setText(this.zoneSub, w.info.isTown ? `${this.ctx.difficulty.name}` : `Nível ${w.info.floor} · ${this.ctx.difficulty.name} · Nv. monstros ${w.info.monsterLevel}`);
  }

  setBoss(a: Actor | null): void {
    this.bossActor = a;
    this.boss.classList.toggle('on', !!a);
    if (a) {
      setText(this.bossName, a.monster?.displayName ?? a.name);
      const def = a.monster ? Data.tryEnemy(a.monster.defId) : undefined;
      setText(this.bossTitle, (def as { title?: string } | undefined)?.title ?? '');
      const marks = this.bossFrame.querySelector('.boss-bar__marks')!;
      marks.replaceChildren();
      const phases = (def as { phases?: { lifeBelow: number }[] } | undefined)?.phases ?? [];
      for (const ph of phases) if (ph.lifeBelow < 1) marks.append(el('i', { style: `left:${ph.lifeBelow * 100}%` }));
    }
  }

  update(dt: number): void {
    const ctx = this.ctx;
    const p = ctx.player;
    if (!p) return;
    const c = ctx.character;
    // orbs
    const lf = p.maxLife > 0 ? p.life / p.maxLife : 0;
    if (Math.abs(lf - this.life.fill) > 0.001) {
      this.life.root.style.setProperty('--fill', lf.toFixed(3));
      if (lf < this.life.lag || this.life.lag < 0) this.life.root.style.setProperty('--lag', this.life.fill < 0 ? lf.toFixed(3) : this.life.fill.toFixed(3));
      else this.life.root.style.setProperty('--lag', lf.toFixed(3));
      this.life.fill = lf;
      this.life.lag = lf;
      setText(this.life.label, `${fmtInt(p.life)} / ${fmtInt(p.maxLife)}`);
      this.life.root.classList.toggle('is-low', lf < 0.3 && p.alive);
      this.lowLife.classList.toggle('on', lf < 0.3 && p.alive);
    }
    const rf = p.maxResource > 0 ? p.resource / p.maxResource : 0;
    if (Math.abs(rf - this.res.fill) > 0.003) {
      this.res.root.style.setProperty('--fill', rf.toFixed(3));
      this.res.root.style.setProperty('--lag', rf.toFixed(3));
      this.res.fill = rf;
      setText(this.res.label, `${fmtInt(p.resource)} / ${fmtInt(p.maxResource)}`);
    }
    // hotbar
    for (const [slot, ui] of this.slots) {
      const id = c.hotbar[slot] ?? (slot === 'lmb' ? 'common.attack' : null);
      if (id !== ui.skill) {
        ui.skill = id;
        const d = id ? skillDef(id) : undefined;
        applyIcon(ui.icon, d?.icon ?? null, slot === 'lmb' ? '⚔' : '');
        ui.root.classList.toggle('is-empty', !id);
      }
      if (!id) continue;
      const d = skillDef(id)!;
      const left = cooldownLeft(p, id);
      const total = d.cooldown ?? 1;
      const v = left > 0 ? Math.min(1, left / total) : 0;
      if (Math.abs(v - ui.cdv) > 0.004) {
        ui.root.style.setProperty('--cd', v.toFixed(3));
        setText(ui.cd, left > 0 ? (left < 1 ? left.toFixed(1) : String(Math.ceil(left))) : '');
        if (v === 0 && ui.cdv > 0) {
          ui.root.classList.remove('is-ready');
          void ui.root.offsetWidth;
          ui.root.classList.add('is-ready');
        }
        ui.cdv = v;
      }
      const nores = skillCost(p, d) > p.resource + 1e-6;
      if (nores !== ui.nores) {
        ui.nores = nores;
        ui.root.classList.toggle('is-nores', nores);
      }
      ui.root.classList.toggle('is-active', p.cast?.skillId === id);
    }
    const control = (ctx as unknown as { control?: { potionCooldown: number; portalChannel: number } }).control;
    const pcd = control?.potionCooldown ?? 0;
    const pv = pcd > 0 ? pcd / POTION_COOLDOWN : 0;
    if (Math.abs(pv - this.potion.cdv) > 0.004) {
      this.potion.root.style.setProperty('--cd', pv.toFixed(3));
      setText(this.potion.cd, pcd > 0 ? String(Math.ceil(pcd)) : '');
      this.potion.cdv = pv;
    }
    setText(this.potionCount, String(c.potions));
    // channel
    const ch = control?.portalChannel ?? -1;
    this.channel.classList.toggle('on', ch >= 0);
    if (ch >= 0) this.channel.style.setProperty('--fill', String(Math.min(1, ch / 1.2)));
    // xp
    const paragon = c.level >= Data.progression.maxLevel;
    const need = paragon ? paragonXpFor(c.paragonLevel) : xpForLevel(c.level);
    const cur = paragon ? c.paragonXp : c.xp;
    const key = `${c.level}|${c.paragonLevel}|${Math.floor((cur / need) * 1000)}`;
    if (key !== this.lastKey) {
      this.lastKey = key;
      this.xpBar.style.setProperty('--fill', String(Math.min(1, cur / need)));
      this.xpBar.classList.toggle('paragon', paragon);
      setText(this.levelBadge, paragon ? `P${c.paragonLevel}` : String(c.level));
      setText(this.xpLabel, `${paragon ? `Paragon ${c.paragonLevel}` : `Nível ${c.level}`} — ${fmtInt(cur)} / ${fmtInt(need)} XP`);
    }
    // target plate
    const h = ctx.input.hover.actorId;
    const t = h !== null ? ctx.world.getActor(h) : undefined;
    const show = !!t && t.alive && !(t.tags.has('boss') && this.bossActor === t);
    this.target.classList.toggle('on', show);
    if (show && t) {
      const tk = `${t.id}`;
      if (tk !== this.lastTargetKey) {
        this.lastTargetKey = tk;
        const rank = t.kind === 'npc' ? 'npc' : (t.monster?.rank ?? 'normal');
        this.target.className = `target-plate on r-${rank}`;
        setText(this.targetName, t.kind === 'npc' ? `${t.name}` : (t.monster?.displayName ?? t.name));
        const mods = t.monster?.eliteMods.map((m) => Data.eliteMod(m).name).join(' · ') ?? '';
        const npcTitle = t.npc ? (Data.npcs.find((n) => n.id === t.npc!.defId)?.title ?? '') : '';
        setText(this.targetMods, t.kind === 'npc' ? npcTitle : mods);
        this.targetBar.style.display = t.kind === 'npc' ? 'none' : '';
      }
      this.targetBar.style.setProperty('--fill', String(t.life / t.maxLife));
    } else this.lastTargetKey = '';
    // boss (re-acquire an engaged boss after returning by portal / respawn)
    if (!this.bossActor && ++this.bossScan % 30 === 0) {
      const eng = this.ctx.world.actors.find((a) => a.alive && a.monster?.rank === 'boss' && (a.ai as { aggro?: boolean } | undefined)?.aggro);
      if (eng) this.setBoss(eng);
    }
    const b = this.bossActor;
    if (b) {
      const f = Math.max(0, b.life / b.maxLife);
      this.bossFrame.style.setProperty('--fill', f.toFixed(4));
      this.bossFrame.style.setProperty('--lag', f.toFixed(4));
      setText(this.bossPct, `${Math.ceil(f * 100)}%`);
      // hide when the boss dies or we left its zone (death, portal, waypoint)
      if (!b.alive || !this.ctx.world.actors.includes(b)) this.setBoss(null);
    }
    // buffs
    let bk = '';
    for (const s of p.statuses) bk += `${s.id},`;
    if (bk !== this.buffKey) {
      this.buffKey = bk;
      this.buffs.replaceChildren(
        ...p.statuses.map((s) => {
          const info = STATUS_NAMES[s.id] ?? [s.id, '•', false];
          const e = el('div', { class: `buff ${info[2] ? 'is-debuff' : ''}`, title: info[0] }, info[1]);
          e.dataset.sid = s.id;
          return e;
        }),
      );
    }
    for (const node of Array.from(this.buffs.children) as HTMLElement[]) {
      const s = p.statuses.find((x) => x.id === node.dataset.sid);
      if (s) node.style.setProperty('--cd', String(1 - s.remaining / Math.max(0.01, s.duration)));
    }
    // rift progress
    this.riftRoot.classList.toggle('on', rift.active);
    if (rift.active) {
      if (!this.riftRoot.firstChild) this.riftRoot.append(el('div', { class: 'rift-bar__label' }), el('div', { class: 'rift-bar__track' }, el('i')), el('div', { class: 'rift-bar__time' }));
      const [label, track, time] = Array.from(this.riftRoot.children) as HTMLElement[];
      setText(label, rift.done ? 'Fenda concluída' : rift.guardianId !== null ? 'O Guardião chegou!' : `${rift.greater ? `Fenda Maior ${rift.level}` : 'Fenda'} — ${Math.floor(rift.progress * 100)}%`);
      track.style.setProperty('--fill', String(rift.progress));
      const t = Math.max(0, rift.timeLeft);
      setText(time, rift.greater ? `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}` : '');
    }
    if (this.bigmapOn) this.big.update(dt);
    else this.mini.update(dt);
    // fps
    const r =(ctx as unknown as { renderer?: { stats: { fps: number; particles: number } } }).renderer;
    this.fps.style.display = ctx.settings.showFps ? '' : 'none';
    if (ctx.settings.showFps && r) setText(this.fps, `${r.stats.fps} FPS · ${r.stats.particles} part.`);
    void dt;
  }

  destroy(): void {
    hideTooltip();
    this.el.remove();
    void this.ui;
  }
}
