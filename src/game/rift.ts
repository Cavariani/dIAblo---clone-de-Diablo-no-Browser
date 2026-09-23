// Rifts (Fendas): random-biome timed runs; kills fill a progress bar that summons the Guardian.
import { Data } from '../data';
import type { MonsterRank } from '../data/schema';
import type { GameCtx, System } from './api';
import { onGameCreated, registerSystem } from './hooks';
import { spawnMonster } from './monsters/spawn';
import { registerInteractHandler } from './systems/PlayerControlSystem';
import { dropLoot } from './systems/LootSystem';

export interface RiftState {
  active: boolean;
  greater: boolean;
  level: number;
  progress: number;
  timeLeft: number;
  guardianId: number | null;
  done: boolean;
  failed: boolean;
}

export const rift: RiftState = { active: false, greater: false, level: 0, progress: 0, timeLeft: 0, guardianId: null, done: false, failed: false };

export function startRift(ctx: GameCtx, greater: boolean, level: number): boolean {
  const c = ctx.character;
  if (greater) {
    if (c.riftKeys <= 0) {
      ctx.ui.toast('Você precisa de um Selo de Fenda (complete uma Fenda comum)', 'warn');
      return false;
    }
    c.riftKeys--;
  }
  rift.greater = greater;
  rift.level = greater ? level : 0;
  ctx.audio.play('rift_open');
  ctx.events.emit('riftOpened', { greater, level });
  ctx.travel({ kind: 'rift', greater, level });
  return true;
}

class RiftSystem implements System {
  readonly name = 'rift';
  update(ctx: GameCtx, dt: number): void {
    if (!rift.active || rift.done) return;
    if (rift.greater && !rift.failed) {
      rift.timeLeft -= dt;
      if (rift.timeLeft <= 0) {
        rift.failed = true;
        ctx.ui.banner('Tempo Esgotado', 'A Fenda Maior não recompensará o seu avanço', 'rift');
        ctx.events.emit('riftFailed', {});
      }
    }
  }
}
registerSystem(95, () => new RiftSystem());

function spawnGuardian(ctx: GameCtx): void {
  const id = Data.rift.guardians[Math.floor(Math.random() * Data.rift.guardians.length)];
  const p = ctx.player.pos;
  const at = ctx.world.nearestWalkable({ x: p.x + 3, y: p.y + 3 }, 6) ?? p;
  const g = spawnMonster(ctx, id, at, { rank: 'guardian', name: Data.boss(id).name });
  if (!g) return;
  rift.guardianId = g.id;
  g.ai!.aggro = false;
  ctx.fx.shockwave(at, { radius: 5, duration: 0.8 });
  ctx.fx.burst('arcane', at, { count: 60, scale: 2 });
  ctx.fx.screenFlash(0x600040, 0.35, 0.6);
  ctx.audio.play('rift_guardian');
  ctx.events.emit('riftGuardianSpawned', { actor: g });
}

onGameCreated((game: GameCtx) => {
  game.events.on('zoneEntered', ({ isRift }) => {
    if (isRift) {
      rift.active = true;
      rift.progress = 0;
      rift.timeLeft = Data.rift.timeLimit;
      rift.guardianId = null;
      rift.done = false;
      rift.failed = false;
      game.ui.banner(rift.greater ? `Fenda Maior ${rift.level}` : 'Fenda', 'Mate monstros para convocar o Guardião', 'rift');
    } else rift.active = false;
  });
  game.events.on('actorDied', ({ actor }) => {
    if (!rift.active || !actor.monster || actor.faction !== 'enemy') return;
    if (actor.id === rift.guardianId) {
      rift.done = true;
      const c = game.character;
      c.riftsCompleted++;
      if (rift.greater && !rift.failed) c.greaterRiftHighest = Math.max(c.greaterRiftHighest, rift.level);
      c.riftKeys += rift.greater ? (rift.failed ? 0 : 2) : 1;
      dropLoot(game, actor.pos, 'guardian', actor.level, 1 + rift.level * 0.05);
      c.materials.riftShard = (c.materials.riftShard ?? 0) + 3 + rift.level;
      game.ui.banner('Fenda Concluída', rift.greater ? (rift.failed ? 'Tempo esgotado' : `Nível ${rift.level} dominado! +2 Selos`) : '+1 Selo de Fenda', 'rift');
      game.audio.play('rift_complete');
      game.fx.burst('levelup', actor.pos, { count: 80 });
      (game as unknown as { addInteractable: (w: unknown, s: unknown) => void }).addInteractable(game.world, { kind: 'riftExit', pos: { x: actor.pos.x + 1.2, y: actor.pos.y + 1.2 }, name: 'Voltar a Brasaluz' });
      game.events.emit('riftCompleted', { greater: rift.greater, level: rift.level, timeLeft: rift.timeLeft });
      return;
    }
    if (rift.guardianId !== null) return;
    const add = Data.rift.progressByRank[actor.monster.rank as MonsterRank] ?? 0.01;
    rift.progress = Math.min(1, rift.progress + add);
    game.events.emit('riftProgress', { progress: rift.progress });
    if (rift.progress >= 1) spawnGuardian(game);
  });
});

registerInteractHandler('riftExit', (ctx) => {
  ctx.audio.play('portal_travel');
  ctx.travel({ kind: 'town' });
});
