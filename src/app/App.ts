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
import type { ActorVisual, CharacterState, SaveFile } from '../game/types';
import { assets } from '../render/assets/AssetManager';
import { Renderer } from '../render/Renderer';
import type { AvatarPreviewHandle } from '../render/types';
import type { AvatarLayer } from '../data/schema';
import { iconEl } from '../ui/icons';
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

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;
const portraitUrl = (classId: ClassId, body: string) => `${import.meta.env.BASE_URL}assets/ui/portraits/${classId}_${body === 'male' ? 'm' : 'f'}.webp`;
const ATTR_NAME: Record<string, string> = { str: 'Força', dex: 'Destreza', int: 'Inteligência' };
const CLASS_ROLE: Record<ClassId, { style: string; difficulty: number }> = {
  berserker: { style: 'Corpo a corpo', difficulty: 1 },
  arcanist: { style: 'Conjurador à distância', difficulty: 2 },
  stalker: { style: 'Atirador ágil', difficulty: 2 },
  bonemancer: { style: 'Invocador', difficulty: 3 },
};
/** Animation played when a class is picked on the creation screen. */
const CLASS_POSE: Record<ClassId, string> = { berserker: 'swing', arcanist: 'cast', stalker: 'shoot', bonemancer: 'cast' };
/** Iconic gear shown on the creation screen (the hero starts in rags). */
const SHOWCASE: Record<ClassId, Partial<Record<AvatarLayer, string>>> = {
  berserker: { chest: 'plate_cuirass', legs: 'plate_greaves', feet: 'plate_boots', hands: 'plate_gauntlets', mainhand: 'battle_axe', offhand: 'kite_shield' },
  arcanist: { chest: 'mage_vest', legs: 'mage_skirt', feet: 'mage_boots', hands: 'mage_sleeves', head: 'mage_hood', mainhand: 'greatstaff' },
  stalker: { chest: 'leather_chest', legs: 'leather_pants', feet: 'leather_boots', hands: 'leather_gloves', head: 'leather_hood', offhand: 'longbow' },
  bonemancer: { chest: 'mage_vest_alt2', legs: 'mage_skirt_alt2', feet: 'mage_boots_alt2', hands: 'mage_sleeves_alt2', head: 'mage_hood_alt2', mainhand: 'rod' },
};

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
    document.documentElement.style.setProperty('--ui-scale', String(s.uiScale ?? 1));
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
    const node = el('div', { class: 'screen' }, embers(25), el('div', { class: 'loading' }, el('div', { class: 'loading__box' }, el('div', { class: 'logo' }, 'Diabl', el('em', 'opus')), bar, label, tip)));
    this.setScreen(node);
    return {
      set: (p, l) => {
        bar.style.setProperty('--p', String(p));
        label.textContent = l;
      },
      done: () => this.setScreen(null),
    };
  }

  /** Shared atmospheric backdrop for all out-of-game screens. */
  private backdrop(extra = ''): HTMLElement {
    return el('div', { class: `screen menu-screen ${extra}` }, el('div', { class: 'menu-bg', style: `background-image:url(${import.meta.env.BASE_URL}assets/ui/menu_bg.webp)` }), el('div', { class: 'menu-fog' }, el('i'), el('i')), embers(45), el('div', { class: 'menu-vignette' }));
  }

  private mountPreview(stage: HTMLElement, visual: ActorVisual): void {
    this.preview = this.renderer.createAvatarPreview(stage, visual, { scale: 2, rotate: false });
    let dragX: number | null = null;
    stage.addEventListener('pointerdown', (e) => {
      dragX = e.clientX;
      stage.setPointerCapture(e.pointerId);
    });
    stage.addEventListener('pointermove', (e) => {
      if (dragX === null) return;
      this.preview?.rotateBy((e.clientX - dragX) * 0.012);
      dragX = e.clientX;
    });
    const end = () => (dragX = null);
    stage.addEventListener('pointerup', end);
    stage.addEventListener('pointercancel', end);
  }

  mainMenu(): void {
    audio.playMusic('music_title', 1);
    const last = this.file.characters.find((c) => c.id === this.file.lastCharacterId) ?? this.file.characters[0];
    const btn = (label: string, fn: () => void, opts: { disabled?: boolean; primary?: boolean } = {}) => {
      const b = el('button', { class: `menu-btn ${opts.primary ? 'menu-btn--primary' : ''}`, onclick: () => { audio.play('ui_click'); fn(); } }, el('span', { class: 'menu-btn__label' }, label)) as HTMLButtonElement;
      b.disabled = !!opts.disabled;
      b.addEventListener('pointerenter', () => !b.disabled && audio.play('ui_hover'));
      return b;
    };
    const heroCard = last
      ? el(
          'button',
          { class: 'hero-card', style: `--cc:${hex(Data.classDef(last.classId).color)}`, onclick: () => { audio.play('ui_click'); this.startGame(last); } },
          el('img', { class: 'hero-card__portrait', src: portraitUrl(last.classId, last.appearance.body), alt: '' }),
          el('div', { class: 'hero-card__text' }, el('div', { class: 'hero-card__kicker' }, 'Continuar jornada'), el('div', { class: 'hero-card__name' }, last.name), el('div', { class: 'hero-card__meta' }, `${Data.classDef(last.classId).name} · Nível ${last.level} · ${Data.difficulty(last.difficulty).name}`)),
          el('span', { class: 'hero-card__go' }, '▶'),
        )
      : null;
    const stack = el(
      'nav',
      { class: 'menu-stack' },
      btn(last ? 'Continuar' : 'Novo Herói', () => (last ? this.startGame(last) : this.createScreen()), { primary: true }),
      last ? btn('Novo Herói', () => this.createScreen()) : null,
      btn('Selecionar Herói', () => this.selectScreen(), { disabled: this.file.characters.length === 0 }),
      btn('Opções', () => this.ui.openPanel('options')),
      btn('Créditos', () => this.creditsScreen()),
    );
    const node = this.backdrop('menu-screen--main');
    node.append(
      el(
        'div',
        { class: 'main-menu' },
        el('header', { class: 'main-menu__brand' }, el('div', { class: 'logo' }, 'Diabl', el('em', 'opus')), el('div', { class: 'logo-rule' }), el('div', { class: 'logo-sub' }, 'As Trevas Despertam')),
        stack,
        heroCard,
      ),
      el('footer', { class: 'menu-footer' }, el('span', 'v1.0'), el('span', 'Arte: Projeto Flare (CC-BY-SA 3.0)'), el('span', 'Um tributo não oficial a Diablo')),
    );
    this.setScreen(node);
  }

  private createScreen(): void {
    let classId: ClassId = 'berserker';
    let app = defaultAppearance(classId);
    const tiles = el('div', { class: 'class-tiles' });
    const stage = el('div', { class: 'stage' });
    const heroName = el('div', { class: 'stage__class' });
    const heroTitle = el('div', { class: 'stage__title' });
    const info = el('aside', { class: 'cs-panel' });
    const err = el('div', { class: 'field-error' });
    const input = el('input', { class: 'cs-input', placeholder: 'Nome do herói', maxLength: 16, spellcheck: false }) as HTMLInputElement;
    const visual = () => {
      const v = playerVisual(newCharacter(classId, 'preview', app));
      v.layers = { ...v.layers, ...SHOWCASE[classId], head: SHOWCASE[classId].head ?? app.head };
      return v;
    };
    const selectClass = (id: ClassId) => {
      if (id === classId) return;
      classId = id;
      app = { ...defaultAppearance(id), skinTone: app.skinTone, armorTint: app.armorTint, body: app.body, head: Data.classDef(id).appearance.heads[app.body]?.[0] ?? defaultAppearance(id).head };
      audio.play('ui_click');
      refresh();
      this.preview?.playOnce(CLASS_POSE[id], 1.1);
    };
    const refresh = () => {
      const cls = Data.classDef(classId);
      document.querySelector('.cs')?.setAttribute('style', `--cc:${hex(cls.color)}`);
      tiles.replaceChildren(
        ...CLASS_IDS.map((id) => {
          const c = Data.classDef(id);
          return el(
            'button',
            { class: `class-tile ${id === classId ? 'sel' : ''}`, style: `--tc:${hex(c.color)}`, onclick: () => selectClass(id), onpointerenter: () => audio.play('ui_hover') },
            el('img', { class: 'class-tile__portrait', src: portraitUrl(id, app.body), alt: '' }),
            el('div', { class: 'class-tile__text' }, el('div', { class: 'class-tile__name' }, c.name), el('div', { class: 'class-tile__title' }, c.title), el('div', { class: 'class-tile__role' }, CLASS_ROLE[id].style)),
          );
        }),
      );
      heroName.textContent = cls.name;
      heroTitle.textContent = cls.title;
      const chips = <T>(label: string, options: T[], cur: T, text: (o: T) => string, set: (o: T) => void) =>
        el('div', { class: 'cs-field' }, el('h4', label), el('div', { class: 'chips' }, ...options.map((o) => el('button', { class: 'chip', 'aria-pressed': String(o === cur), onclick: () => { set(o); audio.play('ui_click'); refresh(); } } as never, text(o)))));
      const swatches = (label: string, colors: number[], cur: number, set: (c: number) => void) =>
        el('div', { class: 'cs-field' }, el('h4', label), el('div', { class: 'swatches' }, ...colors.map((c) => el('button', { class: 'swatch', style: `--sw:${hex(c)}`, 'aria-pressed': String(c === cur), onclick: () => { set(c); audio.play('ui_click'); refresh(); } } as never))));
      const bodyName: Record<string, string> = { male: 'Masculino', female: 'Feminino', female_dark: 'Feminino II' };
      const role = CLASS_ROLE[classId];
      const skills = cls.skills.map((s) => Data.trySkill(s)).filter((s): s is NonNullable<typeof s> => !!s);
      info.replaceChildren(
        el('section', { class: 'cs-section' }, el('h3', { class: 'cs-h' }, 'A Classe'), el('p', { class: 'cs-lore' }, cls.description)),
        el(
          'dl',
          { class: 'cs-facts' },
          el('div', el('dt', 'Recurso'), el('dd', el('i', { class: 'res-dot', style: `--rc:${hex(cls.resource.color)}` }), cls.resource.name)),
          el('div', el('dt', 'Atributo'), el('dd', ATTR_NAME[cls.mainStat])),
          el('div', el('dt', 'Estilo'), el('dd', role.style)),
          el('div', el('dt', 'Complexidade'), el('dd', el('span', { class: 'pips' }, ...[1, 2, 3].map((n) => el('i', { class: n <= role.difficulty ? 'on' : '' }))))),
        ),
        el('section', { class: 'cs-section' }, el('h3', { class: 'cs-h' }, 'Habilidades'), el('div', { class: 'cs-skills' }, ...skills.map((s) => el('div', { class: 'cs-skill', 'data-name': s.name } as never, iconEl(s.icon, 'cs-skill__ico'))))),
        el(
          'section',
          { class: 'cs-section' },
          el('h3', { class: 'cs-h' }, 'Aparência'),
          chips('Corpo', cls.appearance.bodies, app.body, (b) => bodyName[b] ?? b, (b) => (app = { ...app, body: b, head: cls.appearance.heads[b][0] })),
          chips('Cabelo', cls.appearance.heads[app.body], app.head, (h) => ({ head_short: 'Curto', head_bald: 'Raspado', head_long: 'Longo' })[h] ?? h, (h) => (app = { ...app, head: h })),
          app.body === 'male' ? swatches('Pele', SKIN_TONES, app.skinTone, (c) => (app = { ...app, skinTone: c })) : null,
          swatches('Tingimento da armadura', ARMOR_TINTS, app.armorTint, (c) => (app = { ...app, armorTint: c })),
        ),
      );
      if (!this.preview) this.mountPreview(stage, visual());
      else this.preview.update(visual());
    };
    input.addEventListener('input', () => (err.textContent = ''));
    input.addEventListener('keydown', (e) => e.key === 'Enter' && create());
    const create = () => {
      const name = input.value.trim();
      if (name.length < 2) {
        err.textContent = 'O nome precisa ter entre 2 e 16 letras.';
        input.focus();
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
    const node = this.backdrop('menu-screen--dim');
    node.append(
      el(
        'div',
        { class: 'cs' },
        el('header', { class: 'cs-top' }, el('button', { class: 'back-btn', onclick: () => { audio.play('ui_click'); this.mainMenu(); } }, '‹ Voltar'), el('h1', { class: 'cs-title' }, 'Criar Herói'), el('span')),
        el('div', { class: 'cs-left' }, el('h2', { class: 'cs-h' }, 'Escolha sua classe'), tiles),
        el(
          'main',
          { class: 'cs-center' },
          el('div', { class: 'stage-wrap' }, el('div', { class: 'stage__light' }), stage, el('div', { class: 'stage__pedestal' }), el('div', { class: 'stage__hint' }, 'Arraste para girar')),
          el('div', { class: 'stage__caption' }, heroName, heroTitle),
          el('div', { class: 'cs-create' }, el('div', { class: 'cs-namebox' }, input, err), el('button', { class: 'big-btn', onclick: () => create() }, 'Criar Herói')),
        ),
        info,
      ),
    );
    this.setScreen(node);
    refresh();
    setTimeout(() => input.focus(), 50);
  }

  private selectScreen(): void {
    let sel = this.file.characters.find((c) => c.id === this.file.lastCharacterId) ?? this.file.characters[0];
    const list = el('div', { class: 'class-tiles' });
    const stage = el('div', { class: 'stage' });
    const heroName = el('div', { class: 'stage__class' });
    const heroTitle = el('div', { class: 'stage__title' });
    const info = el('aside', { class: 'cs-panel' });
    const fileInput = el('input', { type: 'file', accept: '.json,application/json', style: 'display:none' }) as HTMLInputElement;
    const refresh = () => {
      if (!sel) return this.mainMenu();
      document.querySelector('.cs')?.setAttribute('style', `--cc:${hex(Data.classDef(sel.classId).color)}`);
      list.replaceChildren(
        ...this.file.characters.map((c) => {
          const cd = Data.classDef(c.classId);
          return el(
            'button',
            { class: `class-tile ${c === sel ? 'sel' : ''}`, style: `--tc:${hex(cd.color)}`, onclick: () => { sel = c; audio.play('ui_click'); refresh(); }, ondblclick: () => this.startGame(c) },
            el('img', { class: 'class-tile__portrait', src: portraitUrl(c.classId, c.appearance.body), alt: '' }),
            el('div', { class: 'class-tile__text' }, el('div', { class: 'class-tile__name' }, c.name), el('div', { class: 'class-tile__title' }, `${cd.name} · Nível ${c.level}${c.paragonLevel ? ` · P${c.paragonLevel}` : ''}`), el('div', { class: 'class-tile__role' }, `${Data.difficulty(c.difficulty).name} · ${fmtPlayTime(c.stats.playTime)}`)),
          );
        }),
      );
      const cd = Data.classDef(sel.classId);
      heroName.textContent = sel.name;
      heroTitle.textContent = `${cd.name} · Nível ${sel.level}`;
      const row = (k: string, v: string) => el('div', el('dt', k), el('dd', v));
      info.replaceChildren(
        el('section', { class: 'cs-section' }, el('h3', { class: 'cs-h' }, 'Crônica'), el('dl', { class: 'cs-facts' }, row('Local', Data.tryZone(sel.location.zoneId)?.name ?? '—'), row('Dificuldade', Data.difficulty(sel.difficulty).name), row('Tempo de jogo', fmtPlayTime(sel.stats.playTime)), row('Ouro', sel.gold.toLocaleString('pt-BR')))),
        el('section', { class: 'cs-section' }, el('h3', { class: 'cs-h' }, 'Feitos'), el('dl', { class: 'cs-facts' }, row('Monstros abatidos', sel.stats.kills.toLocaleString('pt-BR')), row('Elites abatidos', String(sel.stats.eliteKills)), row('Lendários encontrados', String(sel.stats.legendariesFound)), row('Fendas concluídas', String(sel.riftsCompleted)), row('Mortes', String(sel.stats.deaths)))),
        el(
          'section',
          { class: 'cs-section' },
          el('h3', { class: 'cs-h' }, 'Arquivo'),
          el(
            'div',
            { class: 'cs-file' },
            el('button', { class: 'btn btn--sm', onclick: () => this.exportSave() }, 'Exportar save'),
            el('button', { class: 'btn btn--sm', onclick: () => fileInput.click() }, 'Importar save'),
            el('button', { class: 'btn btn--danger btn--sm', onclick: () => { if (sel && confirm(`Apagar ${sel.name} para sempre?`)) { void this.save.deleteCharacter(sel.id); sel = this.file.characters[0]; refresh(); } } }, 'Apagar herói'),
          ),
          fileInput,
        ),
      );
      if (!this.preview) this.mountPreview(stage, playerVisual(sel));
      else this.preview.update(playerVisual(sel));
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
    const node = this.backdrop('menu-screen--dim');
    node.append(
      el(
        'div',
        { class: 'cs' },
        el('header', { class: 'cs-top' }, el('button', { class: 'back-btn', onclick: () => { audio.play('ui_click'); this.mainMenu(); } }, '‹ Voltar'), el('h1', { class: 'cs-title' }, 'Seus Heróis'), el('span')),
        el('div', { class: 'cs-left' }, el('h2', { class: 'cs-h' }, `${this.file.characters.length} herói(s)`), list, el('button', { class: 'btn btn--ghost cs-new', onclick: () => this.createScreen() }, '+ Novo herói')),
        el(
          'main',
          { class: 'cs-center' },
          el('div', { class: 'stage-wrap' }, el('div', { class: 'stage__light' }), stage, el('div', { class: 'stage__pedestal' }), el('div', { class: 'stage__hint' }, 'Arraste para girar')),
          el('div', { class: 'stage__caption' }, heroName, heroTitle),
          el('div', { class: 'cs-create' }, el('button', { class: 'big-btn', onclick: () => sel && this.startGame(sel) }, 'Jogar')),
        ),
        info,
      ),
    );
    this.setScreen(node);
    refresh();
  }

  private exportSave(): void {
    const blob = new Blob([this.save.exportJson()], { type: 'application/json' });
    const a = el('a', { href: URL.createObjectURL(blob), download: `diablopus-save-${new Date().toISOString().slice(0, 10)}.json` }) as HTMLAnchorElement;
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
      el('p', 'Diablopus — código, design e UI originais, inspirados na série Diablo. Projeto pessoal sem fins comerciais.'),
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
      const uiScaleRow = () => {
        const val = el('b', { class: 'opt-val' }, `${Math.round((s.uiScale ?? 1) * 100)}%`);
        const i = el('input', { type: 'range', min: '0.8', max: '1.5', step: '0.05', value: String(s.uiScale ?? 1) }) as HTMLInputElement;
        // apply on release so the slider does not move under the cursor while dragging
        i.oninput = () => (val.textContent = `${Math.round(Number(i.value) * 100)}%`);
        i.onchange = () => {
          s.uiScale = Number(i.value);
          this.applySettings();
        };
        return el('div', { class: 'opt-row' }, el('label', 'Tamanho da interface'), el('div', { class: 'opt-scale' }, i, val));
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
        el('h3', { class: 'section-title' }, 'Interface'),
        uiScaleRow(),
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
