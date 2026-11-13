// Captures real in-engine screenshots: node tools/screenshot.mjs [name ...]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, GL_ARGS } from './pw.mjs';
import { serve } from './serve.mjs';
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, 'docs', 'screenshots'); fs.mkdirSync(OUT, { recursive: true });
// name: [x, height above ground, z, heading deg (0 = N, 90 = E), pitch deg, time of day]
export const VIEWS = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'views.json'), 'utf8'));
const want = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const quality = (process.argv.find((a) => a.startsWith('--quality=')) || '--quality=high').split('=')[1];
const size = (process.argv.find((a) => a.startsWith('--size=')) || '--size=1600x900').split('=')[1].split('x').map(Number);
const port = 8123 + Math.floor(Math.random() * 500);
const srv = await serve(port);
const browser = await chromium.launch({ args: GL_ARGS });
const page = await browser.newPage({ viewport: { width: size[0], height: size[1] }, deviceScaleFactor: 1 });
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text().slice(0, 600)); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 600)));
const names = want.length ? want : Object.keys(VIEWS);
const v0 = VIEWS[names[0]];
await page.goto(`http://localhost:${port}/client/index.html?shot=1&ui=0&pr=1&quality=${quality}&pos=${v0[0]},${v0[1]},${v0[2]}&look=${v0[3]},${v0[4]}&time=${v0[5]}`);
for (const name of names) {
  const v = VIEWS[name], t0 = Date.now();
  await page.waitForFunction(() => typeof window.__setView === 'function', null, { timeout: 180000 });
  await page.evaluate((v) => window.__setView(...v), v);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 600000, polling: 500 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, name + '.jpg'), type: 'jpeg', quality: 88, timeout: 240000 });
  const st = await page.evaluate(() => window.__stats());
  console.log(`${name}: ${((Date.now() - t0) / 1000).toFixed(0)}s  chunks ${st.chunks}  tris ${(st.tris / 1e6).toFixed(2)}M  draws ${st.calls}`);
}
await browser.close(); srv.close();
