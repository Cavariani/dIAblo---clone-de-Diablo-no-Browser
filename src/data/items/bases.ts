// Item bases. Visual sprites are real Flare avatar layers; icons are Flare icon atlas indices
// (scripts/assets/catalog/icons.json). Sizes are D3-like: jewelry 1x1, belts 2x1, everything else 1x2.
import type { AvatarLayer, ClassId, ItemBaseDef, ItemSlotType, OffhandType, StatKey, WeaponType } from '../schema';

const TIERS = [1, 8, 16, 26, 38] as const;

function armor(id: string, name: string, slot: ItemSlotType, tier: number, armorV: number, icon: number, layer?: AvatarLayer, sprite?: string, loot?: string, extra: Partial<ItemBaseDef> = {}): ItemBaseDef {
  return {
    id,
    name,
    slot,
    category: slot === 'ring' || slot === 'amulet' ? 'jewelry' : 'armor',
    size: slot === 'ring' || slot === 'amulet' ? [1, 1] : slot === 'belt' ? [2, 1] : [1, 2],
    icon,
    groundSprite: loot,
    visual: layer && sprite ? { layer, sprite } : undefined,
    minLevel: TIERS[tier],
    armor: armorV * (1 + tier * 0.12),
    weight: 10,
    ...extra,
  };
}

function weapon(id: string, name: string, type: WeaponType, tier: number, dmg: [number, number], aps: number, icon: number, sprite: string, loot: string, o: { twoHanded?: boolean; classes?: ClassId[]; layer?: AvatarLayer } = {}): ItemBaseDef {
  const k = 1 + tier * 0.1;
  return {
    id,
    name,
    slot: 'mainhand',
    category: 'weapon',
    weaponType: type,
    twoHanded: o.twoHanded,
    classes: o.classes,
    size: [1, 2],
    icon,
    groundSprite: loot,
    visual: { layer: o.layer ?? 'mainhand', sprite },
    minLevel: TIERS[tier],
    damage: [Math.round(dmg[0] * k * 10) / 10, Math.round(dmg[1] * k * 10) / 10],
    attacksPerSecond: aps,
    weight: 8,
  };
}

function offhand(id: string, name: string, type: OffhandType, tier: number, icon: number, classes: ClassId[], implicits: { stat: StatKey; base: [number, number]; perLevel?: [number, number] }[], o: { sprite?: string; loot?: string; armorV?: number } = {}): ItemBaseDef {
  return {
    id,
    name,
    slot: 'offhand',
    category: 'offhand',
    offhandType: type,
    classes,
    size: [1, 2],
    icon,
    groundSprite: o.loot,
    visual: o.sprite ? { layer: 'offhand', sprite: o.sprite } : undefined,
    minLevel: TIERS[tier],
    armor: o.armorV ? o.armorV * (1 + tier * 0.12) : undefined,
    implicits,
    weight: 7,
  };
}

const MELEE: ClassId[] = ['berserker'];

export const ITEM_BASES: ItemBaseDef[] = [
  // ---------------------------------------------------------------- chest
  armor('chest_cloth', 'Túnica Surrada', 'chest', 0, 10, 129, 'chest', 'cloth_shirt', 'clothes'),
  armor('chest_robe', 'Manto do Aprendiz', 'chest', 0, 9, 185, 'chest', 'mage_vest', 'clothes', { implicits: [{ stat: 'maxResource', base: [4, 8] }] }),
  armor('chest_leather', 'Gibão de Couro', 'chest', 1, 14, 145, 'chest', 'leather_chest', 'leather_armor'),
  armor('chest_robe_2', 'Manto Arcano', 'chest', 1, 12, 185, 'chest', 'mage_vest_alt1', 'clothes', { implicits: [{ stat: 'maxResource', base: [8, 14] }] }),
  armor('chest_chain', 'Cota de Malha', 'chest', 2, 18, 153, 'chest', 'chain_cuirass', 'steel_armor'),
  armor('chest_robe_3', 'Veste do Ocultista', 'chest', 2, 15, 185, 'chest', 'mage_vest_alt2', 'clothes', { implicits: [{ stat: 'maxResource', base: [12, 20] }] }),
  armor('chest_plate', 'Couraça de Placas', 'chest', 3, 24, 161, 'chest', 'plate_cuirass', 'steel_armor'),
  armor('chest_plate_2', 'Couraça do Juramento', 'chest', 4, 28, 161, 'chest', 'plate_cuirass', 'steel_armor'),
  // ---------------------------------------------------------------- legs
  armor('legs_cloth', 'Calças de Pano', 'legs', 0, 6, 131, 'legs', 'cloth_pants', 'clothes'),
  armor('legs_leather', 'Perneiras de Couro', 'legs', 1, 9, 147, 'legs', 'leather_pants', 'leather_armor'),
  armor('legs_skirt', 'Saiote Rúnico', 'legs', 1, 8, 187, 'legs', 'mage_skirt', 'clothes'),
  armor('legs_chain', 'Grevas de Malha', 'legs', 2, 12, 155, 'legs', 'chain_greaves', 'steel_armor'),
  armor('legs_skirt_2', 'Saiote do Vidente', 'legs', 3, 12, 187, 'legs', 'mage_skirt_alt1', 'clothes'),
  armor('legs_plate', 'Grevas de Placas', 'legs', 3, 16, 163, 'legs', 'plate_greaves', 'steel_armor'),
  armor('legs_plate_2', 'Grevas do Colosso', 'legs', 4, 19, 163, 'legs', 'plate_greaves', 'steel_armor'),
  // ---------------------------------------------------------------- head
  armor('head_hood_leather', 'Capuz de Couro', 'head', 0, 6, 144, 'head', 'leather_hood', 'clothes'),
  armor('head_hood_mage', 'Capuz do Místico', 'head', 1, 6, 184, 'head', 'mage_hood', 'clothes'),
  armor('head_coif', 'Coifa de Malha', 'head', 1, 9, 152, 'head', 'chain_coif', 'steel_armor'),
  armor('head_hood_mage_2', 'Capuz Sombrio', 'head', 2, 9, 184, 'head', 'mage_hood_alt1', 'clothes'),
  armor('head_helm', 'Elmo de Placas', 'head', 2, 12, 160, 'head', 'plate_helm', 'steel_armor'),
  armor('head_helm_2', 'Elmo do Carrasco', 'head', 3, 15, 160, 'head', 'plate_helm', 'steel_armor'),
  armor('head_hood_mage_3', 'Capuz do Arquimago', 'head', 4, 14, 184, 'head', 'mage_hood_alt2', 'clothes'),
  // ---------------------------------------------------------------- hands
  armor('hands_cloth', 'Luvas de Pano', 'hands', 0, 4, 130, 'hands', 'cloth_gloves', 'clothes'),
  armor('hands_leather', 'Luvas de Couro', 'hands', 1, 6, 146, 'hands', 'leather_gloves', 'leather_armor'),
  armor('hands_sleeves', 'Mangas Rúnicas', 'hands', 1, 5, 186, 'hands', 'mage_sleeves', 'clothes'),
  armor('hands_chain', 'Luvas de Malha', 'hands', 2, 8, 154, 'hands', 'chain_gloves', 'steel_armor'),
  armor('hands_plate', 'Manoplas de Placas', 'hands', 3, 11, 162, 'hands', 'plate_gauntlets', 'steel_armor'),
  armor('hands_sleeves_2', 'Mangas do Tecelão', 'hands', 4, 10, 186, 'hands', 'mage_sleeves_alt2', 'clothes'),
  // ---------------------------------------------------------------- feet
  armor('feet_sandals', 'Sandálias Gastas', 'feet', 0, 4, 132, 'feet', 'cloth_sandals', 'boots'),
  armor('feet_leather', 'Botas de Couro', 'feet', 1, 6, 148, 'feet', 'leather_boots', 'boots'),
  armor('feet_mage', 'Botas do Andarilho', 'feet', 1, 5, 188, 'feet', 'mage_boots', 'boots'),
  armor('feet_chain', 'Botas de Malha', 'feet', 2, 8, 156, 'feet', 'chain_boots', 'boots'),
  armor('feet_plate', 'Botas de Placas', 'feet', 3, 11, 164, 'feet', 'plate_boots', 'boots'),
  armor('feet_mage_2', 'Botas Etéreas', 'feet', 4, 10, 176, 'feet', 'mage_boots_alt1', 'boots'),
  // ---------------------------------------------------------------- belt
  armor('belt_leather', 'Cinto de Couro', 'belt', 0, 4, 208, undefined, undefined, 'belt'),
  armor('belt_heavy', 'Cinturão Pesado', 'belt', 2, 7, 208, undefined, undefined, 'belt'),
  armor('belt_war', 'Cinturão de Guerra', 'belt', 4, 10, 208, undefined, undefined, 'belt'),
  // ---------------------------------------------------------------- jewelry
  armor('ring_iron', 'Anel de Ferro', 'ring', 0, 0, 198, undefined, undefined, 'ring', { armor: undefined, weight: 7 }),
  armor('ring_gold', 'Anel de Ouro', 'ring', 1, 0, 201, undefined, undefined, 'ring', { armor: undefined, weight: 7 }),
  armor('ring_jewel', 'Anel Cravejado', 'ring', 3, 0, 205, undefined, undefined, 'ring', { armor: undefined, weight: 6 }),
  armor('amulet_bone', 'Amuleto de Osso', 'amulet', 0, 0, 212, undefined, undefined, 'gem', { armor: undefined, weight: 6 }),
  armor('amulet_gold', 'Amuleto de Ouro', 'amulet', 2, 0, 214, undefined, undefined, 'gem', { armor: undefined, weight: 5 }),
  armor('amulet_star', 'Amuleto Estelar', 'amulet', 4, 0, 215, undefined, undefined, 'gem', { armor: undefined, weight: 4 }),
  // ---------------------------------------------------------------- weapons: 1H
  weapon('dagger_ritual', 'Adaga Ritual', 'dagger', 0, [2, 5], 1.5, 96, 'dagger', 'dagger'),
  weapon('dagger_2', 'Punhal Sacrificial', 'dagger', 2, [2.5, 6], 1.5, 96, 'dagger', 'dagger'),
  weapon('sword_short', 'Espada Curta', 'sword', 0, [3, 6], 1.4, 97, 'shortsword', 'shortsword'),
  weapon('sword_long', 'Espada Longa', 'sword', 1, [3.5, 8], 1.4, 98, 'longsword', 'longsword'),
  weapon('sword_3', 'Lâmina do Templo', 'sword', 3, [4, 9], 1.4, 98, 'longsword', 'longsword'),
  weapon('axe_hand', 'Machadinha', 'axe', 0, [3, 7], 1.3, 117, 'hand_axe', 'hand_axe'),
  weapon('axe_battle', 'Machado de Batalha', 'axe', 2, [4, 9], 1.3, 118, 'battle_axe', 'battle_axe'),
  weapon('mace_club', 'Clava', 'mace', 0, [3.5, 7], 1.2, 111, 'club', 'club'),
  weapon('mace_iron', 'Maça de Ferro', 'mace', 1, [4, 8.5], 1.2, 109, 'mace', 'mace'),
  weapon('mace_war', 'Martelo de Guerra', 'mace', 3, [5, 10], 1.2, 110, 'war_hammer', 'war_hammer'),
  weapon('wand_apprentice', 'Varinha do Aprendiz', 'wand', 0, [3, 6], 1.4, 104, 'wand', 'wand', { classes: ['arcanist', 'bonemancer'] }),
  weapon('wand_2', 'Varinha de Ébano', 'wand', 2, [3.5, 7], 1.4, 104, 'wand', 'wand', { classes: ['arcanist', 'bonemancer'] }),
  weapon('rod_1', 'Cetro Rúnico', 'rod', 1, [3.5, 7.5], 1.3, 105, 'rod', 'rod', { classes: ['arcanist', 'bonemancer'] }),
  weapon('rod_2', 'Cetro do Abismo', 'rod', 4, [4.5, 9], 1.3, 105, 'rod', 'rod', { classes: ['arcanist', 'bonemancer'] }),
  // ---------------------------------------------------------------- weapons: 2H
  weapon('greatsword_1', 'Montante', 'greatsword', 1, [7, 14], 1.1, 99, 'greatsword', 'greatsword', { twoHanded: true, classes: MELEE }),
  weapon('greatsword_2', 'Zweihänder', 'greatsword', 3, [8, 16], 1.1, 100, 'zweihander', 'zweihander', { twoHanded: true, classes: MELEE }),
  weapon('greataxe_1', 'Machado de Infantaria', 'greataxe', 2, [8, 16], 1.0, 119, 'infantry_axe', 'infantry_axe', { twoHanded: true, classes: MELEE }),
  weapon('maul_1', 'Malho', 'maul', 1, [8, 15], 0.95, 103, 'maul', 'maul', { twoHanded: true, classes: MELEE }),
  weapon('maul_2', 'Malho do Ferreiro', 'maul', 4, [10, 19], 0.95, 102, 'smith_hammer', 'smith_hammer', { twoHanded: true, classes: MELEE }),
  weapon('staff_quarter', 'Cajado de Carvalho', 'staff', 0, [5, 9], 1.1, 106, 'staff', 'staff', { twoHanded: true, classes: ['arcanist', 'bonemancer'] }),
  weapon('staff_great', 'Grande Cajado', 'staff', 2, [6, 12], 1.1, 107, 'greatstaff', 'greatstaff', { twoHanded: true, classes: ['arcanist', 'bonemancer'] }),
  weapon('staff_3', 'Cajado das Estrelas Mortas', 'staff', 4, [7, 14], 1.1, 107, 'greatstaff', 'greatstaff', { twoHanded: true, classes: ['arcanist', 'bonemancer'] }),
  weapon('bow_short', 'Arco Curto', 'bow', 0, [4, 8], 1.3, 113, 'shortbow', 'shortbow', { twoHanded: true, classes: ['stalker'], layer: 'offhand' }),
  weapon('bow_long', 'Arco Longo', 'bow', 1, [5, 10], 1.3, 114, 'longbow', 'longbow', { twoHanded: true, classes: ['stalker'], layer: 'offhand' }),
  weapon('bow_great', 'Arco de Guerra', 'greatbow', 3, [7, 14], 1.1, 115, 'greatbow', 'greatbow', { twoHanded: true, classes: ['stalker'], layer: 'offhand' }),
  weapon('sling_1', 'Funda de Caçador', 'slingshot', 2, [4, 8], 1.5, 113, 'slingshot', 'slingshot', { twoHanded: true, classes: ['stalker'], layer: 'offhand' }),
  // ---------------------------------------------------------------- offhands
  offhand('shield_buckler', 'Broquel', 'shield', 0, 120, ['berserker'], [{ stat: 'blockChance', base: [0.08, 0.1] }], { sprite: 'buckler', loot: 'buckler', armorV: 8 }),
  offhand('shield_iron', 'Broquel de Ferro', 'shield', 1, 121, ['berserker'], [{ stat: 'blockChance', base: [0.1, 0.12] }], { sprite: 'iron_buckler', loot: 'buckler', armorV: 12 }),
  offhand('shield_kite', 'Escudo Pipa', 'shield', 2, 122, ['berserker'], [{ stat: 'blockChance', base: [0.12, 0.15] }], { sprite: 'kite_shield', loot: 'shield', armorV: 16 }),
  offhand('shield_tower', 'Escudo da Muralha', 'shield', 4, 123, ['berserker'], [{ stat: 'blockChance', base: [0.15, 0.18] }], { sprite: 'shield', loot: 'shield', armorV: 22 }),
  offhand('orb_glass', 'Orbe de Vidro', 'orb', 0, 107, ['arcanist'], [{ stat: 'maxResource', base: [6, 10], perLevel: [0.3, 0.5] }], { loot: 'gem' }),
  offhand('orb_star', 'Orbe Estelar', 'orb', 3, 107, ['arcanist'], [{ stat: 'dmgFire', base: [0.06, 0.1] }, { stat: 'maxResource', base: [10, 16], perLevel: [0.3, 0.5] }], { loot: 'gem' }),
  offhand('quiver_simple', 'Aljava Simples', 'quiver', 0, 225, ['stalker'], [{ stat: 'attackSpeed', base: [0.05, 0.08] }], { loot: 'pouch' }),
  offhand('quiver_hunter', 'Aljava do Caçador', 'quiver', 3, 225, ['stalker'], [{ stat: 'attackSpeed', base: [0.08, 0.12] }, { stat: 'critChance', base: [0.02, 0.04] }], { loot: 'pouch' }),
  offhand('grimoire_worn', 'Grimório Gasto', 'grimoire', 0, 225, ['bonemancer'], [{ stat: 'summonDamage', base: [0.08, 0.12] }], { loot: 'book' }),
  offhand('grimoire_bone', 'Grimório de Ossos', 'grimoire', 3, 225, ['bonemancer'], [{ stat: 'summonDamage', base: [0.12, 0.18] }, { stat: 'maxResource', base: [8, 12] }], { loot: 'book' }),
];
