// Quick-start, run JS in the page, screenshot. node e2e/eval-shot.mjs "<url>" out.png "<js>" [waitMs]
import { chromium } from '@playwright/test';
const [url, out, code = '', wait = '1500'] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: Number(process.env.VW ?? 1600), height: Number(process.env.VH ?? 900) } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => m.type() === 'error' && console.log('[console]', m.text()));
await page.goto(url);
await page.waitForFunction(() => window.__game && window.__game.world && !window.__game.loading, null, { timeout: 60000 });
await page.waitForTimeout(1500);
if (code) console.log('result:', JSON.stringify(await page.evaluate(code)));
await page.waitForTimeout(Number(wait));
await page.screenshot({ path: out, timeout: 60000 });
await browser.close();
