// Basic weapon attack used when a hotbar slot is empty (or before class skills exist).
import type { SkillDef } from '../../data/schema';
import { registerSkills } from './registry';

export const BASIC_ATTACK: SkillDef = {
  id: 'common.attack',
  classId: 'berserker',
  name: 'Ataque',
  description: 'Ataca com a arma equipada causando {dmg} de dano de arma.',
  icon: 1,
  category: 'primary',
  tags: ['melee'],
  unlockLevel: 1,
  maxRank: 1,
  targeting: 'melee',
  range: 0.9,
  damageType: 'physical',
  damage: 1,
  damagePerRank: 0,
  anim: 'swing',
  castTime: 0.22,
  params: { arc: 100 },
  runes: [],
  sfx: { cast: 'swing_light' },
};

registerSkills({
  'common.attack': {
    fire(ctx, c) {
      const w = c.caster.weapon;
      if (w?.ranged) {
        ctx.combat.spawnProjectile({
          owner: c.caster,
          from: { x: c.caster.pos.x + c.dir.x * 0.3, y: c.caster.pos.y + c.dir.y * 0.3 },
          dir: c.dir,
          speed: 11,
          radius: 0.15,
          range: 9,
          visual: 'fx/arrows',
          damage: { amount: ctx.combat.skillDamage(c.caster, c.coefficient, 'physical', c.def.id), type: 'physical', sourceId: c.caster.id, isRanged: true, knockback: 1.5 },
        });
        ctx.audio.play('bow_shot', { pos: c.caster.pos, pitchVar: 0.1 });
        return;
      }
      ctx.combat.melee(c.caster, {
        angle: Math.atan2(c.dir.y, c.dir.x),
        arcDeg: c.params.arc ?? 100,
        range: Math.max(c.def.range, w?.range ?? 0.9),
        maxTargets: 3,
        damage: { amount: ctx.combat.skillDamage(c.caster, c.coefficient, 'physical', c.def.id), type: 'physical', sourceId: c.caster.id, knockback: 2.5 },
      });
    },
  },
});
