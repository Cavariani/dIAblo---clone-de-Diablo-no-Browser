// Item generation: base selection (smart loot), rarity, affixes, legendary powers, set pieces, names.
import type { Rng } from '../../core/rng';
import { Data } from '../../data';
import { RARE_ITEM_NAME_A, RARE_ITEM_NAME_B } from '../../data/items/names';
import type { AffixDef, ClassId, DropProfileDef, ItemBaseDef, Rarity } from '../../data/schema';
import { effectiveMagicFind, requiredLevel, rollAffixValue } from '../../formulas/affixes';
import { itemScale } from '../../formulas/scaling';
import { setStarterItemFactory } from '../save/defaults';
import type { ItemInstance, RolledAffix } from '../types';

let uidCounter = 0;
export const newUid = (): string => `i${Date.now().toString(36)}${(uidCounter++).toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;

export function baseFits(base: ItemBaseDef, classId?: ClassId): boolean {
  return !base.classes || !classId || base.classes.includes(classId);
}

/** Picks a base for ilvl; with smart loot the class-appropriate bases are favoured. */
export function pickBase(rng: Rng, ilvl: number, classId?: ClassId, smart = 0.7): ItemBaseDef {
  const cls = classId ? Data.classDef(classId) : undefined;
  const pool = Data.itemBases.filter((b) => b.minLevel <= ilvl);
  const useSmart = cls && rng.chance(smart);
  return (
    rng.weighted(pool, (b) => {
      let w = b.weight * (b.minLevel >= ilvl - 12 ? 1.6 : 0.6); // prefer recent tiers
      if (useSmart) {
        if (!baseFits(b, classId)) return 0;
        if (b.category === 'weapon' && b.weaponType && !cls!.preferredWeapons.includes(b.weaponType)) w *= 0.15;
        if (b.category === 'offhand' && b.offhandType !== cls!.preferredOffhand) return 0;
      }
      return w;
    }) ?? pool[0]
  );
}

export function rollRarity(rng: Rng, profile: DropProfileDef, magicFind: number, legendaryMult: number): Rarity {
  const mf = effectiveMagicFind(magicFind);
  const w = profile.rarityWeights;
  const table: [Rarity, number][] = [
    ['common', w.common / (1 + mf)],
    ['magic', w.magic * (1 + mf * 0.5)],
    ['rare', w.rare * (1 + mf)],
    ['legendary', w.legendary * (1 + mf) * legendaryMult],
    ['set', w.set * (1 + mf) * legendaryMult],
  ];
  return rng.weighted(table, (t) => t[1])![0];
}

function affixPool(base: ItemBaseDef, classId?: ClassId): AffixDef[] {
  return Data.affixes.filter((a) => (a.slots === 'all' || a.slots.includes(base.slot)) && (!a.classId || !classId || a.classId === classId));
}

function rollAffixes(rng: Rng, base: ItemBaseDef, ilvl: number, count: number, classId?: ClassId, ancestral = false, exclude: string[] = []): RolledAffix[] {
  const pool = affixPool(base, classId).filter((a) => a.minLevel <= ilvl);
  const out: RolledAffix[] = [];
  const groups = new Set<string>(exclude.map((id) => Data.tryAffix(id)?.group ?? id));
  let prefixes = 0;
  let suffixes = 0;
  for (let i = 0; i < count; i++) {
    const def = rng.weighted(pool, (a) => {
      if (groups.has(a.group)) return 0;
      if (count <= 2 && ((a.kind === 'prefix' && prefixes >= 1) || (a.kind === 'suffix' && suffixes >= 1))) return 0;
      return a.weight;
    });
    if (!def) break;
    groups.add(def.group);
    if (def.kind === 'prefix') prefixes++;
    else suffixes++;
    out.push(rollOne(rng, def, ilvl, classId, ancestral));
  }
  return out;
}

export function rollOne(rng: Rng, def: AffixDef, ilvl: number, classId?: ClassId, ancestral = false): RolledAffix {
  const r = rollAffixValue(def, ilvl, rng.next(), ancestral);
  const a: RolledAffix = { id: def.id, value: r.value, min: r.min, max: r.max };
  if (def.stat === 'skillRank' || def.stat === 'skillDamage') {
    const cls = def.classId ?? classId ?? 'berserker';
    const skills = Data.skillsOf(cls);
    a.skillId = skills.length ? rng.pick(skills).id : undefined;
    if (!a.skillId) a.value = 0;
  }
  return a;
}

function rollImplicits(rng: Rng, base: ItemBaseDef, ilvl: number): RolledAffix[] {
  return (base.implicits ?? []).map((im) => {
    const k = Math.max(0, ilvl - 1);
    const min = im.base[0] + (im.perLevel?.[0] ?? 0) * k;
    const max = im.base[1] + (im.perLevel?.[1] ?? 0) * k;
    const pct = im.stat.endsWith('Chance') || im.stat.startsWith('dmg') || im.stat === 'attackSpeed' || im.stat === 'summonDamage' || im.stat.endsWith('Pct');
    const v = min + (max - min) * rng.next();
    return { id: `implicit:${im.stat}`, value: pct ? Math.round(v * 1000) / 1000 : Math.round(v), min, max };
  });
}

function magicName(base: ItemBaseDef, affixes: RolledAffix[]): string {
  let name = base.name;
  const pre = affixes.map((a) => Data.tryAffix(a.id)).find((d) => d?.kind === 'prefix');
  const suf = affixes.map((a) => Data.tryAffix(a.id)).find((d) => d?.kind === 'suffix');
  if (pre) name = `${name} ${pre.magicName}`;
  if (suf) name = `${name} ${suf.magicName}`;
  return name;
}

export interface RollOpts {
  ilvl: number;
  rarity: Rarity;
  classId?: ClassId;
  baseId?: string;
  /** Legendary/set: force a specific one. */
  legendaryId?: string;
  setPieceId?: string;
}

export function createItem(rng: Rng, o: RollOpts): ItemInstance {
  let rarity = o.rarity;
  let base: ItemBaseDef | undefined = o.baseId ? Data.tryItemBase(o.baseId) : undefined;
  let legendaryId: string | undefined;
  let setPieceId: string | undefined;
  let setId: string | undefined;
  let name = '';
  // legendary / set selection picks the base
  if (rarity === 'legendary') {
    const pool = Data.legendaries.filter((l) => l.minLevel <= o.ilvl && (!l.classId || !o.classId || l.classId === o.classId || rng.chance(0.25)));
    const leg = o.legendaryId ? Data.legendary(o.legendaryId) : rng.weighted(pool, (l) => l.weight * (l.classId && l.classId === o.classId ? 2.5 : 1));
    if (leg) {
      legendaryId = leg.id;
      base = Data.itemBase(leg.baseId);
      name = leg.name;
    } else rarity = 'rare';
  } else if (rarity === 'set') {
    const sets = Data.sets.filter((s) => s.minLevel <= o.ilvl);
    const pieces = sets.flatMap((s) => s.pieces.map((p) => ({ s, p })));
    const pick = o.setPieceId ? pieces.find((x) => x.p.id === o.setPieceId) : rng.weighted(pieces, (x) => x.s.weight * (x.s.classId && x.s.classId === o.classId ? 3 : x.s.classId ? 0.4 : 1));
    if (pick) {
      setPieceId = pick.p.id;
      setId = pick.s.id;
      base = Data.itemBase(pick.p.baseId);
      name = pick.p.name;
    } else rarity = 'rare';
  }
  if (!base) base = pickBase(rng, o.ilvl, o.classId);
  const ilvl = Math.max(o.ilvl, base.minLevel);
  const ancestral = rarity === 'legendary' && rng.chance(0.1);
  const item: ItemInstance = {
    uid: newUid(),
    baseId: base.id,
    rarity,
    ilvl,
    reqLevel: requiredLevel(ilvl),
    name: base.name,
    implicits: rollImplicits(rng, base, ilvl),
    affixes: [],
    upgradeLevel: 0,
    isNew: true,
  };
  const scale = itemScale(ilvl) * (ancestral ? 1.3 : 1);
  if (base.damage) {
    const q = 0.9 + rng.next() * 0.2;
    item.damage = [Math.max(1, Math.round(base.damage[0] * scale * q)), Math.max(2, Math.round(base.damage[1] * scale * q))];
    if (item.damage[1] <= item.damage[0]) item.damage[1] = item.damage[0] + 1;
    item.attacksPerSecond = base.attacksPerSecond;
  }
  if (base.armor) item.armor = Math.round(base.armor * scale * (0.9 + rng.next() * 0.2));
  const count = rng.int(Data.rarity(rarity).affixCount[0], Data.rarity(rarity).affixCount[1]);
  if (legendaryId) {
    const leg = Data.legendary(legendaryId);
    const fixed = (leg.fixedAffixes ?? []).map((f) => {
      const r = rollOne(rng, Data.affix(f.affixId), ilvl, o.classId, ancestral);
      if (f.value !== undefined) r.value = f.value;
      return r;
    });
    item.affixes = [...fixed, ...rollAffixes(rng, base, ilvl, leg.randomAffixes, o.classId, ancestral, fixed.map((f) => f.id))];
    item.legendaryValue = Math.round((leg.powerRange[0] + (leg.powerRange[1] - leg.powerRange[0]) * (ancestral ? 0.7 + rng.next() * 0.3 : rng.next())) * 1000) / 1000;
    item.legendaryId = legendaryId;
    item.ancestral = ancestral;
    item.name = name;
  } else if (setPieceId) {
    const piece = Data.setPiece(setPieceId)!.piece;
    const fixed = (piece.fixedAffixes ?? []).map((f) => rollOne(rng, Data.affix(f.affixId), ilvl, o.classId));
    item.affixes = [...fixed, ...rollAffixes(rng, base, ilvl, Math.max(1, count - fixed.length), o.classId, false, fixed.map((f) => f.id))];
    item.setId = setId;
    item.setPieceId = setPieceId;
    item.name = name;
  } else {
    item.affixes = rollAffixes(rng, base, ilvl, count, o.classId);
    if (rarity === 'magic') item.name = magicName(base, item.affixes);
    else if (rarity === 'rare') item.name = `${rng.pick(RARE_ITEM_NAME_A)} ${rng.pick(RARE_ITEM_NAME_B)}`;
  }
  return item;
}

/** Plain white starter item. */
export function starterItem(baseId: string): ItemInstance | null {
  const base = Data.tryItemBase(baseId);
  if (!base) return null;
  const item: ItemInstance = { uid: newUid(), baseId, rarity: 'common', ilvl: 1, reqLevel: 1, name: base.name, implicits: [], affixes: [], upgradeLevel: 0 };
  if (base.damage) {
    item.damage = [Math.round(base.damage[0]), Math.round(base.damage[1])];
    item.attacksPerSecond = base.attacksPerSecond;
  }
  if (base.armor) item.armor = Math.round(base.armor);
  if (base.implicits) item.implicits = base.implicits.map((im) => ({ id: `implicit:${im.stat}`, value: im.base[0], min: im.base[0], max: im.base[1] }));
  return item;
}

setStarterItemFactory((baseId) => starterItem(baseId));
