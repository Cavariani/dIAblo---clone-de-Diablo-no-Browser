// Grid A* (8-connected, no corner cutting) with a binary heap, plus LOS string-pulling.
import type { Vec2 } from '../../core/math';

export interface NavGrid {
  width: number;
  height: number;
  walkable(x: number, y: number): boolean;
}

class Heap {
  private items: number[] = [];
  private keys: number[] = [];
  get size(): number {
    return this.items.length;
  }
  clear(): void {
    this.items.length = 0;
    this.keys.length = 0;
  }
  push(item: number, key: number): void {
    const it = this.items;
    const ks = this.keys;
    let i = it.length;
    it.push(item);
    ks.push(key);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (ks[p] <= key) break;
      it[i] = it[p];
      ks[i] = ks[p];
      i = p;
    }
    it[i] = item;
    ks[i] = key;
  }
  pop(): number {
    const it = this.items;
    const ks = this.keys;
    const top = it[0];
    const lastI = it.pop()!;
    const lastK = ks.pop()!;
    const n = it.length;
    if (n > 0) {
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && ks[c + 1] < ks[c]) c++;
        if (ks[c] >= lastK) break;
        it[i] = it[c];
        ks[i] = ks[c];
        i = c;
      }
      it[i] = lastI;
      ks[i] = lastK;
    }
    return top;
  }
}

const heap = new Heap();
let gScore = new Float32Array(0);
let came = new Int32Array(0);
let stamp = new Uint32Array(0);
let closedStamp = new Uint32Array(0);
let curStamp = 1;

const DIRS = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
] as const;

export function findPath(g: NavGrid, from: Vec2, to: Vec2, maxNodes = 4000): Vec2[] | null {
  const n = g.width * g.height;
  if (gScore.length < n) {
    gScore = new Float32Array(n);
    came = new Int32Array(n);
    stamp = new Uint32Array(n);
    closedStamp = new Uint32Array(n);
  }
  curStamp++;
  const sx = Math.floor(from.x);
  const sy = Math.floor(from.y);
  const tx = Math.floor(to.x);
  const ty = Math.floor(to.y);
  if (!g.walkable(tx, ty)) return null;
  const start = sy * g.width + sx;
  const goal = ty * g.width + tx;
  if (start === goal) return [{ x: to.x, y: to.y }];
  heap.clear();
  gScore[start] = 0;
  stamp[start] = curStamp;
  came[start] = -1;
  heap.push(start, 0);
  let expanded = 0;
  while (heap.size) {
    const cur = heap.pop();
    if (closedStamp[cur] === curStamp) continue;
    closedStamp[cur] = curStamp;
    if (cur === goal) break;
    if (++expanded > maxNodes) return null;
    const cx = cur % g.width;
    const cy = (cur / g.width) | 0;
    for (const [dx, dy, cost] of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!g.walkable(nx, ny)) continue;
      if (dx !== 0 && dy !== 0 && (!g.walkable(cx + dx, cy) || !g.walkable(cx, cy + dy))) continue;
      const ni = ny * g.width + nx;
      if (closedStamp[ni] === curStamp) continue;
      const ng = gScore[cur] + cost;
      if (stamp[ni] === curStamp && ng >= gScore[ni]) continue;
      stamp[ni] = curStamp;
      gScore[ni] = ng;
      came[ni] = cur;
      const hx = Math.abs(nx - tx);
      const hy = Math.abs(ny - ty);
      heap.push(ni, ng + Math.max(hx, hy) + (Math.SQRT2 - 1) * Math.min(hx, hy));
    }
  }
  if (closedStamp[goal] !== curStamp) return null;
  const cells: number[] = [];
  for (let c = goal; c !== -1; c = came[c]) cells.push(c);
  cells.reverse();
  const pts: Vec2[] = cells.map((c) => ({ x: (c % g.width) + 0.5, y: ((c / g.width) | 0) + 0.5 }));
  pts[pts.length - 1] = { x: to.x, y: to.y };
  pts.shift();
  return pts;
}

/** Removes intermediate points that are in direct walkable line of sight. */
export function smoothPath(path: Vec2[], from: Vec2, clear: (a: Vec2, b: Vec2) => boolean): Vec2[] {
  if (path.length <= 1) return path;
  const out: Vec2[] = [];
  let anchor = from;
  let i = 0;
  while (i < path.length) {
    let j = path.length - 1;
    while (j > i && !clear(anchor, path[j])) j--;
    out.push(path[j]);
    anchor = path[j];
    i = j + 1;
  }
  return out;
}
