// Activates legendary + set powers from the equipped items and adds set / power stat bonuses.
import { Data } from '../../../data';
import { addStats, registerStatContributor } from '../../stats/aggregate';
import { setActivePowers } from './active';
import { getPower } from './registry';

registerStatContributor((c, s) => {
  const list: { id: string; value: number; source: string }[] = [];
  const setCounts = new Map<string, number>();
  for (const item of Object.values(c.equipment)) {
    if (!item) continue;
    if (item.legendaryId) {
      const leg = Data.legendary(item.legendaryId);
      list.push({ id: leg.powerId, value: item.legendaryValue ?? leg.powerRange[0], source: item.uid });
    }
    if (item.setId) setCounts.set(item.setId, (setCounts.get(item.setId) ?? 0) + 1);
  }
  for (const [setId, n] of setCounts) {
    const set = Data.set(setId);
    for (const b of set.bonuses) {
      if (n < b.pieces) continue;
      if (b.stats) addStats(s, b.stats);
      if (b.powerId) list.push({ id: b.powerId, value: b.powerValue ?? 1, source: `${setId}:${b.pieces}` });
    }
  }
  setActivePowers(list);
  for (const p of list) {
    const st = getPower(p.id)?.stats?.(p.value, null as never);
    if (st) addStats(s, st as never);
  }
});
