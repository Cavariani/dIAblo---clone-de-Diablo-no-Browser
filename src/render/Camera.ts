// Smooth-follow iso camera with zoom and trauma-based screen shake.
import { clamp, damp, worldToScreen, type Vec2 } from '../core/math';

export class Camera {
  /** Camera center in screen-space pixels (zoom 1). */
  x = 0;
  y = 0;
  zoom = 0.85;
  targetZoom = 0.85;
  private trauma = 0;
  private shakeDecay = 2.5;
  shakeScale = 1;
  offX = 0;
  offY = 0;
  private t = 0;

  snap(p: Vec2): void {
    const s = worldToScreen(p.x, p.y);
    this.x = s.x;
    this.y = s.y - 40;
  }

  shake(intensity: number, duration = 0.25): void {
    this.trauma = Math.min(1, this.trauma + intensity);
    this.shakeDecay = 1 / Math.max(0.05, duration);
  }

  update(target: Vec2, lookAhead: Vec2, dt: number): void {
    const s = worldToScreen(target.x, target.y);
    const tx = s.x + lookAhead.x;
    const ty = s.y - 40 + lookAhead.y;
    this.x = damp(this.x, tx, 12, dt);
    this.y = damp(this.y, ty, 12, dt);
    this.zoom = damp(this.zoom, this.targetZoom, 10, dt);
    this.t += dt;
    if (this.trauma > 0) {
      const k = this.trauma * this.trauma * 22 * this.shakeScale;
      this.offX = (Math.sin(this.t * 91) + Math.sin(this.t * 53) * 0.5) * k;
      this.offY = (Math.cos(this.t * 77) + Math.sin(this.t * 41) * 0.5) * k;
      this.trauma = Math.max(0, this.trauma - dt * this.shakeDecay * 0.6);
    } else {
      this.offX = this.offY = 0;
    }
  }

  zoomBy(steps: number): void {
    this.targetZoom = clamp(this.targetZoom * Math.pow(0.9, steps), 0.6, 1.2);
  }
}
