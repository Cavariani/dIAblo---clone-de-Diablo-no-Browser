// Statuses (DoTs, CC, buffs), effective move speed, regeneration and hit-stun recovery.
import { Data } from '../../data';
import type { GameCtx, System } from '../api';
import { playAnim } from '../combat/Combat';

export class StatusSystem implements System {
  readonly name = 'status';

  update(ctx: GameCtx, dt: number): void {
    for (const a of ctx.world.actors) {
      if (!a.alive) continue;
      if (a.invulnerable > 0) a.invulnerable -= dt;
      if (a.flash > 0) a.flash -= dt;
      a.stateTime += dt;
      let slow = 0;
      let haste = 0;
      let rooted = false;
      let stunned = false;
      for (let i = a.statuses.length - 1; i >= 0; i--) {
        const s = a.statuses[i];
        s.remaining -= dt;
        switch (s.id) {
          case 'slow':
          case 'chill':
            slow = Math.max(slow, s.magnitude);
            break;
          case 'haste':
            haste = Math.max(haste, s.magnitude);
            break;
          case 'root':
            rooted = true;
            break;
          case 'stun':
          case 'freeze':
            stunned = true;
            break;
          case 'burn':
          case 'poison':
          case 'bleed': {
            s.tickTimer += dt;
            if (s.tickTimer >= 0.5) {
              s.tickTimer -= 0.5;
              const src = ctx.world.getActor(s.sourceId);
              // magnitude = fraction of the source's base hit per second
              const base = src?.monster ? src.monster.baseDamage : src ? ctx.combat.skillDamage(src, 1, 'physical') : a.maxLife * 0.02;
              const type = s.id === 'burn' ? 'fire' : s.id === 'poison' ? 'poison' : 'physical';
              ctx.combat.dealDamage(a, { amount: base * s.magnitude * 0.5 * s.stacks, type, sourceId: s.sourceId, isDot: true, silent: true, procCoef: 0 });
              if (!a.alive) break;
            }
            break;
          }
        }
        if (s.remaining <= 0) a.statuses.splice(i, 1);
      }
      if (!a.alive) continue;
      if (stunned) {
        if (a.state !== 'stunned' && a.state !== 'frozen') a.state = 'stunned';
      } else if (a.state === 'stunned' || a.state === 'frozen') {
        a.state = 'idle';
      }
      if (a.state === 'hitstun' && a.stateTime > 0.22) a.state = 'idle';
      if (a.state === 'spawning' && a.stateTime > 1) a.state = 'idle';
      const msBonus = a.kind === 'player' ? a.stats.moveSpeed : 0;
      a.moveSpeed = rooted || stunned ? 0 : a.baseMoveSpeed * (1 + Math.min(0.5, msBonus) + haste) * (1 - Math.min(0.8, slow));

      if (a.kind === 'player' && a.character) {
        const cls = Data.classDef(a.character.classId);
        if (a.stats.lifeRegen > 0 && a.life < a.maxLife) a.life = Math.min(a.maxLife, a.life + a.stats.lifeRegen * dt);
        const r = cls.resource;
        let regen = r.regen + a.stats.resourceRegen;
        if (r.outOfCombatDelay !== undefined) {
          regen = ctx.time - a.lastCombatAt > r.outOfCombatDelay ? r.regen : a.stats.resourceRegen;
        }
        a.resource = Math.max(0, Math.min(a.maxResource, a.resource + regen * dt));
        // out-of-combat life regen (small, Diablo-like)
        if (ctx.time - a.lastDamagedAt > 5 && a.life < a.maxLife) a.life = Math.min(a.maxLife, a.life + a.maxLife * 0.01 * dt);
      }
      if (a.state === 'idle' && !a.cast && a.anim.name === 'hit') playAnim(a, 'stance', true);
    }
  }
}
