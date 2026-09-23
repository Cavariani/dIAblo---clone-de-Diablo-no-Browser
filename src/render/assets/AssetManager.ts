// Loads public/assets/manifest.json and lazily turns sheet/tileset pages into Pixi textures.
import { Assets, Rectangle, Texture, type TextureSource } from 'pixi.js';
import type { AssetManifest, FrameRect, SheetAnimation, SheetDef, TilesetDef } from './manifest';
import type { AssetManagerAPI, FrameTex, IconStyle, LoadedSheet, LoadedTileset } from './types';
import type { AvatarLayer, IconRef } from '../../data/schema';

const BASE = `${import.meta.env.BASE_URL}assets/`;

async function loadJson<T>(rel: string): Promise<T> {
  const res = await fetch(BASE + rel);
  if (!res.ok) throw new Error(`asset ${rel}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

async function loadPage(rel: string): Promise<TextureSource> {
  const tex = await Assets.load<Texture>({ src: BASE + rel, data: { autoGenerateMipmaps: false } });
  return tex.source;
}

function makeFrame(sources: TextureSource[], r: FrameRect, scale: number): FrameTex {
  const [p, x, y, w, h, ox, oy] = r;
  const source = sources[p] ?? sources[0];
  const texture = new Texture({ source, frame: new Rectangle(x, y, Math.max(1, w), Math.max(1, h)) });
  // Positions are in source-texture pixels; divide by scale to get world (screen) pixels.
  return { texture, ox: ox / scale, oy: oy / scale, w: w / scale, h: h / scale };
}

class Sheet implements LoadedSheet {
  private cache = new Map<SheetAnimation, (FrameTex | undefined)[]>();
  constructor(
    readonly def: SheetDef,
    private sources: TextureSource[],
  ) {}

  anim(name: string): SheetAnimation | undefined {
    return this.def.animations[name];
  }

  has(name: string): boolean {
    return name in this.def.animations;
  }

  frame(anim: string, frame: number, dir: number): FrameTex | undefined {
    const a = this.def.animations[anim] ?? this.def.animations.stance ?? Object.values(this.def.animations)[0];
    if (!a) return undefined;
    let list = this.cache.get(a);
    if (!list) {
      list = new Array(a.rects.length);
      this.cache.set(a, list);
    }
    const f = Math.max(0, Math.min(a.frames - 1, frame | 0));
    const d = a.dirs > 1 ? ((dir % a.dirs) + a.dirs) % a.dirs : 0;
    const i = f * a.dirs + d;
    let ft = list[i];
    if (!ft) {
      const r = a.rects[i];
      if (!r) return undefined;
      ft = makeFrame(this.sources, r, this.def.sourceScale || 1);
      list[i] = ft;
    }
    return ft;
  }

  destroy(): void {
    for (const list of this.cache.values()) for (const f of list) f?.texture.destroy(false);
    this.cache.clear();
    for (const s of this.sources) s.destroy();
  }
}

class Tileset implements LoadedTileset {
  private cache = new Map<number, FrameTex>();
  constructor(
    readonly def: TilesetDef,
    private sources: TextureSource[],
  ) {}

  tile(index: number): FrameTex | undefined {
    let t = this.cache.get(index);
    if (!t) {
      const r = this.def.tiles[index];
      if (!r) return undefined;
      t = makeFrame(this.sources, r, 1);
      this.cache.set(index, t);
    }
    return t;
  }
}

export class AssetManager implements AssetManagerAPI {
  manifest!: AssetManifest;
  private sheets = new Map<string, Sheet>();
  private tilesets = new Map<string, Tileset>();
  private inflight = new Map<string, Promise<unknown>>();

  async init(onProgress?: (p: number, label: string) => void): Promise<void> {
    onProgress?.(0, 'Manifesto');
    this.manifest = await loadJson<AssetManifest>('manifest.json');
    onProgress?.(1, 'Pronto');
  }

  hasSheet(id: string): boolean {
    return id in (this.manifest?.sheets ?? {});
  }

  private once<T>(key: string, fn: () => Promise<T>): Promise<T> {
    let p = this.inflight.get(key) as Promise<T> | undefined;
    if (!p) {
      p = fn().finally(() => this.inflight.delete(key));
      this.inflight.set(key, p);
    }
    return p;
  }

  async loadSheets(ids: string[], onProgress?: (p: number) => void): Promise<void> {
    const todo = [...new Set(ids)].filter((id) => !this.sheets.has(id) && this.hasSheet(id));
    let done = 0;
    await Promise.all(
      todo.map((id) =>
        this.once(`sheet:${id}`, async () => {
          const def = await loadJson<SheetDef>(this.manifest.sheets[id]);
          const sources = await Promise.all(def.pages.map(loadPage));
          this.sheets.set(id, new Sheet(def, sources));
        }).then(() => onProgress?.(++done / todo.length)),
      ),
    );
    onProgress?.(1);
  }

  async loadTileset(id: string): Promise<LoadedTileset> {
    const have = this.tilesets.get(id);
    if (have) return have;
    await this.once(`tileset:${id}`, async () => {
      const def = await loadJson<TilesetDef>(this.manifest.tilesets[id]);
      const sources = await Promise.all(def.pages.map(loadPage));
      this.tilesets.set(id, new Tileset(def, sources));
    });
    return this.tilesets.get(id)!;
  }

  getSheet(id: string): LoadedSheet | undefined {
    return this.sheets.get(id);
  }

  getTileset(id: string): LoadedTileset | undefined {
    return this.tilesets.get(id);
  }

  iconStyle(ref: IconRef, displaySize: number): IconStyle | null {
    const ic = this.manifest?.icons;
    if (!ic) return null;
    const index = typeof ref === 'number' ? ref : ic.named[ref];
    const pos = index === undefined ? undefined : ic.icons[index];
    if (!pos) return null;
    const [page, x, y] = pos;
    const k = displaySize / ic.size;
    return {
      backgroundImage: `url(${BASE}${ic.pages[page]})`,
      backgroundPosition: `-${x * k}px -${y * k}px`,
      backgroundSize: `${ic.columns * ic.size * k}px auto`,
    };
  }

  release(keep: Set<string>): void {
    for (const [id, s] of this.sheets) {
      if (!keep.has(id)) {
        s.destroy();
        this.sheets.delete(id);
      }
    }
  }

  sfxUrl(_id: string): string | null {
    return null;
  }

  musicUrl(_id: string): string | null {
    return null;
  }

  imageUrl(id: string): string | null {
    const rel = this.manifest?.images[id];
    return rel ? BASE + rel : null;
  }
}

export const assets = new AssetManager();

/** Flare direction index (0=left, clockwise on screen) from an on-screen angle (0 = right, +PI/2 = down). */
export function flareDir(screenAngle: number): number {
  return (Math.round(screenAngle / (Math.PI / 4)) + 4 + 8) % 8;
}

/** Per-direction avatar layer draw order (bottom -> top), from Flare engine/hero_layers.txt. */
export const AVATAR_LAYER_ORDER: readonly (readonly AvatarLayer[])[] = [
  ['mainhand', 'feet', 'legs', 'hands', 'chest', 'offhand', 'head'],
  ['mainhand', 'feet', 'legs', 'hands', 'chest', 'offhand', 'head'],
  ['mainhand', 'feet', 'legs', 'hands', 'chest', 'offhand', 'head'],
  ['feet', 'legs', 'hands', 'chest', 'offhand', 'head', 'mainhand'],
  ['feet', 'legs', 'hands', 'chest', 'offhand', 'head', 'mainhand'],
  ['feet', 'legs', 'hands', 'chest', 'offhand', 'head', 'mainhand'],
  ['feet', 'legs', 'hands', 'mainhand', 'chest', 'head', 'offhand'],
  ['mainhand', 'feet', 'legs', 'hands', 'chest', 'head', 'offhand'],
];
