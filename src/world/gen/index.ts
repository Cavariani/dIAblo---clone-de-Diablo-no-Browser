// STUB — replaced by the worldgen agent. Minimal single-room level so the engine can run.
import type { GeneratedLevel, GeneratorParams, TileMap } from '../types';

export function generateLevel(params: GeneratorParams): GeneratedLevel {
  const w = 24;
  const h = 24;
  const n = w * h;
  const map: TileMap = {
    width: w,
    height: h,
    cells: new Uint8Array(n),
    floor: new Int32Array(n).fill(-1),
    object: new Int32Array(n).fill(-1),
    overlay: new Int32Array(n).fill(-1),
    doorOpen: new Uint8Array(n),
    explored: new Uint8Array(n),
    visible: new Uint8Array(n),
    region: new Int16Array(n).fill(-1),
    tileset: 'dungeon',
    biome: params.biome,
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1;
      map.cells[y * w + x] = edge ? 2 : 1;
      map.region[y * w + x] = edge ? -1 : 0;
    }
  }
  return {
    map,
    rooms: [{ id: 0, x: 1, y: 1, w: w - 2, h: h - 2, center: { x: w / 2, y: h / 2 }, tags: ['start'] }],
    playerStart: { x: 4.5, y: 4.5 },
    interactables: [],
    packs: [{ pos: { x: 16, y: 16 }, size: 5, region: 0 }],
    lights: [],
    traps: [],
    seed: params.seed,
  };
}
