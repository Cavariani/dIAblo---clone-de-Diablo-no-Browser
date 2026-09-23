// Screen-space light map: clear to ambient, add radial lights, multiply over the world.
import { Container, RenderTexture, Sprite, type Renderer } from 'pixi.js';
import type { LightDef } from '../../data/schema';
import { tex } from '../textures';

export class Lighting {
  readonly sprite: Sprite;
  private rt: RenderTexture;
  private lightsRoot = new Container();
  private pool: Sprite[] = [];
  private used = 0;
  private scale = 0.5;
  ambient = 0x101018;
  darkness = 0.8;
  enabled = true;

  constructor() {
    this.rt = RenderTexture.create({ width: 64, height: 64, resolution: 1 });
    this.sprite = new Sprite(this.rt);
    this.sprite.blendMode = 'multiply';
  }

  setQuality(high: boolean): void {
    this.scale = high ? 0.75 : 0.5;
  }

  resize(w: number, h: number): void {
    const rw = Math.max(16, Math.ceil(w * this.scale));
    const rh = Math.max(16, Math.ceil(h * this.scale));
    if (this.rt.width !== rw || this.rt.height !== rh) this.rt.resize(rw, rh);
    this.sprite.scale.set(w / rw, h / rh);
  }

  begin(): void {
    this.used = 0;
  }

  /** Adds a light at screen position (CSS px). radiusPx = world radius in screen px (horizontal). */
  add(sx: number, sy: number, radiusPx: number, def: LightDef, mult = 1): void {
    let s = this.pool[this.used];
    if (!s) {
      s = new Sprite({ texture: tex().light, anchor: 0.5 });
      s.blendMode = 'add';
      this.pool.push(s);
      this.lightsRoot.addChild(s);
    }
    this.used++;
    s.visible = true;
    s.position.set(sx * this.scale, sy * this.scale);
    const d = (radiusPx * 2 * this.scale) / 256;
    s.scale.set(d, d * 0.5);
    s.tint = def.color;
    s.alpha = Math.min(1, def.intensity * mult);
  }

  render(renderer: Renderer): void {
    for (let i = this.used; i < this.pool.length; i++) this.pool[i].visible = false;
    const k = 1 - this.darkness;
    const ar = ((this.ambient >> 16) & 255) / 255;
    const ag = ((this.ambient >> 8) & 255) / 255;
    const ab = (this.ambient & 255) / 255;
    const clearColor: [number, number, number, number] = [Math.min(1, ar + k), Math.min(1, ag + k), Math.min(1, ab + k), 1];
    renderer.render({ container: this.lightsRoot, target: this.rt, clear: true, clearColor });
    this.sprite.visible = this.enabled;
  }
}
