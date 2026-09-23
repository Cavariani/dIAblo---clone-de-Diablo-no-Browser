import type { RarityDef } from '../schema';

export const RARITY_DEFS: RarityDef[] = [
  { id: 'common', name: 'Comum', color: 0xc8c4bc, cssColor: '#c8c4bc', affixCount: [0, 0], salvage: [{ material: 'scrap', amount: [1, 2] }], sellMult: 1, beam: null, dropSfx: 'drop_common' },
  { id: 'magic', name: 'Mágico', color: 0x6c8cff, cssColor: '#6c8cff', affixCount: [1, 2], salvage: [{ material: 'scrap', amount: [1, 2] }, { material: 'arcaneDust', amount: [1, 2] }], sellMult: 2.2, beam: { color: 0x6c8cff, height: 0.6, intensity: 0.5 }, dropSfx: 'drop_magic' },
  { id: 'rare', name: 'Raro', color: 0xffd84a, cssColor: '#ffd84a', affixCount: [3, 4], salvage: [{ material: 'arcaneDust', amount: [1, 3] }, { material: 'veiledCrystal', amount: [1, 2] }], sellMult: 4.5, beam: { color: 0xffd84a, height: 1, intensity: 0.8 }, dropSfx: 'drop_rare' },
  { id: 'legendary', name: 'Lendário', color: 0xff8a1c, cssColor: '#ff8a1c', affixCount: [3, 4], salvage: [{ material: 'veiledCrystal', amount: [2, 4] }, { material: 'forgottenSoul', amount: [1, 1] }], sellMult: 10, beam: { color: 0xff8a1c, height: 2.4, intensity: 1.5 }, dropSfx: 'drop_legendary' },
  { id: 'set', name: 'Conjunto', color: 0x3fdc5a, cssColor: '#3fdc5a', affixCount: [3, 3], salvage: [{ material: 'veiledCrystal', amount: [2, 4] }, { material: 'forgottenSoul', amount: [1, 1] }], sellMult: 10, beam: { color: 0x3fdc5a, height: 2.4, intensity: 1.5 }, dropSfx: 'drop_set' },
];
