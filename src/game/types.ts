// =============================================================================
// RUNTIME TYPES — simulation state shared between systems, renderer and UI.
// The simulation NEVER touches Pixi/DOM objects; renderer & UI read these.
// Owner: architecture. Additive changes OK; keep fields documented.
// =============================================================================

import type { Vec2 } from '../core/math';
import type {
  AvatarLayer,
  ClassId,
  Color,
  DamageType,
  DifficultyId,
  EquipSlot,
  HotbarSlot,
  LightDef,
  MaterialId,
  MonsterRank,
  ParticlePresetId,
  Rarity,
  StatBlock,
  StatusId,
} from '../data/schema';

export type Faction = 'player' | 'enemy' | 'neutral';
export type ActorKind = 'player' | 'monster' | 'minion' | 'npc';

export type ActorState =
  | 'idle'
  | 'moving'
  | 'attacking' // playing a skill/ability animation (see Actor.cast)
  | 'channeling'
  | 'hitstun'
  | 'stunned'
  | 'frozen'
  | 'dashing' // movement override (charge, leap, roll)
  | 'spawning'
  | 'dead';

export interface AnimState {
  /** Animation name in the sprite sheet: stance | run | swing | cast | shoot | block | hit | die | critdie | spawn ... */
  name: string;
  /** Seconds since this animation started (already scaled by `speed`). */
  time: number;
  /** Playback speed multiplier (attack speed etc). */
  speed: number;
  loop: boolean;
  /** Incremented every time an animation (re)starts — renderer uses it to restart frames. */
  serial: number;
}

export interface StatusInstance {
  id: StatusId;
  sourceId: number | null;
  remaining: number;
  duration: number;
  /** Meaning depends on status: slow fraction, dot damage per second, shield amount, ... */
  magnitude: number;
  damageType?: DamageType;
  tickTimer: number;
  stacks: number;
}

/** Everything the renderer needs to draw an actor. */
export interface ActorVisual {
  /** 'sheet' = single Flare enemy/npc sheet; 'avatar' = layered hero. */
  kind: 'sheet' | 'avatar';
  /** Sheet id in the asset manifest (kind 'sheet'). */
  sheet?: string;
  /** Avatar: body set ('male' | 'female' | 'female_dark') */
  body?: string;
  /** Avatar: sprite id per layer, e.g. { head: 'head_short', chest: 'plate_cuirass', mainhand: 'longsword' }. */
  layers?: Partial<Record<AvatarLayer, string>>;
  scale: number;
  tint?: Color;
  hue?: number;
  brightness?: number;
  /** Avatar customization. */
  skinTone?: Color;
  hairColor?: Color;
  armorTint?: Color;
  /** Colored outline/glow for elites & bosses. */
  outline?: Color;
  alpha: number;
  light?: LightDef;
  hideShadow?: boolean;
  /** Render offset height in pixels (flying enemies). */
  hover?: number;
}

export interface MonsterData {
  defId: string;
  rank: MonsterRank;
  eliteMods: string[];
  packId: number;
  leaderId: number | null;
  /** Display name (rare elites get generated names). */
  displayName: string;
  xp: number;
  /** Damage of a 1.0x ability hit at spawn (level + difficulty scaled). */
  baseDamage: number;
  bossPhase: number;
  riftProgress: number;
  /** Summoner that spawned this monster (for maxAlive tracking). */
  spawnedBy: number | null;
  dropsLoot: boolean;
  /** Free-form per-mod state (timers etc). */
  modState: Record<string, number>;
}

export interface AIState {
  behavior: string;
  /** Behaviour-defined mode string ('idle', 'chase', 'flee', 'windup'...). */
  mode: string;
  targetId: number | null;
  timer: number;
  home: Vec2;
  aggro: boolean;
  /** Free-form behaviour memory. */
  mem: Record<string, number>;
  repathTimer: number;
}

/** An in-progress skill cast (player) or ability (monster). */
export interface CastState {
  skillId: string; // player SkillDef id OR monster ability id
  isAbility: boolean;
  slot?: HotbarSlot;
  time: number;
  /** Seconds until the effect fires (already attack-speed scaled). */
  fireAt: number;
  /** Total cast duration (animation length). */
  duration: number;
  fired: boolean;
  target: Vec2;
  targetId: number | null;
  rune?: string;
  channel: boolean;
  /** For channels: seconds since last cost tick. */
  channelTick: number;
}

/** Movement override used by charges, leaps, rolls, knock-ups. */
export interface DashState {
  from: Vec2;
  to: Vec2;
  duration: number;
  time: number;
  /** Visual arc height in tiles (leaps). */
  arc: number;
  /** Ignore collision with actors while dashing. */
  ghost: boolean;
  onArrive?: () => void;
  onStep?: (t: number) => void;
}

export interface Actor {
  id: number;
  kind: ActorKind;
  faction: Faction;
  name: string;
  level: number;

  pos: Vec2;
  /** Position at the start of the current sim tick; the renderer interpolates prevPos→pos. */
  prevPos: Vec2;
  /** Desired velocity for this tick (tiles/s), set by controller / AI. MovementSystem integrates it. */
  vel: Vec2;
  radius: number;
  mass: number;
  /** World-space facing angle (radians). */
  facing: number;
  baseMoveSpeed: number;
  /** Effective speed after statuses/stats — recomputed each tick by StatusSystem. */
  moveSpeed: number;

  life: number;
  maxLife: number;
  resource: number;
  maxResource: number;
  /** Damage absorb pool (bone armor, shielded elites...). */
  shield: number;

  /** Final stats (players: aggregated from gear/paragon/passives/buffs; monsters: simple block). */
  stats: StatBlock;

  state: ActorState;
  stateTime: number;
  anim: AnimState;
  statuses: StatusInstance[];
  /** Remaining cooldown per skill/ability id (seconds). */
  cooldowns: Record<string, number>;
  /** Remaining charges for charge-based skills. */
  charges: Record<string, number>;

  path: Vec2[] | null;
  pathIndex: number;
  moveTarget: Vec2 | null;
  /** Knockback velocity (tiles/s) that decays each tick. */
  knockback: Vec2;
  dash: DashState | null;
  cast: CastState | null;

  /** Seconds of white hit-flash remaining (renderer). */
  flash: number;
  /** Tint flash color override (e.g. freeze = cyan). */
  flashColor?: Color;
  lastDamagedAt: number;
  lastCombatAt: number;
  alive: boolean;
  deathAt: number;
  /** Seconds of invulnerability remaining. */
  invulnerable: number;
  /** Seconds until the corpse is removed from the world (after death animation). */
  corpseTimer: number;

  visual: ActorVisual;

  /** Set for the player actor; points to the persistent CharacterState. */
  character?: CharacterState;
  monster?: MonsterData;
  npc?: { defId: string };
  minion?: { ownerId: number; skillId: string; expiresAt: number | null; /** Weapon-damage coefficient of the minion's hits. */ coef?: number };
  ai?: AIState;
  /** Player weapon (derived from gear). */
  weapon?: { min: number; max: number; aps: number; range: number; ranged: boolean };
  /** Player main attribute value (damage scaling). */
  mainStat?: number;
  /** Arbitrary flags (e.g. 'boss', 'elite', 'flying'). */
  tags: Set<string>;
}

// -----------------------------------------------------------------------------
// Combat payloads
// -----------------------------------------------------------------------------

export interface StatusApplySpec {
  id: StatusId;
  duration: number;
  magnitude: number;
  chance?: number;
  damageType?: DamageType;
}

export interface DamageSpec {
  /** Pre-mitigation amount already including attacker multipliers (use combat.skillDamage / monster baseDamage). */
  amount: number;
  type: DamageType;
  sourceId: number | null;
  skillId?: string;
  /** Force crit (true), forbid (false), or roll from attacker stats (undefined). */
  crit?: boolean;
  isDot?: boolean;
  isArea?: boolean;
  isMelee?: boolean;
  isRanged?: boolean;
  /** Knockback impulse in tiles/s (scaled by target mass). */
  knockback?: number;
  status?: StatusApplySpec;
  /** Scales on-hit effects (life on hit, legendary procs). 1 = full. */
  procCoef?: number;
  /** Extra hit-stop (seconds) for heavy hits. */
  hitstop?: number;
  /** Direction of the hit (for knockback/particles). Defaults to source->target. */
  dir?: Vec2;
  /** Skip hit animation/flash (DoTs). */
  silent?: boolean;
}

export interface DamageResult {
  amount: number;
  crit: boolean;
  blocked: boolean;
  dodged: boolean;
  absorbed: number;
  killed: boolean;
  overkill: number;
}

// -----------------------------------------------------------------------------
// World objects
// -----------------------------------------------------------------------------

export interface Projectile {
  id: number;
  ownerId: number;
  faction: Faction;
  pos: Vec2;
  vel: Vec2;
  radius: number;
  traveled: number;
  maxRange: number;
  damage: DamageSpec;
  pierceLeft: number;
  hitIds: Set<number>;
  homing: number;
  targetId: number | null;
  /** Lobbed projectile: flies along an arc and explodes at `lob.to`. */
  lob: { from: Vec2; to: Vec2; duration: number; t: number; height: number } | null;
  explodeRadius: number;
  /** Fx/sprite id (asset manifest). */
  visual: string;
  tint?: Color;
  scale: number;
  light?: LightDef;
  trail?: ParticlePresetId;
  impactFx?: string;
  impactParticles?: ParticlePresetId;
  /** Collide with walls? */
  hitsWalls: boolean;
  /** Called for each actor hit (after damage). */
  onHit?: (target: Actor, p: Projectile) => void;
  /** Called when the projectile dies (range / wall / pierce exhausted / lob landing). */
  onExpire?: (p: Projectile, reason: 'range' | 'wall' | 'hit' | 'landed') => void;
  age: number;
  alive: boolean;
  /** Visual z height in tiles (lobbed). */
  z: number;
}

export type GroundShape = 'circle' | 'cone' | 'line' | 'ring';

export interface GroundEffect {
  id: number;
  ownerId: number | null;
  faction: Faction;
  pos: Vec2;
  shape: GroundShape;
  radius: number;
  /** Inner radius for rings. */
  innerRadius: number;
  angle: number;
  arc: number; // radians (cones)
  length: number; // lines
  width: number; // lines
  age: number;
  /** Telegraph time before it becomes active (enemy attacks). Renderer draws a filling warning shape meanwhile. */
  delay: number;
  /** Active duration after delay (0 = single instant hit). */
  duration: number;
  tickInterval: number;
  tickTimer: number;
  damage: DamageSpec | null;
  status?: StatusApplySpec;
  /** Hit each target only once for the whole effect. */
  hitOnce: boolean;
  hitIds: Set<number>;
  /** Actor id to follow (auras). */
  followId: number | null;
  visual: {
    telegraph: boolean;
    color: Color;
    fx?: string;
    particles?: ParticlePresetId;
    light?: LightDef;
    /** Draw the area (e.g. poison pool) while active. */
    showArea: boolean;
  };
  onTick?: (g: GroundEffect) => void;
  onActivate?: (g: GroundEffect) => void;
  onExpire?: (g: GroundEffect) => void;
  alive: boolean;
}

export type GroundItemKind = 'item' | 'gold' | 'potion' | 'globe' | 'material' | 'consumable';

export interface GroundItem {
  id: number;
  kind: GroundItemKind;
  pos: Vec2;
  radius: number;
  item?: ItemInstance;
  gold?: number;
  materialId?: MaterialId;
  consumableId?: string;
  amount: number;
  /** Drop animation: flies from `from` to `pos` over dropDuration. */
  from: Vec2;
  droppedAt: number;
  dropDuration: number;
  alive: boolean;
}

export type InteractKind =
  | 'chest'
  | 'door'
  | 'stairsDown'
  | 'stairsUp'
  | 'waypoint'
  | 'portal'
  | 'shrine'
  | 'stash'
  | 'riftObelisk'
  | 'riftExit'
  | 'breakable'
  | 'lever'
  | 'bossPortal'
  | 'difficultyAltar'
  | 'dungeonEntrance';

export interface Interactable {
  id: number;
  kind: InteractKind;
  pos: Vec2;
  radius: number;
  state: 'idle' | 'open' | 'used' | 'active' | 'locked';
  /** Hover label (pt-BR). */
  name: string;
  interactRange: number;
  blocksMovement: boolean;
  /** Kind-specific payload: { zoneId, floor } for stairs/portals, { tier } for chests, { shrineId }... */
  data: Record<string, unknown>;
  visual: {
    /** Tileset tile index (object layer) or sprite sheet id. */
    tile?: number;
    tileOpen?: number;
    sprite?: string;
    fx?: string;
    light?: LightDef;
    tint?: Color;
  };
  alive: boolean;
}

// -----------------------------------------------------------------------------
// Items & character (persistent)
// -----------------------------------------------------------------------------

export interface RolledAffix {
  /** AffixDef id (or 'implicit:<stat>' for implicits). */
  id: string;
  value: number;
  /** Roll range at this ilvl (for tooltip "perfect roll" display and upgrades). */
  min: number;
  max: number;
  /** Chosen skill for skillRank/skillDamage affixes. */
  skillId?: string;
  /** Rerolled at the blacksmith (only this affix can be rerolled again). */
  enchanted?: boolean;
  /** Number of blacksmith upgrades applied. */
  upgrades?: number;
}

export interface ItemInstance {
  uid: string;
  baseId: string;
  rarity: Rarity;
  ilvl: number;
  reqLevel: number;
  name: string;
  /** Rolled weapon damage [min, max] (weapons only). */
  damage?: [number, number];
  attacksPerSecond?: number;
  /** Rolled armor (armor pieces/shields). */
  armor?: number;
  implicits: RolledAffix[];
  affixes: RolledAffix[];
  legendaryId?: string;
  legendaryValue?: number;
  setId?: string;
  setPieceId?: string;
  /** Ancestral roll: +30% affix values (D3 'ancient' flavour). */
  ancestral?: boolean;
  /** Blacksmith upgrade level 0..5. */
  upgradeLevel: number;
  /** New item badge in inventory until hovered. */
  isNew?: boolean;
  /** Locked from selling/salvaging. */
  locked?: boolean;
}

export interface InventoryEntry {
  item: ItemInstance;
  x: number;
  y: number;
}

export interface Appearance {
  body: string; // 'male' | 'female' | 'female_dark'
  head: string; // head sprite id
  skinTone: Color;
  hairColor: Color;
  armorTint: Color;
}

export type QuestStatus = 'available' | 'active' | 'complete' | 'turnedIn';

export interface CharacterState {
  id: string;
  name: string;
  classId: ClassId;
  appearance: Appearance;
  level: number;
  xp: number;
  paragonLevel: number;
  paragonXp: number;
  paragonAlloc: Record<string, number>;
  gold: number;
  materials: Record<MaterialId, number>;
  inventory: InventoryEntry[];
  equipment: Partial<Record<EquipSlot, ItemInstance>>;
  skillRanks: Record<string, number>;
  runes: Record<string, string>;
  passiveRanks: Record<string, number>;
  /** Bonus skill points from quests. */
  bonusSkillPoints: number;
  hotbar: Record<HotbarSlot, string | null>;
  potions: number;
  potionMax: number;
  /** Unlocked waypoint keys 'zoneId:floor'. */
  waypoints: string[];
  quests: Record<string, { status: QuestStatus; progress: number }>;
  difficulty: DifficultyId;
  bossesKilled: Record<string, number>;
  riftsCompleted: number;
  greaterRiftHighest: number;
  riftKeys: number;
  location: { zoneId: string; floor: number };
  stats: {
    kills: number;
    eliteKills: number;
    deaths: number;
    playTime: number;
    legendariesFound: number;
    goldEarned: number;
  };
  createdAt: number;
  updatedAt: number;
}

export const INVENTORY_W = 10;
export const INVENTORY_H = 6;
export const STASH_W = 10;
export const STASH_H = 10;
export const STASH_TABS = 4;

export interface StashState {
  tabs: InventoryEntry[][];
}

export interface Settings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  uiVolume: number;
  screenShake: number; // 0..1
  /** Interface size multiplier (0.8..1.5). */
  uiScale: number;
  hitStop: boolean;
  damageNumbers: boolean;
  bloom: boolean;
  vignette: boolean;
  lightingQuality: 'low' | 'high';
  showFps: boolean;
  wasdMovement: boolean;
  alwaysShowItemLabels: boolean;
  autoPickupGold: boolean;
  keybinds: Record<string, string>;
}

export interface SaveFile {
  version: number;
  characters: CharacterState[];
  stash: StashState;
  settings: Settings;
  lastCharacterId: string | null;
  meta: { createdAt: number; updatedAt: number };
}
