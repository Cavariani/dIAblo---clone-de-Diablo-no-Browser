// Dispatches AI behaviours; far-away monsters sleep for performance.
import type { GameCtx, System } from '../api';
import { getBehavior } from '../ai/registry';
import '../ai';

const SLEEP_DIST = 22;

export class AISystem implements System {
  readonly name = 'ai';

  update(ctx: GameCtx, dt: number): void {
    const p = ctx.player.pos;
    for (const a of ctx.world.actors) {
      if (!a.alive || !a.ai || a.kind === 'player') continue;
      if (a.kind !== 'minion') {
        const dx = a.pos.x - p.x;
        const dy = a.pos.y - p.y;
        if (dx * dx + dy * dy > SLEEP_DIST * SLEEP_DIST && !a.ai.aggro) {
          a.vel.x = a.vel.y = 0;
          continue;
        }
      }
      // fear: run away from the player, no actions
      if (a.statuses.some((s) => s.id === 'fear')) {
        a.cast = null;
        const dx = a.pos.x - p.x;
        const dy = a.pos.y - p.y;
        const l = Math.hypot(dx, dy) || 1;
        a.vel.x = (dx / l) * a.moveSpeed;
        a.vel.y = (dy / l) * a.moveSpeed;
        continue;
      }
      const b = getBehavior(a.kind === 'minion' ? 'minion' : a.ai.behavior) ?? getBehavior('melee');
      b?.update(ctx, a, dt);
    }
  }
}
