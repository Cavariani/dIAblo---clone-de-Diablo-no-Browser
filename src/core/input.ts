// Keyboard/mouse input with action bindings and per-step edge detection.
import type { InputAction, InputAPI } from '../game/api';
import type { Vec2 } from './math';

export const DEFAULT_BINDINGS: Record<InputAction, string[]> = {
  skill_lmb: ['Mouse0'],
  skill_rmb: ['Mouse2'],
  skill_k1: ['Digit1'],
  skill_k2: ['Digit2'],
  skill_k3: ['Digit3'],
  skill_k4: ['Digit4'],
  potion: ['KeyQ'],
  portal: ['KeyT'],
  forceStand: ['ShiftLeft', 'ShiftRight'],
  showLabels: ['AltLeft', 'AltRight'],
  moveUp: ['KeyW'],
  moveDown: ['KeyS'],
  moveLeft: ['KeyA'],
  moveRight: ['KeyD'],
  inventory: ['KeyI', 'KeyB'],
  character: ['KeyC'],
  skills: ['KeyK'],
  paragon: ['KeyP'],
  quests: ['KeyJ'],
  map: ['Tab', 'KeyM'],
  pause: ['Escape'],
};

export class InputManager implements InputAPI {
  readonly mouse: Vec2 = { x: 0, y: 0 };
  readonly mouseWorld: Vec2 = { x: 0, y: 0 };
  readonly hover = { actorId: null as number | null, groundItemId: null as number | null, interactableId: null as number | null };
  wheel = 0;
  private wheelAcc = 0;
  private down = new Set<string>();
  private pressedAcc = new Set<string>();
  private releasedAcc = new Set<string>();
  private pressed = new Set<string>();
  private released = new Set<string>();
  private bindings = DEFAULT_BINDINGS;
  /** Codes pressed since last frame (for UI hotkeys that don't go through the sim step). */
  private framePressed = new Set<string>();
  private target: HTMLElement | null = null;

  attach(canvasParent: HTMLElement): void {
    this.target = canvasParent;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('pointermove', this.onPointerMove);
    canvasParent.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointerup', this.onPointerUp);
    canvasParent.addEventListener('wheel', this.onWheel, { passive: true });
    canvasParent.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  detach(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    this.target?.removeEventListener('pointerdown', this.onPointerDown);
    this.target?.removeEventListener('wheel', this.onWheel);
  }

  private press(code: string): void {
    if (!this.down.has(code)) {
      this.pressedAcc.add(code);
      this.framePressed.add(code);
    }
    this.down.add(code);
  }

  private release(code: string): void {
    if (this.down.has(code)) this.releasedAcc.add(code);
    this.down.delete(code);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    if (e.code === 'Tab' || e.code.startsWith('Alt') || e.code === 'F1') e.preventDefault();
    this.press(e.code);
  };

  private onKeyUp = (e: KeyboardEvent): void => this.release(e.code);

  private onBlur = (): void => {
    for (const c of [...this.down]) this.release(c);
  };

  private onPointerMove = (e: PointerEvent): void => {
    this.mouse.x = e.clientX;
    this.mouse.y = e.clientY;
  };

  private onPointerDown = (e: PointerEvent): void => {
    this.mouse.x = e.clientX;
    this.mouse.y = e.clientY;
    this.press(`Mouse${e.button}`);
  };

  private onPointerUp = (e: PointerEvent): void => this.release(`Mouse${e.button}`);

  private onWheel = (e: WheelEvent): void => {
    this.wheelAcc += Math.sign(e.deltaY);
  };

  /** Called once per simulation step. */
  poll(): void {
    this.pressed = this.pressedAcc;
    this.released = this.releasedAcc;
    this.pressedAcc = new Set();
    this.releasedAcc = new Set();
    this.wheel = this.wheelAcc;
    this.wheelAcc = 0;
  }

  /** Frame-level edge check (menus/hotkeys). Consumes the press. */
  consumeFramePress(action: InputAction): boolean {
    for (const c of this.bindings[action]) {
      if (this.framePressed.has(c)) {
        this.framePressed.delete(c);
        return true;
      }
    }
    return false;
  }

  endFrame(): void {
    this.framePressed.clear();
  }

  isDown(action: InputAction): boolean {
    for (const c of this.bindings[action]) if (this.down.has(c)) return true;
    return false;
  }

  wasPressed(action: InputAction): boolean {
    for (const c of this.bindings[action]) if (this.pressed.has(c)) return true;
    return false;
  }

  wasReleased(action: InputAction): boolean {
    for (const c of this.bindings[action]) if (this.released.has(c)) return true;
    return false;
  }

  /** Forget mouse button state (e.g. click consumed by UI). */
  clearMouse(): void {
    for (const c of [...this.down]) if (c.startsWith('Mouse')) this.down.delete(c);
    for (const c of [...this.pressedAcc]) if (c.startsWith('Mouse')) this.pressedAcc.delete(c);
  }
}
