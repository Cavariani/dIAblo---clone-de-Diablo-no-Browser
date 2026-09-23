// Level generation entry point (deterministic by seed).
import type { GeneratedLevel, GeneratorParams } from '../types';
import { generateRooms } from './rooms';

export function generateLevel(params: GeneratorParams): GeneratedLevel {
  switch (params.biome) {
    default:
      return generateRooms(params);
  }
}
