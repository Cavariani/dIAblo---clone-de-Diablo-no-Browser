// Loads a URL, waits, prints console errors + page state, screenshots. node e2e/prod-smoke.mjs <url> <out.png> [waitMs]
import { chromium } from '@playwright/test';
const [url, out, wait = '25000'] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && console.log(`[${m.type()}]`, m.text().slice(0, 200)));
page.on('requestfailed', (r) => console.log('[reqfail]', r.url()));
await page.goto(url);
await page.waitForTimeout(Number(wait));
console.log('state:', await page.evaluate(() => ({ game: !!window.__game, loading: window.__game?.loading, zone: window.__game?.world?.info?.zone?.name, screen: document.querySelector('.screen')?.className })));
await page.screenshot({ path: out });
await browser.close();
