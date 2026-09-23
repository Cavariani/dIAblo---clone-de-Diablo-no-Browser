// Screen flow: loading → main menu → create/select → game ↔ pause/options/death.
import '../ui/styles/screens.css';
import { audio } from '../audio/AudioManager';
import { InputManager } from '../core/input';
import { Data } from '../data';
import { CLASS_IDS, type ClassId } from '../data/schema';
import { playerVisual } from '../game/actors';
import { Game } from '../game/Game';
import { defaultAppearance, newCharacter } from '../game/save/defaults';
import { SaveManager } from '../game/save/SaveManager';
import type { CharacterState, SaveFile } from '../game/types';
import { assets } from '../render/assets/AssetManager';
import { Renderer } from '../render/Renderer';
import type { AvatarPreviewHandle } from '../render/types';
import { clearBuffs } from '../game/skills/buffs';
import { el } from '../ui/components/el';
import { fmtPlayTime } from '../ui/format';
import { panelFrame } from '../ui/panels/common';
import { registerPanel, UIRoot } from '../ui/UIRoot';

const TIPS = [
  'Segure Shift para atacar sem sair do lugar.',
  'Pressione T para abrir um portal de volta à cidade. A sua masmorra continuará lá.',
  'Segure Alt para ver todos os itens no chão.',
  'Itens lendários brilham em laranja. Itens de conjunto, em verde.',
  'O ferreiro pode reforjar um afixo de qualquer item mágico ou superior.',
  'Globos vermelhos restauram vida instantaneamente.',
  'Elites de nome dourado são raros e sempre deixam boas recompensas.',
  'Aumente a dificuldade no Altar do Tormento para itens melhores.',
];

const SKIN_TONES = [0xffffff, 0xf2d2b8, 0xd8a880, 0xa87a58, 0x7a5840];
const ARMOR_TINTS = [0xffffff, 0xc8a080, 0xb04a3c, 0x4a6fb5, 0x3f7d4a, 0xc9a24a, 0x6a5a8e, 0x3a3a40];

function embers(n = 40): HTMLElement {
  const box = el('div', { class: 'embers' });
  for (let i = 0; i < n; i++) {
    const e = el('i');
    e.style.setProperty('--x', `${Math.random() * 100}%`);
    e.style.setProperty('--d', `${7 + Math.random() * 9}s`);
    e.style.setProperty('--delay', `${-Math.random() * 12}s`);
    e.style.setProperty('--dx', `${(Math.random() - 0.5) * 160}px`);
    box.append(e);
  }
  return box;
}

export class App {
  readonly renderer = new Renderer();
  readonly save = new SaveManager();
  readonly input = new InputManager();
  ui!: UIRoot;
  game: Game | null = null;
  private screen: HTMLElement | null = null;
  private preview: AvatarPreviewHandle | null = null;
  private raf = 0;
  private file!: SaveFile;

  async boot(): Promise<void> {
    const uiRoot = document.getElementById('ui-root')!;
    this.ui = new UIRoot(uiRoot);
    const loading = this.showLoading();
    loading.set(0.05, 'Inicializando o motor');
    await this.renderer.init(document.getElementById('game-root')!);
    loading.set(0.25, 'Lendo pergaminhos antigos');
    await Promise.all([assets.init(), audio.init(), document.fonts?.ready]);
    loading.set(0.5, 'Carregando o save');
    this.file = await this.save.init();
    this.applySettings();
    loading.set(0.75, 'Acendendo as tochas');
    // preload common hero layers
    await assets.loadSheets(['avatar/male/default_chest', 'avatar/male/default_legs', 'avatar/male/default_feet', 'avatar/male/default_hands', 'avatar/male/head_short']);
    loading.set(1, 'Pronto');
    this.input.attach(document.getElementById('game-root')!);
    const unlock = () => audio.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    this.registerModalPanels();
    this.ui.onEscape = () => this.game && this.ui.openPanel('pause');
    document.getElementById('boot')?.remove();
    this.loop();
    const q = new URLSearchParams(location.search);
    if (q.get('quick')) await this.quickStart(q.get('quick')!, q.get('zone') ?? 'crypt', Number(q.get('floor') ?? 1));
    else this.mainMenu();
  }

  /** Dev/test helper: fresh character straight into a zone. */
  async quickStart(classId: string, zone: string, floor: number): Promise<void> {
    const id = (CLASS_IDS as readonly string[]).includes(classId) ? (classId as ClassId) : 'berserker';
    const c = newCharacter(id, `Teste${Math.floor(Math.random() * 999)}`, defaultAppearance(id));
    c.location = { zoneId: zone, floor };
    await this.startGame(c);
  }

  private applySettings(): void {
    const s = this.file.settings;
    this.renderer.applySettings(s);
    audio.applySettings(s);
  }

  private loop(): void {
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (this.game) this.game.frame(dt);
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  // ------------------------------------------------------------------------------ screens

  private setScreen(node: HTMLElement | null): void {
    this.preview?.destroy();
    this.preview = null;
    this.screen?.remove();
    this.screen = node;
    if (node) document.getElementById('ui-root')!.appendChild(node);
  }

  private showLoading(): { set: (p: number, label: string) => void; done: () => void } {
    const bar = el('div', { class: 'loading__bar' }, el('i'));
    const label = el('div', { class: 'loading__label' });
    const tip = el('div', { class: 'loading__tip' }, TIPS[Math.floor(Math.random() * TIPS.length)]);
    const node = el('div', { class: 'screen' }, embers(25), el('div', { class: 'loading' }, el('div', { class: 'loading__box' }, el('div', { class: 'logo' }, 'd', el('em', 'IA'), 'blo'), bar, label, tip)));
    this.setScreen(node);
    return {
      set: (p, l) => {
        bar.style.setProperty('--p', String(p));
        label.textContent = l;
      },
      done: () => this.setScreen(null),
    };
  }

  mainMenu(): void {
    audio.playMusic('music_title', 1);
    const last = this.file.characters.find((c) => c.id === this.file.lastCharacterId) ?? this.file.characters[0];
    const btn = (label: string, fn: () => void, disabled = false, hint = '') => {
      const b = el('button', { class: 'menu-btn', onclick: () => { audio.play('ui_click'); fn(); } }, el('span', { class: 'menu-btn__glyph' }, '✦'), label, hint ? el('span', { class: 'menu-btn__hint' }, hint) : null) as HTMLButtonElement;
      b.disabled = disabled;
      b.addEventListener('pointerenter', () => audio.play('ui_hover'));
      return b;
    };
    const stack = el(
      'div',
      { class: 'menu-stack' },
      btn('Continuar', () => last && this.startGame(last), !last, last ? `${last.name} · Nv. ${last.level}` : ''),
      btn('Novo Personagem', () => this.createScreen()),
      btn('Selecionar Personagem', () => this.selectScreen(), this.file.characters.length === 0),
      btn('Opções', () => this.ui.openPanel('options')),
      btn('Créditos', () => this.creditsScreen()),
    );
    const node = el('div', { class: 'screen' }, embers(), el('div', { class: 'main-menu' }, el('div', { class: 'main-menu__inner' }, el('div', {}, el('div', { class: 'logo' }, 'd', el('em', 'IA'), 'blo'), el('div', { class: 'logo-sub' }, 'Um ARPG de trevas')), stack)), el('div', { class: 'version' }, 'v1.0 · arte Flare (CC-BY-SA)'));
    this.setScreen(node);
  }

  private createScreen(): void {
    let classId: ClassId = 'berserker';
    let app = defaultAppearance(classId);
    let name = '';
    const cards = el('div', { class: 'class-cards' });
    const stage = el('div', { class: 'preview__stage' });
    const nameLabel = el('div', { class: 'preview__name' });
    const custom = el('div', { class: 'custom' });
    const err = el('div', { class: 'field-error' });
    const input = el('input', { class: 'input', placeholder: 'Nome do herói', maxLength: 16 }) as HTMLInputElement;
    const visual = () => playerVisual(newCharacter(classId, 'preview', app));
    const refresh = () => {
      cards.replaceChildren(
        ...CLASS_IDS.map((id) => {
          const c = Data.classDef(id);
          const card = el('button', { class: `class-card ${id === classId ? 'sel' : ''}`, style: `--cc:#${c.color.toString(16).padStart(6, '0')}`, onclick: () => { classId = id; app = { ...defaultAppearance(id), skinTone: app.skinTone, armorTint: app.armorTint }; audio.play('ui_click'); refresh(); } }, el('h3', c.name), el('div', { class: 'tagline' }, c.title), el('div', { class: 'res' }, `Recurso: ${c.resource.name} · Atributo: ${{ str: 'Força', dex: 'Destreza', int: 'Inteligência' }[c.mainStat]}`), el('p', c.description));
          return card;
        }),
      );
      const cls = Data.classDef(classId);
      const chips = <T>(label: string, options: T[], cur: T, text: (o: T) => string, set: (o: T) => void) =>
        el('div', {}, el('h4', label), el('div', { class: 'swatches' }, ...options.map((o) => el('button', { class: 'chip', 'aria-pressed': String(o === cur), onclick: () => { set(o); refresh(); } } as never, text(o)))));
      const swatches = (label: string, colors: number[], cur: number, set: (c: number) => void) =>
        el('div', {}, el('h4', label), el('div', { class: 'swatches' }, ...colors.map((c) => el('button', { class: 'swatch', style: `background:#${c.toString(16).padStart(6, '0')}`, 'aria-pressed': String(c === cur), onclick: () => { set(c); refresh(); } } as never))));
      const bodyName: Record<string, string> = { male: 'Masculino', female: 'Feminino', female_dark: 'Feminino (pele escura)' };
      custom.replaceChildren(
        ...([
        el('h1', 'Criar Herói'),
        el('div', {}, el('h4', 'Nome'), input, err),
        chips('Silhueta', cls.appearance.bodies, app.body, (b) => bodyName[b] ?? b, (b) => (app = { ...app, body: b, head: cls.appearance.heads[b][0] })),
        chips('Rosto / Cabelo', cls.appearance.heads[app.body], app.head, (h) => ({ head_short: 'Cabelo curto', head_bald: 'Careca', head_long: 'Cabelo longo' })[h] ?? h, (h) => (app = { ...app, head: h })),
        app.body === 'male' ? swatches('Tom de pele', SKIN_TONES, app.skinTone, (c) => (app = { ...app, skinTone: c })) : null,
        swatches('Cor da armadura', ARMOR_TINTS, app.armorTint, (c) => (app = { ...app, armorTint: c })),
        el('div', { class: 'screen-actions' }, el('button', { class: 'btn btn--primary btn--lg', onclick: () => create() }, 'Criar'), el('button', { class: 'btn btn--ghost', onclick: () => this.mainMenu() }, 'Voltar')),
        ].filter(Boolean) as HTMLElement[]),
      );
      nameLabel.textContent = name || cls.name;
      if (!this.preview) this.preview = this.renderer.createAvatarPreview(stage, visual(), { scale: 2.2, rotate: true });
      else this.preview.update(visual());
    };
    input.addEventListener('input', () => {
      name = input.value.trim();
      nameLabel.textContent = name || Data.classDef(classId).name;
      err.textContent = '';
    });
    const create = () => {
      name = input.value.trim();
      if (name.length < 2) {
        err.textContent = 'O nome precisa ter entre 2 e 16 letras.';
        return;
      }
      if (this.file.characters.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
        err.textContent = 'Já existe um herói com esse nome.';
        return;
      }
      const c = newCharacter(classId, name, app);
      void this.save.saveCharacter(c);
      audio.play('level_up');
      this.startGame(c);
    };
    const node = el('div', { class: 'screen' }, embers(20), el('div', { class: 'char-screen' }, cards, el('div', { class: 'preview' }, stage, nameLabel), custom));
    this.setScreen(node);
    refresh();
    setTimeout(() => input.focus(), 50);
  }

  private selectScreen(): void {
    let sel = this.file.characters.find((c) => c.id === this.file.lastCharacterId) ?? this.file.characters[0];
    const list = el('div', { class: 'char-list' });
    const stage = el('div', { class: 'preview__stage' });
    const nameLabel = el('div', { class: 'preview__name' });
    const fileInput = el('input', { type: 'file', accept: '.json,application/json', style: 'display:none' }) as HTMLInputElement;
    const info = el('div', { class: 'custom' });
    const refresh = () => {
      list.replaceChildren(
        ...this.file.characters.map((c) =>
          el('div', { class: `char-entry ${c === sel ? 'sel' : ''}`, onclick: () => { sel = c; audio.play('ui_click'); refresh(); } }, el('div', {}, el('h3', c.name), el('p', `${Data.classDef(c.classId).name} · Nível ${c.level}${c.paragonLevel ? ` (P${c.paragonLevel})` : ''} · ${Data.difficulty(c.difficulty).name}`)), el('span', { class: 'menu-btn__hint' }, fmtPlayTime(c.stats.playTime))),
        ),
      );
      if (sel) {
        nameLabel.textContent = sel.name;
        const v = playerVisual(sel);
        if (!this.preview) this.preview = this.renderer.createAvatarPreview(stage, v, { scale: 2.2, rotate: true });
        else this.preview.update(v);
        info.replaceChildren(
          el('h1', 'Heróis'),
          el('div', { class: 'well' }, el('div', { class: 'stat-row' }, el('span', 'Monstros abatidos'), el('b', String(sel.stats.kills))), el('div', { class: 'stat-row' }, el('span', 'Lendários'), el('b', String(sel.stats.legendariesFound))), el('div', { class: 'stat-row' }, el('span', 'Ouro'), el('b', String(sel.gold))), el('div', { class: 'stat-row' }, el('span', 'Local'), el('b', Data.tryZone(sel.location.zoneId)?.name ?? '—'))),
          el('div', { class: 'screen-actions' }, el('button', { class: 'btn btn--primary btn--lg', onclick: () => sel && this.startGame(sel) }, 'Jogar')),
          el('div', { class: 'screen-actions' }, el('button', { class: 'btn btn--danger btn--sm', onclick: () => { if (sel && confirm(`Apagar ${sel.name} para sempre?`)) { void this.save.deleteCharacter(sel.id); sel = this.file.characters[0]; if (!sel) this.mainMenu(); else refresh(); } } }, 'Apagar'), el('button', { class: 'btn btn--sm', onclick: () => this.exportSave() }, 'Exportar save'), el('button', { class: 'btn btn--sm', onclick: () => fileInput.click() }, 'Importar save'), el('button', { class: 'btn btn--ghost btn--sm', onclick: () => this.mainMenu() }, 'Voltar')),
          fileInput,
        );
      }
    };
    fileInput.onchange = async () => {
      const f = fileInput.files?.[0];
      if (!f) return;
      try {
        this.file = await this.save.importJson(await f.text());
        this.applySettings();
        sel = this.file.characters[0];
        refresh();
      } catch (e) {
        alert((e as Error).message);
      }
    };
    const node = el('div', { class: 'screen' }, embers(20), el('div', { class: 'char-screen' }, list, el('div', { class: 'preview' }, stage, nameLabel), info));
    this.setScreen(node);
    refresh();
  }

  private exportSave(): void {
    const blob = new Blob([this.save.exportJson()], { type: 'application/json' });
    const a = el('a', { href: URL.createObjectURL(blob), download: `diablo-save-${new Date().toISOString().slice(0, 10)}.json` }) as HTMLAnchorElement;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  private creditsScreen(): void {
    const body = el(
      'div',
      {},
      el('h3', 'Arte, animações, tilesets, música e efeitos sonoros'),
      el('p', 'Projeto Flare (flarerpg.org) — Clint Bellanger, Justin Jacobs, Stefan Beller, remaxim, Brandon Morris, Justin Nichol e muitos outros. Licença CC-BY-SA 3.0. Veja CREDITS.md para a lista completa.'),
      el('h3', 'Sons complementares'),
      el('p', 'Kenney (kenney.nl) e artistas do OpenGameArt — domínio público (CC0).'),
      el('h3', 'Fontes'),
      el('p', 'Cinzel, Cinzel Decorative, Alegreya Sans, EB Garamond — Google Fonts (OFL).'),
      el('h3', 'Jogo'),
      el('p', 'dIAblo — código, design e UI originais, inspirados na série Diablo. Projeto pessoal sem fins comerciais.'),
    );
    const panel = panelFrame('Créditos', null, () => this.mainMenu(), body);
    this.setScreen(el('div', { class: 'screen' }, embers(20), el('div', { class: 'credits' }, panel)));
  }

  // ------------------------------------------------------------------------------ game

  async startGame(c: CharacterState): Promise<void> {
    this.setScreen(null);
    const loading = this.showLoading();
    loading.set(0.3, 'Entrando no mundo');
    this.game?.dispose();
    clearBuffs();
    const game = new Game({ character: c, stash: this.file.stash, settings: this.file.settings, renderer: this.renderer, ui: this.ui, audio, input: this.input, save: this.save });
    this.game = game;
    this.ui.bind(game);
    this.file.lastCharacterId = c.id;
    (window as unknown as { __game: Game }).__game = game;
    await game.start();
    loading.done();
    void this.save.saveCharacter(c);
  }

  quitToMenu(): void {
    if (this.game) {
      this.game.save('quit');
      this.game.dispose();
      this.game = null;
    }
    this.ui.closeAll();
    this.ui.closePanel('death');
    this.ui.unbind();
    this.mainMenu();
  }

  // ------------------------------------------------------------------------------ modal panels

  private registerModalPanels(): void {
    registerPanel('pause', (ui) => {
      const stack = el(
        'div',
        { class: 'menu-stack' },
        el('button', { class: 'menu-btn', onclick: () => ui.closePanel('pause') }, 'Continuar'),
        el('button', { class: 'menu-btn', onclick: () => ui.openPanel('options') }, 'Opções'),
        el('button', { class: 'menu-btn', onclick: () => { this.game?.save('manual'); ui.toast('Jogo salvo', 'info'); } }, 'Salvar'),
        el('button', { class: 'menu-btn', onclick: () => this.quitToMenu() }, 'Salvar e Sair para o Menu'),
      );
      const p = panelFrame('Pausa', null, () => ui.closePanel('pause'), stack);
      p.classList.add('modal-panel');
      return { el: p, side: 'center', modal: true };
    });
    const optionsFactory = () => {
      const s = this.file.settings;
      const body = el('div');
      const slider = (label: string, key: 'masterVolume' | 'musicVolume' | 'sfxVolume' | 'uiVolume' | 'screenShake') => {
        const i = el('input', { type: 'range', min: '0', max: '1', step: '0.05', value: String(s[key]) }) as HTMLInputElement;
        i.oninput = () => {
          s[key] = Number(i.value);
          this.applySettings();
        };
        return el('div', { class: 'opt-row' }, el('label', label), i);
      };
      const toggle = (label: string, key: 'hitStop' | 'damageNumbers' | 'bloom' | 'vignette' | 'showFps' | 'wasdMovement' | 'alwaysShowItemLabels' | 'autoPickupGold') => {
        const i = el('input', { type: 'checkbox', checked: s[key] }) as HTMLInputElement;
        i.onchange = () => {
          s[key] = i.checked;
          this.applySettings();
        };
        return el('div', { class: 'opt-row' }, el('label', label), i);
      };
      const q = el('select', { class: 'input', style: 'width:8rem;padding:.2rem' }, el('option', { value: 'high' }, 'Alta'), el('option', { value: 'low' }, 'Baixa')) as HTMLSelectElement;
      q.value = s.lightingQuality;
      q.onchange = () => {
        s.lightingQuality = q.value as 'high' | 'low';
        this.applySettings();
      };
      body.append(
        el('h3', { class: 'section-title' }, 'Áudio'),
        slider('Volume geral', 'masterVolume'),
        slider('Música', 'musicVolume'),
        slider('Efeitos', 'sfxVolume'),
        slider('Interface', 'uiVolume'),
        el('h3', { class: 'section-title' }, 'Vídeo e efeitos'),
        slider('Tremor de tela', 'screenShake'),
        toggle('Congelamento de impacto (hit-stop)', 'hitStop'),
        toggle('Números de dano', 'damageNumbers'),
        toggle('Vinheta', 'vignette'),
        el('div', { class: 'opt-row' }, el('label', 'Qualidade da iluminação'), q),
        toggle('Mostrar FPS', 'showFps'),
        el('h3', { class: 'section-title' }, 'Jogabilidade'),
        toggle('Movimento com WASD (desativa a tecla S de habilidades)', 'wasdMovement'),
        toggle('Sempre mostrar nomes de itens', 'alwaysShowItemLabels'),
        toggle('Coletar ouro automaticamente', 'autoPickupGold'),
        el('h3', { class: 'section-title' }, 'Controles'),
        el('p', { style: 'font-size:.8rem;color:var(--c-text-muted);line-height:1.6' }, 'Clique esquerdo: mover/atacar · Clique direito e 1–4: habilidades · Q: poção · T: portal · Shift: atacar parado · Alt: mostrar itens · I: inventário · C: personagem · K: habilidades · J: missões · Tab/M: mapa · Esc: menu'),
      );
      return body;
    };
    registerPanel('options', (ui) => {
      const wrap = el('div');
      const p = panelFrame('Opções', null, () => ui.closePanel('options'), wrap);
      p.classList.add('modal-panel');
      return {
        el: p,
        side: 'center',
        modal: true,
        onOpen: () => wrap.replaceChildren(optionsFactory()),
        onClose: () => void this.save.saveSettings(this.file.settings),
      };
    });
    registerPanel('death', (ui) => {
      const box = el(
        'div',
        { class: 'death-screen' },
        el('h2', 'Você Morreu'),
        el('p', { class: 'npc-greeting' }, 'A escuridão o reclama... por enquanto.'),
        el('div', { class: 'menu-stack', style: 'margin-top:1rem' }, el('button', { class: 'menu-btn', onclick: () => { ui.closePanel('death'); this.game?.respawn(true); } }, 'Renascer na cidade'), el('button', { class: 'menu-btn', onclick: () => { ui.closePanel('death'); this.game?.respawn(false); } }, 'Renascer no ponto de controle')),
      );
      const p = panelFrame('', null, () => {}, box);
      p.classList.add('modal-panel');
      p.querySelector('.close-btn')?.remove();
      return { el: p, side: 'center', modal: true };
    });
  }
}
