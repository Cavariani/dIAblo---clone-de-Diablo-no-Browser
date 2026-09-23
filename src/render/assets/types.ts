// Runtime asset access contract (implemented by src/render/assets/AssetManager.ts).
import type { Texture } from 'pixi.js';
import type { AssetManifest, SheetAnimation, SheetDef, TilesetDef } from './manifest';
import type { IconRef } from '../../data/schema';

export interface FrameTex {
  texture: Texture;
  /** Anchor offset in px (pixel of the frame that sits on the ground point). */
  ox: number;
  oy: number;
  w: number;
  h: number;
}

export interface LoadedSheet {
  def: SheetDef;
  /** Returns the frame texture for (animation, frame index, direction 0..dirs-1). Falls back to 'stance' / frame 0. */
  frame(anim: string, frame: number, dir: number): FrameTex | undefined;
  anim(name: string): SheetAnimation | undefined;
  has(anim: string): boolean;
}

export interface LoadedTileset {
  def: TilesetDef;
  tile(index: number): FrameTex | undefined;
}

export interface IconStyle {
  /** CSS url(...) of the atlas page. */
  backgroundImage: string;
  /** CSS background-position for a box of `displaySize` px. */
  backgroundPosition: string;
  backgroundSize: string;
}

export interface AssetManagerAPI {
  readonly manifest: AssetManifest;
  /** Loads manifest + icon atlas + always-needed sheets (player avatar layers, common fx, loot). */
  init(onProgress?: (p: number, label: string) => void): Promise<void>;
  /** Lazy-load sheets (e.g. the monsters of a zone). Resolves when textures are ready. */
  loadSheets(ids: string[], onProgress?: (p: number) => void): Promise<void>;
  loadTileset(id: string): Promise<LoadedTileset>;
  getSheet(id: string): LoadedSheet | undefined;
  getTileset(id: string): LoadedTileset | undefined;
  hasSheet(id: string): boolean;
  /** CSS for showing an icon in the DOM UI at `displaySize` px. */
  iconStyle(ref: IconRef, displaySize: number): IconStyle | null;
  /** Unload sheets not in `keep` (GPU memory) — called on biome change. */
  release(keep: Set<string>): void;
  sfxUrl(id: string): string | null;
  musicUrl(id: string): string | null;
  imageUrl(id: string): string | null;
}
