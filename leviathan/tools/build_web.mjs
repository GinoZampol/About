// Builds a self-contained static bundle description for hosting the client without node_modules:
// writes dist/index.html (three.js from a pinned CDN build) and prints the file list to publish.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writePNG } from '../worldgen/png.mjs';
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
// node tools/build_web.mjs [b]  -> dist/ from data/, or dist_b/ from data_b/ (variant 1B)
const VB = process.argv[2] === 'b', DIST = VB ? 'dist_b' : 'dist', DATA = VB ? 'data_b' : 'data';
const V = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'))).dependencies.three;
let html = fs.readFileSync(path.join(ROOT, 'client', 'index.html'), 'utf8');
const style = html.match(/<style>[\s\S]*?<\/style>/)[0], body = html.match(/<body>([\s\S]*)<\/body>/)[1];
const page = `<title>The Leviathan${VB ? ' 1B' : ''}</title>
<meta name="claude:viewport-fit-sides" content="cover">
${style.replace('<style>', '<style>\n  :root { color-scheme: dark; }\n  #hud, #help { padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }\n  @media (max-width: 700px) { #help { display: none; } }')}
<script>window.LEVIATHAN_DATA = 'png';</script>
<script type="importmap">{ "imports": { "three": "https://cdn.jsdelivr.net/npm/three@${V}/build/three.module.js", "three/addons/": "https://cdn.jsdelivr.net/npm/three@${V}/examples/jsm/" } }</script>
${body.replace('./main.js', 'client/main.js')}`;
fs.mkdirSync(path.join(ROOT, DIST), { recursive: true });
fs.writeFileSync(path.join(ROOT, DIST, 'index.html'), page);
const files = {};
fs.mkdirSync(path.join(ROOT, DIST, 'data'), { recursive: true });
for (const d of ['client', 'shared', 'data']) for (const f of fs.readdirSync(path.join(ROOT, d === 'data' ? DATA : d))) {
  if (f === 'index.html') continue;
  if (f.endsWith('.bin')) {
    // lossless wrap: pixel 0 and 1 carry the byte length, then 3 payload bytes per RGB pixel
    const buf = fs.readFileSync(path.join(ROOT, DATA, f)), w = Math.ceil(Math.sqrt(buf.length / 3 + 2)), h = Math.ceil((buf.length / 3 + 2) / w);
    const rgb = new Uint8Array(w * h * 3); rgb[0] = buf.length & 255; rgb[1] = (buf.length >> 8) & 255; rgb[2] = (buf.length >> 16) & 255; rgb[3] = buf.length >>> 24; rgb.set(buf, 6);
    writePNG(path.join(ROOT, DIST, 'data', f.replace('.bin', '.png')), rgb, w, h);
    files[`data/${f.replace('.bin', '.png')}`] = `${DIST}/data/${f.replace('.bin', '.png')}`;
  } else files[`${d}/${f}`] = f.endsWith('.mjs') ? { from: `${d}/${f}`, contentType: 'text/javascript' } : d === 'data' ? `${DATA}/${f}` : `${d}/${f}`;
}
fs.writeFileSync(path.join(ROOT, DIST, 'files.json'), JSON.stringify(files));
console.log(Object.keys(files).length, 'files');
