// Class item sets (2 and 4 piece bonuses).
import type { SetDef } from '../schema';

export const SETS: SetDef[] = [
  {
    id: 'set_immortal_king',
    name: 'Fúria do Rei Imortal',
    classId: 'berserker',
    minLevel: 10,
    weight: 10,
    pieces: [
      { id: 'sp_ik_helm', baseId: 'head_helm', name: 'Coroa de Guerra do Rei Imortal' },
      { id: 'sp_ik_chest', baseId: 'chest_chain', name: 'Couraça do Rei Imortal' },
      { id: 'sp_ik_hands', baseId: 'hands_chain', name: 'Manoplas do Rei Imortal' },
      { id: 'sp_ik_legs', baseId: 'legs_chain', name: 'Grevas do Rei Imortal' },
    ],
    bonuses: [
      { pieces: 2, text: '+12% de velocidade de ataque e +15% de vida', stats: { attackSpeed: 0.12, lifePct: 0.15 } },
      { pieces: 4, text: 'Habilidades do Berserker causam +150% de dano e cada golpe gera 2 de Fúria', powerId: 'set_berserker', powerValue: 1.5 },
    ],
  },
  {
    id: 'set_star_archmage',
    name: 'Vestes do Arquimago Estelar',
    classId: 'arcanist',
    minLevel: 10,
    weight: 10,
    pieces: [
      { id: 'sp_sa_hood', baseId: 'head_hood_mage_2', name: 'Capuz do Arquimago Estelar' },
      { id: 'sp_sa_robe', baseId: 'chest_robe_2', name: 'Manto do Arquimago Estelar' },
      { id: 'sp_sa_sleeves', baseId: 'hands_sleeves', name: 'Mangas do Arquimago Estelar' },
      { id: 'sp_sa_boots', baseId: 'feet_mage', name: 'Botas do Arquimago Estelar' },
    ],
    bonuses: [
      { pieces: 2, text: '+4 de regeneração de Mana e 10% de redução de recarga', stats: { resourceRegen: 4, cooldownReduction: 0.1 } },
      { pieces: 4, text: 'Cada habilidade que custa Mana dispara 3 mísseis arcanos teleguiados de 120% de dano de arma', powerId: 'set_arcanist', powerValue: 1.2 },
    ],
  },
  {
    id: 'set_night_hunter',
    name: 'Couro do Caçador Noturno',
    classId: 'stalker',
    minLevel: 10,
    weight: 10,
    pieces: [
      { id: 'sp_nh_hood', baseId: 'head_hood_leather', name: 'Capuz do Caçador Noturno' },
      { id: 'sp_nh_chest', baseId: 'chest_leather', name: 'Gibão do Caçador Noturno' },
      { id: 'sp_nh_gloves', baseId: 'hands_leather', name: 'Luvas do Caçador Noturno' },
      { id: 'sp_nh_boots', baseId: 'feet_leather', name: 'Botas do Caçador Noturno' },
    ],
    bonuses: [
      { pieces: 2, text: '+8% de chance crítica e +10% de movimento', stats: { critChance: 0.08, moveSpeed: 0.1 } },
      { pieces: 4, text: 'Habilidades primárias disparam +2 projéteis e causam +100% de dano', powerId: 'set_stalker', powerValue: 1 },
    ],
  },
  {
    id: 'set_bone_shroud',
    name: 'Mortalha do Ossomante',
    classId: 'bonemancer',
    minLevel: 10,
    weight: 10,
    pieces: [
      { id: 'sp_bs_hood', baseId: 'head_hood_mage', name: 'Capuz da Mortalha' },
      { id: 'sp_bs_robe', baseId: 'chest_robe_2', name: 'Veste da Mortalha' },
      { id: 'sp_bs_skirt', baseId: 'legs_skirt', name: 'Saiote da Mortalha' },
      { id: 'sp_bs_sleeves', baseId: 'hands_sleeves', name: 'Mangas da Mortalha' },
    ],
    bonuses: [
      { pieces: 2, text: '+30% de dano e +30% de vida dos lacaios', stats: { summonDamage: 0.3, summonLife: 0.3 } },
      { pieces: 4, text: 'Seus lacaios e Lança de Osso causam +200% de dano', powerId: 'set_bonemancer', powerValue: 2 },
    ],
  },
];
