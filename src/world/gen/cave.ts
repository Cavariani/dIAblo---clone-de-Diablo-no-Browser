// Cave generator (cellular automata) + cave tileset autotiling (docs/research/flare-tilesets-outdoor.md §a).
import { Rng } from '../../core/rng';
import { CellKind, type GeneratedLevel, type GeneratorParams, type InteractableSpawn, type PackSpawn, type StaticLight, type TileMap } from '../types';
import { createMap, distanceMap, idx, inside } from './common';

const floorAt = (m: TileMap, x: number, y: number): boolean => inside(m, x, y) && m.cells[idx(m, x, y)] !== CellKind.Wall && m.cells[idx(m, x, y)] !== CellKind.Void;

export function generateCave(p: GeneratorParams): GeneratedLevel {
  const rng = new Rng(p.seed);
  const W = Math.max(34, p.width);
  const H = Math.max(34, p.height);
  const m = createMap(W, H, 'cave', p.biome);
  let solid = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) solid[y * W + x] = x < 2 || y < 2 || x >= W - 2 || y >= H - 2 || rng.chance(0.46) ? 1 : 0;
  for (let it = 0; it < 5; it++) {
    const next = new Uint8Array(W * H);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) {
          next[y * W + x] = 1;
          continue;
        }
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && solid[(y + dy) * W + x + dx]) n++;
        next[y * W + x] = n >= 5 || (it < 2 && n <= 1) ? 1 : 0;
      }
    solid = next;
  }
  // thicken: remove wall cells with floor on opposite sides (Flare has no piece for 1-thick walls)
  for (let pass = 0; pass < 3; pass++)
    for (let y = 2; y < H - 2; y++)
      for (let x = 2; x < W - 2; x++) {
        const i = y * W + x;
        if (!solid[i]) continue;
        if ((!solid[i - 1] && !solid[i + 1]) || (!solid[i - W] && !solid[i + W])) solid[i] = 0;
      }
  for (let i = 0; i < W * H; i++) m.cells[i] = solid[i] ? CellKind.Void : CellKind.Floor;
  // keep the largest region, tunnel the others into it
  const regionOf = new Int32Array(W * H).fill(-1);
  const regions: number[][] = [];
  for (let i = 0; i < W * H; i++) {
    if (m.cells[i] !== CellKind.Floor || regionOf[i] >= 0) continue;
    const list: number[] = [];
    const q = [i];
    regionOf[i] = regions.length;
    while (q.length) {
      const c = q.pop()!;
      list.push(c);
      for (const n of [c + 1, c - 1, c + W, c - W]) if (m.cells[n] === CellKind.Floor && regionOf[n] < 0) {
        regionOf[n] = regions.length;
        q.push(n);
      }
    }
    regions.push(list);
  }
  regions.sort((a, b) => b.length - a.length);
  for (let r = 1; r < regions.length; r++) {
    if (regions[r].length < 12) {
      for (const c of regions[r]) m.cells[c] = CellKind.Void;
      continue;
    }
    const a = regions[r][0];
    const b = regions[0][Math.floor(rng.next() * regions[0].length)];
    let x = a % W;
    let y = (a / W) | 0;
    const tx = b % W;
    const ty = (b / W) | 0;
    while (x !== tx || y !== ty) {
      if (rng.chance(0.5) ? x !== tx : y === ty) x += Math.sign(tx - x);
      else y += Math.sign(ty - y);
      for (let dy = 0; dy <= 1; dy++) for (let dx = 0; dx <= 1; dx++) if (x + dx > 1 && y + dy > 1 && x + dx < W - 2 && y + dy < H - 2) m.cells[(y + dy) * W + x + dx] = CellKind.Floor;
    }
  }
  // walls = void cells touching floor
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (m.cells[i] !== CellKind.Void) continue;
      let t = false;
      for (let dy = -1; dy <= 1 && !t; dy++) for (let dx = -1; dx <= 1; dx++) if (inside(m, x + dx, y + dy) && m.cells[idx(m, x + dx, y + dy)] === CellKind.Floor) t = true;
      if (t) m.cells[i] = CellKind.Wall;
    }

  // start/exit by BFS distance
  const floors: number[] = [];
  for (let i = 0; i < W * H; i++) if (m.cells[i] === CellKind.Floor) floors.push(i);
  const s = floors[Math.floor(rng.next() * floors.length)];
  let sx = s % W;
  let sy = (s / W) | 0;
  let dist = distanceMap(m, sx, sy);
  let far = s;
  for (const f of floors) if (dist[f] > dist[far]) far = f;
  // start from the far end for a longer walk
  sx = far % W;
  sy = (far / W) | 0;
  dist = distanceMap(m, sx, sy);
  let exit = far;
  for (const f of floors) if (dist[f] > dist[exit]) exit = f;
  const start = { x: sx + 0.5, y: sy + 0.5 };
  const exitPos = { x: (exit % W) + 0.5, y: ((exit / W) | 0) + 0.5 };
  const maxD = dist[exit];

  const interactables: InteractableSpawn[] = [];
  const lights: StaticLight[] = [];
  const packs: PackSpawn[] = [];
  // place start features on free floor cells at a small distance from the start
  const nearFree = (minD: number, taken: { x: number; y: number }[]) => {
    for (let r = minD; r < 8; r++)
      for (const f of floors) {
        const fx = (f % W) + 0.5;
        const fy = ((f / W) | 0) + 0.5;
        const d = Math.hypot(fx - start.x, fy - start.y);
        if (d < r || d > r + 1 || taken.some((t) => Math.hypot(t.x - fx, t.y - fy) < 2)) continue;
        let open = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (floorAt(m, Math.floor(fx) + dx, Math.floor(fy) + dy)) open++;
        if (open === 9) return { x: fx, y: fy };
      }
    return { x: start.x, y: start.y };
  };
  const taken = [start];
  if (p.hasWaypoint) {
    const wp = nearFree(2, taken);
    taken.push(wp);
    interactables.push({ kind: 'waypoint', pos: wp });
  }
  interactables.push({ kind: 'stairsUp', pos: nearFree(2.5, taken), data: { floor: p.floor - 1 } });
  let bossArena: GeneratedLevel['bossArena'];
  if (p.bossFloor) {
    // carve a round arena around the exit
    const r = 5;
    for (let y = -r; y <= r; y++)
      for (let x = -r; x <= r; x++) {
        const cx = Math.floor(exitPos.x) + x;
        const cy = Math.floor(exitPos.y) + y;
        if (cx < 3 || cy < 3 || cx >= W - 3 || cy >= H - 3 || x * x + y * y > r * r) continue;
        m.cells[idx(m, cx, cy)] = CellKind.Floor;
      }
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = idx(m, x, y);
        if (m.cells[i] === CellKind.Wall) {
          let t = false;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (inside(m, x + dx, y + dy) && m.cells[idx(m, x + dx, y + dy)] === CellKind.Floor) t = true;
          if (!t) m.cells[i] = CellKind.Void;
        } else if (m.cells[i] === CellKind.Void) {
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (inside(m, x + dx, y + dy) && m.cells[idx(m, x + dx, y + dy)] === CellKind.Floor) m.cells[i] = CellKind.Wall;
        }
      }
    bossArena = { center: exitPos, radius: r };
  } else interactables.push({ kind: 'stairsDown', pos: exitPos, data: { floor: p.floor + 1 } });

  // packs spread along the path distance, props & lights
  const spaced: number[] = [];
  for (const f of rng.shuffle([...floors])) {
    if (dist[f] < 8 || (p.bossFloor && dist[f] > maxD - 8)) continue;
    const fx = f % W;
    const fy = (f / W) | 0;
    if (spaced.some((o) => Math.hypot((o % W) - fx, ((o / W) | 0) - fy) < 6)) continue;
    spaced.push(f);
  }
  const packCount = Math.round((floors.length / 100) * p.density);
  for (let k = 0; k < Math.min(packCount, spaced.length); k++) packs.push({ pos: { x: (spaced[k] % W) + 0.5, y: ((spaced[k] / W) | 0) + 0.5 }, size: rng.int(3, 7), region: 0 });
  let chests = p.chests;
  let shrines = p.shrines;
  for (let k = packCount; k < spaced.length; k++) {
    const pos = { x: (spaced[k] % W) + 0.5, y: ((spaced[k] / W) | 0) + 0.5 };
    if (chests > 0) {
      chests--;
      interactables.push({ kind: 'chest', pos, data: { tier: rng.chance(0.15) ? 1 : 0 } });
    } else if (shrines > 0) {
      shrines--;
      interactables.push({ kind: 'shrine', pos });
    }
  }
  paintCave(m, rng, lights, start, exitPos);
  // a few braziers (dungeon tileset) for warm light pools
  const decor: NonNullable<GeneratedLevel['decor']> = [];
  const brazierAt = (x: number, y: number) => {
    const i = idx(m, x, y);
    if (m.cells[i] !== CellKind.Floor || m.object[i] >= 0) return;
    m.cells[i] = CellKind.Obstacle;
    decor.push({ tileset: 'dungeon', tile: 167, x, y });
    lights.push({ pos: { x: x + 0.5, y: y + 0.5 }, light: { radius: 5, color: 0xff8a30, intensity: 1.2, flicker: 0.3 } });
  };
  brazierAt(Math.floor(start.x) + 2, Math.floor(start.y) + 1);
  for (let k = 0; k < 6; k++) {
    const f = spaced[spaced.length - 1 - k];
    if (f !== undefined) brazierAt((f % W) + 1, ((f / W) | 0) + 1);
  }
  return { map: m, rooms: [], playerStart: start, waypointPos: start, interactables, packs, lights, traps: [], bossArena, decor, seed: p.seed };
}

export function paintCave(m: TileMap, rng: Rng, lights: StaticLight[], avoid: { x: number; y: number }, avoid2: { x: number; y: number }): void {
  const W = m.width;
  const pick = (plain: number[], themed: number[]) => (rng.chance(0.72) ? rng.pick(plain) : rng.pick(themed));
  for (let y = 0; y < m.height; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const c = m.cells[i];
      if (c === CellKind.Void) continue;
      if (c === CellKind.Floor) {
        m.floor[i] = rng.chance(0.08) ? rng.pick([25, 31]) : rng.int(16, 30);
        continue;
      }
      // wall autotile: open = floor side
      const E = floorAt(m, x + 1, y);
      const Wn = floorAt(m, x - 1, y);
      const S = floorAt(m, x, y + 1);
      const N = floorAt(m, x, y - 1);
      let t = -1;
      let under = 'floor';
      if (E && S) t = pick([80, 84], [99, 103, 115]);
      else if (Wn && S) t = pick([81, 85], [117, 119, 121]);
      else if (Wn && N) {
        t = rng.pick([82, 86]);
        under = 'void';
      } else if (E && N) t = pick([83, 87], [116, 118, 120]);
      else if (E) t = pick([64, 68], [96, 100, 112]);
      else if (S) t = pick([65, 69], [97, 101, 113]);
      else if (Wn) {
        t = rng.pick([66, 70]);
        under = 'left';
      } else if (N) {
        t = rng.pick([67, 71]);
        under = 'right';
      } else if (floorAt(m, x + 1, y + 1)) t = pick([72, 76], [98, 102, 114]);
      else if (floorAt(m, x - 1, y + 1)) {
        t = rng.pick([73, 77]);
        under = 'left';
      } else if (floorAt(m, x - 1, y - 1)) {
        t = rng.pick([74, 78]);
        under = 'void';
      } else if (floorAt(m, x + 1, y - 1)) {
        t = rng.pick([75, 79]);
        under = 'right';
      }
      m.object[i] = t;
      m.floor[i] = under === 'floor' ? rng.int(16, 30) : under === 'left' ? 57 : under === 'right' ? 56 : -1;
    }
  // props: stalagmites, boulders, mushrooms, light shafts
  for (let k = 0; k < (m.width * m.height) / 55; k++) {
    const x = rng.int(3, m.width - 4);
    const y = rng.int(3, m.height - 4);
    const i = y * W + x;
    if (m.cells[i] !== CellKind.Floor || m.object[i] >= 0) continue;
    if (Math.hypot(x - avoid.x, y - avoid.y) < 3 || Math.hypot(x - avoid2.x, y - avoid2.y) < 3) continue;
    // keep a free ring so paths don't get blocked
    let open = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (floorAt(m, x + dx, y + dy)) open++;
    if (open < 9) continue;
    const r = rng.next();
    if (r < 0.35) {
      m.object[i] = rng.pick([144, 145, 146, 147]);
      m.cells[i] = CellKind.Obstacle;
    } else if (r < 0.55) {
      m.object[i] = rng.pick([150, 151, 152]);
      m.cells[i] = CellKind.Obstacle;
    } else if (r < 0.85) {
      m.object[i] = rng.pick([132, 133, 134, 135]);
      lights.push({ pos: { x: x + 0.5, y: y + 0.5 }, light: { radius: 2.2, color: 0x60ffb0, intensity: 0.55, flicker: 0.1 } });
    } else {
      m.overlay[i] = rng.pick([52, 53, 54, 55]);
    }
  }
}
