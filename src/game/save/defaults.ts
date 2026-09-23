// Defaults: settings, new characters, empty save.
import { Data } from '../../data';
import type { ClassId } from '../../data/schema';
import { STASH_TABS, type Appearance, type CharacterState, type SaveFile, type Settings, type StashState } from '../types';

export const SAVE_VERSION = 1;

export const defaultSettings = (): Settings => ({
  masterVolume: 0.8,
  musicVolume: 0.55,
  sfxVolume: 0.8,
  uiVolume: 0.7,
  screenShake: 1,
  hitStop: true,
  damageNumbers: true,
  bloom: true,
  vignette: true,
  lightingQuality: 'high',
  showFps: false,
  wasdMovement: false,
  alwaysShowItemLabels: false,
  autoPickupGold: true,
  keybinds: {},
});

export const emptyStash = (): StashState => ({ tabs: Array.from({ length: STASH_TABS }, () => []) });

export const emptySave = (): SaveFile => ({
  version: SAVE_VERSION,
  characters: [],
  stash: emptyStash(),
  settings: defaultSettings(),
  lastCharacterId: null,
  meta: { createdAt: Date.now(), updatedAt: Date.now() },
});

/** Item factory hook (set by the items module) used to build starting gear. */
let starterItemFactory: ((baseId: string, classId: ClassId) => CharacterState['inventory'][number]['item'] | null) | null = null;
export const setStarterItemFactory = (fn: typeof starterItemFactory): void => {
  starterItemFactory = fn;
};

export function newCharacter(classId: ClassId, name: string, appearance: Appearance): CharacterState {
  const cls = Data.classDef(classId);
  const now = Date.now();
  const c: CharacterState = {
    id: `c${now.toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`,
    name,
    classId,
    appearance,
    level: 1,
    xp: 0,
    paragonLevel: 0,
    paragonXp: 0,
    paragonAlloc: {},
    gold: 0,
    materials: { scrap: 0, arcaneDust: 0, veiledCrystal: 0, forgottenSoul: 0, riftShard: 0 },
    inventory: [],
    equipment: {},
    skillRanks: {},
    runes: {},
    passiveRanks: {},
    bonusSkillPoints: 0,
    hotbar: { lmb: null, rmb: null, k1: null, k2: null, k3: null, k4: null },
    potions: 5,
    potionMax: 5,
    waypoints: ['town:1'],
    quests: {},
    difficulty: 'normal',
    bossesKilled: {},
    riftsCompleted: 0,
    greaterRiftHighest: 0,
    riftKeys: 0,
    location: { zoneId: 'town', floor: 1 },
    stats: { kills: 0, eliteKills: 0, deaths: 0, playTime: 0, legendariesFound: 0, goldEarned: 0 },
    createdAt: now,
    updatedAt: now,
  };
  for (const s of cls.startingSkills) {
    if (Data.trySkill(s.skillId)) {
      c.skillRanks[s.skillId] = 1;
      c.hotbar[s.slot] = s.skillId;
    }
  }
  if (starterItemFactory) {
    for (const it of cls.startingItems) {
      const item = starterItemFactory(it.baseId, classId);
      if (!item) continue;
      const base = Data.tryItemBase(it.baseId);
      if (!base) continue;
      const slot = base.slot === 'ring' ? 'ring1' : base.slot;
      if (!c.equipment[slot]) c.equipment[slot] = item;
    }
  }
  return c;
}

export function defaultAppearance(classId: ClassId): Appearance {
  const cls = Data.classDef(classId);
  const body = cls.appearance.bodies[0];
  return { body, head: cls.appearance.heads[body][0], skinTone: 0xffffff, hairColor: 0x4a3020, armorTint: 0xffffff };
}
