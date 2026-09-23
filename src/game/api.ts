// =============================================================================
// SERVICE CONTRACTS between modules. Systems, skills, AI, legendary powers and
// elite mods only talk to each other through these interfaces.
// Owner: architecture. Additive changes OK.
// =============================================================================

import type { Vec2 } from '../core/math';
import type { EventBus, GameEvents } from '../core/events';
import type { Rng } from '../core/rng';
import type { SpatialHash } from '../core/spatialHash';
import type {
  BiomeDef,
  Color,
  DamageType,
  DifficultyDef,
  LightDef,
  MusicId,
  ParticlePresetId,
  SfxId,
  SkillDef,
  StatusId,
  ZoneDef,
} from '../data/schema';
import type {
  Actor,
  CharacterState,
  DamageResult,
  DamageSpec,
  Faction,
  GroundEffect,
  GroundItem,
  GroundShape,
  Interactable,
  Projectile,
  Settings,
  StatusApplySpec,
} from './types';
import type { GeneratedLevel, StaticLight, TileMap } from '../world/types';

// -----------------------------------------------------------------------------
// World
// -----------------------------------------------------------------------------

export interface ZoneInstanceInfo {
  zone: ZoneDef;
  biome: BiomeDef;
  floor: number;
  /** Monster level for this instance (area level adjusted by difficulty). */
  monsterLevel: number;
  isTown: boolean;
  isRift: boolean;
  greaterRiftLevel: number;
  seed: number;
}

export interface WorldAPI {
  readonly info: ZoneInstanceInfo;
  readonly map: TileMap;
  readonly level: GeneratedLevel;
  readonly actors: Actor[];
  readonly projectiles: Projectile[];
  readonly groundEffects: GroundEffect[];
  readonly groundItems: GroundItem[];
  readonly interactables: Interactable[];
  readonly staticLights: StaticLight[];
  /** Rebuilt every tick from alive actors. */
  readonly actorHash: SpatialHash<Actor>;

  nextId(): number;
  addActor(a: Actor): Actor;
  removeActor(a: Actor): void;
  getActor(id: number | null | undefined): Actor | undefined;
  addProjectile(p: Projectile): Projectile;
  addGroundEffect(g: GroundEffect): GroundEffect;
  addGroundItem(g: GroundItem): GroundItem;
  addInteractable(i: Interactable): Interactable;

  /** Actors whose circle intersects (x, y, r). */
  queryActors(x: number, y: number, r: number, out?: Actor[], filter?: (a: Actor) => boolean): Actor[];
  /** Alive actors hostile to `faction` within radius. */
  enemiesOf(faction: Faction, x: number, y: number, r: number, out?: Actor[]): Actor[];

  isWalkable(x: number, y: number): boolean;
  /** Cells that block line of sight (walls, closed doors). */
  blocksSight(cx: number, cy: number): boolean;
  /** Grid raycast; true if nothing blocks between a and b. */
  lineOfSight(a: Vec2, b: Vec2): boolean;
  /** Returns the furthest walkable point along a->b (for dashes/teleports). */
  clampMove(a: Vec2, b: Vec2, radius: number): Vec2;
  /** Nearest walkable point to p (spiral search). */
  nearestWalkable(p: Vec2, maxDist?: number): Vec2 | null;
  /** A* path (world points) or null. */
  findPath(from: Vec2, to: Vec2, maxNodes?: number): Vec2[] | null;
  /** Flow-field direction toward the player (for hordes). Returns null if unreachable/out of field. */
  flowDirToPlayer(p: Vec2): Vec2 | null;
}

// -----------------------------------------------------------------------------
// Combat
// -----------------------------------------------------------------------------

export interface ProjectileInit {
  owner: Actor;
  from: Vec2;
  dir: Vec2; // normalized world dir
  speed: number;
  radius: number;
  range: number;
  damage: DamageSpec;
  visual: string;
  scale?: number;
  tint?: Color;
  light?: LightDef;
  trail?: ParticlePresetId;
  impactFx?: string;
  impactParticles?: ParticlePresetId;
  pierce?: number;
  homing?: number;
  targetId?: number | null;
  explodeRadius?: number;
  hitsWalls?: boolean;
  /** Lobbed to a point instead of flying straight. */
  lobTo?: Vec2;
  lobHeight?: number;
  onHit?: Projectile['onHit'];
  onExpire?: Projectile['onExpire'];
}

export interface GroundEffectInit {
  owner: Actor | null;
  faction: Faction;
  pos: Vec2;
  shape?: GroundShape;
  radius?: number;
  innerRadius?: number;
  angle?: number;
  arcDeg?: number;
  length?: number;
  width?: number;
  delay?: number;
  duration?: number;
  tickInterval?: number;
  damage?: DamageSpec | null;
  status?: StatusApplySpec;
  hitOnce?: boolean;
  followId?: number | null;
  telegraph?: boolean;
  color?: Color;
  fx?: string;
  particles?: ParticlePresetId;
  light?: LightDef;
  showArea?: boolean;
  onTick?: GroundEffect['onTick'];
  onActivate?: GroundEffect['onActivate'];
  onExpire?: GroundEffect['onExpire'];
}

export interface MeleeOpts {
  /** Facing angle (world radians). */
  angle: number;
  /** Full arc in degrees (360 = circle). */
  arcDeg: number;
  range: number;
  damage: DamageSpec;
  maxTargets?: number;
  onHit?: (target: Actor, result: DamageResult) => void;
  /** Particle preset spawned at each hit. */
  hitParticles?: ParticlePresetId;
}

export interface AreaOpts {
  damage: DamageSpec;
  onHit?: (target: Actor, result: DamageResult) => void;
  maxTargets?: number;
  exclude?: Set<number>;
}

export interface SummonOpts {
  enemyId: string;
  pos: Vec2;
  faction: Faction;
  owner?: Actor;
  skillId?: string;
  level?: number;
  lifeMult?: number;
  damageMult?: number;
  duration?: number | null;
  tint?: Color;
  scale?: number;
}

export interface CombatAPI {
  /** Apply a damage packet (crit roll, mitigation, block/dodge, shields, procs, feedback, death). */
  dealDamage(target: Actor, spec: DamageSpec): DamageResult | null;
  /**
   * Player/minion skill damage amount BEFORE target mitigation:
   * weaponRoll * coefficient * (1 + mainStat/100) * (1 + elemental% + damage%) * skill bonuses.
   */
  skillDamage(caster: Actor, coefficient: number, type: DamageType, skillId?: string): number;
  /** Monster ability damage amount before mitigation. */
  monsterDamage(caster: Actor, mult: number): number;
  melee(caster: Actor, opts: MeleeOpts): Actor[];
  /** Instant circle AoE (hostile to caster faction). */
  aoe(caster: Actor | null, faction: Faction, center: Vec2, radius: number, opts: AreaOpts): Actor[];
  /** Instant cone AoE. */
  cone(caster: Actor, center: Vec2, angle: number, arcDeg: number, radius: number, opts: AreaOpts): Actor[];
  /** Instant line/rectangle AoE (beams, charges). */
  line(caster: Actor, from: Vec2, to: Vec2, width: number, opts: AreaOpts): Actor[];
  spawnProjectile(init: ProjectileInit): Projectile;
  spawnGroundEffect(init: GroundEffectInit): GroundEffect;
  applyStatus(target: Actor, spec: StatusApplySpec, sourceId: number | null): void;
  hasStatus(target: Actor, id: StatusId): boolean;
  removeStatus(target: Actor, id: StatusId): void;
  heal(target: Actor, amount: number, source?: GameEvents['playerHealed']['source']): number;
  addResource(actor: Actor, amount: number): void;
  spendResource(actor: Actor, amount: number): boolean;
  knockback(target: Actor, from: Vec2, force: number): void;
  /** Move actor along a->b over duration (charge/leap/roll). Clamped to walkable space. */
  dash(actor: Actor, to: Vec2, duration: number, opts?: { arc?: number; ghost?: boolean; onArrive?: () => void; onStep?: (t: number) => void }): void;
  teleport(actor: Actor, to: Vec2): void;
  summon(opts: SummonOpts): Actor | null;
  kill(target: Actor, killer: Actor | null): void;
  isHostile(a: Faction, b: Faction): boolean;
  /** Global hit-stop request (seconds, respects settings). */
  hitStop(seconds: number): void;
}

// -----------------------------------------------------------------------------
// FX (implemented by the renderer; simulation only calls these)
// -----------------------------------------------------------------------------

export type FloatTextStyle = 'damage' | 'crit' | 'playerDamage' | 'heal' | 'resource' | 'gold' | 'xp' | 'info' | 'immune' | 'block' | 'dodge';

export interface FxBurstOpts {
  count?: number;
  color?: Color;
  /** World-space direction bias. */
  dir?: Vec2;
  spreadDeg?: number;
  speed?: number;
  /** Height above ground (tiles). */
  z?: number;
  scale?: number;
}

export interface SpriteFxOpts {
  scale?: number;
  tint?: Color;
  /** World angle for directional fx. */
  angle?: number;
  followId?: number;
  additive?: boolean;
  /** Override total duration (s); otherwise animation length. */
  duration?: number;
  alpha?: number;
  z?: number;
  loop?: boolean;
}

export interface FxAPI {
  damageNumber(pos: Vec2, amount: number, crit: boolean, type: DamageType, toPlayer: boolean): void;
  floatText(pos: Vec2, text: string, style: FloatTextStyle, color?: Color): void;
  shake(intensity: number, duration?: number): void;
  burst(preset: ParticlePresetId, pos: Vec2, opts?: FxBurstOpts): void;
  /** Plays a sprite animation (Flare power fx) at a world point. Returns a handle id. */
  spriteFx(fxId: string, pos: Vec2, opts?: SpriteFxOpts): number;
  stopFx(handle: number): void;
  /** Transient dynamic light. */
  light(pos: Vec2, def: LightDef, duration: number, followId?: number): void;
  decal(kind: 'blood' | 'scorch' | 'crack' | 'frost' | 'poison' | 'bone', pos: Vec2, opts?: { color?: Color; scale?: number }): void;
  /** Lightning/beam segment between two points. */
  beam(from: Vec2, to: Vec2, opts: { color: Color; width?: number; duration?: number; jagged?: boolean }): void;
  screenFlash(color: Color, alpha: number, duration: number): void;
  shockwave(pos: Vec2, opts?: { radius?: number; duration?: number }): void;
}

// -----------------------------------------------------------------------------
// Audio
// -----------------------------------------------------------------------------

export interface AudioAPI {
  /** Positional sfx attenuates & pans by distance to the listener (player). */
  play(id: SfxId, opts?: { pos?: Vec2; volume?: number; pitch?: number; pitchVar?: number }): void;
  playMusic(id: MusicId, fadeSeconds?: number): void;
  stopMusic(fadeSeconds?: number): void;
  setListener(pos: Vec2): void;
  applySettings(settings: Settings): void;
  /** Must be called from a user gesture before audio plays. */
  unlock(): void;
}

// -----------------------------------------------------------------------------
// UI (DOM overlay)
// -----------------------------------------------------------------------------

export type PanelId =
  | 'inventory'
  | 'character'
  | 'skills'
  | 'paragon'
  | 'stash'
  | 'vendor'
  | 'blacksmith'
  | 'quests'
  | 'waypoints'
  | 'rift'
  | 'difficulty'
  | 'map'
  | 'options'
  | 'pause'
  | 'dialog'
  | 'death';

export interface UIAPI {
  toast(text: string, kind?: GameEvents['toast']['kind']): void;
  /** Big centered banner (zone name, level up, boss phase, rift complete). */
  banner(title: string, subtitle?: string, kind?: 'zone' | 'levelup' | 'boss' | 'rift' | 'legendary' | 'death' | 'quest'): void;
  openPanel(id: PanelId, data?: unknown): void;
  closePanel(id: PanelId): void;
  togglePanel(id: PanelId): void;
  isOpen(id: PanelId): boolean;
  closeAll(): boolean;
  /** True while the pointer is over an interactive UI element (clicks must not reach the world). */
  isPointerOverUI(): boolean;
  /** True when a modal panel blocks gameplay input (pause, options, death). */
  isModal(): boolean;
  setBossBar(actor: Actor | null): void;
  /** Called once per rendered frame. Cheap DOM writes only when values change. */
  update(dt: number): void;
}

// -----------------------------------------------------------------------------
// Game context handed to systems, skills, AI, powers
// -----------------------------------------------------------------------------

export interface GameCtx {
  /** Scaled simulation time (seconds). */
  readonly time: number;
  readonly events: EventBus<GameEvents>;
  readonly rng: Rng;
  readonly world: WorldAPI;
  readonly player: Actor;
  readonly character: CharacterState;
  readonly difficulty: DifficultyDef;
  readonly combat: CombatAPI;
  readonly fx: FxAPI;
  readonly audio: AudioAPI;
  readonly ui: UIAPI;
  readonly settings: Settings;
  /** Recompute player stats (after gear/skill/paragon/buff changes). */
  refreshPlayerStats(): void;
  /** Travel to another zone/floor (autosaves). */
  travel(to: TravelTarget): void;
  /** Persist now. */
  save(reason: string): void;
}

export type TravelTarget =
  | { kind: 'town' }
  | { kind: 'zone'; zoneId: string; floor: number; via: 'waypoint' | 'stairs' | 'portal' | 'start' }
  | { kind: 'rift'; greater: boolean; level: number }
  | { kind: 'riftNextFloor' }
  | { kind: 'portalBack' };

export interface System {
  readonly name: string;
  /** Called on zone load (new World). */
  init?(ctx: GameCtx): void;
  update(ctx: GameCtx, dt: number): void;
  /** Called before the world is discarded. */
  dispose?(ctx: GameCtx): void;
}

// -----------------------------------------------------------------------------
// Pluggable behaviours (registries keyed by id from data)
// -----------------------------------------------------------------------------

export interface SkillCastInfo {
  caster: Actor;
  def: SkillDef;
  rank: number;
  rune: string | null;
  /** Merged params: def.params <- rune.params <- power modifiers. */
  params: Record<string, number>;
  /** Weapon damage coefficient at this rank (def.damage + perRank). */
  coefficient: number;
  damageType: DamageType;
  target: Vec2;
  targetId: number | null;
  /** World-space unit direction caster -> target. */
  dir: Vec2;
}

export interface SkillImpl {
  /** Called when the cast reaches its fire point. */
  fire(ctx: GameCtx, cast: SkillCastInfo): void;
  /** Channel tick (channel skills), called every tick while channeling. */
  channel?(ctx: GameCtx, cast: SkillCastInfo, dt: number): void;
  /** Called when a channel ends. */
  endChannel?(ctx: GameCtx, cast: SkillCastInfo): void;
  /** Optional custom validation (e.g. requires corpses). */
  canCast?(ctx: GameCtx, cast: SkillCastInfo): boolean;
}

export interface AIBehavior {
  /** Called every tick for alive monsters/minions with this behaviour id. Sets actor.vel / starts casts. */
  update(ctx: GameCtx, actor: Actor, dt: number): void;
}

/** Legendary / set / passive / shrine power hooks. All optional. */
export interface PowerHooks {
  /** Stat modifications while active (added to aggregation). */
  stats?(value: number, ctx: GameCtx): Partial<Record<string, number>>;
  /** Mutate skill params before cast (e.g. +2 projectiles). */
  modifySkill?(value: number, cast: SkillCastInfo, ctx: GameCtx): void;
  /** Multiply outgoing damage (return multiplier, 1 = none). */
  outgoingMult?(value: number, target: Actor, spec: DamageSpec, ctx: GameCtx): number;
  /** Multiply incoming damage to the owner. */
  incomingMult?(value: number, source: Actor | null, spec: DamageSpec, ctx: GameCtx): number;
  onHit?(value: number, target: Actor, spec: DamageSpec, result: DamageResult, ctx: GameCtx): void;
  onCrit?(value: number, target: Actor, spec: DamageSpec, ctx: GameCtx): void;
  onKill?(value: number, victim: Actor, ctx: GameCtx): void;
  onCast?(value: number, cast: SkillCastInfo, ctx: GameCtx): void;
  onDamaged?(value: number, source: Actor | null, amount: number, ctx: GameCtx): void;
  tick?(value: number, dt: number, ctx: GameCtx): void;
}

export interface EliteModImpl {
  onSpawn?(ctx: GameCtx, actor: Actor): void;
  tick?(ctx: GameCtx, actor: Actor, dt: number): void;
  onHitTarget?(ctx: GameCtx, actor: Actor, target: Actor, result: DamageResult): void;
  onDamaged?(ctx: GameCtx, actor: Actor, result: DamageResult): void;
  onDeath?(ctx: GameCtx, actor: Actor): void;
}
