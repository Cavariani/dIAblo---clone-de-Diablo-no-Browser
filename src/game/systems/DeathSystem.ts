// Corpse timers & removal, minion expiry.
import type { GameCtx, System } from '../api';
import type { World } from '../World';

export class DeathSystem implements System {
  readonly name = 'death';

  update(ctx: GameCtx, dt: number): void {
    const w = ctx.world as World;
    for (let i = w.actors.length - 1; i >= 0; i--) {
      const a = w.actors[i];
      if (a.minion?.expiresAt && ctx.time >= a.minion.expiresAt && a.alive) ctx.combat.kill(a, null);
      if (a.alive || a.kind === 'player') continue;
      a.corpseTimer -= dt;
      if (a.corpseTimer <= 0) w.removeActor(a);
    }
    w.compact();
  }
}
