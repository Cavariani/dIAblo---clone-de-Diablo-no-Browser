// UI art: menu background + class portraits from Flare (CC-BY-SA 3.0) → public/assets/ui.
import fs from 'node:fs';
import sharp from 'sharp';
const SRC = '.assets-src/flare-game/mods/fantasycore/images';
const OUT = 'public/assets/ui';
fs.mkdirSync(`${OUT}/portraits`, { recursive: true });
await sharp(`${SRC}/menus/backgrounds/dungeon.jpg`).resize(1920).webp({ quality: 76 }).toFile(`${OUT}/menu_bg.webp`);
const PORTRAITS = {
  berserker_m: 'male06', berserker_f: 'female14',
  arcanist_m: 'male20', arcanist_f: 'female15',
  stalker_m: 'male03', stalker_f: 'female02',
  bonemancer_m: 'male10', bonemancer_f: 'female09',
};
for (const [k, f] of Object.entries(PORTRAITS)) await sharp(`${SRC}/portraits/${f}.png`).resize(256).webp({ quality: 82 }).toFile(`${OUT}/portraits/${k}.webp`);
console.log('ui assets ok');
