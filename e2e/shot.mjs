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
  for (let i = 0; i < (act.includes("long") ? 45 : 12); i++) {
    const target = await page.evaluate(() => { const g = window.__game; const p = g.player; const m = g.world.actors.filter(a => a.kind === 'monster' && a.alive).sort((a,b)=>Math.hypot(a.pos.x-p.pos.x,a.pos.y-p.pos.y)-Math.hypot(b.pos.x-p.pos.x,b.pos.y-p.pos.y))[0]; return m ? g.renderer.worldToScreen(m.pos.x, m.pos.y) : null; });
    if (target) { await page.mouse.move(target.x, target.y - 40); await page.mouse.down(); await page.waitForTimeout(350); await page.mouse.up(); }
  }
}
if (act.includes('skills')) {
  // unlock every class skill, bind 4 at a time and cast them at the nearest monster
  const ids = await page.evaluate(() => { const g = window.__game; const c = g.character; const list = g.constructor && window.__skills ? [] : []; void list; return Object.keys(window.__allSkills ? {} : {}); });
  void ids;
  for (let round = 0; round < 2; round++) {
    await page.evaluate((round) => {
      const g = window.__game; const c = g.character;
      const skills = window.__classSkills;
      const pick = skills.slice(round * 4, round * 4 + 4);
      c.hotbar.k1 = pick[0]; c.hotbar.k2 = pick[1]; c.hotbar.k3 = pick[2]; c.hotbar.k4 = pick[3];
      for (const s of skills) c.skillRanks[s] = 5;
      g.player.resource = g.player.maxResource;
      g.player.cooldowns = {};
    }, round);
    for (const key of ['Digit1', 'Digit2', 'Digit3', 'Digit4']) {
      const target = await page.evaluate(() => { const g = window.__game; const p = g.player; const m = g.world.actors.filter(a => a.kind === 'monster' && a.alive).sort((a,b)=>Math.hypot(a.pos.x-p.pos.x,a.pos.y-p.pos.y)-Math.hypot(b.pos.x-p.pos.x,b.pos.y-p.pos.y))[0]; g.player.resource = g.player.maxResource; return m ? g.renderer.worldToScreen(m.pos.x, m.pos.y) : null; });
      if (target) await page.mouse.move(target.x, target.y - 30);
      await page.keyboard.down(key); await page.waitForTimeout(700); await page.keyboard.up(key); await page.waitForTimeout(300);
    }
    await page.screenshot({ path: out.replace('.png', `-r${round}.png`) });
  }
}
if (act.includes('panels')) {
  await page.evaluate(() => { const d = window.__dbg; d.give('magic', 3); d.give('rare', 3); d.give('common', 2); d.drop('rare'); d.drop('magic'); d.open('inventory'); d.open('character'); });
  await page.waitForTimeout(800);
  const slot = await page.$('.inv-item');
  if (slot) { const b = await slot.boundingBox(); await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); }
  await page.waitForTimeout(600);
}
if (act.includes('legend')) {
  await page.evaluate(() => { const d = window.__dbg; d.drop('legendary'); d.drop('set'); d.drop('rare'); });
  await page.waitForTimeout(1600);
}
const info = await page.evaluate(() => { const g = window.__game; if (!g) return null; return { kills: g.character.stats.kills, gold: g.character.gold, items: g.world.groundItems.length, inv: g.character.inventory.length, fps: g.renderer.stats.fps, actors: g.world.actors.length, life: g.player.life, max: g.player.maxLife, lvl: g.character.level, xp: g.character.xp, pos: g.player.pos }; });
await page.screenshot({ path: out });
console.log(JSON.stringify(info));
console.log(logs.slice(0, 20).join('\n'));
await browser.close();
