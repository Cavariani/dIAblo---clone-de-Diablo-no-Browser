// =============================================================================
// ASSET MANIFEST CONTRACT — produced by scripts/assets/build-assets.mjs into
// public/assets/manifest.json (+ per-sheet json files), consumed by AssetManager.
// Owner: architecture. The pipeline and the renderer must both follow this.
// =============================================================================

/**
 * A single frame: [page, x, y, w, h, ox, oy]
 *  - page: index into SheetDef.pages (texture file)
 *  - x, y, w, h: rect inside that page (pixels)
 *  - ox, oy: anchor offset — the pixel inside the frame that must be placed on the
 *    entity's ground point (feet). i.e. draw the frame at (screenX - ox, screenY - oy).
 */
export type FrameRect = [page: number, x: number, y: number, w: number, h: number, ox: number, oy: number];

export interface SheetAnimation {
  frames: number;
  /** Total duration in ms at speed 1. */
  duration: number;
  type: 'looped' | 'back_forth' | 'play_once';
  /** Frame index where the "hit" happens (Flare active_frame) — optional. */
  activeFrame?: number;
  /** 8 for directional sprites, 1 for omni-directional fx. */
  dirs: number;
  /** rects[frame * dirs + dir] */
  rects: FrameRect[];
}

export interface SheetDef {
  id: string; // e.g. 'enemy/skeleton', 'avatar/male/plate_cuirass', 'fx/fireball', 'npc/knight'
  /** Texture page URLs relative to public/assets/ (webp). */
  pages: string[];
  animations: Record<string, SheetAnimation>;
  /** If the pipeline downscaled the source, multiply rendering scale by 1/sourceScale to keep world size. */
  sourceScale: number;
  /** Approximate visual height in px of the idle frame (for health bars / name plates). */
  height: number;
}

export interface TileDef {
  /** [page, x, y, w, h, ox, oy]: ox/oy = pixel that sits on the tile's anchor point (see docs). */
  r: FrameRect;
}

export interface TilesetDef {
  id: string; // 'dungeon', 'cave', 'grassland', 'ruins', 'snowplains'
  pages: string[];
  tiles: Record<string, FrameRect>;
  /** Animated tiles: tile index -> { frames: tile indices, duration ms } */
  animated?: Record<string, { frames: number[]; duration: number }>;
}

export interface IconAtlasDef {
  pages: string[];
  size: number; // icon size in px
  columns: number;
  /** Flare icon index -> [page, x, y]. */
  icons: Record<string, [number, number, number]>;
  /** Semantic names -> Flare icon index (e.g. 'weapon.longsword': 12). */
  named: Record<string, number>;
}

export interface AudioAssetDef {
  file: string; // relative to public/assets/
  volume?: number;
}

export interface AssetManifest {
  version: number;
  /** Sheet id -> json URL (lazy loaded) relative to public/assets/. */
  sheets: Record<string, string>;
  tilesets: Record<string, string>;
  icons: IconAtlasDef;
  sfx: Record<string, AudioAssetDef>;
  music: Record<string, AudioAssetDef>;
  /** Ground loot sprites (sheet ids) by semantic name. */
  loot: Record<string, string>;
  /** Portraits / UI images. */
  images: Record<string, string>;
}
