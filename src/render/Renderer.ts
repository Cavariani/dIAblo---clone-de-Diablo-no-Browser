// Pixi renderer: camera, tile layers, actor views, projectiles, ground effects, items, interactables,
// lighting, particles, overlays. Reads simulation state every frame (pull model).
import { Application, Container, Graphics, Sprite, Texture } from 'pixi.js';
import { worldToScreen, type Vec2 } from '../core/math';
import { Data } from '../data';
import type { GameCtx, WorldAPI } from '../game/api';
import type { Actor, ActorVisual, GroundEffect, GroundItem, Interactable, Projectile, Settings } from '../game/types';
import { assets, flareDir } from './assets/AssetManager';
import { Camera } from './Camera';
import { FxService } from './fx/FxService';
import { Lighting } from './lighting/Lighting';
import { FogRenderer } from './fog/FogRenderer';
import { tex } from './textures';
import type { AvatarPreviewHandle, HoverInfo, RendererAPI, RenderStats } from './types';
import { ActorView, frameAt } from './views/ActorView';
import { TileLayer } from './views/TileLayer';
import { ItemView } from './views/ItemView';
import { InteractableView } from './views/InteractableView';

interface ProjView {
  s: Sprite;
  shadow: Sprite;
  t: number;
}

export class Renderer implements RendererAPI {
  app = new Application();
  readonly camera = new Camera();
  readonly fx: FxService;
  readonly stats: RenderStats = { fps: 0, frameMs: 0, sprites: 0, particles: 0, actorsVisible: 0 };
  canvas!: HTMLCanvasElement;

  private worldLow = new Container(); // under lighting
  private worldHigh = new Container(); // above lighting (emissive)
  private overlay = new Container(); // text above everything (same transform)
  private objects = new Container({ sortableChildren: true });
  private groundFx = new Graphics();
  private tiles = new TileLayer();
  private lighting = new Lighting();
  private fog = new FogRenderer();
  private vignette!: Sprite;
  private actorViews = new Map<Actor, ActorView>();
  private projViews = new Map<Projectile, ProjView>();
  private itemViews = new Map<GroundItem, ItemView>();
  private interViews = new Map<Interactable, InteractableView>();
  private world: WorldAPI | null = null;
  private showLabels = false;
  private hoverActor: number | null = null;
  private fpsAcc = 0;
  private fpsFrames = 0;
  private loadingSheets = new Set<string>();
  private settings: Settings | null = null;
  private time = 0;
  private ambientTimer = 0;

  constructor() {
    this.fx = new FxService(this.camera);
  }

  async init(container: HTMLElement): Promise<void> {
    await this.app.init({
      resizeTo: window,
      background: 0x000000,
      antialias: false,
      preference: 'webgl',
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      powerPreference: 'high-performance',
    });
    this.canvas = this.app.canvas;
    container.appendChild(this.canvas);
    this.app.ticker.stop(); // the game drives rendering
    const st = this.app.stage;
    st.eventMode = 'none';
    this.worldLow.addChild(this.tiles.floor, this.fx.decalLayer, this.objects, this.fx.particles.normalLayer);
    this.worldHigh.addChild(this.fog.sprite, this.groundFx, this.fx.spriteLayer, this.fx.particles.addLayer, this.fx.beamLayer);
    this.overlay.addChild(this.fx.textLayer);
    this.vignette = new Sprite(tex().vignette);
    this.fx.flashSprite.blendMode = 'add';
    st.addChild(this.worldLow, this.lighting.sprite, this.worldHigh, this.overlay, this.vignette, this.fx.flashSprite);
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.lighting.resize(w, h);
    if (this.vignette) {
      this.vignette.width = w;
      this.vignette.height = h;
    }
    this.fx.flashSprite.width = w;
    this.fx.flashSprite.height = h;
  }

  applySettings(s: Settings): void {
    this.settings = s;
    this.camera.shakeScale = s.screenShake;
    this.vignette.visible = s.vignette;
    this.lighting.setQuality(s.lightingQuality === 'high');
    this.resize();
  }

  setShowAllLabels(show: boolean): void {
    this.showLabels = show;
  }

  async setWorld(world: WorldAPI, sheetIds: string[], onProgress?: (p: number) => void): Promise<void> {
    this.clearWorld();
    this.world = world;
    const biome = world.info.biome;
    const ts = await assets.loadTileset(world.map.tileset);
    const need = new Set(sheetIds);
    for (const a of world.actors) this.viewFor(a).neededSheets(need);
    for (const fx of ['fx/arrows', 'fx/fireball', 'fx/icicle', 'fx/spit', 'npc/return_obelisk1', 'npc/return_obelisk2']) need.add(fx);
    await assets.loadSheets([...need].filter((id) => assets.hasSheet(id)), onProgress);
    // cave back-faces are ~300px black silhouettes that would hide the play area: draw them translucent
    const caveFront = world.map.tileset === 'cave' ? new Set([66, 70, 106, 67, 71, 107, 74, 78, 82, 86, 73, 77, 75, 79]) : undefined;
    this.tiles.build(world.map, ts, this.objects, biome.tint, caveFront);
    const decor = world.level.decor ?? [];
    for (const id of new Set(decor.map((d) => d.tileset))) await assets.loadTileset(id);
    this.tiles.addDecor(decor.map((d) => ({ ts: assets.getTileset(d.tileset), tile: d.tile, x: d.x, y: d.y })), this.objects);
    if (world.interactables.some((i) => i.kind === 'stash')) await assets.loadTileset('dungeon');
    this.fog.setMap(world.map);
    this.lighting.ambient = biome.ambient.color;
    this.lighting.darkness = biome.ambient.darkness;
    this.fx.getActor = (id) => world.getActor(id);
  }

  clearWorld(): void {
    for (const v of this.actorViews.values()) v.destroy();
    this.actorViews.clear();
    for (const v of this.projViews.values()) {
      v.s.destroy();
      v.shadow.destroy();
    }
    this.projViews.clear();
    for (const v of this.itemViews.values()) v.destroy();
    this.itemViews.clear();
    for (const v of this.interViews.values()) v.destroy();
    this.interViews.clear();
    this.tiles.clear(this.objects);
    this.fog.clear();
    this.fx.clear();
    this.groundFx.clear();
    this.world = null;
  }

  private viewFor(a: Actor): ActorView {
    let v = this.actorViews.get(a);
    if (!v) {
      v = new ActorView(a);
      this.actorViews.set(a, v);
      this.objects.addChild(v.root);
      const need = new Set<string>();
      v.neededSheets(need);
      const missing = [...need].filter((id) => !assets.getSheet(id) && assets.hasSheet(id) && !this.loadingSheets.has(id));
      if (missing.length) {
        for (const m of missing) this.loadingSheets.add(m);
        void assets.loadSheets(missing).finally(() => missing.forEach((m) => this.loadingSheets.delete(m)));
      }
    }
    return v;
  }

  // ---------------------------------------------------------------------------- coordinates

  private get zoom(): number {
    return this.camera.zoom;
  }

  worldToScreen(wx: number, wy: number): Vec2 {
    const s = worldToScreen(wx, wy);
    return {
      x: (s.x - this.camera.x) * this.zoom + window.innerWidth / 2 + this.camera.offX,
      y: (s.y - this.camera.y) * this.zoom + window.innerHeight / 2 + this.camera.offY,
    };
  }

  screenToWorld(sx: number, sy: number): Vec2 {
    const px = (sx - window.innerWidth / 2 - this.camera.offX) / this.zoom + this.camera.x;
    const py = (sy - window.innerHeight / 2 - this.camera.offY) / this.zoom + this.camera.y;
    return { x: px / 192 + py / 96, y: py / 96 - px / 192 };
  }

  snapCamera(pos: Vec2): void {
    this.camera.snap(pos);
  }

  pick(sx: number, sy: number): HoverInfo {
    const out: HoverInfo = { actorId: null, groundItemId: null, interactableId: null };
    if (!this.world) return out;
    const px = (sx - window.innerWidth / 2 - this.camera.offX) / this.zoom + this.camera.x;
    const py = (sy - window.innerHeight / 2 - this.camera.offY) / this.zoom + this.camera.y;
    // item labels first (they sit on top)
    for (const [g, v] of this.itemViews) if (g.alive && v.hit(px, py)) {
      out.groundItemId = g.id;
      return out;
    }
    let best: Actor | null = null;
    let bestScore = Infinity;
    for (const [a, v] of this.actorViews) {
      if (!a.alive || a.kind === 'player' || a.kind === 'minion') continue;
      const rx = v.root.x + v.bx;
      const ry = v.root.y + v.by;
      // generous but trimmed box (sprites have transparent margins)
      const padX = v.bw * 0.2;
      const padY = v.bh * 0.1;
      if (px < rx + padX || px > rx + v.bw - padX || py < ry + padY || py > v.root.y + 10) continue;
      const score = Math.abs(px - v.root.x) + Math.abs(py - (v.root.y - v.height / 2)) * 0.5 - (a.kind === 'monster' ? 1000 : 0);
      if (score < bestScore) {
        bestScore = score;
        best = a;
      }
    }
    if (best) {
      out.actorId = best.id;
      return out;
    }
    for (const [o, v] of this.interViews) if (o.alive && v.hit(px, py)) {
      out.interactableId = o.id;
      return out;
    }
    return out;
  }

  // ---------------------------------------------------------------------------- frame

  render(ctx: GameCtx, frameDt: number, _alpha: number): void {
    const t0 = performance.now();
    this.time += frameDt;
    const w = this.world;
    const W = window.innerWidth;
    const H = window.innerHeight;
    if (!w) {
      this.app.renderer.render(this.app.stage);
      return;
    }
    // camera
    if (ctx.input.wheel) this.camera.zoomBy(-ctx.input.wheel);
    const p = ctx.player;
    const mouse = ctx.input.mouse;
    const look = { x: ((mouse.x - W / 2) / W) * 60, y: ((mouse.y - H / 2) / H) * 40 };
    this.camera.update(p.pos, look, frameDt);
    const z = this.zoom;
    for (const c of [this.worldLow, this.worldHigh, this.overlay]) {
      c.scale.set(z);
      c.position.set(Math.round(W / 2 - this.camera.x * z + this.camera.offX), Math.round(H / 2 - this.camera.y * z + this.camera.offY));
    }
    const vx0 = this.camera.x - W / 2 / z;
    const vx1 = this.camera.x + W / 2 / z;
    const vy0 = this.camera.y - H / 2 / z;
    const vy1 = this.camera.y + H / 2 / z;
    this.tiles.cull(vx0, vy0, vx1, vy1);
    this.tiles.fadeAround(p.pos.x, p.pos.y, frameDt);
    const dt = frameDt * ((ctx as unknown as { loop?: { timeScale: number } }).loop?.timeScale ?? 1);

    // actors
    this.hoverActor = ctx.input.hover.actorId;
    const alive = new Set<Actor>();
    let visible = 0;
    for (const a of w.actors) {
      alive.add(a);
      const v = this.viewFor(a);
      const s = worldToScreen(a.pos.x, a.pos.y);
      const on = s.x > vx0 - 300 && s.x < vx1 + 300 && s.y > vy0 - 200 && s.y < vy1 + 400;
      if (v.root.visible !== on) v.root.visible = on;
      if (!on) continue;
      visible++;
      v.update(dt, a.id === this.hoverActor);
    }
    for (const [a, v] of this.actorViews) if (!alive.has(a)) {
      v.destroy();
      this.actorViews.delete(a);
    }

    // projectiles
    const liveP = new Set<Projectile>();
    for (const pr of w.projectiles) {
      if (!pr.alive) continue;
      liveP.add(pr);
      let v = this.projViews.get(pr);
      if (!v) {
        const s = new Sprite();
        const additive = !pr.visual.includes('arrow') && !pr.visual.includes('axe') && !pr.visual.includes('knife') && !pr.visual.includes('spear') && !pr.visual.includes('stone');
        s.blendMode = additive ? 'add' : 'normal';
        if (pr.tint !== undefined) s.tint = pr.tint;
        (additive ? this.worldHigh : this.objects).addChild(s);
        const shadow = new Sprite({ texture: tex().shadow, anchor: 0.5 });
        shadow.scale.set(0.35, 0.18);
        shadow.alpha = 0.6;
        this.worldLow.addChildAt(shadow, 2);
        v = { s, shadow, t: 0 };
        this.projViews.set(pr, v);
        if (!assets.getSheet(pr.visual) && assets.hasSheet(pr.visual)) void assets.loadSheets([pr.visual]);
      }
      v.t += frameDt;
      const sheet = assets.getSheet(pr.visual);
      const sc = worldToScreen(pr.pos.x, pr.pos.y);
      v.shadow.position.set(sc.x, sc.y);
      v.s.zIndex = pr.pos.x + pr.pos.y;
      if (sheet) {
        const name = Object.keys(sheet.def.animations)[0];
        const anim = sheet.anim(name)!;
        const dx = pr.vel.x;
        const dy = pr.vel.y;
        const dir = flareDir(Math.atan2(dx + dy, dx - dy));
        const ft = sheet.frame(name, frameAt(anim, v.t, true), dir);
        if (ft) {
          v.s.texture = ft.texture;
          const k = pr.scale * (ft.w / Math.max(1, ft.texture.frame.width));
          v.s.scale.set(k);
          // flare projectiles are anchored at the ground; lift to z
          v.s.position.set(sc.x - ft.ox * pr.scale, sc.y - ft.oy * pr.scale - (pr.z - 0.6) * 48);
          if (anim.dirs === 1) {
            v.s.anchor.set(ft.ox / ft.w, ft.oy / ft.h);
            v.s.position.set(sc.x, sc.y - (pr.z - 0.6) * 48);
            const sa = worldToScreen(dx, dy);
            v.s.rotation = Math.atan2(sa.y, sa.x);
          }
        }
      }
      if (pr.light) this.fx.light(pr.pos, pr.light, 0.02);
    }
    for (const [pr, v] of this.projViews) if (!liveP.has(pr)) {
      v.s.destroy();
      v.shadow.destroy();
      this.projViews.delete(pr);
    }

    // ground items
    const liveI = new Set<GroundItem>();
    for (const g of w.groundItems) {
      if (!g.alive) continue;
      liveI.add(g);
      let v = this.itemViews.get(g);
      if (!v) {
        v = new ItemView(g, this.objects, this.worldHigh, this.overlay);
        this.itemViews.set(g, v);
      }
      v.update(ctx.time, frameDt, this.showLabels || ctx.input.hover.groundItemId === g.id, ctx.input.hover.groundItemId === g.id, this.fx);
    }
    for (const [g, v] of this.itemViews) if (!liveI.has(g)) {
      v.destroy();
      this.itemViews.delete(g);
    }

    // interactables
    const liveO = new Set<Interactable>();
    for (const o of w.interactables) {
      if (!o.alive) continue;
      liveO.add(o);
      let v = this.interViews.get(o);
      if (!v) {
        v = new InteractableView(o, w.map.tileset, this.objects, this.worldHigh, this.overlay);
        this.interViews.set(o, v);
      }
      v.update(this.time, frameDt, ctx.input.hover.interactableId === o.id, this.fx);
    }
    for (const [o, v] of this.interViews) if (!liveO.has(o)) {
      v.destroy();
      this.interViews.delete(o);
    }

    this.drawGroundEffects(w.groundEffects);

    // ambient particles
    const biome = w.info.biome;
    this.ambientTimer -= frameDt;
    if (biome.ambientParticles && this.ambientTimer <= 0) {
      this.ambientTimer = 0.08;
      const wx = p.pos.x + (Math.random() - 0.5) * 16;
      const wy = p.pos.y + (Math.random() - 0.5) * 16;
      this.fx.burst(biome.ambientParticles, { x: wx, y: wy }, { z: Math.random() * 2 });
    }

    this.fx.update(frameDt, z);
    this.fog.update();
    this.renderLights(ctx, w);
    this.app.renderer.render(this.app.stage);

    // stats
    this.fpsAcc += frameDt;
    this.fpsFrames++;
    if (this.fpsAcc >= 0.5) {
      this.stats.fps = Math.round(this.fpsFrames / this.fpsAcc);
      this.fpsAcc = 0;
      this.fpsFrames = 0;
    }
    this.stats.frameMs = performance.now() - t0;
    this.stats.particles = this.fx.particles.count;
    this.stats.actorsVisible = visible;
  }

  private renderLights(ctx: GameCtx, w: WorldAPI): void {
    const L = this.lighting;
    const z = this.zoom;
    const W = window.innerWidth;
    const H = window.innerHeight;
    L.begin();
    const add = (x: number, y: number, def: { radius: number; color: number; intensity: number; flicker?: number }, mult = 1, zOff = 0) => {
      const s = this.worldToScreen(x, y);
      const r = def.radius * 136 * z;
      if (s.x < -r || s.x > W + r || s.y < -r || s.y > H + r) return;
      const fl = def.flicker ? 1 - def.flicker * 0.5 + Math.sin(this.time * 13 + x * 7) * def.flicker * 0.25 + Math.sin(this.time * 23 + y) * def.flicker * 0.25 : 1;
      L.add(s.x, s.y - zOff * z, r, def, mult * fl);
    };
    const pl = ctx.player;
    add(pl.pos.x, pl.pos.y, w.info.biome.playerLight, 1, 30);
    for (const l of w.staticLights) add(l.pos.x, l.pos.y, l.light, 1, 40);
    for (const a of w.actors) if (a.visual.light && a.alive) add(a.pos.x, a.pos.y, a.visual.light);
    for (const l of this.fx.lights) add(l.x, l.y, l.def, 1 - l.life / Math.max(0.01, l.max));
    for (const v of this.interViews.values()) if (v.light) add(v.obj.pos.x, v.obj.pos.y, v.light);
    for (const v of this.itemViews.values()) if (v.light) add(v.item.pos.x, v.item.pos.y, v.light, v.lightMult);
    L.render(this.app.renderer);
  }

  private drawGroundEffects(list: GroundEffect[]): void {
    const g = this.groundFx;
    g.clear();
    for (const e of list) {
      if (!e.alive) continue;
      const telegraph = e.age < e.delay;
      if (!telegraph && !e.visual.showArea) continue;
      const prog = telegraph ? Math.min(1, e.age / Math.max(0.01, e.delay)) : 1;
      const color = e.visual.color;
      const pulse = 0.5 + Math.sin(this.time * 18) * 0.15;
      const pts = shapePoints(e, 1);
      const inner = shapePoints(e, prog);
      if (!pts.length) continue;
      g.poly(pts).fill({ color, alpha: telegraph ? 0.12 : 0.18 }).stroke({ color, alpha: telegraph ? pulse : 0.5, width: 3 });
      if (telegraph) g.poly(inner).fill({ color, alpha: 0.28 });
    }
  }

  createAvatarPreview(container: HTMLElement, visual: ActorVisual, opts: { scale?: number; anim?: string; rotate?: boolean } = {}): AvatarPreviewHandle {
    const app = new Application();
    let destroyed = false;
    const fake = { id: -1, pos: { x: 0, y: 0 }, facing: Math.PI / 4, radius: 0.22, alive: true, kind: 'player', visual, anim: { name: opts.anim ?? 'stance', time: 0, speed: 1, loop: true, serial: 0 }, flash: 0, dash: null, tags: new Set(), life: 1, maxLife: 1, corpseTimer: 1 } as unknown as Actor;
    let view: ActorView | null = null;
    let raf = 0;
    let onceLeft = 0;
    const start = async () => {
      await app.init({ backgroundAlpha: 0, width: container.clientWidth || 260, height: container.clientHeight || 320, antialias: false, preference: 'webgl', resolution: Math.min(window.devicePixelRatio || 1, 2), autoDensity: true });
      if (destroyed) {
        app.destroy(true);
        return;
      }
      app.ticker.stop();
      container.appendChild(app.canvas);
      view = new ActorView(fake);
      const need = new Set<string>();
      view.neededSheets(need);
      await assets.loadSheets([...need].filter((i) => assets.hasSheet(i)));
      const sc = opts.scale ?? 1.6;
      view.root.scale.set(sc);
      view.root.position.set(0, 0);
      const holder = new Container();
      holder.addChild(view.root);
      app.stage.addChild(holder);
      let last = performance.now();
      const loop = () => {
        if (destroyed) return;
        const now = performance.now();
        const dt = (now - last) / 1000;
        last = now;
        if (opts.rotate) fake.facing += dt * 0.6;
        if (onceLeft > 0 && (onceLeft -= dt) <= 0) fake.anim = { name: opts.anim ?? 'stance', time: 0, speed: 1, loop: true, serial: fake.anim.serial + 1 };
        view!.update(dt, false);
        holder.position.set(app.screen.width / 2, app.screen.height * 0.82);
        view!.root.position.set(0, 0);
        app.renderer.render(app.stage);
        raf = requestAnimationFrame(loop);
      };
      loop();
    };
    void start();
    return {
      update: (v: ActorVisual) => {
        fake.visual = v;
        if (view) {
          const need = new Set<string>();
          view.neededSheets(need);
          void assets.loadSheets([...need].filter((i) => assets.hasSheet(i)));
        }
      },
      setAnim: (name: string) => {
        fake.anim = { name, time: 0, speed: 1, loop: true, serial: fake.anim.serial + 1 };
      },
      playOnce: (name: string, seconds: number) => {
        fake.anim = { name, time: 0, speed: 1, loop: false, serial: fake.anim.serial + 1 };
        onceLeft = seconds;
      },
      rotateBy: (d: number) => {
        fake.facing += d;
      },
      destroy: () => {
        destroyed = true;
        cancelAnimationFrame(raf);
        try {
          app.destroy(true, { children: true });
        } catch {
          /* not initialised yet */
        }
      },
    };
  }
}

/** Polygon points (screen px) of a ground effect scaled by progress (0..1). */
function shapePoints(e: GroundEffect, k: number): number[] {
  const out: number[] = [];
  const push = (wx: number, wy: number) => {
    const s = worldToScreen(wx, wy);
    out.push(s.x, s.y);
  };
  switch (e.shape) {
    case 'circle':
    case 'ring': {
      const r = e.radius * k;
      for (let i = 0; i < 32; i++) {
        const a = (i / 32) * Math.PI * 2;
        push(e.pos.x + Math.cos(a) * r, e.pos.y + Math.sin(a) * r);
      }
      break;
    }
    case 'cone': {
      const r = e.radius * k;
      push(e.pos.x, e.pos.y);
      for (let i = 0; i <= 16; i++) {
        const a = e.angle - e.arc / 2 + (e.arc * i) / 16;
        push(e.pos.x + Math.cos(a) * r, e.pos.y + Math.sin(a) * r);
      }
      break;
    }
    case 'line': {
      const len = e.length * k;
      const c = Math.cos(e.angle);
      const s = Math.sin(e.angle);
      const hw = e.width / 2;
      push(e.pos.x - s * hw, e.pos.y + c * hw);
      push(e.pos.x + c * len - s * hw, e.pos.y + s * len + c * hw);
      push(e.pos.x + c * len + s * hw, e.pos.y + s * len - c * hw);
      push(e.pos.x + s * hw, e.pos.y - c * hw);
      break;
    }
  }
  return out;
}

void Data;
void Texture;
