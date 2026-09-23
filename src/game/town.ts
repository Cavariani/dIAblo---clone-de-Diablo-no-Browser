// Town & world interactions: NPCs, stash, waypoints, dungeon entrance, difficulty altar, shrines.
import { Data } from '../data';
import { addBuff } from './skills/buffs';
import { registerInteractHandler, registerNpcHandler } from './systems/PlayerControlSystem';
import { refreshStock } from './items/shop';
import { onGameCreated } from './hooks';

registerNpcHandler((ctx, npc) => {
  const id = npc.npc?.defId;
  if (!id) return;
  const def = Data.npc(id);
  if (def.role === 'ambient') {
    ctx.fx.floatText({ x: npc.pos.x, y: npc.pos.y - 0.5 }, def.greeting[Math.floor(Math.random() * def.greeting.length)], 'info', 0xf0e0b0);
    return;
  }
  ctx.ui.openPanel('dialog', id);
});

registerInteractHandler('stash', (ctx) => ctx.ui.openPanel('stash'));
registerInteractHandler('portal', (ctx, o) => {
  ctx.audio.play('portal_travel');
  if (o.data.back) ctx.travel({ kind: 'portalBack' });
  else ctx.travel({ kind: 'town' });
});
registerInteractHandler('waypoint', (ctx) => {
  ctx.audio.play('waypoint_activate');
  ctx.ui.openPanel('waypoints');
});
registerInteractHandler('difficultyAltar', (ctx) => ctx.ui.openPanel('difficulty'));
registerInteractHandler('riftObelisk', (ctx) => ctx.ui.openPanel('rift'));
registerInteractHandler('dungeonEntrance', (ctx, o) => {
  const zoneId = (o.data.zoneId as string) ?? 'crypt';
  ctx.audio.play('stairs');
  ctx.travel({ kind: 'zone', zoneId, floor: (o.data.floor as number) ?? 1, via: 'stairs' });
});
registerInteractHandler('shrine', (ctx, o) => {
  if (o.state !== 'idle') return;
  o.state = 'used';
  const pool = Data.shrines;
  const s = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
  const stats = s?.stats ?? { damagePct: 0.25 };
  addBuff(ctx, 'shrine', s?.name ?? 'Santuário da Fúria', stats, s?.duration ?? 60);
  ctx.ui.banner(s?.name ?? 'Santuário da Fúria', s?.description ?? '+25% de dano por 60s', 'quest');
  ctx.fx.burst('holy', o.pos, { count: 40, z: 0.8 });
  ctx.fx.light(o.pos, { radius: 5, color: s?.color ?? 0xffd060, intensity: 2 }, 1.2);
  ctx.audio.play('shrine_activate');
  ctx.events.emit('shrineActivated', { shrineId: s?.id ?? 'fury' });
});

onGameCreated((game) => {
  game.events.on('zoneEntered', ({ isTown }: { isTown: boolean }) => {
    if (isTown) refreshStock(game);
    // first steps: tell new heroes where the first dungeon is (the renderer also draws a guide arrow)
    if (isTown && !Object.keys(game.character.bossesKilled).length && !game.character.waypoints.some((w: string) => w.startsWith('crypt')))
      setTimeout(() => game.ui.toast('Siga a seta dourada: a Cripta dos Reis Caídos fica a sudoeste da praça, junto ao guarda.', 'quest'), 1500);
  });
});
