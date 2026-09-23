// Dependency-free extension points for feature modules (avoids import cycles with Game.ts).
import type { GameCtx, System } from './api';

export interface HookedGame extends GameCtx {
  readonly renderer: unknown;
}

export const extraSystems: { order: number; make: () => System }[] = [];
/** Adds a system to every Game (order: 10 control … 130 death). */
export const registerSystem = (order: number, make: () => System): void => {
  extraSystems.push({ order, make });
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GameHook = (game: any) => void;
export const worldHooks: GameHook[] = [];
/** Called whenever a new world is entered. */
export const onWorldEntered = (fn: GameHook): void => {
  worldHooks.push(fn);
};
export const gameHooks: GameHook[] = [];
/** Called once when a Game is created (subscribe to events here). */
export const onGameCreated = (fn: GameHook): void => {
  gameHooks.push(fn);
};
