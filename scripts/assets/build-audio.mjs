#!/usr/bin/env node
// Copies selected Flare (CC-BY-SA/CC-BY) and CC0 sounds into public/assets/audio and writes audio-manifest.json.
// Sound ids missing here are synthesized at runtime (src/audio/synth.ts).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FC = '.assets-src/flare-game/mods/fantasycore';
const EC = '.assets-src/flare-game/mods/empyrean_campaign';
const CC = '.assets-src/cc0-audio';
const OUT = path.join(ROOT, 'public/assets/audio');

const K = (n) => `${CC}/kenney_impact-sounds/Audio/${n}.ogg`;
/** id -> [volume, ...files] */
const SFX = {
  swing_light: [0.55, `${FC}/soundfx/melee_attack.ogg`, `${FC}/soundfx/melee_attack_2.ogg`, `${FC}/soundfx/melee_attack_3.ogg`],
  swing_heavy: [0.7, `${FC}/soundfx/melee_attack_2.ogg`, `${FC}/soundfx/melee_attack_3.ogg`],
  bow_shot: [0.55, `${FC}/soundfx/powers/shoot.ogg`],
  hit_physical: [0.45, K('impactPunch_medium_000'), K('impactPunch_medium_001'), K('impactPunch_medium_002'), K('impactSoft_heavy_000')],
  hit_crit: [0.6, K('impactPunch_heavy_000'), K('impactPunch_heavy_001'), K('impactPunch_heavy_002')],
  hit_bone: [0.45, K('impactWood_medium_000'), K('impactWood_medium_001'), K('impactWood_heavy_000')],
  hit_player: [0.55, `${FC}/soundfx/male_hit.ogg`],
  block: [0.6, `${FC}/soundfx/powers/block.ogg`],
  hit_metal: [0.45, K('impactPlate_medium_000'), K('impactPlate_medium_001')],
  fireball: [0.55, `${FC}/soundfx/powers/fireball.ogg`],
  fire_cast: [0.5, `${FC}/soundfx/powers/fireball.ogg`],
  explosion: [0.7, `${FC}/soundfx/powers/burn.ogg`],
  meteor_impact: [0.85, `${FC}/soundfx/powers/burn.ogg`],
  frost_nova: [0.65, `${FC}/soundfx/powers/freeze.ogg`],
  ice_shatter: [0.55, `${CC}/oga_ice-spells/ice.wav`],
  lightning_zap: [0.5, `${FC}/soundfx/powers/shock.ogg`],
  chain_lightning: [0.55, `${FC}/soundfx/powers/thunder.ogg`],
  arcane_blast: [0.5, `${FC}/soundfx/powers/shock.ogg`],
  teleport: [0.55, `${FC}/soundfx/powers/teleport.ogg`],
  bone_spear: [0.5, `${FC}/soundfx/powers/spikes.ogg`],
  bone_armor: [0.55, `${FC}/soundfx/powers/shield.ogg`],
  summon_skeleton: [0.55, `${FC}/soundfx/powers/teleport.ogg`],
  corpse_explosion: [0.7, `${FC}/soundfx/powers/burn.ogg`],
  curse: [0.55, `${FC}/soundfx/powers/timestop.ogg`],
  blood_nova: [0.6, `${FC}/soundfx/powers/burn.ogg`],
  leap_slam: [0.75, `${FC}/soundfx/powers/quake.ogg`],
  ground_stomp: [0.75, `${FC}/soundfx/powers/quake.ogg`],
  war_cry: [0.7, `${FC}/soundfx/powers/warcry.ogg`],
  heal_cast: [0.5, `${FC}/soundfx/powers/heal.ogg`],
  multishot: [0.55, `${FC}/soundfx/powers/shoot.ogg`],
  arrow_wall: [0.4, `${FC}/soundfx/powers/arrow_wall.ogg`],
  trap_set: [0.5, `${CC}/kenney_rpg-audio/Audio/metalLatch.ogg`],
  skeleton_die: [0.5, `${FC}/soundfx/enemies/skeleton_die.ogg`, `${FC}/soundfx/enemies/skeleton_critdie.ogg`],
  skeleton_hit: [0.4, `${FC}/soundfx/enemies/skeleton_hit.ogg`],
  zombie_groan: [0.5, `${FC}/soundfx/enemies/zombie_ment.ogg`],
  zombie_die: [0.55, `${FC}/soundfx/enemies/zombie_die.ogg`, `${FC}/soundfx/enemies/zombie_critdie.ogg`],
  goblin_die: [0.5, `${FC}/soundfx/enemies/goblin_die.ogg`],
  beast_die: [0.5, `${FC}/soundfx/enemies/antlion_die.ogg`, `${FC}/soundfx/enemies/antlion_critdie.ogg`],
  minotaur_roar: [0.7, `${FC}/soundfx/enemies/minotaur_phys.ogg`],
  minotaur_die: [0.7, `${FC}/soundfx/enemies/minotaur_die.ogg`],
  wyvern_screech: [0.6, `${FC}/soundfx/enemies/wyvern_ment.ogg`],
  wyvern_die: [0.6, `${FC}/soundfx/enemies/wyvern_die.ogg`],
  grave_die: [0.6, `${FC}/soundfx/enemies/grave_die.ogg`],
  monster_attack: [0.35, `${FC}/soundfx/enemies/skeleton_phys.ogg`, `${FC}/soundfx/enemies/goblin_phys.ogg`],
  monster_die: [0.45, `${FC}/soundfx/enemies/goblin_die.ogg`, `${FC}/soundfx/enemies/antlion_die.ogg`],
  summon_monster: [0.55, `${FC}/soundfx/enemies/grave_attack.ogg`],
  boss_roar: [0.9, `${FC}/soundfx/enemies/minotaur_critdie.ogg`],
  gold_pickup: [0.5, `${FC}/soundfx/inventory/inventory_coins.ogg`, `${CC}/kenney_rpg-audio/Audio/handleCoins.ogg`],
  gold_drop: [0.4, `${CC}/kenney_casino-audio/Audio/chips-collide-1.ogg`],
  item_pickup: [0.5, `${FC}/soundfx/inventory/inventory_object.ogg`],
  potion_drink: [0.6, `${FC}/soundfx/powers/potion.ogg`],
  potion_drop: [0.5, `${FC}/soundfx/inventory/inventory_potion.ogg`],
  globe_pickup: [0.5, `${EC}/soundfx/powers/mastite_regen.ogg`],
  equip_armor: [0.55, `${FC}/soundfx/inventory/inventory_maille.ogg`, `${FC}/soundfx/inventory/inventory_leather.ogg`],
  equip_weapon: [0.55, `${FC}/soundfx/inventory/inventory_metal.ogg`],
  equip_jewelry: [0.55, `${FC}/soundfx/inventory/inventory_gem.ogg`],
  drop_common: [0.4, `${FC}/soundfx/flying_loot.ogg`],
  drop_magic: [0.45, `${FC}/soundfx/flying_loot.ogg`],
  drop_rare: [0.55, `${FC}/soundfx/flying_loot.ogg`],
  door_open: [0.55, `${FC}/soundfx/door_open.ogg`],
  chest_open: [0.6, `${FC}/soundfx/wood_open.ogg`],
  chest_open_rare: [0.6, `${FC}/soundfx/environment/stone_open.ogg`],
  waypoint_travel: [0.6, `${FC}/soundfx/environment/teleporter.ogg`],
  portal_travel: [0.6, `${FC}/soundfx/environment/teleporter.ogg`],
  stairs: [0.55, `${FC}/soundfx/environment/stairs.ogg`],
  level_up: [0.8, `${FC}/soundfx/level_up.ogg`],
  player_death: [0.75, `${FC}/soundfx/male_die.ogg`],
  low_life_heartbeat: [0.6, `${FC}/soundfx/heartbeat.ogg`],
  no_resource: [0.4, `${FC}/soundfx/no_mana.ogg`],
  footstep_stone: [0.18, `${FC}/soundfx/steps/step_echo1.ogg`, `${FC}/soundfx/steps/step_echo2.ogg`, `${FC}/soundfx/steps/step_echo3.ogg`, `${FC}/soundfx/steps/step_echo4.ogg`],
  footstep_dirt: [0.2, `${FC}/soundfx/steps/step_leather1.ogg`, `${FC}/soundfx/steps/step_leather2.ogg`, `${FC}/soundfx/steps/step_leather3.ogg`],
  ui_click: [0.5, `${CC}/kenney_interface-sounds/Audio/click_002.ogg`],
  ui_open: [0.45, `${CC}/kenney_rpg-audio/Audio/bookOpen.ogg`],
  ui_close: [0.4, `${CC}/kenney_rpg-audio/Audio/bookClose.ogg`],
  ui_error: [0.45, `${CC}/kenney_interface-sounds/Audio/error_004.ogg`],
  ui_confirm: [0.5, `${CC}/kenney_interface-sounds/Audio/confirmation_002.ogg`],
  sell: [0.5, `${FC}/soundfx/inventory/inventory_coins.ogg`],
  buy: [0.5, `${FC}/soundfx/inventory/inventory_coins.ogg`],
  salvage: [0.6, K('impactMetal_heavy_000')],
  craft_upgrade: [0.65, K('impactBell_heavy_000')],
  craft_reroll: [0.55, `${CC}/oga_get-ruby-se/getruby.ogg`],
  shrine_activate: [0.6, `${EC}/soundfx/powers/mastite_regen.ogg`],
  legendary_chime: [0.7, `${CC}/oga_bell-arpeggio-24/24.wav`],
  amb_wind: [0.35, `${FC}/soundfx/environment/wind_loop.ogg`],
  amb_cave: [0.4, `${FC}/soundfx/environment/cave_droplets_loop.ogg`],
  amb_crypt: [0.35, `${FC}/soundfx/environment/cave_wind_loop.ogg`],
  amb_forest: [0.35, `${FC}/soundfx/environment/forest_owl_loop.ogg`],
  amb_fire: [0.35, `${FC}/soundfx/environment/open_fire_loop.ogg`],
  amb_town: [0.3, `${FC}/soundfx/environment/anvil_loop.ogg`],
};

const MUSIC = {
  music_title: [0.6, `${FC}/music/title_theme.ogg`],
  music_town: [0.55, `${FC}/music/town_theme.ogg`],
  music_crypt: [0.55, `${FC}/music/dungeon_theme.ogg`],
  music_cave: [0.55, `${FC}/music/cave_theme.ogg`],
  music_forest: [0.55, `${FC}/music/magical_theme.ogg`],
  music_hell: [0.55, `${FC}/music/unrest_theme.ogg`],
  music_boss: [0.6, `${FC}/music/boss_theme.ogg`],
  music_rift: [0.55, `${FC}/music/battle_theme.ogg`],
};

fs.mkdirSync(path.join(OUT, 'sfx'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'music'), { recursive: true });
const manifest = { sfx: {}, music: {} };
let bytes = 0;
const copy = (src, dst) => {
  const abs = path.join(ROOT, src);
  if (!fs.existsSync(abs)) {
    console.warn(`missing ${src}`);
    return false;
  }
  const out = path.join(OUT, dst);
  if (!fs.existsSync(out) || fs.statSync(out).size !== fs.statSync(abs).size) fs.copyFileSync(abs, out);
  bytes += fs.statSync(out).size;
  return true;
};
for (const [id, [volume, ...files]] of Object.entries(SFX)) {
  const list = [];
  files.forEach((f, i) => {
    const ext = path.extname(f);
    const name = `sfx/${id}${files.length > 1 ? `_${i}` : ''}${ext}`;
    if (copy(f, name)) list.push(name);
  });
  if (list.length) manifest.sfx[id] = { files: list, volume };
}
for (const [id, [volume, file]] of Object.entries(MUSIC)) {
  const name = `music/${id}${path.extname(file)}`;
  if (copy(file, name)) manifest.music[id] = { files: [name], volume };
}
fs.writeFileSync(path.join(OUT, 'audio-manifest.json'), JSON.stringify(manifest, null, 1));
console.log(`audio: ${Object.keys(manifest.sfx).length} sfx, ${Object.keys(manifest.music).length} music, ${(bytes / 1048576).toFixed(1)} MB`);
