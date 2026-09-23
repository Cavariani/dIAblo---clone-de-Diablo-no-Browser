// Shared helpers for level generators (pure, deterministic).
import { CellKind, type TileMap } from '../types';
import type { BiomeId } from '../../data/schema';
import type { Rng } from '../../core/rng';

export function createMap(width: number, height: number, tileset: string, biome: BiomeId): TileMap {
  const n = width * height;
  return {
    width,
    height,
    cells: new Uint8Array(n), // Void
    floor: new Int32Array(n).fill(-1),
    object: new Int32Array(n).fill(-1),
    overlay: new Int32Array(n).fill(-1),
    doorOpen: new Uint8Array(n),
    explored: new Uint8Array(n),
    visible: new Uint8Array(n),
    region: new Int16Array(n).fill(-1),
    tileset,
    biome,
  };
}

export const idx = (m: TileMap, x: number, y: number): number => y * m.width + x;
export const inside = (m: TileMap, x: number, y: number): boolean => x >= 0 && y >= 0 && x < m.width && y < m.height;
export const isFloorLike = (m: TileMap, x: number, y: number): boolean => {
  if (!inside(m, x, y)) return false;
  const c = m.cells[idx(m, x, y)];
  return c === CellKind.Floor || c === CellKind.Door || c === CellKind.Obstacle;
};

export function carveRect(m: TileMap, x0: number, y0: number, w: number, h: number, region: number): void {
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++) {
      if (!inside(m, x, y)) continue;
      const i = idx(m, x, y);
      m.cells[i] = CellKind.Floor;
      if (m.region[i] < 0 || region >= 0) m.region[i] = region;
    }
}

/** L-shaped corridor of given width between two points. */
export function carveCorridor(m: TileMap, ax: number, ay: number, bx: number, by: number, width: number, rng: Rng): void {
  const horizFirst = rng.chance(0.5);
  const carveLine = (x0: number, y0: number, x1: number, y1: number) => {
    const sx = Math.sign(x1 - x0);
    const sy = Math.sign(y1 - y0);
    let x = x0;
    let y = y0;
    for (;;) {
      for (let k = 0; k < width; k++) {
        const cx = sx !== 0 ? x : x + k;
        const cy = sx !== 0 ? y + k : y;
        if (inside(m, cx, cy) && m.cells[idx(m, cx, cy)] !== CellKind.Floor) {
          m.cells[idx(m, cx, cy)] = CellKind.Floor;
        }
      }
      if (x === x1 && y === y1) break;
      x += sx;
      y += sy;
    }
  };
  if (horizFirst) {
    carveLine(ax, ay, bx, ay);
    carveLine(bx, ay, bx, by);
    // make the elbow square
    for (let a = 0; a < width; a++) for (let b = 0; b < width; b++) if (inside(m, bx + a, ay + b)) m.cells[idx(m, bx + a, ay + b)] = CellKind.Floor;
  } else {
    carveLine(ax, ay, ax, by);
    carveLine(ax, by, bx, by);
    for (let a = 0; a < width; a++) for (let b = 0; b < width; b++) if (inside(m, ax + a, by + b)) m.cells[idx(m, ax + a, by + b)] = CellKind.Floor;
  }
}

/** Marks every non-floor cell touching a floor cell (8-neighbourhood) as Wall. */
export function buildWalls(m: TileMap): void {
  for (let y = 0; y < m.height; y++)
    for (let x = 0; x < m.width; x++) {
      const i = idx(m, x, y);
      if (m.cells[i] !== CellKind.Void) continue;
      let touch = false;
      for (let dy = -1; dy <= 1 && !touch; dy++) for (let dx = -1; dx <= 1; dx++) if (isFloorLike(m, x + dx, y + dy)) touch = true;
      if (touch) m.cells[i] = CellKind.Wall;
    }
}

/** BFS distance (in cells) over walkable cells from (sx, sy). Unreachable = -1. */
export function distanceMap(m: TileMap, sx: number, sy: number): Int32Array {
  const d = new Int32Array(m.width * m.height).fill(-1);
  const q = new Int32Array(m.width * m.height);
  let h = 0;
  let t = 0;
  const s = idx(m, sx, sy);
  d[s] = 0;
  q[t++] = s;
  while (h < t) {
    const c = q[h++];
    const cx = c % m.width;
    const cy = (c / m.width) | 0;
    const nb = [
      [cx + 1, cy],
      [cx - 1, cy],
      [cx, cy + 1],
      [cx, cy - 1],
    ];
    for (const [nx, ny] of nb) {
      if (!inside(m, nx, ny)) continue;
      const ni = idx(m, nx, ny);
      const k = m.cells[ni];
      if (d[ni] >= 0 || (k !== CellKind.Floor && k !== CellKind.Door)) continue;
      d[ni] = d[c] + 1;
      q[t++] = ni;
    }
  }
  return d;
}

export function weightedIndex(rng: Rng, choices: readonly (readonly [number, number])[]): number {
  return rng.weighted(choices, (c) => c[1])![0];
}
