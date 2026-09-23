import { describe, expect, it } from 'vitest';
import { Data, validateData } from '../src/data';
import { affixRange, requiredLevel, rollAffixValue } from '../src/formulas/affixes';
import { armorReduction, cooldownAfterCdr, mitigation, resistReduction, skillDamage } from '../src/formulas/damage';
import { buyPrice, rerollCost, sellPrice } from '../src/formulas/economy';
import { itemScale, monsterDamage, monsterLife, playerLife } from '../src/formulas/scaling';
import { buildXpTable, levelDiffMult, xpToNext } from '../src/formulas/xp';
import { Rng } from '../src/core/rng';
import '../src/game/modules';
import { createItem } from '../src/game/items/generate';
import { passiveText } from '../src/ui/panels/SkillsPanel';

describe('data integrity', () => {
  it('has no broken cross references', () => {
    expect(validateData()).toEqual([]);
  });
  it('ships the required content volume', () => {
    expect(Data.classes.length).toBeGreaterThanOrEqual(3);
    for (const c of Data.classes) {
      expect(c.skills.length).toBeGreaterThanOrEqual(6);
      expect(c.passives.length).toBeGreaterThanOrEqual(5);
    }
    expect(Data.legendaries.length).toBeGreaterThanOrEqual(10);
    expect(Data.paragonNodes.length).toBeGreaterThan(0);
  });
});

describe('damage & mitigation', () => {
  it('skill damage scales with weapon, coefficient and main stat', () => {
    const base = skillDamage({ weaponMin: 10, weaponMax: 10, coefficient: 1, mainStat: 0, elementalBonus: 0, damageBonus: 0, roll: 0.5 });
    expect(base).toBe(10);
    expect(skillDamage({ weaponMin: 10, weaponMax: 10, coefficient: 2, mainStat: 100, elementalBonus: 0, damageBonus: 0, roll: 0 })).toBe(40);
    const lo = skillDamage({ weaponMin: 5, weaponMax: 15, coefficient: 1, mainStat: 0, elementalBonus: 0, damageBonus: 0, roll: 0 });
    const hi = skillDamage({ weaponMin: 5, weaponMax: 15, coefficient: 1, mainStat: 0, elementalBonus: 0, damageBonus: 0, roll: 1 });
    expect([lo, hi]).toEqual([5, 15]);
  });
  it('armor and resist reductions follow D3 curves and cap at 75%', () => {
    expect(armorReduction(50, 1)).toBeCloseTo(0.5);
    expect(armorReduction(1e9, 1)).toBe(0.75);
    expect(resistReduction(5, 1)).toBeCloseTo(0.5);
    expect(armorReduction(-10, 5)).toBe(0);
  });
  it('mitigation multiplies layers; DoTs ignore armor', () => {
    const m = mitigation({ armor: 50, resist: 5, attackerLevel: 1, damageReduction: 0.2 });
    expect(m).toBeCloseTo(0.5 * 0.5 * 0.8);
    expect(mitigation({ armor: 50, resist: 0, attackerLevel: 1, isDot: true })).toBe(1);
    expect(cooldownAfterCdr(10, 2)).toBeCloseTo(4);
  });
});

describe('progression', () => {
  it('xp curve is monotonic and fast early', () => {
    const t = buildXpTable(50);
    expect(t.length).toBe(49);
    for (let i = 1; i < t.length; i++) expect(t[i]).toBeGreaterThan(t[i - 1]);
    // level 2 in roughly 7-12 normal level-1 kills (≈14 xp each)
    expect(xpToNext(1) / 14).toBeGreaterThan(6);
    expect(xpToNext(1) / 14).toBeLessThan(13);
  });
  it('penalises farming far lower monsters', () => {
    expect(levelDiffMult(10, 10)).toBe(1);
    expect(levelDiffMult(5, 10)).toBeCloseTo(0.6);
    expect(levelDiffMult(1, 30)).toBeLessThan(0.1);
    expect(levelDiffMult(15, 10)).toBeLessThanOrEqual(1.25);
  });
  it('monster and item scaling stay in sane ranges at level 50', () => {
    expect(monsterLife(1)).toBe(30);
    expect(monsterLife(50)).toBeGreaterThan(2500);
    expect(monsterLife(50)).toBeLessThan(4000);
    expect(monsterDamage(50)).toBeGreaterThan(150);
    expect(itemScale(50)).toBeGreaterThan(40);
    expect(playerLife(100, 10, 1, 10)).toBeGreaterThan(100);
  });
});

describe('items & affixes', () => {
  it('affix ranges grow with ilvl and rolls stay inside', () => {
    const def = { base: [2, 4] as [number, number], perLevel: [0.5, 1] as [number, number], format: 'int' as const };
    const [a1, b1] = affixRange(def, 1);
    const [a50, b50] = affixRange(def, 50);
    expect(a50).toBeGreaterThan(a1);
    expect(b50).toBeGreaterThan(b1);
    for (const r of [0, 0.3, 0.99]) {
      const v = rollAffixValue(def, 20, r);
      expect(v.value).toBeGreaterThanOrEqual(v.min);
      expect(v.value).toBeLessThanOrEqual(v.max);
    }
    expect(rollAffixValue(def, 20, 0, true).value).toBeGreaterThan(rollAffixValue(def, 20, 0).value);
    expect(requiredLevel(1)).toBe(1);
    expect(requiredLevel(60)).toBe(50);
  });
  it('generated items respect rarity affix counts', () => {
    const rng = new Rng(1234);
    for (const rarity of ['common', 'magic', 'rare', 'legendary'] as const) {
      const [lo, hi] = Data.rarity(rarity).affixCount;
      for (let i = 0; i < 40; i++) {
        const it = createItem(rng, { ilvl: 1 + (i % 50), rarity, classId: 'berserker' });
        expect(it.rarity).toBe(rarity);
        expect(it.affixes.length).toBeGreaterThanOrEqual(lo);
        expect(it.affixes.length).toBeLessThanOrEqual(hi + 1);
        if (rarity === 'legendary') expect(it.legendaryId).toBeTruthy();
      }
    }
  });
  it('economy: buy > sell, rerolls get pricier', () => {
    expect(buyPrice(10, 'rare')).toBeGreaterThan(sellPrice(10, 'rare'));
    expect(sellPrice(10, 'legendary')).toBeGreaterThan(sellPrice(10, 'magic'));
    expect(rerollCost(10, 3).gold).toBeGreaterThan(rerollCost(10, 0).gold);
  });
});

describe('passives', () => {
  it('fills descriptions from per-rank stats', () => {
    const p = Data.passivesOf('berserker').find((x) => x.id === 'berserker.ruthless')!;
    expect(passiveText(p, 2)).toBe('+2.4% de Chance Crítica e +12% de Dano Crítico.');
  });
});
