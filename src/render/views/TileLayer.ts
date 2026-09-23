// Floor tiles (chunked, culled) and object-layer tiles (depth-sorted with actors, fade when occluding).
import { Container, Sprite } from 'pixi.js';
import { worldToScreen } from '../../core/math';
import type { TileMap } from '../../world/types';
import type { LoadedTileset } from '../assets/types';

const CHUNK = 8;

interface Chunk {
  c: Container;
  objs: Sprite[];
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  visible: boolean;
}

export class TileLayer {
  readonly floor = new Container();
  private chunks: Chunk[] = [];
  /** Object sprite per cell index (walls/props). */
  private objectAt = new Map<number, Sprite>();
  private faded = new Set<Sprite>();
  private map: TileMap | null = null;

  build(map: TileMap, ts: LoadedTileset, objects: Container, tint?: number): void {
    this.clear(objects);
    this.map = map;
    const cw = Math.ceil(map.width / CHUNK);
    const ch = Math.ceil(map.height / CHUNK);
    for (let cy = 0; cy < ch; cy++)
      for (let cx = 0; cx < cw; cx++) {
        const c = new Container();
        const chunk: Chunk = { c, objs: [], minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, visible: true };
        for (let y = cy * CHUNK; y < Math.min(map.height, (cy + 1) * CHUNK); y++)
          for (let x = cx * CHUNK; x < Math.min(map.width, (cx + 1) * CHUNK); x++) {
            const i = y * map.width + x;
            const center = worldToScreen(x + 0.5, y + 0.5);
            const fl = map.floor[i];
            if (fl >= 0) {
              const t = ts.tile(fl);
              if (t) {
                const s = new Sprite(t.texture);
                // anchor on the diamond centre and overlap 2% to hide sub-pixel seams when zoomed
                s.anchor.set(t.ox / t.w, t.oy / t.h);
                s.scale.set(1.025);
                s.position.set(center.x, center.y);
                if (tint !== undefined) s.tint = tint;
                c.addChild(s);
                extend(chunk, center.x - t.ox, center.y - t.oy, t.w, t.h);
              }
            }
            const ov = map.overlay[i];
            if (ov >= 0) {
              const t = ts.tile(ov);
              if (t) {
                const s = new Sprite(t.texture);
                s.position.set(center.x - t.ox, center.y - t.oy);
                c.addChild(s);
              }
            }
            const ob = map.object[i];
            if (ob >= 0) {
              const t = ts.tile(ob);
              if (t) {
                const s = new Sprite(t.texture);
                s.position.set(center.x - t.ox, center.y - t.oy);
                s.zIndex = x + y + 1 + x * 1e-4;
                if (tint !== undefined) s.tint = tint;
                objects.addChild(s);
                chunk.objs.push(s);
                this.objectAt.set(i, s);
                extend(chunk, s.x, s.y, t.w, t.h);
              }
            }
          }
        if (c.children.length || chunk.objs.length) {
          c.cullable = false;
          this.floor.addChild(c);
          this.chunks.push(chunk);
        }
      }
  }

  /** Culls chunks against the visible screen rect (world-screen px) with a margin. */
  cull(x0: number, y0: number, x1: number, y1: number): void {
    const m = 200;
    for (const ch of this.chunks) {
      const vis = ch.maxX > x0 - m && ch.minX < x1 + m && ch.maxY > y0 - m && ch.minY < y1 + m;
      if (vis !== ch.visible) {
        ch.visible = vis;
        ch.c.visible = vis;
        for (const o of ch.objs) o.visible = vis;
      }
    }
  }

  /** Fades object tiles that are in front of (and overlap) the given world point. */
  fadeAround(px: number, py: number, dt: number): void {
    const map = this.map;
    if (!map) return;
    const want = new Set<Sprite>();
    const cx = Math.floor(px);
    const cy = Math.floor(py);
    for (let dy = 0; dy <= 3; dy++)
      for (let dx = 0; dx <= 3; dx++) {
        if (dx + dy === 0) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (x >= map.width || y >= map.height) continue;
        const s = this.objectAt.get(y * map.width + x);
        if (!s) continue;
        // only tall sprites that could hide the hero
        if (s.height > 150 && Math.abs(x - y - (px - py)) < 2.2) want.add(s);
      }
    for (const s of this.faded) if (!want.has(s)) {
      s.alpha = Math.min(1, s.alpha + dt * 4);
      if (s.alpha >= 1) this.faded.delete(s);
    }
    for (const s of want) {
      s.alpha = Math.max(0.35, s.alpha - dt * 5);
      this.faded.add(s);
    }
  }

  /** Changes the object tile at a cell (doors, chests...). */
  setObject(x: number, y: number, sprite: Sprite | null): void {
    void x;
    void y;
    void sprite;
  }

  clear(objects: Container): void {
    for (const ch of this.chunks) {
      for (const o of ch.objs) {
        objects.removeChild(o);
        o.destroy();
      }
      ch.c.destroy({ children: true });
    }
    this.chunks = [];
    this.objectAt.clear();
    this.faded.clear();
    this.map = null;
  }
}

function extend(ch: Chunk, x: number, y: number, w: number, h: number): void {
  ch.minX = Math.min(ch.minX, x);
  ch.minY = Math.min(ch.minY, y);
  ch.maxX = Math.max(ch.maxX, x + w);
  ch.maxY = Math.max(ch.maxY, y + h);
}
