// Elite modifiers (champions share 1-2, rares get 2-3). Behaviour in src/game/monsters/eliteMods.ts.
import type { EliteModDef } from './schema';

export const ELITE_MODS: EliteModDef[] = [
  { id: 'fast', name: 'Veloz', description: 'Move-se e ataca muito mais rápido.', color: 0xffe080, speedMult: 1.45, weight: 10 },
  { id: 'extra_health', name: 'Vida Extra', description: 'Possui o dobro de vida.', color: 0xff8080, lifeMult: 2, weight: 8 },
  { id: 'shielding', name: 'Blindado', description: 'Periodicamente fica invulnerável.', color: 0x9ad8ff, weight: 7, incompatible: ['vampiric'] },
  { id: 'vampiric', name: 'Vampírico', description: 'Cura-se com o dano causado.', color: 0xc02030, weight: 8 },
  { id: 'explosive', name: 'Explosivo', description: 'Explode violentamente ao morrer.', color: 0xff6020, weight: 8 },
  { id: 'molten', name: 'Derretido', description: 'Deixa um rastro de fogo e explode ao morrer.', color: 0xff4010, damageMult: 1.1, weight: 7, incompatible: ['explosive'] },
  { id: 'frozen', name: 'Congelante', description: 'Invoca orbes de gelo que explodem e congelam.', color: 0x80d0ff, weight: 7, minLevel: 4 },
  { id: 'arcane', name: 'Arcano', description: 'Dispara raios arcanos giratórios.', color: 0xd070ff, weight: 6, minLevel: 6 },
  { id: 'teleporter', name: 'Teleportador', description: 'Teletransporta-se para perto do alvo.', color: 0xb0a0ff, weight: 6 },
  { id: 'vortex', name: 'Vórtice', description: 'Puxa o herói para perto.', color: 0x8060ff, weight: 5, minLevel: 8, incompatible: ['teleporter'] },
  { id: 'desecrator', name: 'Profanador', description: 'Cria poças de fogo sob o herói.', color: 0xff5020, weight: 7, minLevel: 3 },
  { id: 'nightmarish', name: 'Pesadelo', description: 'Seus golpes podem causar medo.', color: 0x9040c0, weight: 5, minLevel: 10 },
  { id: 'electrified', name: 'Eletrizado', description: 'Solta faíscas ao ser atingido.', color: 0xc0c0ff, weight: 6, minLevel: 5 },
  { id: 'mortar', name: 'Morteiro', description: 'Lança bombas explosivas à distância.', color: 0xff9a40, weight: 5, minLevel: 12 },
  { id: 'horde', name: 'Horda', description: 'Acompanhado de lacaios extras.', color: 0xc0a080, weight: 5 },
];
