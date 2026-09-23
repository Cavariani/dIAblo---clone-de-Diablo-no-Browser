// Quick visual check: node e2e/shot.mjs [url] [out.png] [actions]
import { chromium } from '@playwright/test';
const url = process.argv[2] ?? 'http://localhost:5173/';
const out = process.argv[3] ?? 'e2e-results/shot.png';
const act = process.argv[4] ?? '';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${e.stack}`));
await page.goto(url);
await page.waitForFunction(() => window.__game, null, { timeout: 60000 }).catch(() => logs.push('timeout waiting __game'));
await page.waitForTimeout(2500);
if (act.includes('walk')) {
  await page.mouse.move(1100, 600); await page.mouse.down(); await page.waitForTimeout(1500); await page.mouse.up();
}
if (act.includes('fight')) {
  await page.evaluate(() => {
    const g = window.__game; const p = g.player;
    const m = g.world.actors.filter(a => a.kind === 'monster' && a.alive).sort((a,b)=>Math.hypot(a.pos.x-p.pos.x,a.pos.y-p.pos.y)-Math.hypot(b.pos.x-p.pos.x,b.pos.y-p.pos.y))[0];
    if (m) { p.pos.x = m.pos.x - 1.2; p.pos.y = m.pos.y - 1.2; }
  });
  await page.waitForTimeout(1500);
  for (let i = 0; i < 12; i++) {
    const target = await page.evaluate(() => { const g = window.__game; const p = g.player; const m = g.world.actors.filter(a => a.kind === 'monster' && a.alive).sort((a,b)=>Math.hypot(a.pos.x-p.pos.x,a.pos.y-p.pos.y)-Math.hypot(b.pos.x-p.pos.x,b.pos.y-p.pos.y))[0]; return m ? g.renderer.worldToScreen(m.pos.x, m.pos.y) : null; });
    if (target) { await page.mouse.move(target.x, target.y - 40); await page.mouse.down(); await page.waitForTimeout(350); await page.mouse.up(); }
  }
}
const info = await page.evaluate(() => { const g = window.__game; if (!g) return null; return { fps: g.renderer.stats.fps, actors: g.world.actors.length, life: g.player.life, max: g.player.maxLife, lvl: g.character.level, xp: g.character.xp, pos: g.player.pos }; });
await page.screenshot({ path: out });
console.log(JSON.stringify(info));
console.log(logs.slice(0, 20).join('\n'));
await browser.close();
