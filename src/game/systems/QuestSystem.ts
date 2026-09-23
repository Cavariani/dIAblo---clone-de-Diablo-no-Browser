// Quests: availability, progress tracking via events, turn-in rewards.
import { Rng } from '../../core/rng';
import { Data } from '../../data';
import type { QuestDef } from '../../data/schema';
import type { GameCtx } from '../api';
import { onGameCreated } from '../hooks';
import { createItem } from '../items/generate';
import { addToGrid } from '../items/inventory';
import { gainXp } from '../progression/xp';
import { dropItem } from './LootSystem';

export function questGoal(q: QuestDef): number {
  const o = q.objective;
  return o.kind === 'kill' || o.kind === 'clearRift' || o.kind === 'collect' ? o.count : 1;
}

export function questAvailable(ctx: GameCtx, q: QuestDef): boolean {
  const st = ctx.character.quests[q.id];
  if (st) return false;
  return (q.requires ?? []).every((r) => ctx.character.quests[r]?.status === 'turnedIn');
}

export function acceptQuest(ctx: GameCtx, q: QuestDef): void {
  ctx.character.quests[q.id] = { status: 'active', progress: 0 };
  // already satisfied objectives
  if (q.objective.kind === 'killBoss' && ctx.character.bossesKilled[q.objective.bossId]) complete(ctx, q);
  ctx.events.emit('questAccepted', { questId: q.id });
  ctx.ui.toast(`Missão aceita: ${q.name}`, 'quest');
}

function complete(ctx: GameCtx, q: QuestDef): void {
  const st = ctx.character.quests[q.id];
  if (!st || st.status !== 'active') return;
  st.status = 'complete';
  st.progress = questGoal(q);
  ctx.events.emit('questCompleted', { questId: q.id });
  ctx.ui.toast(`Missão concluída: ${q.name} — volte a ${Data.npc(q.giver).name}`, 'quest');
  ctx.audio.play('quest_complete');
}

function progress(ctx: GameCtx, q: QuestDef, n = 1): void {
  const st = ctx.character.quests[q.id];
  if (!st || st.status !== 'active') return;
  st.progress = Math.min(questGoal(q), st.progress + n);
  ctx.events.emit('questProgress', { questId: q.id, progress: st.progress, goal: questGoal(q) });
  if (st.progress >= questGoal(q)) complete(ctx, q);
}

export function turnIn(ctx: GameCtx, q: QuestDef): void {
  const c = ctx.character;
  const st = c.quests[q.id];
  if (!st || st.status !== 'complete') return;
  st.status = 'turnedIn';
  c.gold += q.reward.gold;
  gainXp(ctx, q.reward.xp);
  if (q.reward.skillPoint) c.bonusSkillPoints++;
  if (q.reward.item) {
    const item = createItem(new Rng(), { ilvl: c.level + 1, rarity: q.reward.item.rarity, classId: c.classId });
    if (!addToGrid(c.inventory, item)) dropItem(ctx, ctx.player.pos, item);
  }
  ctx.events.emit('questTurnedIn', { questId: q.id });
  ctx.events.emit('goldChanged', { gold: c.gold });
  ctx.events.emit('inventoryChanged', {});
  ctx.ui.banner('Missão Concluída', q.name, 'quest');
  ctx.audio.play('quest_complete');
}

onGameCreated((game: GameCtx) => {
  const active = () => Data.quests.filter((q) => game.character.quests[q.id]?.status === 'active');
  game.events.on('actorDied', ({ actor, killer }) => {
    if (!actor.monster || actor.faction !== 'enemy') return;
    void killer;
    for (const q of active()) {
      const o = q.objective;
      if (o.kind === 'kill') {
        if (o.zoneId && game.world.info.zone.id !== o.zoneId) continue;
        if (o.enemyId && actor.monster.defId !== o.enemyId) continue;
        if (o.rank && !(o.rank === 'champion' ? actor.tags.has('elite') : actor.monster.rank === o.rank)) continue;
        progress(game, q);
      }
    }
  });
  game.events.on('bossDefeated', ({ bossId }) => {
    for (const q of active()) if (q.objective.kind === 'killBoss' && q.objective.bossId === bossId) complete(game, q);
  });
  game.events.on('zoneEntered', ({ zoneId, floor }) => {
    for (const q of active()) if (q.objective.kind === 'reachFloor' && q.objective.zoneId === zoneId && floor >= q.objective.floor) complete(game, q);
  });
  game.events.on('riftCompleted', () => {
    for (const q of active()) if (q.objective.kind === 'clearRift') progress(game, q);
  });
});
