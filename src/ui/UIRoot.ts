// DOM UI root: HUD, panels (registry), toasts, banners, tooltips, hotkeys. Implements UIAPI.
import './styles/tokens.css';
import './styles/base.css';
import './styles/frames.css';
import './styles/controls.css';
import './styles/hud.css';
import type { GameCtx, PanelId, UIAPI } from '../game/api';
import type { Actor } from '../game/types';
import { el } from './components/el';
import { hideTooltip, initTooltips } from './components/Tooltip';
import { Hud } from './hud/Hud';

export interface PanelInstance {
  el: HTMLElement;
  side: 'left' | 'right' | 'center' | 'full';
  modal?: boolean;
  onOpen?(data?: unknown): void;
  onClose?(): void;
  update?(dt: number): void;
}

export type PanelFactory = (ui: UIRoot, ctx: GameCtx) => PanelInstance;
const factories = new Map<PanelId, PanelFactory>();
export const registerPanel = (id: PanelId, f: PanelFactory): void => {
  factories.set(id, f);
};

const HOTKEYS: Partial<Record<string, PanelId>> = {
  KeyI: 'inventory',
  KeyB: 'inventory',
  KeyC: 'character',
  KeyK: 'skills',
  KeyP: 'paragon',
  KeyJ: 'quests',
};

export class UIRoot implements UIAPI {
  readonly root: HTMLElement;
  readonly hudLayer = el('div', { class: 'hud' });
  private slots: Record<PanelInstance['side'], HTMLElement>;
  private toasts = el('div', { class: 'toasts' });
  private banners = el('div', { class: 'hud' });
  private panels = new Map<PanelId, PanelInstance>();
  private open = new Map<PanelId, PanelInstance>();
  private overUI = false;
  ctx: GameCtx | null = null;
  hud: Hud | null = null;
  /** Called when Esc is pressed with nothing open (opens pause). */
  onEscape: (() => void) | null = null;
  onToggleMap: (() => void) | null = null;
  private lastBanner = '';

  constructor(root: HTMLElement) {
    this.root = root;
    this.slots = {
      left: el('div', { class: 'panel-slot panel-slot--left' }),
      right: el('div', { class: 'panel-slot panel-slot--right' }),
      center: el('div', { class: 'panel-slot panel-slot--center' }),
      full: el('div', { class: 'panel-slot panel-slot--full' }),
    };
    root.append(this.hudLayer, this.banners, this.toasts, this.slots.left, this.slots.right, this.slots.center, this.slots.full);
    initTooltips(root);
    window.addEventListener('pointermove', (e) => {
      const t = e.target as HTMLElement | null;
      this.overUI = !!t && t.tagName !== 'CANVAS' && root.contains(t);
    });
    window.addEventListener('keydown', (e) => this.onKey(e));
  }

  private onKey(e: KeyboardEvent): void {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    if (!this.ctx) return;
    if (e.code === 'Escape') {
      if (!this.closeAll()) this.onEscape?.();
      return;
    }
    if (this.isModal()) return;
    if (e.code === 'Tab' || e.code === 'KeyM') {
      e.preventDefault();
      this.onToggleMap?.();
      return;
    }
    const id = HOTKEYS[e.code];
    if (id && factories.has(id)) this.togglePanel(id);
  }

  bind(ctx: GameCtx): void {
    this.ctx = ctx;
    this.hud?.destroy();
    for (const p of this.panels.values()) p.el.remove();
    this.panels.clear();
    this.open.clear();
    this.hud = new Hud(this, ctx);
    this.hudLayer.replaceChildren(this.hud.el);
    const ev = ctx.events;
    ev.on('toast', ({ text, kind }) => this.toast(text, kind));
    ev.on('levelUp', ({ level }) => this.banner(`Nível ${level}`, '+1 Ponto de Habilidade', 'levelup'));
    ev.on('bossSpawned', ({ actor }) => this.setBossBar(actor));
    ev.on('bossDefeated', () => this.setBossBar(null));
    ev.on('bossPhase', ({ announce }) => announce && this.banner(announce, undefined, 'boss'));
    ev.on('playerDied', () => this.openPanel('death'));
  }

  unbind(): void {
    this.closeAll();
    this.hud?.destroy();
    this.hud = null;
    this.hudLayer.replaceChildren();
    this.ctx = null;
  }

  toast(text: string, kind: Parameters<UIAPI['toast']>[1] = 'info'): void {
    const t = el('div', { class: `toast toast--${kind}` });
    if (kind === 'legendary' || kind === 'set') {
      t.append(el('small', kind === 'legendary' ? 'LENDÁRIO' : 'CONJUNTO'), text);
    } else t.textContent = text;
    this.toasts.appendChild(t);
    while (this.toasts.children.length > 5) this.toasts.firstElementChild?.remove();
    setTimeout(() => t.remove(), kind === 'legendary' || kind === 'set' ? 4600 : 3300);
  }

  banner(title: string, subtitle?: string, kind: Parameters<UIAPI['banner']>[2] = 'zone'): void {
    const key = `${title}|${subtitle}`;
    if (key === this.lastBanner && this.banners.children.length) return;
    this.lastBanner = key;
    this.banners.replaceChildren();
    const b = el('div', { class: `banner banner--${kind}` }, el('div', { class: 'banner__title' }, title), subtitle ? el('div', { class: 'banner__sub' }, subtitle) : null, el('div', { class: 'banner__rule' }));
    this.banners.appendChild(b);
    setTimeout(() => {
      if (b.parentNode) b.remove();
      if (this.lastBanner === key) this.lastBanner = '';
    }, kind === 'death' ? 6000 : 3700);
  }

  private instance(id: PanelId): PanelInstance | null {
    let p = this.panels.get(id);
    if (!p) {
      const f = factories.get(id);
      if (!f || !this.ctx) return null;
      p = f(this, this.ctx);
      p.el.classList.add('ui-panel');
      this.panels.set(id, p);
    }
    return p;
  }

  openPanel(id: PanelId, data?: unknown): void {
    const p = this.instance(id);
    if (!p) return;
    if (this.open.has(id)) {
      p.onOpen?.(data);
      return;
    }
    // one panel per side
    for (const [oid, op] of this.open) if (op.side === p.side || (p.modal && oid !== id)) this.closePanel(oid);
    this.open.set(id, p);
    p.el.classList.remove('is-closing');
    p.el.classList.add('is-opening');
    this.slots[p.side].appendChild(p.el);
    p.onOpen?.(data);
    this.ctx?.audio.play('ui_open');
  }

  closePanel(id: PanelId): void {
    const p = this.open.get(id);
    if (!p) return;
    this.open.delete(id);
    hideTooltip();
    p.onClose?.();
    p.el.classList.remove('is-opening');
    p.el.classList.add('is-closing');
    setTimeout(() => {
      if (!this.open.has(id)) p.el.remove();
    }, 180);
    this.ctx?.audio.play('ui_close');
  }

  togglePanel(id: PanelId): void {
    if (this.open.has(id)) this.closePanel(id);
    else this.openPanel(id);
  }

  isOpen(id: PanelId): boolean {
    return this.open.has(id);
  }

  closeAll(): boolean {
    const had = this.open.size > 0;
    for (const id of [...this.open.keys()]) {
      if (id === 'death') continue;
      this.closePanel(id);
    }
    return had;
  }

  isPointerOverUI(): boolean {
    return this.overUI;
  }

  isModal(): boolean {
    for (const p of this.open.values()) if (p.modal) return true;
    return false;
  }

  setBossBar(actor: Actor | null): void {
    this.hud?.setBoss(actor);
  }

  update(dt: number): void {
    this.hud?.update(dt);
    for (const p of this.open.values()) p.update?.(dt);
  }
}
