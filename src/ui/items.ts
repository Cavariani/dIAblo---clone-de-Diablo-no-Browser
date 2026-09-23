// Item presentation: names, stat lines, DPS, tooltip cards with comparison.
import { Data } from '../data';
import type { EquipSlot, ItemBaseDef, StatKey } from '../data/schema';
import { sellPrice } from '../formulas/economy';
import { canEquip, slotsFor } from '../game/items/inventory';
import type { CharacterState, ItemInstance, RolledAffix } from '../game/types';
import { el } from './components/el';
import { fmtByFormat, fmtInt } from './format';

const SLOT_NAMES: Record<string, string> = {
  head: 'Cabeça',
  amulet: 'Amuleto',
  chest: 'Peito',
  hands: 'Mãos',
  belt: 'Cintura',
  legs: 'Pernas',
  feet: 'Pés',
  ring: 'Anel',
  mainhand: 'Arma',
  offhand: 'Mão Secundária',
};

const WEAPON_NAMES: Record<string, string> = {
  sword: 'Espada',
  axe: 'Machado',
  mace: 'Maça',
  dagger: 'Adaga',
  greatsword: 'Espada de Duas Mãos',
  greataxe: 'Machado de Duas Mãos',
  maul: 'Malho de Duas Mãos',
  staff: 'Cajado',
  wand: 'Varinha',
  rod: 'Cetro',
  bow: 'Arco',
  greatbow: 'Arco de Guerra',
  slingshot: 'Funda',
};
const OFF_NAMES: Record<string, string> = { shield: 'Escudo', orb: 'Orbe', quiver: 'Aljava', grimoire: 'Grimório' };

const STAT_LABEL: Partial<Record<StatKey, [string, 'int' | 'pct' | 'pct1' | 'dec1']>> = {
  blockChance: ['de Chance de Bloqueio', 'pct'],
  maxResource: ['de Recurso Máximo', 'int'],
  attackSpeed: ['de Velocidade de Ataque', 'pct'],
  critChance: ['de Chance de Acerto Crítico', 'pct1'],
  summonDamage: ['de Dano de Lacaios', 'pct'],
  dmgFire: ['de Dano de Fogo', 'pct'],
};

export function itemTypeLine(item: ItemInstance, base: ItemBaseDef): string {
  const rarity = Data.rarity(item.rarity).name;
  const kind = base.weaponType ? WEAPON_NAMES[base.weaponType] : base.offhandType ? OFF_NAMES[base.offhandType] : SLOT_NAMES[base.slot];
  return `${kind} ${rarity}${item.ancestral ? ' Ancestral' : ''}`;
}

export function itemDps(item: ItemInstance): number {
  if (!item.damage) return 0;
  const aps = (item.attacksPerSecond ?? 1) * (1 + affixSum(item, 'attackSpeed'));
  const min = item.damage[0] + affixSum(item, 'minDamage');
  const max = item.damage[1] + affixSum(item, 'maxDamage');
  return ((min + max) / 2) * aps * (1 + affixSum(item, 'damagePct'));
}

export function affixSum(item: ItemInstance, stat: StatKey): number {
  let v = 0;
  for (const a of [...item.implicits, ...item.affixes]) {
    const s = a.id.startsWith('implicit:') ? a.id.slice(9) : Data.tryAffix(a.id)?.stat;
    if (s === stat) v += a.value;
  }
  return v;
}

export function affixText(a: RolledAffix): string {
  if (a.id.startsWith('implicit:')) {
    const stat = a.id.slice(9) as StatKey;
    const lab = STAT_LABEL[stat];
    return lab ? `+${fmtByFormat(a.value, lab[1])} ${lab[0]}` : `+${a.value} ${stat}`;
  }
  const def = Data.tryAffix(a.id);
  if (!def) return a.id;
  const skill = a.skillId ? (Data.trySkill(a.skillId)?.name ?? '') : '';
  return def.text.replace('{v}', fmtByFormat(a.value, def.format)).replace('{skill}', skill);
}

function affixRange(a: RolledAffix): string {
  if (a.id.startsWith('implicit:')) return '';
  const def = Data.tryAffix(a.id);
  if (!def || a.min === a.max) return '';
  return `[${fmtByFormat(a.min, def.format)}–${fmtByFormat(a.max, def.format)}]`;
}

/** Stat deltas vs another item (for the comparison summary). */
function statMap(item: ItemInstance | undefined): Map<string, number> {
  const m = new Map<string, number>();
  if (!item) return m;
  for (const a of [...item.implicits, ...item.affixes]) {
    const s = a.id.startsWith('implicit:') ? a.id.slice(9) : Data.tryAffix(a.id)?.stat;
    if (s && s !== 'skillRank' && s !== 'skillDamage') m.set(s, (m.get(s) ?? 0) + a.value);
  }
  return m;
}

const COMPARE_KEYS: [StatKey, string, 'int' | 'pct' | 'pct1' | 'dec1'][] = [
  ['str', 'Força', 'int'],
  ['dex', 'Destreza', 'int'],
  ['int', 'Inteligência', 'int'],
  ['vit', 'Vitalidade', 'int'],
  ['critChance', 'Chance Crítica', 'pct1'],
  ['critDamage', 'Dano Crítico', 'pct'],
  ['attackSpeed', 'Vel. de Ataque', 'pct'],
  ['lifePct', 'Vida', 'pct'],
  ['allRes', 'Resist. Total', 'int'],
  ['moveSpeed', 'Movimento', 'pct'],
];

export function equippedFor(c: CharacterState, item: ItemInstance): ItemInstance | undefined {
  const base = Data.tryItemBase(item.baseId);
  if (!base) return undefined;
  const slots = slotsFor(base.slot) as EquipSlot[];
  const eq = slots.map((s) => c.equipment[s]).filter(Boolean) as ItemInstance[];
  if (!eq.length) return undefined;
  // compare rings with the weaker one
  return eq.sort((a, b) => (a.affixes.length - b.affixes.length) || a.ilvl - b.ilvl)[0];
}

export interface CardOpts {
  compare?: ItemInstance;
  tag?: string;
  price?: { value: number; label: string; canAfford?: boolean };
  character?: CharacterState;
}

export function itemCard(item: ItemInstance, o: CardOpts = {}): HTMLElement {
  const base = Data.tryItemBase(item.baseId);
  const card = el('div', { class: `tt r-${item.rarity} ${o.tag ? 'tt--compare' : ''}` });
  if (!base) return card;
  if (o.tag) card.append(el('span', { class: 'tt__tag' }, o.tag));
  card.append(el('header', { class: 'tt__head' }, el('h3', item.name), el('p', itemTypeLine(item, base))));
  // main number
  const dps = itemDps(item);
  const cmp = o.compare;
  if (item.damage) {
    const delta = cmp ? dps - itemDps(cmp) : 0;
    card.append(
      el('div', { class: 'tt__main' }, el('strong', dps.toFixed(1)), el('span', 'Dano por segundo'), cmp ? el('em', { class: delta >= 0 ? 'up' : 'down' }, `${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta).toFixed(1)}`) : null),
      el('div', { class: 'tt__sub' }, `${fmtInt(item.damage[0])}–${fmtInt(item.damage[1])} de dano · ${(item.attacksPerSecond ?? 1).toFixed(2)} ataques/s`),
    );
  } else if (item.armor) {
    const delta = cmp ? item.armor - (cmp.armor ?? 0) : 0;
    card.append(el('div', { class: 'tt__main' }, el('strong', fmtInt(item.armor)), el('span', 'Armadura'), cmp && delta !== 0 ? el('em', { class: delta >= 0 ? 'up' : 'down' }, `${delta >= 0 ? '▲' : '▼'} ${fmtInt(Math.abs(delta))}`) : null));
  }
  const list = el('ul', { class: 'tt__affixes' });
  for (const a of item.implicits) list.append(el('li', { class: 'implicit' }, affixText(a)));
  for (const a of item.affixes) list.append(el('li', { class: a.enchanted ? 'enchanted' : '' }, affixText(a), el('span', { class: 'range' }, affixRange(a))));
  if (item.upgradeLevel) list.append(el('li', { class: 'implicit' }, `Aprimorado ${item.upgradeLevel}/5`));
  if (list.children.length) card.append(list);
  if (item.legendaryId) {
    const leg = Data.legendary(item.legendaryId);
    card.append(el('p', { class: 'tt__legend' }, leg.powerText.replace('{v}', fmtByFormat(item.legendaryValue ?? leg.powerRange[0], leg.powerFormat))));
    card.append(el('p', { class: 'tt__flavor' }, `“${leg.flavor}”`));
  }
  if (item.setId) {
    const set = Data.set(item.setId);
    const owned = o.character ? Object.values(o.character.equipment).filter((e) => e?.setId === set.id).length : 0;
    const box = el('div', { class: 'tt__set' }, el('h4', `${set.name} (${owned}/${set.pieces.length})`));
    const ul = el('ul');
    for (const p of set.pieces) ul.append(el('li', { class: o.character && Object.values(o.character.equipment).some((e) => e?.setPieceId === p.id) ? 'on' : '' }, p.name));
    for (const b of set.bonuses) ul.append(el('li', { class: owned >= b.pieces ? 'on' : '' }, `(${b.pieces}) ${b.text}`));
    box.append(ul);
    card.append(box);
  }
  // comparison summary
  if (cmp) {
    const a = statMap(item);
    const b = statMap(cmp);
    const rows: HTMLElement[] = [];
    for (const [k, label, f] of COMPARE_KEYS) {
      const d = (a.get(k) ?? 0) - (b.get(k) ?? 0);
      if (Math.abs(d) < 1e-6) continue;
      rows.push(el('li', { class: d > 0 ? 'up' : 'down', style: 'color:inherit' }, el('span', { class: d > 0 ? 'up' : 'down' }, `${d > 0 ? '+' : '−'}${fmtByFormat(Math.abs(d), f)} ${label}`)));
    }
    if (rows.length) card.append(el('ul', { class: 'tt__affixes', style: 'border-top:1px solid #2e2722;padding-top:.375rem' }, ...rows));
  }
  const reqErr = o.character ? canEquip(o.character, item) : null;
  const foot = el('footer', { class: 'tt__foot' }, el('span', { class: reqErr ? 'bad' : '' }, reqErr ?? `Nível de item ${item.ilvl}`));
  if (o.price) foot.append(el('span', { class: o.price.canAfford === false ? 'bad' : 'gold' }, `${o.price.label}: ${fmtInt(o.price.value)} ◉`));
  else foot.append(el('span', { class: 'gold' }, `Venda: ${fmtInt(sellPrice(item.ilvl, item.rarity))} ◉`));
  card.append(foot);
  return card;
}

export { SLOT_NAMES };
