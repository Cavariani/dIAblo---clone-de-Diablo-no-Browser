// FxAPI implementation: particles, damage numbers, decals, beams, sprite fx, transient lights, flashes.
import { BitmapText, Container, Graphics, Sprite, Texture } from 'pixi.js';
import { worldToScreen, type Vec2 } from '../../core/math';
import { fxRng } from '../../core/rng';
import type { DamageType, LightDef } from '../../data/schema';
import type { FloatTextStyle, FxAPI, FxBurstOpts, SpriteFxOpts } from '../../game/api';
import type { Actor } from '../../game/types';
import { assets, flareDir } from '../assets/AssetManager';
import { tex } from '../textures';
import type { Camera } from '../Camera';
import { frameAt } from '../views/ActorView';
import { Particles } from './Particles';

interface FloatText {
  t: BitmapText;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  pop: number;
}

export interface TransientLight {
  x: number;
  y: number;
  def: LightDef;
  life: number;
  max: number;
  followId?: number;
}

interface SpriteFx {
  id: number;
  s: Sprite;
  sheet: string;
  anim: string;
  t: number;
  dur: number;
  pos: Vec2;
  dir: number;
  scale: number;
  loop: boolean;
  followId?: number;
  z: number;
}

const DMG_COLORS: Record<DamageType, number> = {
  physical: 0xf2eee6,
  fire: 0xff9a40,
  cold: 0x8ad0ff,
  lightning: 0xc8c0ff,
  poison: 0x9ae050,
  arcane: 0xe090ff,
};

const STYLE_COLORS: Record<FloatTextStyle, number> = {
  damage: 0xf2eee6,
  crit: 0xffd040,
  playerDamage: 0xff4040,
  heal: 0x60ff80,
  resource: 0x60a0ff,
  gold: 0xffd84a,
  xp: 0xc0a0ff,
  info: 0xffffff,
  immune: 0xb0b0b0,
  block: 0xc0c0c0,
  dodge: 0xc0c0c0,
};

export class FxService implements FxAPI {
  readonly particles = new Particles();
  readonly textLayer = new Container();
  readonly decalLayer = new Container();
  readonly beamLayer = new Container();
  readonly spriteLayer = new Container();
  readonly flashSprite = new Sprite(Texture.WHITE);
  readonly lights: TransientLight[] = [];
  private texts: FloatText[] = [];
  private textPool: BitmapText[] = [];
  private decals: { s: Sprite; life: number }[] = [];
  private beams: { g: Graphics; life: number; max: number }[] = [];
  private rings: { s: Sprite; life: number; max: number; r: number }[] = [];
  private sprites: SpriteFx[] = [];
  private flashLife = 0;
  private flashMax = 1;
  private flashAlpha = 0;
  private fxId = 1;
  getActor: (id: number) => Actor | undefined = () => undefined;
  damageNumbersEnabled = true;

  constructor(private camera: Camera) {
    this.beamLayer.blendMode = 'add';
    this.spriteLayer.blendMode = 'add';
    this.flashSprite.alpha = 0;
  }

  private sp(p: Vec2, z = 0): { x: number; y: number } {
    const s = worldToScreen(p.x, p.y);
    return { x: s.x, y: s.y - z * 48 };
  }

  damageNumber(pos: Vec2, amount: number, crit: boolean, type: DamageType, toPlayer: boolean): void {
    const txt = formatNum(amount) + (crit ? '!' : '');
    this.spawnText(pos, txt, toPlayer ? 0xff3a3a : crit ? 0xffd040 : DMG_COLORS[type], crit ? 1.55 : 1, toPlayer);
  }

  floatText(pos: Vec2, text: string, style: FloatTextStyle, color?: number): void {
    this.spawnText(pos, text, color ?? STYLE_COLORS[style], style === 'crit' ? 1.4 : 0.9, false);
  }

  private spawnText(pos: Vec2, text: string, color: number, size: number, drift: boolean): void {
    if (this.texts.length > 90) {
      const old = this.texts.shift()!;
      old.t.visible = false;
      this.textPool.push(old.t);
    }
    const t =
      this.textPool.pop() ??
      new BitmapText({
        text,
        style: { fontFamily: 'Cinzel, Georgia, serif', fontSize: 30, fontWeight: 'bold', fill: 0xffffff, stroke: { color: 0x000000, width: 5 } },
      });
    if (!t.parent) this.textLayer.addChild(t);
    t.text = text;
    t.tint = color;
    t.visible = true;
    t.anchor.set(0.5);
    const s = this.sp(pos, 1.3);
    const ft: FloatText = {
      t,
      x: s.x + fxRng.range(-18, 18),
      y: s.y,
      vx: drift ? 0 : fxRng.range(-40, 40),
      vy: -150 - fxRng.range(0, 40),
      life: 0,
      max: size > 1.2 ? 1.1 : 0.85,
      pop: size,
    };
    this.texts.push(ft);
  }

  shake(intensity: number, duration?: number): void {
    this.camera.shake(intensity, duration);
  }

  burst(preset: string, pos: Vec2, o: FxBurstOpts = {}): void {
    const s = worldToScreen(pos.x, pos.y);
    let dirX: number | undefined;
    let dirY: number | undefined;
    if (o.dir) {
      const d = worldToScreen(o.dir.x, o.dir.y);
      dirX = d.x;
      dirY = d.y * 2;
    }
    this.particles.emit(preset, s.x, s.y, { count: o.count, color: o.color, dirX, dirY, z: o.z, scale: o.scale, speed: o.speed });
  }

  spriteFx(fxId: string, pos: Vec2, o: SpriteFxOpts = {}): number {
    const sheet = assets.getSheet(fxId);
    if (!sheet) {
      void assets.loadSheets([fxId]);
      return 0;
    }
    const anim = Object.keys(sheet.def.animations)[0];
    const a = sheet.anim(anim)!;
    const s = new Sprite();
    s.blendMode = o.additive === false ? 'normal' : 'add';
    s.alpha = o.alpha ?? 1;
    if (o.tint !== undefined) s.tint = o.tint;
    this.spriteLayer.addChild(s);
    const angle = o.angle ?? 0;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const id = this.fxId++;
    this.sprites.push({ id, s, sheet: fxId, anim, t: 0, dur: o.duration ?? a.duration / 1000, pos: { ...pos }, dir: flareDir(Math.atan2(dx + dy, dx - dy)), scale: o.scale ?? 1, loop: !!o.loop, followId: o.followId, z: o.z ?? 0 });
    return id;
  }

  stopFx(handle: number): void {
    const i = this.sprites.findIndex((s) => s.id === handle);
    if (i >= 0) {
      this.sprites[i].s.destroy();
      this.sprites.splice(i, 1);
    }
  }

  light(pos: Vec2, def: LightDef, duration: number, followId?: number): void {
    if (this.lights.length > 60) this.lights.shift();
    this.lights.push({ x: pos.x, y: pos.y, def, life: 0, max: duration, followId });
  }

  decal(kind: 'blood' | 'scorch' | 'crack' | 'frost' | 'poison' | 'bone', pos: Vec2, o: { color?: number; scale?: number } = {}): void {
    const t = tex();
    const s = new Sprite({ texture: kind === 'scorch' || kind === 'frost' || kind === 'poison' ? t.scorch : t.splat, anchor: 0.5 });
    const p = worldToScreen(pos.x, pos.y);
    s.position.set(p.x + fxRng.range(-8, 8), p.y + fxRng.range(-4, 4));
    const sc = (o.scale ?? 1) * fxRng.range(0.5, 0.8);
    s.scale.set(sc, sc * 0.5);
    s.rotation = 0;
    s.tint =
      kind === 'blood'
        ? (o.color ?? 0x5a0606)
        : kind === 'scorch'
          ? 0x140a06
          : kind === 'frost'
            ? 0x9ad8ff
            : kind === 'poison'
              ? 0x4a8a10
              : kind === 'bone'
                ? 0xb8b0a0
                : 0x2a2420;
    s.alpha = kind === 'bone' ? 0.35 : 0.7;
    this.decalLayer.addChild(s);
    this.decals.push({ s, life: 25 });
    if (this.decals.length > 140) this.decals.shift()!.s.destroy();
  }

  beam(from: Vec2, to: Vec2, o: { color: number; width?: number; duration?: number; jagged?: boolean }): void {
    const g = new Graphics();
    const a = this.sp(from, 0.8);
    const b = this.sp(to, 0.8);
    const w = o.width ?? 8;
    const pts: [number, number][] = [[a.x, a.y]];
    if (o.jagged) {
      const n = Math.max(3, Math.floor(Math.hypot(b.x - a.x, b.y - a.y) / 30));
      for (let i = 1; i < n; i++) {
        const t = i / n;
        pts.push([a.x + (b.x - a.x) * t + fxRng.range(-18, 18), a.y + (b.y - a.y) * t + fxRng.range(-18, 18)]);
      }
    }
    pts.push([b.x, b.y]);
    const stroke = (width: number, color: number, alpha: number) => {
      g.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
      g.stroke({ width, color, alpha, cap: 'round', join: 'round' });
    };
    stroke(w * 2.5, o.color, 0.25);
    stroke(w, o.color, 0.8);
    stroke(w * 0.35, 0xffffff, 1);
    this.beamLayer.addChild(g);
    const dur = o.duration ?? 0.2;
    this.beams.push({ g, life: 0, max: dur });
  }

  screenFlash(color: number, alpha: number, duration: number): void {
    this.flashSprite.tint = color;
    this.flashAlpha = alpha;
    this.flashLife = 0;
    this.flashMax = duration;
  }

  shockwave(pos: Vec2, o: { radius?: number; duration?: number } = {}): void {
    const s = new Sprite({ texture: tex().ring, anchor: 0.5 });
    const p = worldToScreen(pos.x, pos.y);
    s.position.set(p.x, p.y);
    s.blendMode = 'add';
    s.scale.set(0.01);
    this.beamLayer.addChild(s);
    this.rings.push({ s, life: 0, max: o.duration ?? 0.45, r: o.radius ?? 3 });
  }

  update(dt: number, zoom: number): void {
    this.particles.update(dt);
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const f = this.texts[i];
      f.life += dt;
      const t = f.life / f.max;
      if (t >= 1) {
        f.t.visible = false;
        this.textPool.push(f.t);
        this.texts.splice(i, 1);
        continue;
      }
      f.vy += 260 * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.t.position.set(f.x, f.y);
      const pop = t < 0.12 ? 1 + (1 - t / 0.12) * 0.8 : 1;
      f.t.scale.set((f.pop * pop * 0.7) / Math.max(0.7, zoom));
      f.t.alpha = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
    }
    for (let i = this.decals.length - 1; i >= 0; i--) {
      const d = this.decals[i];
      d.life -= dt;
      if (d.life < 3) d.s.alpha = Math.max(0, d.s.alpha - dt * 0.25);
      if (d.life <= 0) {
        d.s.destroy();
        this.decals.splice(i, 1);
      }
    }
    for (let i = this.beams.length - 1; i >= 0; i--) {
      const b = this.beams[i];
      b.life += dt;
      b.g.alpha = 1 - b.life / b.max;
      if (b.life >= b.max) {
        b.g.destroy();
        this.beams.splice(i, 1);
      }
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life += dt;
      const t = r.life / r.max;
      r.s.scale.set((t * r.r * 192) / 256, (t * r.r * 96) / 256);
      r.s.alpha = 1 - t;
      if (t >= 1) {
        r.s.destroy();
        this.rings.splice(i, 1);
      }
    }
    for (let i = this.sprites.length - 1; i >= 0; i--) {
      const f = this.sprites[i];
      f.t += dt;
      const follow = f.followId ? this.getActor(f.followId) : undefined;
      if (follow) f.pos = follow.pos;
      const sheet = assets.getSheet(f.sheet);
      const a = sheet?.anim(f.anim);
      if (!sheet || !a || (!f.loop && f.t >= f.dur)) {
        f.s.destroy();
        this.sprites.splice(i, 1);
        continue;
      }
      const fr = frameAt(a, f.t * ((a.duration / 1000) / f.dur), f.loop);
      const ft = sheet.frame(f.anim, fr, f.dir);
      if (!ft) continue;
      const p = this.sp(f.pos, f.z);
      f.s.texture = ft.texture;
      f.s.scale.set(f.scale * (ft.w / Math.max(1, ft.texture.frame.width)));
      f.s.position.set(p.x - ft.ox * f.scale, p.y - ft.oy * f.scale);
    }
    for (let i = this.lights.length - 1; i >= 0; i--) {
      const l = this.lights[i];
      l.life += dt;
      if (l.followId) {
        const a = this.getActor(l.followId);
        if (a) {
          l.x = a.pos.x;
          l.y = a.pos.y;
        }
      }
      if (l.life >= l.max) this.lights.splice(i, 1);
    }
    if (this.flashLife < this.flashMax) {
      this.flashLife += dt;
      this.flashSprite.alpha = this.flashAlpha * Math.max(0, 1 - this.flashLife / this.flashMax);
    } else this.flashSprite.alpha = 0;
  }

  clear(): void {
    this.particles.clear();
    for (const f of this.texts) {
      f.t.visible = false;
      this.textPool.push(f.t);
    }
    this.texts = [];
    for (const d of this.decals) d.s.destroy();
    this.decals = [];
    for (const b of this.beams) b.g.destroy();
    this.beams = [];
    for (const r of this.rings) r.s.destroy();
    this.rings = [];
    for (const s of this.sprites) s.s.destroy();
    this.sprites = [];
    this.lights.length = 0;
  }
}

function formatNum(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e4) return Math.round(n / 1e3) + 'k';
  return String(Math.round(n));
}
