// World instance: entity lists, spatial hash, collision queries, LOS, pathfinding and flow field.
import { SpatialHash } from '../core/spatialHash';
import type { Vec2 } from '../core/math';
import { CellKind, type GeneratedLevel, type StaticLight, type TileMap } from '../world/types';
import { findPath, smoothPath } from '../world/nav/astar';
import type { WorldAPI, ZoneInstanceInfo } from './api';
import type { Actor, Faction, GroundEffect, GroundItem, Interactable, Projectile } from './types';

const FLOW_RADIUS = 30;

export class World implements WorldAPI {
  readonly map: TileMap;
  readonly actors: Actor[] = [];
  readonly projectiles: Projectile[] = [];
  readonly groundEffects: GroundEffect[] = [];
  readonly groundItems: GroundItem[] = [];
  readonly interactables: Interactable[] = [];
  readonly staticLights: StaticLight[];
  readonly actorHash = new SpatialHash<Actor>(2);
  private byId = new Map<number, Actor>();
  private idCounter = 1;
  // flow field
  private flow: Int32Array;
  private flowCell = -1;
  private flowQueue: Int32Array;
  /** Bumped whenever blocking geometry changes (doors) — renderer/fog may react. */
  geometryVersion = 0;

  constructor(
    readonly info: ZoneInstanceInfo,
    readonly level: GeneratedLevel,
  ) {
    this.map = level.map;
    this.staticLights = level.lights;
    this.flow = new Int32Array(this.map.width * this.map.height).fill(-1);
    this.flowQueue = new Int32Array(this.map.width * this.map.height);
  }

  nextId(): number {
    return this.idCounter++;
  }

  addActor(a: Actor): Actor {
    this.actors.push(a);
    this.byId.set(a.id, a);
    return a;
  }

  removeActor(a: Actor): void {
    const i = this.actors.indexOf(a);
    if (i >= 0) {
      this.actors[i] = this.actors[this.actors.length - 1];
      this.actors.pop();
    }
    this.byId.delete(a.id);
  }

  getActor(id: number | null | undefined): Actor | undefined {
    return id == null ? undefined : this.byId.get(id);
  }

  addProjectile(p: Projectile): Projectile {
    this.projectiles.push(p);
    return p;
  }

  addGroundEffect(g: GroundEffect): GroundEffect {
    this.groundEffects.push(g);
    return g;
  }

  addGroundItem(g: GroundItem): GroundItem {
    this.groundItems.push(g);
    return g;
  }

  addInteractable(i: Interactable): Interactable {
    this.interactables.push(i);
    return i;
  }

  /** Removes dead entries from lists (swap-remove). Called once per tick. */
  compact(): void {
    const sweep = <T extends { alive: boolean }>(arr: T[]) => {
      for (let i = arr.length - 1; i >= 0; i--)
        if (!arr[i].alive) {
          arr[i] = arr[arr.length - 1];
          arr.pop();
        }
    };
    sweep(this.projectiles);
    sweep(this.groundEffects);
    sweep(this.groundItems);
    sweep(this.interactables);
  }

  rebuildHash(): void {
    this.actorHash.clear();
    for (const a of this.actors) if (a.alive) this.actorHash.insert(a);
  }

  queryActors(x: number, y: number, r: number, out: Actor[] = [], filter?: (a: Actor) => boolean): Actor[] {
    return this.actorHash.queryCircle(x, y, r, out, filter);
  }

  enemiesOf(faction: Faction, x: number, y: number, r: number, out: Actor[] = []): Actor[] {
    return this.actorHash.queryCircle(x, y, r, out, (a) => a.alive && a.faction !== faction && a.faction !== 'neutral' && a.kind !== 'npc');
  }

  cell(cx: number, cy: number): number {
    if (cx < 0 || cy < 0 || cx >= this.map.width || cy >= this.map.height) return CellKind.Void;
    return this.map.cells[cy * this.map.width + cx];
  }

  /** Cell walkable for movement. */
  walkableCell(cx: number, cy: number): boolean {
    const c = this.cell(cx, cy);
    if (c === CellKind.Floor) return true;
    if (c === CellKind.Door) return this.map.doorOpen[cy * this.map.width + cx] === 1;
    return false;
  }

  isWalkable(x: number, y: number): boolean {
    return this.walkableCell(Math.floor(x), Math.floor(y));
  }

  blocksSight(cx: number, cy: number): boolean {
    const c = this.cell(cx, cy);
    if (c === CellKind.Wall || c === CellKind.Void) return true;
    if (c === CellKind.Door) return this.map.doorOpen[cy * this.map.width + cx] !== 1;
    return false;
  }

  /** Blocks projectiles (walls, closed doors, obstacles). */
  blocksProjectile(cx: number, cy: number): boolean {
    return this.blocksSight(cx, cy) || this.cell(cx, cy) === CellKind.Obstacle;
  }

  private ray(a: Vec2, b: Vec2, blocked: (cx: number, cy: number) => boolean): boolean {
    let cx = Math.floor(a.x);
    let cy = Math.floor(a.y);
    const ex = Math.floor(b.x);
    const ey = Math.floor(b.y);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const stepX = dx > 0 ? 1 : -1;
    const stepY = dy > 0 ? 1 : -1;
    const tdx = dx !== 0 ? Math.abs(1 / dx) : Infinity;
    const tdy = dy !== 0 ? Math.abs(1 / dy) : Infinity;
    let tmx = dx !== 0 ? (dx > 0 ? cx + 1 - a.x : a.x - cx) * tdx : Infinity;
    let tmy = dy !== 0 ? (dy > 0 ? cy + 1 - a.y : a.y - cy) * tdy : Infinity;
    for (let guard = 0; guard < 512; guard++) {
      if (blocked(cx, cy)) return false;
      if (cx === ex && cy === ey) return true;
      if (tmx < tmy) {
        tmx += tdx;
        cx += stepX;
      } else {
        tmy += tdy;
        cy += stepY;
      }
    }
    return true;
  }

  lineOfSight(a: Vec2, b: Vec2): boolean {
    return this.ray(a, b, (x, y) => this.blocksSight(x, y));
  }

  /** Walkable straight line with a little clearance (for path smoothing). */
  clearWalk(a: Vec2, b: Vec2, radius = 0.25): boolean {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = (-dy / len) * radius;
    const ny = (dx / len) * radius;
    const blocked = (x: number, y: number) => !this.walkableCell(x, y);
    return (
      this.ray(a, b, blocked) &&
      this.ray({ x: a.x + nx, y: a.y + ny }, { x: b.x + nx, y: b.y + ny }, blocked) &&
      this.ray({ x: a.x - nx, y: a.y - ny }, { x: b.x - nx, y: b.y - ny }, blocked)
    );
  }

  clampMove(a: Vec2, b: Vec2, radius: number): Vec2 {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) return { x: a.x, y: a.y };
    const steps = Math.ceil(len / 0.1);
    let last = { x: a.x, y: a.y };
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const p = { x: a.x + dx * t, y: a.y + dy * t };
      if (!this.circleFree(p.x, p.y, radius)) break;
      last = p;
    }
    return last;
  }

  /** True if a circle at (x,y) doesn't overlap blocking cells. */
  circleFree(x: number, y: number, r: number): boolean {
    const x0 = Math.floor(x - r);
    const x1 = Math.floor(x + r);
    const y0 = Math.floor(y - r);
    const y1 = Math.floor(y + r);
    for (let cy = y0; cy <= y1; cy++)
      for (let cx = x0; cx <= x1; cx++) {
        if (this.walkableCell(cx, cy)) continue;
        const px = Math.max(cx, Math.min(x, cx + 1));
        const py = Math.max(cy, Math.min(y, cy + 1));
        if ((px - x) ** 2 + (py - y) ** 2 < r * r) return false;
      }
    return true;
  }

  nearestWalkable(p: Vec2, maxDist = 6): Vec2 | null {
    const cx = Math.floor(p.x);
    const cy = Math.floor(p.y);
    if (this.walkableCell(cx, cy)) return { x: p.x, y: p.y };
    for (let r = 1; r <= maxDist; r++)
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          if (this.walkableCell(cx + dx, cy + dy)) return { x: cx + dx + 0.5, y: cy + dy + 0.5 };
        }
    return null;
  }

  findPath(from: Vec2, to: Vec2, maxNodes = 4000): Vec2[] | null {
    const grid = { width: this.map.width, height: this.map.height, walkable: (x: number, y: number) => this.walkableCell(x, y) };
    const raw = findPath(grid, from, to, maxNodes);
    if (!raw) return null;
    return smoothPath(raw, from, (a, b) => this.clearWalk(a, b));
  }

  /** Recompute the BFS distance field from the player's cell when it changes. */
  updateFlow(player: Vec2): void {
    const m = this.map;
    const px = Math.floor(player.x);
    const py = Math.floor(player.y);
    const cell = py * m.width + px;
    if (cell === this.flowCell) return;
    this.flowCell = cell;
    const d = this.flow;
    d.fill(-1);
    if (!this.walkableCell(px, py)) return;
    const q = this.flowQueue;
    let h = 0;
    let t = 0;
    d[cell] = 0;
    q[t++] = cell;
    while (h < t) {
      const c = q[h++];
      const dist = d[c];
      if (dist >= FLOW_RADIUS) continue;
      const cx = c % m.width;
      const cy = (c / m.width) | 0;
      for (let k = 0; k < 4; k++) {
        const nx = cx + (k === 0 ? 1 : k === 1 ? -1 : 0);
        const ny = cy + (k === 2 ? 1 : k === 3 ? -1 : 0);
        if (!this.walkableCell(nx, ny)) continue;
        const ni = ny * m.width + nx;
        if (d[ni] >= 0) continue;
        d[ni] = dist + 1;
        q[t++] = ni;
      }
    }
  }

  flowDirToPlayer(p: Vec2): Vec2 | null {
    const m = this.map;
    const cx = Math.floor(p.x);
    const cy = Math.floor(p.y);
    if (cx < 0 || cy < 0 || cx >= m.width || cy >= m.height) return null;
    const here = this.flow[cy * m.width + cx];
    if (here < 0) return null;
    let best = here;
    let bx = 0;
    let by = 0;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= m.width || ny >= m.height) continue;
        if (dx && dy && (!this.walkableCell(cx + dx, cy) || !this.walkableCell(cx, cy + dy))) continue;
        const v = this.flow[ny * m.width + nx];
        if (v >= 0 && v < best) {
          best = v;
          bx = nx + 0.5 - p.x;
          by = ny + 0.5 - p.y;
        }
      }
    if (best === here) return null;
    const l = Math.hypot(bx, by) || 1;
    return { x: bx / l, y: by / l };
  }
}
