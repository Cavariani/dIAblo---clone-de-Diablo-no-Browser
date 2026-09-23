// =============================================================================
// WORLD / MAP TYPES — output of level generators, consumed by World, renderer,
// navigation, fog of war and minimap. Owner: architecture.
// =============================================================================

import type { Vec2 } from '../core/math';
import type { BiomeId, LightDef } from '../data/schema';
import type { InteractKind } from '../game/types';

/** Logical cell kinds (collision + minimap). */
export const enum CellKind {
  Void = 0, // outside the level (black)
  Floor = 1,
  Wall = 2,
  Door = 3, // walkable when open (see TileMap.doorOpen)
  Water = 4, // not walkable, doesn't block projectiles/sight
  Lava = 5, // not walkable, doesn't block projectiles/sight, glows
  Pit = 6, // not walkable, doesn't block projectiles/sight
  Obstacle = 7, // prop that blocks movement (barrel, pillar, tree trunk) but not sight
}

/**
 * Visual tile placed on a cell. `tile` is an index into the biome tileset
 * (see scripts/assets/catalog/tileset-*.json and the asset manifest).
 */
export interface PlacedTile {
  tile: number;
  /** Optional tint / alpha variation. */
  tint?: number;
  /** Walls that should fade when the player stands behind them. */
  occluder?: boolean;
}

export interface TileMap {
  width: number;
  height: number;
  /** CellKind per cell (row-major: idx = y * width + x). */
  cells: Uint8Array;
  /** Floor tile index per cell (-1 = none). */
  floor: Int32Array;
  /** Object-layer tile per cell (walls, props, trees...) (-1 = none). Drawn depth-sorted with actors. */
  object: Int32Array;
  /** Optional decal/overlay tile drawn on top of floor (cracks, blood, rugs) (-1 = none). */
  overlay: Int32Array;
  /** Door open state per cell (1 = open). */
  doorOpen: Uint8Array;
  /** Fog of war: 1 once seen. */
  explored: Uint8Array;
  /** Currently visible this frame (0/1) — updated by FogSystem. */
  visible: Uint8Array;
  /** Region id per cell (room index, -1 corridor/none) for spawning & minimap. */
  region: Int16Array;
  tileset: string;
  biome: BiomeId;
}

export interface RoomInfo {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  center: Vec2;
  /** Tags: 'start', 'exit', 'boss', 'treasure', 'normal', 'plaza'... */
  tags: string[];
}

export interface InteractableSpawn {
  kind: InteractKind;
  pos: Vec2;
  data?: Record<string, unknown>;
  name?: string;
}

export interface PackSpawn {
  pos: Vec2;
  /** Suggested pack size. */
  size: number;
  /** Region id (room). */
  region: number;
  /** Hint: 'elite' forces an elite pack here. */
  hint?: 'elite' | 'unique' | 'ambush' | 'normal';
}

export interface StaticLight {
  pos: Vec2;
  light: LightDef;
}

export interface TrapSpawn {
  trapId: string;
  pos: Vec2;
}

/** Output of every level generator. Must be deterministic for a given seed. */
export interface GeneratedLevel {
  map: TileMap;
  rooms: RoomInfo[];
  playerStart: Vec2;
  /** Where arriving via town portal / waypoint places the player (defaults to playerStart). */
  waypointPos?: Vec2;
  interactables: InteractableSpawn[];
  packs: PackSpawn[];
  lights: StaticLight[];
  traps: TrapSpawn[];
  /** Boss arena (last floor): boss spawns at center when the player enters radius. */
  bossArena?: { center: Vec2; radius: number };
  /** Named NPC spawns (town). */
  npcs?: { npcId: string; pos: Vec2; facing?: number }[];
  seed: number;
}

export interface GeneratorParams {
  seed: number;
  biome: BiomeId;
  zoneId: string;
  floor: number;
  floors: number;
  width: number;
  height: number;
  /** Is this the last floor (boss arena)? */
  bossFloor: boolean;
  hasWaypoint: boolean;
  /** Rift floors: no stairs up, stairs down to next rift floor, denser. */
  rift: boolean;
  chests: number;
  shrines: number;
  traps: string[];
  density: number;
}

export const cellIndex = (map: TileMap, x: number, y: number): number => y * map.width + x;
export const inBounds = (map: TileMap, x: number, y: number): boolean => x >= 0 && y >= 0 && x < map.width && y < map.height;
