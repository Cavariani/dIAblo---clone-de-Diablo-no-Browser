// Rifts: timed endgame runs with a progress bar and a guardian boss.
import type { RiftDef } from './schema';

export const RIFT: RiftDef = {
  timeLimit: 600,
  progressByRank: { normal: 0.012, champion: 0.045, rare: 0.06, minion: 0.008, unique: 0.1, boss: 0, guardian: 0 },
  guardians: ['guardian_lich', 'guardian_antlion', 'boss_butcher'],
  levelScaling: { life: 0.17, damage: 0.08 },
  biomes: ['crypt', 'cave', 'forest', 'hell'],
  floorsNormal: 1,
};
