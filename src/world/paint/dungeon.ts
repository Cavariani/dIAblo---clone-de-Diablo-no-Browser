// Paints logical cells with Flare 'dungeon' tileset indices.
// Rules from docs/research/flare-tilesets-dungeon.md §4: tall walls on the west/north side of rooms
// (camera-facing), short ledges on the east/south side so rooms stay visible.
import { CellKind, type StaticLight, type TileMap } from '../types';
import { idx, inside, isFloorLike, weightedIndex } from '../gen/common';
import type { Rng } from '../../core/rng';

const FLOOR_PLAIN: [number, number][] = [
  [16, 30],
  [17, 30],
  [18, 30],
  [19, 30],
  [36, 12],
  [37, 12],
  [38, 12],
  [39, 12],
  [40, 12],
  [41, 12],
  [42, 12],
  [43, 12],
  [44, 12],
  [45, 12],
  [46, 12],
  [47, 12],
];
const FLOOR_CHAPEL: [number, number][] = [
  [32, 1],
  [33, 1],
  [34, 1],
  [35, 1],
];

// West wall of a room (cell has floor at +x). Decor: 96 chains, 98 niche, 100 shelf, 102 torch, 104 crumble, 106 banner, 108 blood.
const WALL_W = { plain: [64, 68], decor: [96, 98, 100, 104, 106], torch: 102, blood: 108 };
// North wall of a room (floor at +y).
const WALL_N = { plain: [65, 69], decor: [97, 99, 101, 105, 107], torch: 103, blood: 109 };

export const DUNGEON_TILES = {
  stairsDown: 286,
  stairsUp: 284,
  brazier: 167,
  brazierUnlit: 151,
  chest: [144, 145],
  chestOpen: [160, 161],
  barrel: 146,
  barrelBroken: 162,
  crate: 147,
  crateBroken: 163,
  bones: [176, 177, 178, 179, 180, 181, 182, 183],
  statues: [128, 129, 130, 131],
  altar: [134, 135],
  pillar: [110, 111],
  teleporter: 264,
  teleporterActive: 265,
  redGrate: 52,
};

export interface PaintOptions {
  /** Share of wall cells using blood bricks (hell biome). */
  bloodWalls?: number;
  torchEvery?: number;
  lights: StaticLight[];
  torchLight?: { color: number; radius: number; intensity: number };
  /** Cells to leave without floor tiles (e.g. under 4x4 stair sprites). */
  skipFloor?: Set<number>;
}

export function paintDungeon(m: TileMap, rng: Rng, opt: PaintOptions): void {
  const torchLight = opt.torchLight ?? { color: 0xffa040, radius: 4.5, intensity: 1.1 };
  let sinceTorch = 0;
  const torchEvery = opt.torchEvery ?? 5;
  for (let y = 0; y < m.height; y++)
    for (let x = 0; x < m.width; x++) {
      const i = idx(m, x, y);
      const c = m.cells[i];
      if (c === CellKind.Void) continue;
      if (!opt.skipFloor?.has(i)) {
        const chapel = m.region[i] >= 0 && m.region[i] % 5 === 3;
        m.floor[i] = weightedIndex(rng, chapel ? FLOOR_CHAPEL : FLOOR_PLAIN);
      }
      if (c !== CellKind.Wall) continue;
      const E = isFloorLike(m, x + 1, y);
      const W = isFloorLike(m, x - 1, y);
      const S = isFloorLike(m, x, y + 1);
      const N = isFloorLike(m, x, y - 1);
      let t = -1;
      if (E && S) t = 73;
      else if (E && N) t = 72;
      else if (W && S) t = 74;
      else if (W && N) t = 91;
      else if (E && W) t = 110; // thin separator: pillar
      else if (N && S) t = 110;
      else if (E) {
        // west wall of a room: tall, camera-facing
        const r = rng.next();
        const blood = opt.bloodWalls ?? 0;
        if (sinceTorch >= torchEvery && rng.chance(0.5)) {
          t = WALL_W.torch;
          sinceTorch = 0;
          opt.lights.push({ pos: { x: x + 1.05, y: y + 0.5 }, light: { ...torchLight, flicker: 0.25 } });
        } else if (r < blood) t = WALL_W.blood;
        else if (r < blood + 0.18) t = rng.pick(WALL_W.decor);
        else t = rng.chance(0.72) ? WALL_W.plain[0] : WALL_W.plain[1];
        sinceTorch++;
      } else if (S) {
        const r = rng.next();
        const blood = opt.bloodWalls ?? 0;
        if (sinceTorch >= torchEvery && rng.chance(0.5)) {
          t = WALL_N.torch;
          sinceTorch = 0;
          opt.lights.push({ pos: { x: x + 0.5, y: y + 1.05 }, light: { ...torchLight, flicker: 0.25 } });
        } else if (r < blood) t = WALL_N.blood;
        else if (r < blood + 0.18) t = rng.pick(WALL_N.decor);
        else t = rng.chance(0.72) ? WALL_N.plain[0] : WALL_N.plain[1];
        sinceTorch++;
      } else if (W) {
        // east wall (short ledge); transition piece where the tall north wall meets it
        t = isTall(m, x, y - 1) ? 70 : 82;
      } else if (N) {
        t = isTall(m, x - 1, y) ? 71 : 83;
      } else {
        // only diagonal floor → inner corners
        if (isFloorLike(m, x + 1, y + 1)) t = 77;
        else if (isFloorLike(m, x + 1, y - 1)) t = 76;
        else if (isFloorLike(m, x - 1, y + 1)) t = 78;
        else if (isFloorLike(m, x - 1, y - 1)) t = 95;
      }
      m.object[i] = t;
    }
}

/** Is the wall cell a tall (camera-facing) piece? Used to choose tall→short transitions. */
function isTall(m: TileMap, x: number, y: number): boolean {
  if (!inside(m, x, y) || m.cells[idx(m, x, y)] !== CellKind.Wall) return false;
  if (isFloorLike(m, x + 1, y) || isFloorLike(m, x, y + 1)) return true;
  const ortho = isFloorLike(m, x - 1, y) || isFloorLike(m, x, y - 1);
  // tall inner corners (77, 76, 78) have only diagonal floor
  return !ortho && (isFloorLike(m, x + 1, y + 1) || isFloorLike(m, x + 1, y - 1) || isFloorLike(m, x - 1, y + 1));
}
