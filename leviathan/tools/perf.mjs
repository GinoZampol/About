// Measures streaming latency, memory, geometry load and frame time at representative places.
// NOTE: in this repository's CI/cloud environment the browser has no GPU, so frame times are from
// a software rasteriser (SwiftShader); triangle counts, draw calls, memory and build times are
// hardware-independent. Run on a real machine with:  node tools/perf.mjs --gpu
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { chromium, GL_ARGS } from './pw.mjs';
import { serve } from './serve.mjs';
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const VIEWS = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'views.json'), 'utf8'));
const gpu = process.argv.includes('--gpu');
const quality = (process.argv.find((a) => a.startsWith('--quality=')) || '--quality=medium').split('=')[1];
const names = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const port = 8700 + Math.floor(Math.random() * 200), srv = await serve(port);
const browser = await chromium.launch({ args: gpu ? ['--ignore-gpu-blocklist'] : GL_ARGS, headless: !gpu });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
const t0 = Date.now();
await page.goto(`http://localhost:${port}/client/index.html?ui=0&pr=1&quality=${quality}`);
await page.waitForFunction(() => typeof window.__setView === 'function', null, { timeout: 300000 });
const loadMs = Date.now() - t0;
const renderer = await page.evaluate(() => { const g = document.createElement('canvas').getContext('webgl2'); const e = g.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'unknown'; });
const rows = [];
for (const name of (names.length ? names : Object.keys(VIEWS))) {
  const v = VIEWS[name], t1 = Date.now();
  const before = await page.evaluate(() => window.__stats().built);
  await page.evaluate((v) => window.__setView(...v), v);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 600000, polling: 250 });
  const streamMs = Date.now() - t1;
  const a = await page.evaluate(() => window.__stats()); const ta = Date.now();
  await page.waitForTimeout(6000);
  const b = await page.evaluate(() => window.__stats()); const tb = Date.now();
  rows.push({ view: name, frameMs: +((tb - ta) / Math.max(1, b.frames - a.frames)).toFixed(1), streamSec: +(streamMs / 1000).toFixed(1), chunksBuilt: b.built - before, avgChunkBuildMs: +b.avgBuildMs.toFixed(1), visibleChunks: b.chunks, trisDrawnM: +(b.tris / 1e6).toFixed(2), drawCalls: b.calls, vegInstances: b.veg.instances, geometries: b.geometries, jsHeapMB: Math.round(b.heap / 1e6) });
  console.log(JSON.stringify(rows[rows.length - 1]));
}
const result = { date: new Date().toISOString().slice(0, 10), renderer, cpu: os.cpus()[0].model, cores: os.cpus().length, quality, resolution: '1280x720', initialLoadSec: +(loadMs / 1000).toFixed(1), rows };
fs.writeFileSync(path.join(ROOT, 'docs', `performance_${quality}.json`), JSON.stringify(result, null, 1));
await browser.close(); srv.close();
