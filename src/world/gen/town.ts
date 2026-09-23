// Fixed town hub "Brasaluz" (grassland tileset). Hand-placed layout; seed only affects small variations.
import { Rng } from '../../core/rng';
import { CellKind, type GeneratedLevel, type GeneratorParams, type InteractableSpawn, type StaticLight } from '../types';
import { createMap, idx } from './common';

const W = 36;
const H = 36;

export function generateTown(p: GeneratorParams): GeneratedLevel {
  const rng = new Rng(1234);
  const m = createMap(W, H, 'grassland', 'town');
  const lights: StaticLight[] = [];
  const decor: NonNullable<GeneratedLevel['decor']> = [];
  const set = (x: number, y: number, kind: CellKind, obj = -1) => {
    const i = idx(m, x, y);
    m.cells[i] = kind;
    if (obj >= 0) m.object[i] = obj;
  };
  // grass everywhere, tree band at the borders
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = idx(m, x, y);
      m.floor[i] = 16 + (y % 4) * 4 + (x % 4);
      const border = x < 3 || y < 3 || x >= W - 3 || y >= H - 3;
      if (border) {
        m.cells[i] = CellKind.Wall;
        if ((x + y) % 2 === 0 || rng.chance(0.3)) m.object[i] = rng.pick([248, 249, 250, 251, 244, 245, 252, 253]);
        else if (rng.chance(0.5)) m.object[i] = rng.pick([122, 123, 112, 113]);
      } else {
        m.cells[i] = CellKind.Floor;
        m.region[i] = 0;
      }
    }
  const cobble = (x: number, y: number) => {
    const i = idx(m, x, y);
    if (m.cells[i] === CellKind.Floor) m.floor[i] = rng.pick([32, 33, 34, 35, 36, 37, 38, 39]);
  };
  const border = (x: number, y: number) => {
    const i = idx(m, x, y);
    if (m.cells[i] === CellKind.Floor && m.floor[i] < 32) m.floor[i] = rng.pick([40, 41, 42, 43, 44, 45, 46, 47]);
  };
  // plaza + roads
  const cx = 18;
  const cy = 18;
  /** Crypt entrance: on the south road, in plain view from the plaza (keep its surroundings clear). */
  const entrance = { x: 18, y: 27 };
  const nearEntrance = (x: number, y: number) => Math.hypot(x + 0.5 - entrance.x, y + 0.5 - entrance.y) < 3.5;
  for (let y = 3; y < H - 3; y++)
    for (let x = 3; x < W - 3; x++) {
      const d = Math.abs(x - cx) + Math.abs(y - cy);
      if (d <= 4 || ((y === 17 || y === 18) && x >= 4 && x <= W - 5) || ((x === 17 || x === 18) && y >= 4)) cobble(x, y);
    }
  for (let y = 3; y < H - 3; y++)
    for (let x = 3; x < W - 3; x++) {
      const i = idx(m, x, y);
      if (m.floor[i] >= 32 && m.floor[i] <= 39) continue;
      let near = false;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const f = m.floor[idx(m, x + dx, y + dy)];
        if (f >= 32 && f <= 39) near = true;
      }
      if (near) border(x, y);
    }
  // braziers around the plaza (dungeon tileset fire)
  for (const [bx, by] of [
    [cx - 3, cy - 3],
    [cx + 3, cy - 3],
    [cx - 3, cy + 3],
    [cx + 3, cy + 3],
  ]) {
    set(bx, by, CellKind.Obstacle);
    decor.push({ tileset: 'dungeon', tile: 167, x: bx, y: by });
    lights.push({ pos: { x: bx + 0.5, y: by + 0.5 }, light: { radius: 5, color: 0xff9a40, intensity: 1.2, flicker: 0.3 } });
  }

  // blacksmith: stone hall 296 anchored at (6,14), collision x 7..11, y 9..13
  m.object[idx(m, 6, 14)] = 296;
  for (let y = 9; y <= 13; y++) for (let x = 7; x <= 11; x++) set(x, y, CellKind.Obstacle);
  set(9, 15, CellKind.Obstacle, 103); // anvil
  set(12, 13, CellKind.Obstacle, 100); // logs
  set(7, 16, CellKind.Obstacle, 102); // fire pit
  lights.push({ pos: { x: 7.5, y: 16.5 }, light: { radius: 4.5, color: 0xff7a30, intensity: 1.3, flicker: 0.4 } });
  set(11, 16, CellKind.Obstacle, 137); // chopping block

  // market (south-west): tents + goods
  set(12, 26, CellKind.Obstacle, 72);
  set(12, 25, CellKind.Obstacle, 73);
  set(14, 28, CellKind.Obstacle, 74);
  set(15, 28, CellKind.Obstacle, 75);
  set(10, 24, CellKind.Obstacle, 96);
  set(11, 28, CellKind.Obstacle, 97);
  set(16, 29, CellKind.Obstacle, 98);
  set(9, 27, CellKind.Obstacle, 99);
  lights.push({ pos: { x: 13.5, y: 26.5 }, light: { radius: 4, color: 0xffc080, intensity: 0.9, flicker: 0.1 } });

  // cabins
  const cabinA = (x: number, y: number) => {
    set(x, y, CellKind.Obstacle, 209);
    set(x - 1, y, CellKind.Obstacle, 208);
    set(x, y - 1, CellKind.Obstacle, 210);
    set(x, y - 2, CellKind.Obstacle, 211);
    set(x - 1, y - 1, CellKind.Obstacle);
    set(x - 1, y - 2, CellKind.Obstacle);
    lights.push({ pos: { x: x + 1.3, y: y - 0.5 }, light: { radius: 3, color: 0xffb060, intensity: 0.8, flicker: 0.15 } });
  };
  const cabinB = (x: number, y: number) => {
    set(x - 2, y, CellKind.Obstacle, 212);
    set(x - 1, y, CellKind.Obstacle, 213);
    set(x, y, CellKind.Obstacle, 214);
    set(x, y - 1, CellKind.Obstacle, 215);
    set(x - 2, y - 1, CellKind.Obstacle);
    set(x - 1, y - 1, CellKind.Obstacle);
    lights.push({ pos: { x: x - 1, y: y + 1.3 }, light: { radius: 3, color: 0xffb060, intensity: 0.8, flicker: 0.15 } });
  };
  cabinA(26, 10);
  cabinA(9, 7);
  cabinB(30, 23);
  cabinB(28, 29);
  // fences along the market and a few along the roads
  for (let x = 8; x <= 15; x += 2) {
    set(x - 1, 23, CellKind.Obstacle, 106);
    set(x, 23, CellKind.Obstacle, 107);
  }
  for (let y = 25; y <= 30; y += 2) {
    set(7, y - 1, CellKind.Obstacle, 105);
    set(7, y, CellKind.Obstacle, 104);
  }
  // dressing
  for (const [x, y, t] of [
    [22, 8, 138],
    [20, 29, 139],
    [30, 8, 140],
    [31, 8, 141],
    [32, 10, 142],
    [30, 11, 143],
    [24, 24, 136],
    [5, 22, 131],
    [24, 5, 128],
  ] as const)
    set(x, y, t === 138 || t === 139 ? CellKind.Obstacle : CellKind.Obstacle, t);
  for (let k = 0; k < 45; k++) {
    const x = rng.int(4, W - 5);
    const y = rng.int(4, H - 5);
    const i = idx(m, x, y);
    if (m.cells[i] === CellKind.Floor && m.object[i] < 0 && m.floor[i] < 32 && Math.abs(x - cx) + Math.abs(y - cy) > 6 && !nearEntrance(x, y)) m.object[i] = rng.pick([112, 113, 118, 119, 124, 125, 126, 127, 122]);
  }

  const interactables: InteractableSpawn[] = [
    { kind: 'waypoint', pos: { x: cx + 0.5, y: cy + 0.5 } },
    { kind: 'stash', pos: { x: 15.5, y: 21.5 }, name: 'Baú Compartilhado' },
    { kind: 'riftObelisk', pos: { x: 28.5, y: 15.5 } },
    { kind: 'difficultyAltar', pos: { x: 15.5, y: 8.5 } },
    { kind: 'dungeonEntrance', pos: { ...entrance }, name: 'Cripta dos Reis Caídos', data: { zoneId: 'crypt', floor: 1 } },
  ];
  // keep interactable cells walkable around them
  const npcs: GeneratedLevel['npcs'] = [
    { npcId: 'blacksmith', pos: { x: 10.5, y: 16.6 }, facing: Math.PI * 0.25 },
    { npcId: 'merchant', pos: { x: 14.2, y: 25.8 }, facing: -Math.PI * 0.6 },
    { npcId: 'elder', pos: { x: 21.5, y: 15.2 }, facing: Math.PI * 0.75 },
    { npcId: 'riftkeeper', pos: { x: 27.3, y: 17.2 }, facing: Math.PI * 0.9 },
    { npcId: 'villager_1', pos: { x: 23.5, y: 21.5 }, facing: Math.PI },
    { npcId: 'villager_2', pos: { x: 12.5, y: 19.8 }, facing: 0 },
    { npcId: 'guard_1', pos: { x: 15.8, y: 26.4 }, facing: -Math.PI / 2 },
    { npcId: 'guard_2', pos: { x: 19.8, y: 30.5 }, facing: -Math.PI / 2 },
  ];
  void p;
  return {
    map: m,
    rooms: [{ id: 0, x: 3, y: 3, w: W - 6, h: H - 6, center: { x: cx, y: cy }, tags: ['plaza'] }],
    playerStart: { x: cx + 0.5, y: cy + 2.5 },
    waypointPos: { x: cx + 0.5, y: cy + 2 },
    interactables,
    packs: [],
    lights,
    traps: [],
    npcs,
    decor,
    seed: 1234,
  };
}
