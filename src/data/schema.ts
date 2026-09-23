// =============================================================================
// DATA SCHEMA — every piece of game content (classes, skills, enemies, items,
// affixes, drop tables, zones...) is described by these types and lives in
// src/data/*.ts as plain data. Game logic reads data; it never hardcodes content.
// Owner: architecture. Additive changes are OK (add optional fields); do not
// rename/remove fields without updating every consumer.
// =============================================================================

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

export type ClassId = 'berserker' | 'arcanist' | 'stalker' | 'bonemancer';
export const CLASS_IDS: readonly ClassId[] = ['berserker', 'arcanist', 'stalker', 'bonemancer'];

export type ResourceKind = 'fury' | 'mana' | 'energy' | 'essence';

export type DamageType = 'physical' | 'fire' | 'cold' | 'lightning' | 'poison' | 'arcane';
export const DAMAGE_TYPES: readonly DamageType[] = ['physical', 'fire', 'cold', 'lightning', 'poison', 'arcane'];

export type PrimaryAttr = 'str' | 'dex' | 'int';

/** Equipment slots on the paper doll. */
export type EquipSlot =
  | 'head'
  | 'amulet'
  | 'chest'
  | 'hands'
  | 'belt'
  | 'legs'
  | 'feet'
  | 'ring1'
  | 'ring2'
  | 'mainhand'
  | 'offhand';
export const EQUIP_SLOTS: readonly EquipSlot[] = [
  'head',
  'amulet',
  'chest',
  'hands',
  'belt',
  'legs',
  'feet',
  'ring1',
  'ring2',
  'mainhand',
  'offhand',
];

/** Which slot family an item base fits into (a 'ring' fits ring1 or ring2). */
export type ItemSlotType = 'head' | 'amulet' | 'chest' | 'hands' | 'belt' | 'legs' | 'feet' | 'ring' | 'mainhand' | 'offhand';

export type Rarity = 'common' | 'magic' | 'rare' | 'legendary' | 'set';
export const RARITIES: readonly Rarity[] = ['common', 'magic', 'rare', 'legendary', 'set'];

export type WeaponType =
  | 'sword'
  | 'axe'
  | 'mace'
  | 'dagger'
  | 'greatsword'
  | 'greataxe'
  | 'maul'
  | 'staff'
  | 'wand'
  | 'rod'
  | 'bow'
  | 'greatbow'
  | 'slingshot';

export type OffhandType = 'shield' | 'orb' | 'quiver' | 'grimoire';

/** Visual layers of the Flare-style layered avatar (see docs/research/flare-characters.md). */
export type AvatarLayer = 'feet' | 'legs' | 'chest' | 'hands' | 'head' | 'mainhand' | 'offhand';

/** Avatar animation names available on Flare hero sheets. */
export type AvatarAnim = 'stance' | 'run' | 'swing' | 'cast' | 'shoot' | 'block' | 'hit' | 'die';

export type DifficultyId = 'normal' | 'nightmare' | 'torment1' | 'torment2' | 'torment3' | 'torment4' | 'torment5';

export type BiomeId = 'town' | 'crypt' | 'cave' | 'forest' | 'hell';

export type MonsterRank = 'normal' | 'champion' | 'rare' | 'minion' | 'unique' | 'boss' | 'guardian';

/** Material tiers produced by salvaging (by rarity). */
export type MaterialId = 'scrap' | 'arcaneDust' | 'veiledCrystal' | 'forgottenSoul' | 'riftShard';

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

/**
 * All numeric character/monster stats. PERCENTAGE STATS ARE STORED AS FRACTIONS
 * (0.05 = 5%). Flat stats are plain numbers.
 */
export const STAT_KEYS = [
  // attributes
  'str',
  'dex',
  'int',
  'vit',
  // life
  'maxLife', // flat bonus life
  'lifePct', // % bonus life
  'lifeRegen', // life per second
  'lifeOnHit', // flat life per hit
  'lifePerKill', // flat life per kill
  'lifeSteal', // fraction of damage dealt
  // resource
  'maxResource',
  'resourceRegen', // per second (flat)
  'resourceCostReduction', // fraction
  'resourceOnHit', // flat
  // defense
  'armor',
  'armorPct',
  'allRes',
  'resPhysical',
  'resFire',
  'resCold',
  'resLightning',
  'resPoison',
  'resArcane',
  'damageReduction', // generic fraction, multiplicative with others
  'eliteDamageReduction',
  'meleeDamageReduction',
  'rangedDamageReduction',
  'blockChance',
  'blockAmount', // flat damage blocked
  'dodgeChance',
  'thorns', // flat damage reflected to melee attackers
  'ccReduction', // fraction reduction of stun/freeze/slow durations
  // offense
  'critChance',
  'critDamage',
  'attackSpeed', // fraction bonus
  'cooldownReduction', // fraction
  'damagePct', // generic damage bonus fraction
  'minDamage', // flat added to weapon min
  'maxDamage', // flat added to weapon max
  'dmgPhysical',
  'dmgFire',
  'dmgCold',
  'dmgLightning',
  'dmgPoison',
  'dmgArcane',
  'eliteDamage',
  'bossDamage',
  'areaDamage', // chance-free splash bonus fraction (D3 style simplified to bonus vs AoE skills)
  'summonDamage',
  'summonLife',
  'knockbackPower',
  // utility
  'moveSpeed', // fraction
  'goldFind',
  'magicFind',
  'pickupRadius', // tiles
  'xpBonus',
  'potionHeal', // fraction bonus to potion healing
  'globeHeal', // fraction bonus to health globes
] as const;

export type StatKey = (typeof STAT_KEYS)[number];

/** Final or partial stat block. Missing keys are treated as 0. */
export type StatBlock = Record<StatKey, number>;
export type PartialStats = Partial<Record<StatKey, number>>;

/** Maps each damage type to its % damage bonus stat and resistance stat. */
export const DAMAGE_TYPE_STATS: Record<DamageType, { bonus: StatKey; res: StatKey }> = {
  physical: { bonus: 'dmgPhysical', res: 'resPhysical' },
  fire: { bonus: 'dmgFire', res: 'resFire' },
  cold: { bonus: 'dmgCold', res: 'resCold' },
  lightning: { bonus: 'dmgLightning', res: 'resLightning' },
  poison: { bonus: 'dmgPoison', res: 'resPoison' },
  arcane: { bonus: 'dmgArcane', res: 'resArcane' },
};

// ---------------------------------------------------------------------------
// Visual references
// ---------------------------------------------------------------------------

/**
 * Reference to an icon in the icon atlas produced by the asset pipeline
 * (public/assets/icons). Either a numeric Flare icon index or a named icon id
 * registered in the icon manifest.
 */
export type IconRef = number | string;

/** Color as 0xRRGGBB number. */
export type Color = number;

export interface SpriteRef {
  /** Sprite sheet id in the asset manifest (e.g. 'enemy/skeleton', 'fx/fireball'). */
  sheet: string;
  scale?: number;
  tint?: Color;
  /** Optional hue shift in degrees applied by a ColorMatrix filter. */
  hue?: number;
  /** Extra brightness multiplier (1 = none). */
  brightness?: number;
  /** Render with additive blend (spell effects). */
  additive?: boolean;
  alpha?: number;
}

/** Particle preset id (implemented in src/render/fx/particlePresets.ts). */
export type ParticlePresetId = string;
/** Sound effect id (declared in src/data/audio.ts). */
export type SfxId = string;
/** Music track id (declared in src/data/audio.ts). */
export type MusicId = string;

export interface LightDef {
  radius: number; // tiles
  color: Color;
  intensity: number; // 0..~2
  flicker?: number; // 0..1 amplitude
}

// ---------------------------------------------------------------------------
// Classes, skills, runes, passives
// ---------------------------------------------------------------------------

export interface ResourceDef {
  kind: ResourceKind;
  name: string; // pt-BR, e.g. 'Fúria'
  color: Color; // orb color
  colorDark: Color;
  baseMax: number;
  /** Per-second regeneration (negative for decay, e.g. fury decays out of combat). */
  regen: number;
  /** If set, regen only applies after this many seconds out of combat (fury decay). */
  outOfCombatDelay?: number;
  /** Start value when entering a zone: 'full' (mana/energy) or 'empty' (fury). */
  startFull: boolean;
}

export type SkillCategory = 'primary' | 'secondary' | 'defensive' | 'mobility' | 'summon' | 'utility' | 'ultimate';

export type SkillTargeting =
  | 'melee' // swing at target/cursor within weapon reach (moves into range first)
  | 'direction' // fires toward cursor (projectiles, beams)
  | 'point' // targets ground point (AoE, leap, teleport) within range
  | 'self' // centered on caster (novas, buffs, shouts)
  | 'target'; // requires an enemy under cursor (moves into range)

export interface RuneDef {
  id: string; // unique within the skill, e.g. 'a', 'b', 'c'
  name: string; // pt-BR
  description: string; // pt-BR, may contain {param} placeholders
  /** Skill rank required to select this rune. */
  unlockRank: number;
  /** Overrides / additions to SkillDef.params when this rune is active. */
  params?: Record<string, number>;
  /** Overrides the damage type. */
  damageType?: DamageType;
  /** Optional tint for vfx when this rune is active. */
  tint?: Color;
}

export interface SkillDef {
  id: string; // globally unique, e.g. 'berserker.cleave'
  classId: ClassId;
  name: string; // pt-BR
  /** pt-BR description; placeholders {dmg} (weapon damage % at current rank), {param} for any params key. */
  description: string;
  icon: IconRef;
  category: SkillCategory;
  tags: string[]; // e.g. ['melee', 'aoe', 'physical', 'generator']
  /** Hotbar slot suggestion when auto-assigning. */
  defaultSlot?: HotbarSlot;
  /** Required character level to invest the first point. */
  unlockLevel: number;
  maxRank: number; // usually 5
  targeting: SkillTargeting;
  /** Max cast range in tiles (melee: reach). */
  range: number;
  damageType: DamageType;
  /** Weapon damage coefficient at rank 1 (1.5 = 150% weapon damage). 0 for non-damaging skills. */
  damage: number;
  /** Added to `damage` per extra rank. */
  damagePerRank: number;
  cost?: number; // resource spent
  generate?: number; // resource generated (per cast or per hit, see params.generateOnHit)
  cooldown?: number; // seconds
  charges?: number;
  /** Animation to play on the caster. */
  anim: AvatarAnim;
  /** Time (s) from cast start to the moment the effect happens (scaled by attack speed). */
  castTime: number;
  /** Channelled skills keep casting while the button is held (costs per second). */
  channel?: boolean;
  /** Can the caster move while casting/channeling? */
  movingCast?: boolean;
  /** Free-form tunables used by the skill implementation (radius, projectiles, duration, ...). */
  params: Record<string, number>;
  runes: RuneDef[];
  sfx?: { cast?: SfxId; hit?: SfxId };
  vfx?: { cast?: string; projectile?: string; impact?: string; tint?: Color };
}

export type HotbarSlot = 'lmb' | 'rmb' | 'k1' | 'k2' | 'k3' | 'k4';
export const HOTBAR_SLOTS: readonly HotbarSlot[] = ['lmb', 'rmb', 'k1', 'k2', 'k3', 'k4'];

export interface PassiveDef {
  id: string; // e.g. 'berserker.bloodlust'
  classId: ClassId;
  name: string;
  description: string; // pt-BR with {v} placeholder for per-rank value
  icon: IconRef;
  maxRank: number;
  /** Tree tier: tiers unlock after N points spent in the class tree (see ClassDef.treeTiers). */
  tier: number;
  /** Stats granted per rank. */
  statsPerRank?: PartialStats;
  /** Special behaviour implemented in code (src/game/skills/passives.ts). */
  powerId?: string;
  powerValuePerRank?: number;
  /** Other node ids that must have at least 1 rank. */
  requires?: string[];
}

export interface ClassDef {
  id: ClassId;
  name: string; // pt-BR original class name
  title: string; // short tagline
  description: string;
  mainStat: PrimaryAttr;
  resource: ResourceDef;
  /** Base attributes at level 1 and gained per level. */
  baseAttributes: Record<'str' | 'dex' | 'int' | 'vit', number>;
  attributesPerLevel: Record<'str' | 'dex' | 'int' | 'vit', number>;
  baseLife: number;
  lifePerLevel: number;
  /** Base move speed in tiles/second. */
  moveSpeed: number;
  skills: string[]; // SkillDef ids, in tree order
  passives: string[]; // PassiveDef ids
  /** Points spent required to unlock each tier index (tier 0 = 0). */
  treeTiers: number[];
  startingItems: { baseId: string; rarity?: Rarity }[];
  startingSkills: { skillId: string; slot: HotbarSlot }[];
  /** Weapon types this class prefers (smart loot bias, starting gear). */
  preferredWeapons: WeaponType[];
  preferredOffhand?: OffhandType;
  appearance: ClassAppearanceDef;
  color: Color; // UI accent
  icon: IconRef;
}

export interface ClassAppearanceDef {
  /** Allowed avatar body sets (Flare: 'male', 'female', 'female_dark'). */
  bodies: string[];
  /** Head sprites per body set. */
  heads: Record<string, string[]>;
  /** Default layer sprite per layer when nothing is equipped (class look). */
  defaultLayers: Partial<Record<AvatarLayer, string>>;
  armorTints: Color[];
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

export interface ItemBaseDef {
  id: string;
  name: string; // pt-BR, e.g. 'Espada Longa'
  slot: ItemSlotType;
  category: 'weapon' | 'offhand' | 'armor' | 'jewelry';
  weaponType?: WeaponType;
  offhandType?: OffhandType;
  twoHanded?: boolean;
  /** Restrict to classes (undefined = any class). */
  classes?: ClassId[];
  /** Grid size in inventory cells [w, h]. */
  size: [number, number];
  icon: IconRef;
  /** Ground loot sprite id (asset manifest), optional. */
  groundSprite?: string;
  /** Layered avatar visual when equipped. */
  visual?: { layer: AvatarLayer; sprite: string };
  /** Earliest item level it can drop. */
  minLevel: number;
  /** Weapon base damage at ilvl 1 [min, max]; scaled by formulas.itemScale(ilvl). */
  damage?: [number, number];
  attacksPerSecond?: number;
  /** Armor value at ilvl 1; scaled by formulas.itemScale(ilvl). */
  armor?: number;
  /** Implicit stats rolled on every copy (e.g. shields: block chance). Values at ilvl 1 + per level. */
  implicits?: { stat: StatKey; base: [number, number]; perLevel?: [number, number] }[];
  /** Relative drop weight among bases. */
  weight: number;
}

export interface AffixDef {
  id: string;
  kind: 'prefix' | 'suffix';
  /** Only one affix of a given group per item. */
  group: string;
  stat: StatKey | 'skillRank' | 'skillDamage';
  /** For skillRank / skillDamage affixes: restrict to a class; the skill is picked at roll time. */
  classId?: ClassId;
  /** pt-BR template: {v} value, {skill} skill name. e.g. '+{v} de Força', '+{v}% de Dano de Fogo'. */
  text: string;
  /** How {v} is formatted. 'pct' multiplies by 100. */
  format: 'int' | 'dec1' | 'pct' | 'pct1';
  /** Value range at ilvl 1. */
  base: [number, number];
  /** Added to range per item level above 1. */
  perLevel: [number, number];
  slots: ItemSlotType[] | 'all';
  weight: number;
  minLevel: number;
  /** Magic item name part: prefix -> adjective, suffix -> 'do/da ...'. */
  magicName: string;
  tag: 'primary' | 'offense' | 'defense' | 'utility';
}

export interface LegendaryDef {
  id: string;
  name: string; // unique item name, pt-BR
  baseId: string;
  classId?: ClassId;
  flavor: string; // lore line in italics
  /** Power implemented in src/game/items/powers/*.ts keyed by id. */
  powerId: string;
  /** pt-BR description with {v}. */
  powerText: string;
  powerRange: [number, number];
  powerFormat: 'int' | 'dec1' | 'pct' | 'pct1';
  /** Always-present affixes (value rolled normally unless given). */
  fixedAffixes?: { affixId: string; value?: number }[];
  /** Additional random affixes. */
  randomAffixes: number;
  minLevel: number;
  weight: number;
}

export interface SetDef {
  id: string;
  name: string;
  classId?: ClassId;
  pieces: { id: string; baseId: string; name: string; fixedAffixes?: { affixId: string; value?: number }[] }[];
  bonuses: { pieces: number; text: string; stats?: PartialStats; powerId?: string; powerValue?: number }[];
  minLevel: number;
  weight: number;
}

export interface RarityDef {
  id: Rarity;
  name: string; // pt-BR label
  color: Color;
  cssColor: string;
  affixCount: [number, number];
  /** Salvage output. */
  salvage: { material: MaterialId; amount: [number, number] }[];
  sellMult: number;
  /** Ground beam & drop celebration settings. */
  beam: { color: Color; height: number; intensity: number } | null;
  dropSfx: SfxId;
}

export interface MaterialDef {
  id: MaterialId;
  name: string;
  icon: IconRef;
  color: Color;
}

export interface ConsumableDef {
  id: string; // 'potion_health', 'scroll_portal', ...
  name: string;
  icon: IconRef;
  stack: number;
  price: number;
}

// ---------------------------------------------------------------------------
// Monsters
// ---------------------------------------------------------------------------

export type EnemyArchetype =
  | 'swarm'
  | 'archer'
  | 'caster'
  | 'tank'
  | 'exploder'
  | 'summoner'
  | 'charger'
  | 'kiter'
  | 'boss';

export type StatusId =
  | 'slow'
  | 'chill'
  | 'freeze'
  | 'stun'
  | 'burn'
  | 'poison'
  | 'bleed'
  | 'shock'
  | 'fear'
  | 'vulnerable'
  | 'weaken'
  | 'root'
  | 'haste'
  | 'fortify'
  | 'shielded'
  | 'invulnerable'
  | 'berserk'
  | 'stealth';

export interface ProjectileSpec {
  /** Sprite/fx id from the asset manifest (e.g. 'fx/fireball', 'fx/arrow'). */
  visual: string;
  speed: number; // tiles/s
  radius: number; // collision radius, tiles
  range: number; // max travel distance
  count?: number;
  spreadDeg?: number;
  pierce?: number; // extra targets
  homing?: number; // turn rate rad/s
  gravityArc?: boolean; // lobbed (mortar) — lands at target point
  explodeRadius?: number;
  light?: LightDef;
  trail?: ParticlePresetId;
  impactFx?: string;
  impactParticles?: ParticlePresetId;
}

export interface AoeSpec {
  shape: 'circle' | 'cone' | 'line' | 'ring';
  radius: number;
  arcDeg?: number;
  length?: number;
  width?: number;
  /** Ground damage-over-time zone duration (0 = instant). */
  duration?: number;
  tickInterval?: number;
}

export interface EnemyAbilityDef {
  id: string;
  kind: 'melee' | 'projectile' | 'aoe' | 'charge' | 'leap' | 'summon' | 'explode' | 'nova' | 'beam' | 'buff' | 'teleport';
  /** Multiplier on the monster's base damage. */
  damageMult: number;
  damageType: DamageType;
  range: number;
  cooldown: number;
  /** Telegraph/wind-up time before the hit lands (seconds). */
  windup: number;
  /** Time after the hit before the monster can act again. */
  recovery: number;
  anim: string;
  projectile?: ProjectileSpec;
  aoe?: AoeSpec;
  summon?: { enemyId: string; count: number; maxAlive: number };
  status?: { id: StatusId; duration: number; magnitude: number };
  /** Draw a ground telegraph during windup. */
  telegraph?: boolean;
  /** Selection weight when several abilities are ready. */
  weight?: number;
  /** Only use when target is at least this far (e.g. charges). */
  minRange?: number;
  sfx?: SfxId;
}

export interface EnemyDef {
  id: string;
  name: string; // pt-BR
  /** Sprite sheet id in the asset manifest (e.g. 'enemy/skeleton'). */
  sprite: SpriteRef;
  archetype: EnemyArchetype;
  /** AI behaviour id (src/game/ai/behaviors). */
  ai: string;
  lifeMult: number; // x monsterBaseLife(level)
  damageMult: number; // x monsterBaseDamage(level)
  armorMult?: number;
  speed: number; // tiles/s
  radius: number; // tiles
  mass: number; // knockback resistance (1 = normal)
  xpMult: number;
  aggroRange: number;
  /** Preferred engagement distance (kiters/archers keep this distance). */
  preferredRange?: number;
  abilities: EnemyAbilityDef[];
  resist?: Partial<Record<DamageType, number>>;
  flags?: { undead?: boolean; demon?: boolean; beast?: boolean; flying?: boolean; noKnockback?: boolean; noCorpse?: boolean };
  bloodColor?: Color;
  deathParticles?: ParticlePresetId;
  sounds?: { aggro?: SfxId; attack?: SfxId; hit?: SfxId; die?: SfxId };
  light?: LightDef;
  /** Minimum area level to appear. */
  minLevel?: number;
}

export interface BossPhaseDef {
  /** Phase begins when life fraction drops to or below this value (first phase = 1). */
  lifeBelow: number;
  abilities: string[]; // ability ids from the boss EnemyDef.abilities
  speedMult?: number;
  damageMult?: number;
  /** Banner text shown when the phase starts. */
  announce?: string;
  /** Adds spawned at phase start. */
  adds?: { enemyId: string; count: number };
  /** Become invulnerable during a transition (seconds). */
  transitionTime?: number;
}

export interface BossDef extends EnemyDef {
  title: string; // e.g. 'Rei das Criptas'
  phases: BossPhaseDef[];
  music?: MusicId;
  /** Guaranteed loot. */
  loot: { legendaryChance: number; minRares: number; gold: [number, number] };
}

export interface EliteModDef {
  id: string;
  name: string; // pt-BR shown under elite name, e.g. 'Rápido', 'Vampírico'
  description: string;
  color: Color;
  /** Multipliers applied at spawn. */
  lifeMult?: number;
  damageMult?: number;
  speedMult?: number;
  /** Implemented in src/game/monsters/eliteMods.ts by id. */
  incompatible?: string[];
  minLevel?: number;
  weight: number;
}

// ---------------------------------------------------------------------------
// World
// ---------------------------------------------------------------------------

export interface BiomeDef {
  id: BiomeId;
  name: string;
  /** Tileset id in the asset manifest. */
  tileset: string;
  generator: 'town' | 'rooms' | 'cave' | 'forest' | 'hell';
  /** Tint applied to tiles (ColorMatrix/tint). */
  tint?: Color;
  hue?: number;
  /** Darkness color & amount for the lighting pass. */
  ambient: { color: Color; darkness: number };
  playerLight: LightDef;
  fog?: { color: Color; density: number };
  music: MusicId;
  ambientSfx?: SfxId;
  /** Ambient particles (dust motes, embers, spores...). */
  ambientParticles?: ParticlePresetId;
  traps: string[]; // TrapDef ids
}

export interface ZoneDef {
  id: string;
  name: string; // pt-BR
  biome: BiomeId;
  kind: 'town' | 'dungeon';
  /** Number of floors (levels) in this zone. */
  floors: number;
  /** Area level of floor 1 on Normal; each floor adds `levelPerFloor`. */
  baseLevel: number;
  levelPerFloor: number;
  /** Floors (1-based) that have a waypoint. */
  waypointFloors: number[];
  monsters: { enemyId: string; weight: number }[];
  /** Packs per 100 walkable tiles. */
  density: number;
  /** Chance a pack is champion / rare elite. */
  championChance: number;
  rareChance: number;
  /** Boss on the last floor (arena). */
  bossId?: string;
  /** Unique named mini-boss on some floor. */
  unique?: { enemyId: string; name: string; floor: number };
  /** Zone unlocked after defeating this zone's boss / clearing. */
  next?: string;
  /** Map size in tiles (w, h) — generator hint. */
  size: [number, number];
  chestsPerFloor: [number, number];
  shrinesPerFloor: [number, number];
}

export interface TrapDef {
  id: string;
  name: string;
  kind: 'spikes' | 'fire_jet' | 'poison_vent' | 'arrow_wall' | 'explosive_barrel';
  damageMult: number;
  damageType: DamageType;
  cycle: number; // seconds between activations
  activeTime: number;
  radius: number;
  sprite?: string;
}

export interface ShrineDef {
  id: string;
  name: string; // e.g. 'Santuário da Fúria'
  description: string;
  duration: number;
  stats?: PartialStats;
  powerId?: string; // special (e.g. 'conduit' lightning, 'frenzy')
  color: Color;
  weight: number;
}

// ---------------------------------------------------------------------------
// Difficulty & progression
// ---------------------------------------------------------------------------

export interface DifficultyDef {
  id: DifficultyId;
  name: string; // 'Normal', 'Pesadelo', 'Tormento I' ...
  order: number;
  requiredLevel: number;
  lifeMult: number;
  damageMult: number;
  xpBonus: number; // fraction
  goldBonus: number;
  magicFindBonus: number;
  legendaryChanceMult: number;
  /** Monster level: Normal uses area level; others use max(areaLevel + levelOffset, playerLevel) when scaleToPlayer. */
  levelOffset: number;
  scaleToPlayer: boolean;
  color: Color;
}

export interface ProgressionDef {
  maxLevel: number; // 50
  /** XP required to go from level L to L+1 is xpTable[L-1]. Generated by formulas.xp. */
  xpTable: number[];
  paragonXpBase: number;
  paragonXpGrowth: number;
  skillPointsPerLevel: number;
  paragonPointsPerLevel: number;
}

export interface ParagonNodeDef {
  id: string;
  category: 'core' | 'offense' | 'defense' | 'utility';
  name: string;
  stat: StatKey | 'mainStat';
  perPoint: number;
  maxPoints: number; // 0 = unlimited
  format: 'int' | 'dec1' | 'pct' | 'pct1';
}

// ---------------------------------------------------------------------------
// Loot tables
// ---------------------------------------------------------------------------

export interface DropProfileDef {
  /** Keyed by MonsterRank. */
  rank: MonsterRank;
  /** Chance to drop any item at all, and number of rolls. */
  itemRolls: number;
  itemChance: number;
  /** Relative rarity weights before magic-find/difficulty adjustments. */
  rarityWeights: Record<Rarity, number>;
  goldChance: number;
  goldMult: number;
  potionChance: number;
  globeChance: number;
  materialChance: number;
}

// ---------------------------------------------------------------------------
// NPCs & quests
// ---------------------------------------------------------------------------

export type NpcRole = 'blacksmith' | 'merchant' | 'questgiver' | 'stash' | 'healer' | 'riftkeeper' | 'ambient';

export interface NpcDef {
  id: string;
  name: string;
  title: string;
  role: NpcRole;
  sprite: SpriteRef;
  greeting: string[];
  idleLines?: string[];
  portrait?: string;
}

export interface QuestDef {
  id: string;
  name: string;
  giver: string; // NpcDef id
  description: string;
  objective:
    | { kind: 'kill'; enemyId?: string; rank?: MonsterRank; count: number; zoneId?: string }
    | { kind: 'reachFloor'; zoneId: string; floor: number }
    | { kind: 'killBoss'; bossId: string }
    | { kind: 'clearRift'; count: number }
    | { kind: 'collect'; itemTag: string; count: number };
  reward: { xp: number; gold: number; item?: { rarity: Rarity; slot?: ItemSlotType }; skillPoint?: boolean };
  requires?: string[];
  /** Dialogue lines on accept / completion. */
  acceptText: string;
  completeText: string;
}

// ---------------------------------------------------------------------------
// Rifts
// ---------------------------------------------------------------------------

export interface RiftDef {
  /** Seconds allowed for greater rifts. */
  timeLimit: number;
  /** Progress contributed (fraction of bar) by monster rank. */
  progressByRank: Record<MonsterRank, number>;
  guardians: string[]; // BossDef ids
  /** Per greater-rift level: life/damage multiplier growth. */
  levelScaling: { life: number; damage: number };
  biomes: BiomeId[];
  floorsNormal: number;
}
