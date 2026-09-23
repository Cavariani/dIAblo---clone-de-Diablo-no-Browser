// XP gain, level ups and paragon.
import { Data } from '../../data';
import { buildXpTable, levelDiffMult, paragonXp } from '../../formulas/xp';
import type { GameCtx } from '../api';

const table = (): number[] => (Data.progression.xpTable.length ? Data.progression.xpTable : buildXpTable(Data.progression.maxLevel));

export function xpForLevel(level: number): number {
  return table()[level - 1] ?? Infinity;
}

export function paragonXpFor(level: number): number {
  const p = Data.progression;
  return paragonXp(level, p.paragonXpBase || 60000, p.paragonXpGrowth || 0.05);
}

export function gainXp(ctx: GameCtx, raw: number, monsterLevel?: number): void {
  const c = ctx.character;
  const p = ctx.player;
  let amount = raw * (1 + p.stats.xpBonus + ctx.difficulty.xpBonus);
  if (monsterLevel !== undefined) amount *= levelDiffMult(monsterLevel, c.level);
  amount = Math.max(1, Math.round(amount));
  const max = Data.progression.maxLevel;
  if (c.level < max) {
    c.xp += amount;
    let leveled = false;
    while (c.level < max && c.xp >= xpForLevel(c.level)) {
      c.xp -= xpForLevel(c.level);
      c.level++;
      leveled = true;
      ctx.events.emit('levelUp', { level: c.level });
    }
    if (c.level >= max) c.xp = 0;
    if (leveled) {
      ctx.refreshPlayerStats();
      p.life = p.maxLife;
      ctx.fx.burst('levelup', p.pos, { count: 60 });
      ctx.fx.light(p.pos, { radius: 6, color: 0xffd070, intensity: 2 }, 1.2);
      ctx.audio.play('level_up');
      ctx.ui.banner(`Nível ${c.level}`, 'Você ficou mais forte', 'levelup');
    }
  } else {
    c.paragonXp += amount;
    while (c.paragonXp >= paragonXpFor(c.paragonLevel)) {
      c.paragonXp -= paragonXpFor(c.paragonLevel);
      c.paragonLevel++;
      ctx.events.emit('paragonUp', { paragonLevel: c.paragonLevel });
      ctx.audio.play('paragon_up');
      ctx.ui.banner(`Paragon ${c.paragonLevel}`, 'Um novo ponto de Paragon', 'levelup');
    }
  }
  ctx.events.emit('xpGained', { amount, total: c.xp });
}
