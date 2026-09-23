// Fog of war: visibility (radius + line of sight) and exploration, updated a few times per second.
import type { GameCtx, System } from '../api';
import { registerSystem } from '../hooks';
import type { World } from '../World';

const RADIUS = 9;

class FogSystem implements System {
  readonly name = 'fog';
  private acc = 1;
  private lastCell = -1;
  private visList: number[] = [];

  update(ctx: GameCtx, dt: number): void {
    const w = ctx.world as World;
    const m = w.map;
    this.acc += dt;
    const p = ctx.player.pos;
    const cell = Math.floor(p.y) * m.width + Math.floor(p.x);
    if (this.acc < 0.15 && cell === this.lastCell) return;
    this.acc = 0;
    this.lastCell = cell;
    for (const i of this.visList) m.visible[i] = 0;
    this.visList.length = 0;
    if (w.info.isTown) {
      if (!(m as { fogVersion?: number }).fogVersion) {
        m.explored.fill(1);
        m.visible.fill(1);
        (m as { fogVersion?: number }).fogVersion = 1;
      }
      return;
    }
    const cx = Math.floor(p.x);
    const cy = Math.floor(p.y);
    const r2 = RADIUS * RADIUS;
    for (let y = cy - RADIUS; y <= cy + RADIUS; y++) {
      if (y < 0 || y >= m.height) continue;
      for (let x = cx - RADIUS; x <= cx + RADIUS; x++) {
        if (x < 0 || x >= m.width) continue;
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy > r2) continue;
        const i = y * m.width + x;
        // walls are revealed when a neighbouring floor is visible (so rooms outline nicely)
        const target = { x: x + 0.5, y: y + 0.5 };
        if (!w.lineOfSightLoose(p, target)) continue;
        m.visible[i] = 1;
        m.explored[i] = 1;
        this.visList.push(i);
      }
    }
    const fm = m as { fogVersion?: number };
    fm.fogVersion = (fm.fogVersion ?? 0) + 1;
  }
}

registerSystem(120, () => new FogSystem());
