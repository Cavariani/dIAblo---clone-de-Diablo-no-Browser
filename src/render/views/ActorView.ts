// Draws one actor: Flare sheet sprite or layered avatar, shadow, hit flash, elite glow, health bar.
import { ColorMatrixFilter, Container, Sprite, Texture } from 'pixi.js';
import { GlowFilter } from 'pixi-filters';
import { worldToScreen } from '../../core/math';
import type { AvatarLayer } from '../../data/schema';
import type { Actor } from '../../game/types';
import { assets, AVATAR_LAYER_ORDER, flareDir } from '../assets/AssetManager';
import type { LoadedSheet, SheetAnimationLike } from './animTypes';
import { tex } from '../textures';

const flashFilter = new ColorMatrixFilter();
flashFilter.brightness(2.6, false);
const glowCache = new Map<number, GlowFilter>();
function glow(color: number): GlowFilter {
  let g = glowCache.get(color);
  if (!g) {
    g = new GlowFilter({ distance: 10, outerStrength: 2.2, innerStrength: 0, color, quality: 0.2 });
    glowCache.set(color, g);
  }
  return g;
}
const hoverGlow = new GlowFilter({ distance: 8, outerStrength: 2.5, innerStrength: 0, color: 0xff3020, quality: 0.2 });
const npcGlow = new GlowFilter({ distance: 8, outerStrength: 2, innerStrength: 0, color: 0xfff0b0, quality: 0.2 });

/** Frame index for an animation at time t (seconds). */
export function frameAt(anim: SheetAnimationLike, t: number, loop: boolean): number {
  const n = anim.frames;
  if (n <= 1) return 0;
  const fd = anim.duration / 1000 / n;
  const i = Math.floor(t / Math.max(0.001, fd));
  if (anim.type === 'back_forth' && loop) {
    const cycle = 2 * n - 2;
    const k = i % cycle;
    return k < n ? k : cycle - k;
  }
  if (anim.type === 'play_once' || !loop) return Math.min(n - 1, i);
  return i % n;
}

const LAYER_TINTED: Partial<Record<AvatarLayer, boolean>> = { chest: true, legs: true, feet: true, hands: true, head: true };

/** Sim interpolation factor (0..1) for the current frame; set by the Renderer. */
let renderAlpha = 1;
export function setRenderAlpha(a: number): void {
  renderAlpha = a;
}
/** Interpolated render position of an actor between the last two sim ticks. */
export function renderPos(a: Actor): { x: number; y: number } {
  const p = a.prevPos;
  if (!p) return a.pos;
  return { x: p.x + (a.pos.x - p.x) * renderAlpha, y: p.y + (a.pos.y - p.y) * renderAlpha };
}
/** Extra angle (rad) past a sector border before switching sprite direction (avoids flicker). */
const DIR_HYSTERESIS = 0.14;

export class ActorView {
  private dir = -1;
  readonly root = new Container();
  private shadow: Sprite;
  private body = new Container();
  private sprites: Sprite[] = [];
  private layerSprites = new Map<AvatarLayer, Sprite>();
  private animTime = 0;
  private serial = -1;
  private sheetId = '';
  private layerKey = '';
  private barBg: Sprite;
  private barFg: Sprite;
  private lastFilterKey = '';
  /** Visual height (px) for bars / labels. */
  height = 110;
  /** Screen-space bounds of the current frame (relative to root). */
  bx = 0;
  by = 0;
  bw = 0;
  bh = 0;

  constructor(readonly actor: Actor) {
    this.shadow = new Sprite({ texture: tex().shadow, anchor: 0.5 });
    this.shadow.scale.set((actor.radius * 2.6 * 96) / 128, (actor.radius * 2.6 * 48) / 128);
    this.root.addChild(this.shadow, this.body);
    this.barBg = new Sprite({ texture: Texture.WHITE, tint: 0x100000, anchor: { x: 0.5, y: 0.5 } });
    this.barFg = new Sprite({ texture: Texture.WHITE, tint: 0xc01818, anchor: { x: 0, y: 0.5 } });
    this.barBg.visible = this.barFg.visible = false;
    this.root.addChild(this.barBg, this.barFg);
  }

  private sheetFor(layer: AvatarLayer, spriteId: string): LoadedSheet | undefined {
    const v = this.actor.visual;
    const body = v.body ?? 'male';
    const ids = [`avatar/${body}/${spriteId}`];
    if (body === 'female_dark') ids.push(`avatar/female/${spriteId}`);
    ids.push(`avatar/${body}/default_${layer}`);
    for (const id of ids) {
      const s = assets.getSheet(id);
      if (s) return s;
    }
    return undefined;
  }

  /** Sheet ids this view needs (loaded lazily by the renderer). */
  neededSheets(out: Set<string>): void {
    const v = this.actor.visual;
    if (v.kind === 'sheet' && v.sheet) out.add(v.sheet);
    else if (v.layers) {
      const body = v.body ?? 'male';
      for (const [layer, id] of Object.entries(v.layers)) {
        if (!id) continue;
        const primary = `avatar/${body}/${id}`;
        if (assets.hasSheet(primary)) out.add(primary);
        else if (assets.hasSheet(`avatar/female/${id}`)) out.add(`avatar/female/${id}`);
        out.add(`avatar/${body}/default_${layer}`);
      }
    }
  }

  private rebuildLayers(): void {
    const v = this.actor.visual;
    this.body.removeChildren();
    this.sprites = [];
    this.layerSprites.clear();
    if (v.kind === 'sheet') {
      const s = new Sprite();
      this.sprites.push(s);
      this.body.addChild(s);
    } else {
      for (const layer of ['feet', 'legs', 'hands', 'chest', 'head', 'mainhand', 'offhand'] as AvatarLayer[]) {
        if (!v.layers?.[layer]) continue;
        const s = new Sprite();
        this.layerSprites.set(layer, s);
        this.body.addChild(s);
      }
    }
  }

  update(dt: number, hovered: boolean): void {
    const a = this.actor;
    const v = a.visual;
    const key = v.kind === 'sheet' ? (v.sheet ?? '') : `${v.body}|${JSON.stringify(v.layers)}`;
    if (key !== this.layerKey) {
      this.layerKey = key;
      this.rebuildLayers();
    }
    if (a.anim.serial !== this.serial) {
      this.serial = a.anim.serial;
      this.animTime = 0;
    } else this.animTime += dt * a.anim.speed;

    const rp = renderPos(a);
    const p = worldToScreen(rp.x, rp.y);
    let lift = 0;
    if (a.dash && a.dash.arc > 0) lift = Math.sin(Math.min(1, a.dash.time / a.dash.duration) * Math.PI) * a.dash.arc * 48;
    this.root.position.set(p.x, p.y);
    this.body.y = -lift - (v.hover ?? 0);
    this.root.zIndex = a.pos.x + a.pos.y;
    const dx = Math.cos(a.facing);
    const dy = Math.sin(a.facing);
    const ang = Math.atan2(dx + dy, dx - dy);
    let dir = flareDir(ang);
    if (this.dir >= 0 && dir !== this.dir) {
      // keep the current direction until the angle is clearly inside the next sector
      let diff = ang - (this.dir - 4) * (Math.PI / 4);
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      if (Math.abs(diff) < Math.PI / 8 + DIR_HYSTERESIS) dir = this.dir;
    }
    this.dir = dir;
    const scale = v.scale;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const place = (s: Sprite, sheet: LoadedSheet | undefined, tint: number | undefined) => {
      if (!sheet) {
        s.visible = false;
        return;
      }
      let name = a.anim.name;
      if (!sheet.has(name)) name = name === 'critdie' ? 'die' : name === 'spawn' || name === 'dash_attack' || name === 'shield_bash' ? 'swing' : 'stance';
      const anim = sheet.anim(name)!;
      const f = frameAt(anim, this.animTime, a.anim.loop);
      const ft = sheet.frame(name, f, dir);
      if (!ft) {
        s.visible = false;
        return;
      }
      s.visible = true;
      s.texture = ft.texture;
      s.scale.set(scale * (ft.w / Math.max(1, ft.texture.frame.width)));
      s.position.set(-ft.ox * scale, -ft.oy * scale);
      s.tint = tint ?? 0xffffff;
      minX = Math.min(minX, s.x);
      minY = Math.min(minY, s.y);
      maxX = Math.max(maxX, s.x + ft.w * scale);
      maxY = Math.max(maxY, s.y + ft.h * scale);
    };

    if (v.kind === 'sheet') {
      place(this.sprites[0], v.sheet ? assets.getSheet(v.sheet) : undefined, v.tint);
    } else {
      const order = AVATAR_LAYER_ORDER[dir];
      let zi = 0;
      for (const layer of order) {
        const s = this.layerSprites.get(layer);
        if (!s) continue;
        const id = v.layers![layer]!;
        const naked = id.startsWith('default_') || id.startsWith('head_');
        const tint = naked ? v.skinTone : LAYER_TINTED[layer] ? v.armorTint : undefined;
        place(s, this.sheetFor(layer, id), tint);
        s.zIndex = zi++;
      }
      this.body.sortableChildren = true;
    }
    if (minX !== Infinity) {
      this.bx = minX;
      this.by = minY + this.body.y;
      this.bw = maxX - minX;
      this.bh = maxY - minY;
      this.height = -this.by;
    }

    // death fade
    const dead = !a.alive && a.kind !== 'player';
    this.root.alpha = v.alpha * (dead ? Math.min(1, a.corpseTimer / 1.5) : 1);
    this.shadow.visible = !dead && !v.hideShadow;

    // filters: flash > hover > elite outline
    const flashing = a.flash > 0 && a.alive;
    const fkey = flashing ? 'f' : hovered && a.alive ? `h${a.kind}` : v.outline !== undefined && a.alive ? `o${v.outline}` : '';
    if (fkey !== this.lastFilterKey) {
      this.lastFilterKey = fkey;
      this.body.filters = flashing ? [flashFilter] : hovered && a.alive ? [a.kind === 'npc' ? npcGlow : hoverGlow] : v.outline !== undefined && a.alive ? [glow(v.outline)] : [];
    }

    // health bar
    const showBar = a.kind === 'monster' && a.alive && !a.tags.has('boss') && (a.life < a.maxLife || hovered || a.tags.has('elite'));
    this.barBg.visible = this.barFg.visible = showBar;
    if (showBar) {
      const w = a.tags.has('elite') ? 64 : 44;
      const y = this.by - 10;
      this.barBg.position.set(0, y);
      this.barBg.width = w + 2;
      this.barBg.height = 6;
      this.barFg.position.set(-w / 2, y);
      this.barFg.width = w * Math.max(0, a.life / a.maxLife);
      this.barFg.height = 4;
      this.barFg.tint = a.tags.has('elite') ? (v.outline ?? 0xc01818) : 0xc01818;
    }
  }

  destroy(): void {
    this.root.destroy({ children: true });
  }
}
