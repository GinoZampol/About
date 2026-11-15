// Terrain worker: builds chunk meshes (ground + still water) and vegetation placements off the main thread.
import { World } from '../shared/world.mjs';
import { placeVegetation } from './vegPlacement.js';

let world = null;
export const C = 64;          // cells per chunk edge
const WN = 32;                // water cells per chunk edge

self.onmessage = (e) => {
  const m = e.data;
  if (m.type === 'init') { world = new World(m.data); self.postMessage({ type: 'ready' }); }
  else if (m.type === 'build') build(m);
  else if (m.type === 'veg') { const r = placeVegetation(world, m); self.postMessage(r.msg, r.transfer); }
  else if (m.type === 'hgrid') {
    // strip of the refined height grid (cell-centred samples of the full ground function)
    const { T, j0, j1 } = m, cell = world.S / T, out = new Float32Array((j1 - j0) * T);
    for (let j = j0; j < j1; j++) for (let i = 0; i < T; i++) out[(j - j0) * T + i] = world.ground((i + 0.5) * cell, (j + 0.5) * cell, cell) + world.ho;
    self.postMessage({ type: 'hgrid', j0, j1, out }, [out.buffer]);
  }
  else if (m.type === 'edit') { for (const [ix, iz, dh] of m.cells) world.setEdit(ix, iz, dh); }
};

function build({ id, x0, z0, size }) {
  const cell = size / C, n1 = C + 1, n3 = C + 3;
  const hs = new Float32Array(n3 * n3);
  for (let j = 0; j < n3; j++) { const z = z0 + (j - 1) * cell; for (let i = 0; i < n3; i++) hs[j * n3 + i] = world.ground(x0 + (i - 1) * cell, z, cell); }
  const nv = n1 * n1 + 4 * n1;
  const pos = new Float32Array(nv * 3), nrm = new Int8Array(nv * 3), morph = new Float32Array(nv);
  let minY = 1e9, maxY = -1e9;
  const H = (i, j) => hs[(j + 1) * n3 + i + 1];
  for (let j = 0; j < n1; j++) for (let i = 0; i < n1; i++) {
    const v = j * n1 + i, h = H(i, j);
    pos[v * 3] = i * cell; pos[v * 3 + 1] = h; pos[v * 3 + 2] = j * cell;
    if (h < minY) minY = h; if (h > maxY) maxY = h;
    const gx = (H(i + 1, j) - H(i - 1, j)) / (2 * cell), gz = (H(i, j + 1) - H(i, j - 1)) / (2 * cell);
    const l = 127 / Math.sqrt(gx * gx + gz * gz + 1);
    nrm[v * 3] = -gx * l; nrm[v * 3 + 1] = l; nrm[v * 3 + 2] = -gz * l;
    // geomorph target: where this vertex sits on the parent (half-resolution) mesh
    const oi = i & 1, oj = j & 1;
    let ph = h;
    if (oi && !oj) ph = 0.5 * (H(i - 1, j) + H(i + 1, j));
    else if (!oi && oj) ph = 0.5 * (H(i, j - 1) + H(i, j + 1));
    else if (oi && oj) ph = 0.5 * (H(i + 1, j - 1) + H(i - 1, j + 1));
    morph[v] = h - ph;
  }
  // skirts hide any residual cracks between LODs
  const skirt = cell * 1.5 + 0.5; let v = n1 * n1;
  const addSkirt = (i, j) => {
    const s = j * n1 + i;
    pos[v * 3] = pos[s * 3]; pos[v * 3 + 1] = pos[s * 3 + 1] - skirt; pos[v * 3 + 2] = pos[s * 3 + 2];
    nrm[v * 3] = nrm[s * 3]; nrm[v * 3 + 1] = nrm[s * 3 + 1]; nrm[v * 3 + 2] = nrm[s * 3 + 2]; morph[v] = morph[s]; v++;
  };
  for (let i = 0; i < n1; i++) addSkirt(i, 0);
  for (let i = 0; i < n1; i++) addSkirt(i, C);
  for (let j = 0; j < n1; j++) addSkirt(0, j);
  for (let j = 0; j < n1; j++) addSkirt(C, j);

  // still water (sea and lakes): a coarser grid at the local water level, kept only where wet
  let water = null;
  if (minY < 3400) {
    const w1 = WN + 1, st = C / WN, lv = new Float32Array(w1 * w1), dp = new Float32Array(w1 * w1); let anyWet = false;
    for (let j = 0; j < w1; j++) for (let i = 0; i < w1; i++) {
      const x = x0 + i * st * cell, z = z0 + j * st * cell;
      const L = world.stillLevel(x, z), d = L - H(i * st, j * st);
      lv[j * w1 + i] = L; dp[j * w1 + i] = d; if (d > 0) anyWet = true;
    }
    if (anyWet) {
      // lake levels are stored on a 24 m raster: extend them across the dry vertices of coarse water
      // grids so a far-LOD lake reaches its shore instead of being cut at the raster edge
      for (let pass = 0; pass < 2; pass++) {
        const src = lv.slice();
        for (let j = 0; j < w1; j++) for (let i = 0; i < w1; i++) {
          const k = j * w1 + i; if (src[k] !== 0 || H(i * st, j * st) < 0.3) continue;
          let m = 0;
          for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) { const x = i + a, y = j + b; if (x >= 0 && y >= 0 && x < w1 && y < w1 && src[y * w1 + x] > m) m = src[y * w1 + x]; }
          if (m > 0) { lv[k] = m; dp[k] = m - H(i * st, j * st); }
        }
      }
      const idx = [];
      for (let j = 0; j < WN; j++) for (let i = 0; i < WN; i++) {
        const a = j * w1 + i, b = a + 1, c = a + w1, d = c + 1;
        const lo = Math.min(lv[a], lv[b], lv[c], lv[d]), hi = Math.max(lv[a], lv[b], lv[c], lv[d]);
        if (hi - lo > 0.05) continue;
        if (dp[a] > 0 || dp[b] > 0 || dp[c] > 0 || dp[d] > 0) idx.push(a, c, b, b, c, d);
      }
      if (idx.length) {
        const wp = new Float32Array(w1 * w1 * 3);
        for (let j = 0; j < w1; j++) for (let i = 0; i < w1; i++) { const k = j * w1 + i; wp[k * 3] = i * st * cell; wp[k * 3 + 1] = lv[k]; wp[k * 3 + 2] = j * st * cell; }
        water = { pos: wp, depth: dp, index: new Uint16Array(idx) };
      }
    }
  }
  const transfer = [pos.buffer, nrm.buffer, morph.buffer];
  if (water) transfer.push(water.pos.buffer, water.depth.buffer, water.index.buffer);
  self.postMessage({ type: 'chunk', id, pos, nrm, morph, minY, maxY, water }, transfer);
}
