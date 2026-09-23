// Crypt generator: BSP rooms + 2-wide corridors, painted with the Flare dungeon tileset.
import { Rng } from '../../core/rng';
import { CellKind, type GeneratedLevel, type GeneratorParams, type InteractableSpawn, type PackSpawn, type RoomInfo, type StaticLight } from '../types';
import { buildWalls, carveCorridor, carveRect, createMap, distanceMap, idx } from './common';
import { DUNGEON_TILES, paintDungeon } from '../paint/dungeon';

interface Leaf {
  x: number;
  y: number;
  w: number;
  h: number;
  a?: Leaf;
  b?: Leaf;
  room?: RoomInfo;
}

const MIN_LEAF = 11;

function split(leaf: Leaf, rng: Rng, depth: number): void {
  if (depth > 6) return;
  const canH = leaf.h >= MIN_LEAF * 2;
  const canV = leaf.w >= MIN_LEAF * 2;
  if (!canH && !canV) return;
  const vertical = canV && (!canH || leaf.w > leaf.h * 1.2 || (leaf.w * 1.2 >= leaf.h && rng.chance(0.5)));
  if (vertical) {
    const cut = rng.int(MIN_LEAF, leaf.w - MIN_LEAF);
    leaf.a = { x: leaf.x, y: leaf.y, w: cut, h: leaf.h };
    leaf.b = { x: leaf.x + cut, y: leaf.y, w: leaf.w - cut, h: leaf.h };
  } else {
    const cut = rng.int(MIN_LEAF, leaf.h - MIN_LEAF);
    leaf.a = { x: leaf.x, y: leaf.y, w: leaf.w, h: cut };
    leaf.b = { x: leaf.x, y: leaf.y + cut, w: leaf.w, h: leaf.h - cut };
  }
  split(leaf.a, rng, depth + 1);
  split(leaf.b, rng, depth + 1);
}

function leaves(l: Leaf, out: Leaf[] = []): Leaf[] {
  if (!l.a || !l.b) out.push(l);
  else {
    leaves(l.a, out);
    leaves(l.b, out);
  }
  return out;
}

function anyRoom(l: Leaf, rng: Rng): RoomInfo {
  if (l.room) return l.room;
  const ls = leaves(l).filter((x) => x.room);
  return rng.pick(ls).room!;
}

export function generateRooms(p: GeneratorParams): GeneratedLevel {
  const rng = new Rng(p.seed);
  const W = Math.max(30, p.width);
  const H = Math.max(30, p.height);
  const m = createMap(W, H, 'dungeon', p.biome);
  const root: Leaf = { x: 1, y: 1, w: W - 2, h: H - 2 };
  split(root, rng, 0);
  const rooms: RoomInfo[] = [];
  const ls = leaves(root);
  for (const l of ls) {
    const big = p.bossFloor && rooms.length === 0 ? 0 : 0;
    const rw = Math.max(6, Math.min(l.w - 3, rng.int(6, 11) + big));
    const rh = Math.max(6, Math.min(l.h - 3, rng.int(6, 11) + big));
    const rx = l.x + 1 + rng.int(0, Math.max(0, l.w - rw - 2));
    const ry = l.y + 1 + rng.int(0, Math.max(0, l.h - rh - 2));
    const room: RoomInfo = { id: rooms.length, x: rx, y: ry, w: rw, h: rh, center: { x: rx + rw / 2, y: ry + rh / 2 }, tags: ['normal'] };
    carveRect(m, rx, ry, rw, rh, room.id);
    rooms.push(room);
    l.room = room;
  }
  // connect siblings bottom-up
  const connect = (l: Leaf) => {
    if (!l.a || !l.b) return;
    connect(l.a);
    connect(l.b);
    const ra = anyRoom(l.a, rng);
    const rb = anyRoom(l.b, rng);
    carveCorridor(m, Math.floor(ra.center.x) - 1, Math.floor(ra.center.y) - 1, Math.floor(rb.center.x) - 1, Math.floor(rb.center.y) - 1, 2, rng);
  };
  connect(root);
  // a few loops for less linear layouts
  for (let k = 0; k < Math.floor(rooms.length / 4); k++) {
    const a = rng.pick(rooms);
    const b = rng.pick(rooms);
    if (a !== b && Math.hypot(a.center.x - b.center.x, a.center.y - b.center.y) < 18)
      carveCorridor(m, Math.floor(a.center.x), Math.floor(a.center.y), Math.floor(b.center.x), Math.floor(b.center.y), 2, rng);
  }

  // start = random room, exit = farthest room by walking distance
  const start = rooms[rng.int(0, rooms.length - 1)];
  start.tags = ['start'];
  const dist = distanceMap(m, Math.floor(start.center.x), Math.floor(start.center.y));
  let exit = start;
  let best = -1;
  for (const r of rooms) {
    const d = dist[idx(m, Math.floor(r.center.x), Math.floor(r.center.y))];
    if (d > best) {
      best = d;
      exit = r;
    }
  }
  exit.tags = [p.bossFloor ? 'boss' : 'exit'];

  const interactables: InteractableSpawn[] = [];
  const lights: StaticLight[] = [];
  const packs: PackSpawn[] = [];
  const skipFloor = new Set<number>();

  const playerStart = { x: start.center.x, y: start.center.y };
  if (p.hasWaypoint) {
    interactables.push({ kind: 'waypoint', pos: { x: start.x + 1.5, y: start.y + 1.5 } });
  }
  if (p.floor > 1 || !p.rift) {
    interactables.push({ kind: 'stairsUp', pos: { x: start.x + start.w - 1.5, y: start.y + 1 }, data: { floor: p.floor - 1 } });
  }

  let bossArena: GeneratedLevel['bossArena'];
  if (p.bossFloor) {
    bossArena = { center: { ...exit.center }, radius: Math.min(exit.w, exit.h) / 2 + 1 };
  } else {
    interactables.push({ kind: 'stairsDown', pos: { x: exit.center.x, y: exit.center.y }, data: { floor: p.floor + 1 } });
  }

  // props, braziers, chests, packs
  let chestsLeft = p.chests;
  let shrinesLeft = p.shrines;
  for (const r of rooms) {
    const inner = (pad: number) => ({ x: r.x + pad + rng.int(0, Math.max(0, r.w - 1 - pad * 2)), y: r.y + pad + rng.int(0, Math.max(0, r.h - 1 - pad * 2)) });
    // brazier as an obstacle with light
    if (rng.chance(0.55) && r.w >= 7 && r.h >= 7) {
      const c = inner(2);
      const i = idx(m, c.x, c.y);
      if (m.cells[i] === CellKind.Floor && !(r === start && Math.hypot(c.x - playerStart.x, c.y - playerStart.y) < 2)) {
        m.cells[i] = CellKind.Obstacle;
        m.object[i] = DUNGEON_TILES.brazier;
        lights.push({ pos: { x: c.x + 0.5, y: c.y + 0.5 }, light: { color: 0xff8a30, radius: 5.5, intensity: 1.25, flicker: 0.3 } });
      }
    }
    // bones / decor (non blocking) as overlay-like objects
    for (let k = rng.int(0, 3); k > 0; k--) {
      const c = inner(1);
      const i = idx(m, c.x, c.y);
      if (m.cells[i] === CellKind.Floor && m.object[i] < 0) m.object[i] = rng.pick(DUNGEON_TILES.bones);
    }
    if (r === start) continue;
    if (chestsLeft > 0 && rng.chance(0.35)) {
      chestsLeft--;
      interactables.push({ kind: 'chest', pos: { x: r.x + 1.5, y: r.y + r.h - 1.5 }, data: { tier: rng.chance(0.15) ? 1 : 0 } });
    }
    if (shrinesLeft > 0 && rng.chance(0.2)) {
      shrinesLeft--;
      interactables.push({ kind: 'shrine', pos: { x: r.x + r.w - 1.5, y: r.y + 1.5 } });
    }
    if (r === exit && p.bossFloor) continue;
    const area = r.w * r.h;
    const n = Math.max(1, Math.round((area / 100) * p.density * rng.range(0.7, 1.3)));
    for (let k = 0; k < n; k++) packs.push({ pos: { x: r.center.x + rng.range(-1.5, 1.5), y: r.center.y + rng.range(-1.5, 1.5) }, size: rng.int(3, 7), region: r.id });
  }
  // corridor packs
  for (let k = 0; k < rooms.length / 3; k++) {
    const x = rng.int(1, W - 2);
    const y = rng.int(1, H - 2);
    const i = idx(m, x, y);
    if (m.cells[i] === CellKind.Floor && m.region[i] < 0 && Math.hypot(x - playerStart.x, y - playerStart.y) > 10) packs.push({ pos: { x: x + 0.5, y: y + 0.5 }, size: rng.int(2, 4), region: -1 });
  }

  buildWalls(m);
  paintDungeon(m, rng, { lights, skipFloor, bloodWalls: p.biome === 'hell' ? 0.3 : 0.02 });

  return { map: m, rooms, playerStart, waypointPos: playerStart, interactables, packs, lights, traps: [], bossArena, seed: p.seed };
}
