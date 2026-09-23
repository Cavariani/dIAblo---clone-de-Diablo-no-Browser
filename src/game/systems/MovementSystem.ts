// Integrates velocities, knockback and dashes; resolves wall & actor collisions; drives run/stance anims.
import type { GameCtx, System } from '../api';
import { playAnim } from '../combat/Combat';
import type { World } from '../World';
import type { Actor } from '../types';

const near: Actor[] = [];
/** Facing turn speed (rad/s): a 180° turn takes ~0.14s. */
const TURN_RATE = 22;
/** Seconds without input before the run cycle drops to stance. */
const STOP_GRACE = 0.09;
const stillTime = new WeakMap<Actor, number>();

function resolveWalls(w: World, a: Actor): void {
  const r = a.radius;
  for (let iter = 0; iter < 2; iter++) {
    const x0 = Math.floor(a.pos.x - r);
    const x1 = Math.floor(a.pos.x + r);
    const y0 = Math.floor(a.pos.y - r);
    const y1 = Math.floor(a.pos.y + r);
    for (let cy = y0; cy <= y1; cy++)
      for (let cx = x0; cx <= x1; cx++) {
        if (w.walkableCell(cx, cy)) continue;
        const px = Math.max(cx, Math.min(a.pos.x, cx + 1));
        const py = Math.max(cy, Math.min(a.pos.y, cy + 1));
        let dx = a.pos.x - px;
        let dy = a.pos.y - py;
        const d2 = dx * dx + dy * dy;
        if (d2 >= r * r) continue;
        if (d2 < 1e-10) {
          // center inside the cell: push out along the shortest axis
          const lx = a.pos.x - cx;
          const rx = cx + 1 - a.pos.x;
          const ty = a.pos.y - cy;
          const by = cy + 1 - a.pos.y;
          const m = Math.min(lx, rx, ty, by);
          if (m === lx) a.pos.x = cx - r;
          else if (m === rx) a.pos.x = cx + 1 + r;
          else if (m === ty) a.pos.y = cy - r;
          else a.pos.y = cy + 1 + r;
          continue;
        }
        const d = Math.sqrt(d2);
        dx /= d;
        dy /= d;
        a.pos.x = px + dx * r;
        a.pos.y = py + dy * r;
      }
  }
}

export class MovementSystem implements System {
  readonly name = 'movement';

  update(ctx: GameCtx, dt: number): void {
    const w = ctx.world as World;
    for (const a of w.actors) {
      if (!a.alive || a.kind === 'npc') continue;
      // dash overrides everything
      if (a.dash) {
        const d = a.dash;
        d.time += dt;
        const t = Math.min(1, d.time / d.duration);
        a.pos.x = d.from.x + (d.to.x - d.from.x) * t;
        a.pos.y = d.from.y + (d.to.y - d.from.y) * t;
        a.facing = Math.atan2(d.to.y - d.from.y, d.to.x - d.from.x);
        d.onStep?.(t);
        if (t >= 1) {
          a.dash = null;
          a.state = 'idle';
          d.onArrive?.();
        }
        continue;
      }
      let vx = a.vel.x;
      let vy = a.vel.y;
      const busy = a.state === 'stunned' || a.state === 'frozen' || a.state === 'spawning' || (a.cast && !a.cast.channel);
      if (busy) vx = vy = 0;
      vx += a.knockback.x;
      vy += a.knockback.y;
      const kd = Math.exp(-dt * 9);
      a.knockback.x *= kd;
      a.knockback.y *= kd;
      if (Math.abs(a.knockback.x) + Math.abs(a.knockback.y) < 0.02) a.knockback.x = a.knockback.y = 0;
      a.pos.x += vx * dt;
      a.pos.y += vy * dt;

      // soft separation between actors
      if (a.mass < 50) {
        w.queryActors(a.pos.x, a.pos.y, a.radius + 0.6, near);
        for (const b of near) {
          if (b === a || !b.alive) continue;
          const dx = a.pos.x - b.pos.x;
          const dy = a.pos.y - b.pos.y;
          const min = a.radius + b.radius;
          const d2 = dx * dx + dy * dy;
          if (d2 >= min * min || d2 < 1e-8) continue;
          const d = Math.sqrt(d2);
          const push = (min - d) * (b.mass / (a.mass + b.mass)) * (a.kind === 'player' ? 0.5 : 0.8);
          a.pos.x += (dx / d) * push;
          a.pos.y += (dy / d) * push;
        }
      }
      resolveWalls(w, a);

      const moving = vx * vx + vy * vy > 0.01 && !busy;
      if (moving && (a.vel.x !== 0 || a.vel.y !== 0)) {
        // turn quickly but not instantly, so the 8-direction sprite sweeps through turns instead of popping
        const target = Math.atan2(a.vel.y, a.vel.x);
        const diff = Math.atan2(Math.sin(target - a.facing), Math.cos(target - a.facing));
        const maxTurn = TURN_RATE * dt;
        a.facing += Math.abs(diff) <= maxTurn ? diff : Math.sign(diff) * maxTurn;
      }
      // locomotion animation
      if (!a.cast && (a.state === 'idle' || a.state === 'moving')) {
        const wantsWalk = a.vel.x * a.vel.x + a.vel.y * a.vel.y > 0.01;
        const still = wantsWalk ? 0 : (stillTime.get(a) ?? 0) + dt;
        stillTime.set(a, still);
        // brief stops (path corners, re-targeting) keep the run cycle instead of flickering to stance
        const walking = wantsWalk || (a.anim.name === 'run' && still < STOP_GRACE);
        a.state = walking ? 'moving' : 'idle';
        const runSpeed = a.moveSpeed / Math.max(0.5, a.kind === 'player' ? 2.4 : a.baseMoveSpeed || 1);
        playAnim(a, walking ? 'run' : 'stance', true, walking ? runSpeed : 1);
      }
    }
  }
}
