// Level generation entry point (deterministic by seed).
import type { GeneratedLevel, GeneratorParams } from '../types';
import { generateCave } from './cave';
import { generateForest } from './forest';
import { generateRooms } from './rooms';
import { generateTown } from './town';

export function generateLevel(params: GeneratorParams): GeneratedLevel {
  switch (params.biome) {
    case 'town':
      return generateTown(params);
    case 'cave':
      return generateCave(params);
    case 'forest':
      return generateForest(params);
    default:
      return generateRooms(params); // crypt & hell (tinted, bloody walls)
  }
}
