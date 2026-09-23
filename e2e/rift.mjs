// Rift smoke test: open rift panel in town, start a greater rift, kill everything, check guardian + completion.
import { chromium } from '@playwright/test';
const base = process.argv[2] ?? 'http://localhost:5288/';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error') logs.push(`[error] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${e.stack}`));
await page.goto(`${base}?quick=stalker&zone=town`);
const ready = () => page.waitForFunction(() => window.__game && window.__game.world && !window.__game.loading, null, { timeout: 60000 });
await ready();
await page.waitForTimeout(1500);
await page.evaluate(() => { window.__game.character.riftKeys = 2; window.__game.ui.openPanel('rift'); });
await page.waitForTimeout(600);
await page.screenshot({ path: 'e2e-results/rift-panel.png' });
await page.click('button:has-text("Abrir Fenda Maior")');
await page.waitForTimeout(1500);
await ready();
await page.waitForTimeout(2000);
const info = await page.evaluate(() => { const g = window.__game; return { zone: g.world.info.zone.name, gr: g.world.info.greaterRiftLevel, monsters: g.world.actors.filter((a) => a.monster && a.alive).length }; });
console.log('entered', JSON.stringify(info));
// kill monsters in batches until guardian spawns
for (let i = 0; i < 40; i++) {
  const st = await page.evaluate(() => {
    const g = window.__game;
    const ms = g.world.actors.filter((a) => a.monster && a.alive && a.faction === 'enemy' && a.monster.rank !== 'guardian').slice(0, 6);
    for (const m of ms) g.combat.dealDamage(m, { amount: 1e9, type: "physical", sourceId: g.player.id, crit: false });
    const gd = g.world.actors.find((a) => a.monster && a.monster.rank === 'guardian' && a.alive);
    return { left: g.world.actors.filter((a) => a.monster && a.alive).length, guardian: !!gd };
  });
  await page.waitForTimeout(250);
  if (st.guardian) { console.log('guardian after', i, 'batches'); break; }
  if (st.left === 0) { console.log('no monsters left, no guardian'); break; }
}
await page.waitForTimeout(1500);
await page.screenshot({ path: 'e2e-results/rift-guardian.png' });
await page.evaluate(() => { const g = window.__game; const gd = g.world.actors.find((a) => a.monster && a.monster.rank === 'guardian' && a.alive); if (gd) g.combat.dealDamage(gd, { amount: 1e10, type: "physical", sourceId: g.player.id, crit: false }); });
await page.waitForTimeout(2500);
await page.screenshot({ path: 'e2e-results/rift-done.png' });
console.log('after', JSON.stringify(await page.evaluate(() => { const c = window.__game.character; return { keys: c.riftKeys, gr: c.greaterRiftHighest, done: c.riftsCompleted, exit: window.__game.world.interactables.some((o) => o.kind === 'riftExit') }; })));
console.log(logs.join('\n') || 'no errors');
await browser.close();
