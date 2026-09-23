// Bootstrap. (Temporary quick-start until the menu flow lands: starts a Berserker in the crypt.)
import { InputManager } from './core/input';
import './game/modules';
import { Game } from './game/Game';
import { audio } from './audio/AudioManager';
import { defaultAppearance, defaultSettings, emptyStash, newCharacter } from './game/save/defaults';
import { assets } from './render/assets/AssetManager';
import { Renderer } from './render/Renderer';
import { UIRoot } from './ui/UIRoot';
import './ui/panels';
import { Data } from './data';
import type { Rarity } from './data/schema';
import { createItem } from './game/items/generate';
import { addToGrid } from './game/items/inventory';
import { dropItem } from './game/systems/LootSystem';


async function boot(): Promise<void> {
  const root = document.getElementById('game-root')!;
  const renderer = new Renderer();
  await renderer.init(root);
  await Promise.all([assets.init(), audio.init()]);
  const unlock = () => audio.unlock();
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
  const settings = defaultSettings();
  renderer.applySettings(settings);
  audio.applySettings(settings);
  const input = new InputManager();
  input.attach(root);
  const params = new URLSearchParams(location.search);
  const classId = (params.get('class') as 'berserker') ?? 'berserker';
  const character = newCharacter(classId, 'Herói', defaultAppearance(classId));
  character.location = { zoneId: params.get('zone') ?? 'crypt', floor: Number(params.get('floor') ?? 1) };
  const ui = new UIRoot(document.getElementById('ui-root')!);
  const game = new Game({ character, stash: emptyStash(), settings, renderer, ui, audio, input, save: null });
  ui.bind(game);
  await game.start();
  document.getElementById('boot')?.remove();
  (window as unknown as { __game: Game }).__game = game;
  (window as unknown as { __classSkills: string[] }).__classSkills = Data.classDef(classId).skills;
  (window as unknown as { __dbg: unknown }).__dbg = {
    give(rarity: Rarity, n = 1) {
      for (let i = 0; i < n; i++) addToGrid(game.character.inventory, createItem(game.rng, { ilvl: Math.max(1, game.character.level), rarity, classId: game.character.classId }));
      game.events.emit('inventoryChanged', {});
    },
    drop(rarity: Rarity) {
      dropItem(game, game.player.pos, createItem(game.rng, { ilvl: game.character.level, rarity, classId: game.character.classId }));
    },
    open(id: string) {
      ui.openPanel(id as never);
    },
  };
  let last = performance.now();
  const frame = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    game.frame(dt);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

void boot();
