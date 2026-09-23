// Bootstrap. (Temporary quick-start until the menu flow lands: starts a Berserker in the crypt.)
import { InputManager } from './core/input';
import { Game } from './game/Game';
import type { AudioAPI, UIAPI } from './game/api';
import { defaultAppearance, defaultSettings, emptyStash, newCharacter } from './game/save/defaults';
import { assets } from './render/assets/AssetManager';
import { Renderer } from './render/Renderer';

const nullUI: UIAPI = {
  toast: () => {},
  banner: () => {},
  openPanel: () => {},
  closePanel: () => {},
  togglePanel: () => {},
  isOpen: () => false,
  closeAll: () => false,
  isPointerOverUI: () => false,
  isModal: () => false,
  setBossBar: () => {},
  update: () => {},
};
const nullAudio: AudioAPI = { play: () => {}, playMusic: () => {}, stopMusic: () => {}, setListener: () => {}, applySettings: () => {}, unlock: () => {} };

async function boot(): Promise<void> {
  const root = document.getElementById('game-root')!;
  const renderer = new Renderer();
  await renderer.init(root);
  await assets.init();
  const settings = defaultSettings();
  renderer.applySettings(settings);
  const input = new InputManager();
  input.attach(root);
  const params = new URLSearchParams(location.search);
  const classId = (params.get('class') as 'berserker') ?? 'berserker';
  const character = newCharacter(classId, 'Herói', defaultAppearance(classId));
  character.location = { zoneId: params.get('zone') ?? 'crypt', floor: Number(params.get('floor') ?? 1) };
  const game = new Game({ character, stash: emptyStash(), settings, renderer, ui: nullUI, audio: nullAudio, input, save: null });
  await game.start();
  document.getElementById('boot')?.remove();
  (window as unknown as { __game: Game }).__game = game;
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
