// Balance bot: fresh level-1 hero plays the Crypt (3 floors + boss) with simple attack-move.
// Reports sim-time per floor, level, deaths. node e2e/balance.mjs [class] [url]
import { chromium } from '@playwright/test';
const cls = process.argv[2] ?? 'berserker';
const base = process.argv[3] ?? 'http://localhost:5288/';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`${base}?quick=${cls}&zone=crypt&floor=1`);
const ready = () => page.waitForFunction(() => window.__game && window.__game.world && !window.__game.loading, null, { timeout: 90000 });
await ready();
await page.waitForTimeout(1000);

const state = () =>
  page.evaluate(() => {
    const g = window.__game;
    if (!g || !g.world || g.loading) return null;
    const p = g.player;
    const W = innerWidth;
    const H = innerHeight;
    const ms = g.world.actors.filter((a) => a.kind === 'monster' && a.alive && a.faction === 'enemy');
    ms.sort((a, b) => Math.hypot(a.pos.x - p.pos.x, a.pos.y - p.pos.y) - Math.hypot(b.pos.x - p.pos.x, b.pos.y - p.pos.y));
    const m = ms[0];
    let aim = null;
    if (m) {
      const s = g.renderer.worldToScreen(m.pos.x, m.pos.y);
      aim = { x: Math.min(W - 80, Math.max(80, s.x)), y: Math.min(H - 170, Math.max(80, s.y - 30)), on: s.x > 60 && s.x < W - 60 && s.y > 60 && s.y < H - 150 };
    }
    const boss = g.world.actors.find((a) => a.monster && a.monster.rank === 'boss');
    const total = g.world.actors.filter((a) => a.kind === 'monster' && a.faction === 'enemy').length;
    return {
      t: g.time,
      floor: g.world.info.floor,
      zone: g.world.info.zone.id,
      lvl: g.character.level,
      life: p.life / p.maxLife,
      alive: p.alive,
      left: ms.length,
      total,
      aim,
      fury: p.resource / Math.max(1, p.maxResource),
      boss: boss ? { alive: boss.alive, hp: boss.life / boss.maxLife } : null,
      deaths: g.character.stats.deaths,
      kills: g.character.stats.kills,
    };
  });

const log = [];
let floor = 0;
let lastProgress = { kills: -1, t: 0 };
const t0 = (await state()).t;
for (let i = 0; i < 2500; i++) {
  const s = await state().catch(() => null);
  if (!s) {
    await page.waitForTimeout(1000);
    continue;
  }
  if (s.floor !== floor || s.zone !== 'crypt') {
    if (s.zone !== 'crypt') break;
    floor = s.floor;
    log.push(`floor ${floor} @ ${((s.t - t0) / 60).toFixed(1)} min · lvl ${s.lvl} · kills ${s.kills}`);
  }
  if (s.boss && !s.boss.alive) {
    log.push(`BOSS DEAD @ ${((s.t - t0) / 60).toFixed(1)} min · lvl ${s.lvl} · deaths ${s.deaths}`);
    break;
  }
  if (!s.alive) {
    await page.waitForTimeout(1500);
    await page.evaluate(() => document.querySelector('.death-screen button, .modal-panel button')?.click());
    await page.waitForTimeout(2000);
    continue;
  }
  if (s.life < 0.35) await page.keyboard.press('KeyQ');
  // go down once most of the floor is cleared, or when stuck (no kills for 40s of sim time)
  if (s.kills !== lastProgress.kills) lastProgress = { kills: s.kills, t: s.t };
  const stuck = s.t - lastProgress.t > 40;
  if (!s.boss && (s.left <= s.total * 0.35 || stuck)) {
    await page.evaluate(() => {
      const g = window.__game;
      const st = g.world.interactables.find((o) => o.kind === 'stairsDown');
      if (st) g.travel({ kind: 'zone', zoneId: 'crypt', floor: g.world.info.floor + 1, via: 'stairs' });
    });
    await page.waitForTimeout(1500);
    await ready();
    lastProgress.t = (await state()).t;
    continue;
  }
  if (s.boss && stuck) {
    // walk to the boss when nothing else is around
    await page.evaluate(() => {
      const g = window.__game;
      const b = g.world.actors.find((a) => a.monster && a.monster.rank === 'boss');
      if (b) { g.player.pos.x = b.pos.x - 3; g.player.pos.y = b.pos.y - 3; }
    });
    lastProgress.t = s.t;
  }
  if (!s.aim) {
    await page.waitForTimeout(200);
    continue;
  }
  await page.mouse.move(s.aim.x, s.aim.y);
  if (s.aim.on && s.fury > 0.6) {
    await page.mouse.down({ button: 'right' });
    await page.waitForTimeout(250);
    await page.mouse.up({ button: 'right' });
  } else {
    await page.mouse.down();
    await page.waitForTimeout(400);
    await page.mouse.up();
  }
}
const end = await state();
log.push(`end @ ${((end.t - t0) / 60).toFixed(1)} min sim · lvl ${end.lvl} · kills ${end.kills} · deaths ${end.deaths}`);
console.log(log.join('\n'));
await page.screenshot({ path: `e2e-results/balance-${cls}.png` });
await browser.close();
