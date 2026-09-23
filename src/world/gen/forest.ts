// Corrupted forest: organic clearings joined by trails, dense tree bands as walls (grassland tileset).
import { Rng } from '../../core/rng';
import { CellKind, type GeneratedLevel, type GeneratorParams, type InteractableSpawn, type PackSpawn, type StaticLight } from '../types';
import { createMap, distanceMap, idx, inside } from './common';

export function generateForest(p: GeneratorParams): GeneratedLevel {
  const rng = new Rng(p.seed);
  const W = Math.max(36, p.width);
  const H = Math.max(36, p.height);
  const m = createMap(W, H, 'grassland', p.biome);
  for (let i = 0; i < W * H; i++) m.cells[i] = CellKind.Wall;
  // clearings (poisson-ish)
  const centers: { x: number; y: number; r: number }[] = [];
  for (let tries = 0; tries < 400 && centers.length < Math.floor((W * H) / 150); tries++) {
    const r = rng.int(3, 5);
    const x = rng.int(r + 4, W - r - 5);
    const y = rng.int(r + 4, H - r - 5);
    if (centers.some((c) => Math.hypot(c.x - x, c.y - y) < c.r + r + 3)) continue;
    centers.push({ x, y, r });
  }
  const carve = (x: number, y: number, isPath = false) => {
    if (x < 3 || y < 3 || x >= W - 3 || y >= H - 3) return;
    const i = idx(m, x, y);
    if (m.cells[i] !== CellKind.Floor) {
      m.cells[i] = CellKind.Floor;
      m.overlay[i] = isPath ? -2 : -1; // marker: path cells get cobble later
    }
  };
  for (const c of centers)
    for (let y = -c.r - 1; y <= c.r + 1; y++)
      for (let x = -c.r - 1; x <= c.r + 1; x++) {
        const d = Math.hypot(x, y) + rng.range(-0.8, 0.8);
        if (d <= c.r) carve(c.x + x, c.y + y);
      }
  // connect clearings with a nearest-neighbour chain (MST-like)
  const connected = [centers[0]];
  const rest = centers.slice(1);
  while (rest.length) {
    let bi = 0;
    let bj = 0;
    let bd = Infinity;
    for (let i = 0; i < connected.length; i++)
      for (let j = 0; j < rest.length; j++) {
        const d = Math.hypot(connected[i].x - rest[j].x, connected[i].y - rest[j].y);
        if (d < bd) {
          bd = d;
          bi = i;
          bj = j;
        }
      }
    const a = connected[bi];
    const b = rest.splice(bj, 1)[0];
    let x = a.x;
    let y = a.y;
    while (Math.abs(x - b.x) + Math.abs(y - b.y) > 0) {
      if (rng.chance(0.25)) {
        x += rng.int(-1, 1);
        y += rng.int(-1, 1);
      } else if (Math.abs(x - b.x) > Math.abs(y - b.y)) x += Math.sign(b.x - x);
      else y += Math.sign(b.y - y);
      for (let dy = 0; dy <= 1; dy++) for (let dx = 0; dx <= 1; dx++) carve(x + dx, y + dy, true);
    }
    connected.push(b);
  }
  // start / exit
  const dist0 = distanceMap(m, centers[0].x, centers[0].y);
  let far = centers[0];
  for (const c of centers) if (dist0[idx(m, c.x, c.y)] > dist0[idx(m, far.x, far.y)]) far = c;
  const dist = distanceMap(m, far.x, far.y);
  let exitC = far;
  for (const c of centers) if (dist[idx(m, c.x, c.y)] > dist[idx(m, exitC.x, exitC.y)]) exitC = c;
  const start = { x: far.x + 0.5, y: far.y + 0.5 };
  const exit = { x: exitC.x + 0.5, y: exitC.y + 0.5 };

  // paint
  const lights: StaticLight[] = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = idx(m, x, y);
      m.floor[i] = 16 + (y % 4) * 4 + (x % 4);
      if (m.cells[i] === CellKind.Floor) {
        if (m.overlay[i] === -2) m.floor[i] = rng.pick([40, 41, 42, 43, 44, 45, 46, 47]);
        m.overlay[i] = -1;
        continue;
      }
      m.overlay[i] = -1;
      // distance to nearest floor (only paint trees near the playable area)
      let near = 99;
      for (let dy = -3; dy <= 3; dy++)
        for (let dx = -3; dx <= 3; dx++) {
          if (!inside(m, x + dx, y + dy) || m.cells[idx(m, x + dx, y + dy)] !== CellKind.Floor) continue;
          near = Math.min(near, Math.max(Math.abs(dx), Math.abs(dy)));
        }
      if (near > 3) {
        m.cells[i] = CellKind.Void;
        m.floor[i] = -1;
        continue;
      }
      if ((x + y) % 2 === 0 || rng.chance(0.35)) m.object[i] = rng.chance(0.6) ? rng.pick([244, 245, 246, 247]) : rng.pick([248, 249, 250, 251]);
      else m.object[i] = rng.pick([122, 123, 112, 113, 124, 125]);
    }
  // dressing: graves, stumps, rocks, eerie lights
  const interactables: InteractableSpawn[] = [];
  const packs: PackSpawn[] = [];
  if (p.hasWaypoint) interactables.push({ kind: 'waypoint', pos: { x: start.x + 1, y: start.y + 0.5 } });
  interactables.push({ kind: 'stairsUp', pos: { x: start.x - 1, y: start.y - 1 }, data: { floor: p.floor - 1 } });
  let bossArena: GeneratedLevel['bossArena'];
  if (p.bossFloor) bossArena = { center: exit, radius: exitC.r };
  else interactables.push({ kind: 'stairsDown', pos: exit, data: { floor: p.floor + 1 } });
  let chests = p.chests;
  let shrines = p.shrines;
  for (const c of centers) {
    if (c === far) continue;
    const area = Math.PI * c.r * c.r;
    if (!(c === exitC && p.bossFloor)) {
      const n = Math.max(1, Math.round((area / 100) * p.density * 1.4));
      for (let k = 0; k < n; k++) packs.push({ pos: { x: c.x + rng.range(-1.5, 1.5), y: c.y + rng.range(-1.5, 1.5) }, size: rng.int(3, 7), region: 0 });
    }
    for (let k = 0; k < 4; k++) {
      const x = c.x + rng.int(-c.r + 1, c.r - 1);
      const y = c.y + rng.int(-c.r + 1, c.r - 1);
      const i = idx(m, x, y);
      if (m.cells[i] !== CellKind.Floor || m.object[i] >= 0) continue;
      const r = rng.next();
      if (r < 0.3) {
        m.object[i] = rng.pick([140, 141, 142, 143]);
        m.cells[i] = CellKind.Obstacle;
      } else if (r < 0.5) {
        m.object[i] = rng.pick([128, 129, 130, 131]);
        m.cells[i] = CellKind.Obstacle;
      } else if (r < 0.7) {
        m.object[i] = rng.pick([136, 137]);
        m.cells[i] = CellKind.Obstacle;
      } else m.object[i] = rng.pick([118, 119, 124, 126]);
    }
    if (rng.chance(0.6)) lights.push({ pos: { x: c.x + 0.5, y: c.y + 0.5 }, light: { radius: 4, color: 0x9aff70, intensity: 0.45, flicker: 0.2 } });
    if (c !== exitC && chests > 0 && rng.chance(0.4)) {
      chests--;
      interactables.push({ kind: 'chest', pos: { x: c.x + c.r - 1.5, y: c.y + 0.5 } });
    }
    if (c !== exitC && shrines > 0 && rng.chance(0.3)) {
      shrines--;
      interactables.push({ kind: 'shrine', pos: { x: c.x - c.r + 1.5, y: c.y + 0.5 } });
    }
  }
  return { map: m, rooms: [], playerStart: start, waypointPos: start, interactables, packs, lights, traps: [], bossArena, seed: p.seed };
}
