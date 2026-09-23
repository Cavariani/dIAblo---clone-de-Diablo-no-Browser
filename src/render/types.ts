// Renderer contract (implemented by src/render/Renderer.ts). Owner: architecture.
import type { Vec2 } from '../core/math';
import type { FxAPI, GameCtx, WorldAPI } from '../game/api';
import type { ActorVisual, Settings } from '../game/types';

export interface HoverInfo {
  actorId: number | null;
  groundItemId: number | null;
  interactableId: number | null;
}

export interface RenderStats {
  fps: number;
  frameMs: number;
  sprites: number;
  particles: number;
  actorsVisible: number;
}

export interface RendererAPI {
  /** Effects service used by the simulation. */
  readonly fx: FxAPI;
  readonly stats: RenderStats;
  /** The canvas element (inserted into the container passed to init). */
  readonly canvas: HTMLCanvasElement;

  init(container: HTMLElement): Promise<void>;
  /**
   * Prepare a new world: load its tileset + monster sheets (via AssetManager), build tile layers,
   * static lights and fog textures. Resolves when ready to render.
   */
  setWorld(world: WorldAPI, sheetIds: string[], onProgress?: (p: number) => void): Promise<void>;
  /** Drop all views of the current world. */
  clearWorld(): void;
  /** Draw a frame. `alpha` = interpolation factor between sim steps (0..1). */
  render(ctx: GameCtx, frameDt: number, alpha: number): void;

  /** Screen CSS pixels -> world tiles (uses current camera). */
  screenToWorld(sx: number, sy: number): Vec2;
  /** World tiles -> screen CSS pixels. */
  worldToScreen(wx: number, wy: number): Vec2;
  /** What is under the given screen point (sprite-bounds hit test, monsters prioritized). */
  pick(sx: number, sy: number): HoverInfo;

  /** Snap camera to a world point (on zone load). */
  snapCamera(pos: Vec2): void;
  applySettings(settings: Settings): void;
  /** Show/hide ground item labels (Alt held or setting). */
  setShowAllLabels(show: boolean): void;
  resize(): void;

  /** Creates an animated avatar preview inside a DOM element (character creation/select screens). */
  createAvatarPreview(container: HTMLElement, visual: ActorVisual, opts?: { scale?: number; anim?: string; rotate?: boolean }): AvatarPreviewHandle;
}

export interface AvatarPreviewHandle {
  update(visual: ActorVisual): void;
  setAnim(anim: string): void;
  /** Plays a one-shot animation, then returns to the idle one. */
  playOnce(anim: string, seconds: number): void;
  /** Rotates the preview (radians); drag-to-rotate. */
  rotateBy(delta: number): void;
  destroy(): void;
}
