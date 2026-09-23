// Crafting materials (from salvage) and consumables.
import type { ConsumableDef, MaterialDef } from '../schema';

export const MATERIALS: MaterialDef[] = [
  { id: 'scrap', name: 'Sucata Recuperada', icon: 262, color: 0xc8c4bc },
  { id: 'arcaneDust', name: 'Pó Arcano', icon: 514, color: 0x6c8cff },
  { id: 'veiledCrystal', name: 'Cristal Velado', icon: 70, color: 0xffd84a },
  { id: 'forgottenSoul', name: 'Alma Esquecida', icon: 71, color: 0xff8a1c },
  { id: 'riftShard', name: 'Fragmento de Fenda', icon: 514, color: 0xff4aa0 },
];

export const CONSUMABLES: ConsumableDef[] = [
  { id: 'potion_health', name: 'Poção de Vida', icon: 64, stack: 99, price: 25 },
  { id: 'rift_key', name: 'Selo de Fenda', icon: 79, stack: 99, price: 0 },
];
