// Level generation entry point (deterministic by seed).
import type { GeneratedLevel, GeneratorParams } from '../types';
import { generateRooms } from './rooms';
import { generateTown } from './town';

export function generateLevel(params: GeneratorParams): GeneratedLevel {
  switch (params.biome) {
    case 'town':
      return generateTown(params);
    default:
      return generateRooms(params);
  }
}
