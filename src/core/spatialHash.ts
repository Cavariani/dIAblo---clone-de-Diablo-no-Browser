// Uniform-grid spatial hash for broad-phase queries (actors, loot, projectiles).
// Rebuilt (clear + insert) once per simulation tick by the World; queries are allocation-free
// when you pass your own output array.

export interface SpatialItem {
  id: number;
  pos: { x: number; y: number };
  radius: number;
}

export class SpatialHash<T extends SpatialItem> {
  private cells = new Map<number, T[]>();
  private readonly inv: number;
  private arrPool: T[][] = [];
  private seen = new Set<number>();

  constructor(public readonly cellSize = 2) {
    this.inv = 1 / cellSize;
  }

  private key(cx: number, cy: number): number {
    // Supports coordinates in [-32768, 32767]
    return ((cx + 32768) << 16) | ((cy + 32768) & 0xffff);
  }

  clear(): void {
    for (const arr of this.cells.values()) {
      arr.length = 0;
      this.arrPool.push(arr);
    }
    this.cells.clear();
  }

  insert(item: T): void {
    const r = item.radius;
    const x0 = Math.floor((item.pos.x - r) * this.inv);
    const x1 = Math.floor((item.pos.x + r) * this.inv);
    const y0 = Math.floor((item.pos.y - r) * this.inv);
    const y1 = Math.floor((item.pos.y + r) * this.inv);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const k = this.key(cx, cy);
        let arr = this.cells.get(k);
        if (!arr) {
          arr = this.arrPool.pop() ?? [];
          this.cells.set(k, arr);
        }
        arr.push(item);
      }
    }
  }

  /**
   * Items whose circle intersects the query circle. Results are de-duplicated.
   * Pass `out` to avoid allocation. Optional filter.
   */
  queryCircle(x: number, y: number, r: number, out: T[] = [], filter?: (t: T) => boolean): T[] {
    out.length = 0;
    const x0 = Math.floor((x - r) * this.inv);
    const x1 = Math.floor((x + r) * this.inv);
    const y0 = Math.floor((y - r) * this.inv);
    const y1 = Math.floor((y + r) * this.inv);
    const multiCell = x0 !== x1 || y0 !== y1;
    const seen = this.seen;
    if (multiCell) seen.clear();
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const arr = this.cells.get(this.key(cx, cy));
        if (!arr) continue;
        for (let i = 0; i < arr.length; i++) {
          const it = arr[i];
          const dx = it.pos.x - x;
          const dy = it.pos.y - y;
          const rr = r + it.radius;
          if (dx * dx + dy * dy > rr * rr) continue;
          if (multiCell) {
            if (seen.has(it.id)) continue;
            seen.add(it.id);
          }
          if (filter && !filter(it)) continue;
          out.push(it);
        }
      }
    }
    return out;
  }

  /** Nearest item within maxDist satisfying filter. */
  nearest(x: number, y: number, maxDist: number, filter?: (t: T) => boolean): T | undefined {
    const tmp = this.queryCircle(x, y, maxDist, [], filter);
    let best: T | undefined;
    let bestD = Infinity;
    for (const it of tmp) {
      const d = (it.pos.x - x) ** 2 + (it.pos.y - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = it;
      }
    }
    return best;
  }
}
