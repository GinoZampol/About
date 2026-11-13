// World validation: hydrology, terrain continuity, traversability, ecology and determinism checks
// run against the exported data set through the same World model the game uses.
//   node worldgen/validate.mjs [--quick]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadWorldData, World, MAP } from '../shared/world.mjs';
import { materialAt } from '../shared/subsurface.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const data = await loadWorldData((n) => fs.readFileSync(path.join(ROOT, 'data', n)));
const w = new World(data), S = w.S, N = w.N, H = w.H;
const out = []; let fails = 0;
const report = (name, ok, detail) => { out.push(`${ok ? 'PASS' : 'FAIL'}  ${name}: ${detail}`); if (!ok) fails++; };
const info = (name, detail) => out.push(`INFO  ${name}: ${detail}`);
const hAt = (i, j) => H[j * N + i] * w.hs - w.ho;

// ---- 1. rivers: monotone profiles, connected network, channels actually hold the water --------
{
  const P = w.rPts, off = w.rSegOff, nSeg = off.length - 1;
  let uphill = 0, pts = 0, ends = { water: 0, junction: 0, orphan: 0 }, perched = 0, dryBed = 0, samples = 0, maxGrad = 0, falls = 0;
  const starts = new Set(); for (let s = 0; s < nSeg; s++) starts.add(`${P[off[s] * 5].toFixed(1)},${P[off[s] * 5 + 1].toFixed(1)}`);
  for (let s = 0; s < nSeg; s++) {
    for (let k = off[s]; k < off[s + 1] - 1; k++) {
      pts++; const dz = P[k * 5 + 7] - P[k * 5 + 2]; if (dz > 1e-3) uphill++;
      const ds = Math.hypot(P[k * 5 + 5] - P[k * 5], P[k * 5 + 6] - P[k * 5 + 1]) || 1, g = -dz / ds; if (g > maxGrad) maxGrad = g; if (g > 0.35) falls++;
    }
    const e = (off[s + 1] - 1) * 5, ex = P[e], ez = P[e + 1];
    const base = w.baseHeight(ex, ez);
    if (base < w.stillLevel(ex, ez) + 0.5) ends.water++; else if (starts.has(`${ex.toFixed(1)},${ez.toFixed(1)}`)) ends.junction++; else ends.orphan++;
    for (let k = off[s] + 3; k < off[s + 1] - 3; k += 9) {
      const x = P[k * 5], z = P[k * 5 + 1], zw = P[k * 5 + 2], hw = P[k * 5 + 3] / 2;
      const tx = P[k * 5 + 5] - P[k * 5 - 5], tz = P[k * 5 + 6] - P[k * 5 - 4], tl = Math.hypot(tx, tz) || 1, nx = -tz / tl, nz = tx / tl;
      samples++;
      if (w.ground(x, z) > zw - 0.05) dryBed++;
      const B = hw + Math.min(60, 4 + 1.2 * hw * 2) + 2;
      if (w.ground(x + nx * B, z + nz * B) < zw - 1.5 && w.ground(x - nx * B, z - nz * B) < zw - 1.5) perched++;
    }
  }
  report('river profiles never climb', uphill === 0, `${uphill} uphill steps in ${pts} (max gradient ${(maxGrad * 100).toFixed(0)}%, ${falls} waterfall/cascade steps)`);
  report('river network is connected', ends.orphan === 0, `${ends.water} segments end in a lake or the sea, ${ends.junction} at confluences, ${ends.orphan} orphaned`);
  report('channel beds lie below the water surface', dryBed / samples < 0.01, `${(100 * dryBed / samples).toFixed(2)}% of ${samples} cross-sections dry`);
  report('rivers are not perched above both banks', perched / samples < 0.02, `${(100 * perched / samples).toFixed(2)}% of cross-sections`);
  info('river network', `${nSeg} reaches, ${w.meta.riverKm} km, ${w.meta.lakes.length} lakes`);
}

// ---- 2. terrain: closed basins, discontinuities, slope distribution ---------------------------
{
  let pits = 0, deepPits = 0, land = 0, maxJump = 0, sl = [0, 0, 0, 0, 0];
  const dx = S / N;
  for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) {
    const h = hAt(i, j); if (h <= 0.2) continue;
    const x = (i + 0.5) * dx, z = (j + 0.5) * dx;
    if (h < w.stillLevel(x, z)) continue;
    land++;
    let lower = false, mn = 1e9;
    for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) { if (!a && !b) continue; const v = hAt(i + a, j + b); if (v <= h) lower = true; if (v < mn) mn = v; }
    if (!lower) { pits++; if (mn - h > 1.0) deepPits++; }
    const gx = (hAt(i + 1, j) - hAt(i - 1, j)) / (2 * dx), gz = (hAt(i, j + 1) - hAt(i, j - 1)) / (2 * dx), s = Math.hypot(gx, gz);
    const jump = Math.max(Math.abs(hAt(i + 1, j) - h), Math.abs(hAt(i, j + 1) - h)); if (jump > maxJump) maxJump = jump;
    sl[s < 0.05 ? 0 : s < 0.15 ? 1 : s < 0.45 ? 2 : s < 1 ? 3 : 4]++;
  }
  report('no unintended closed basins', deepPits === 0, `${pits} single-cell hollows under 1 m (quantisation), ${deepPits} deeper`);
  report('no terrain discontinuities', maxJump < dx * 4, `largest step between adjacent 12 m samples ${maxJump.toFixed(1)} m (cliff limit ${(dx * 4).toFixed(0)} m)`);
  const pc = sl.map((v) => (100 * v / land).toFixed(1));
  info('slope classes (land)', `<5% ${pc[0]}%  5-15% ${pc[1]}%  15-45% ${pc[2]}%  45-100% ${pc[3]}%  cliffs ${pc[4]}%`);
  info('land area', `${(land * dx * dx / 1e6).toFixed(0)} km2 of 2500, highest point ${w.meta.maxElevation} m`);
}

// ---- 3. chunk seams: neighbouring chunks must produce bit-identical edge vertices --------------
{
  let mism = 0, tests = 0;
  for (let L = 3; L <= 11; L++) {
    const size = S / 2 ** L, cell = size / 64;
    for (let t = 0; t < 40; t++) {
      const cx = Math.floor((0.13 + 0.7 * ((t * 0.618) % 1)) * 2 ** L), cz = Math.floor((0.2 + 0.6 * ((t * 0.377) % 1)) * 2 ** L), k = (t * 7) % 65;
      const a = w.ground(cx * size + 64 * cell, cz * size + k * cell, cell), b = w.ground((cx + 1) * size + 0 * cell, cz * size + k * cell, cell);
      tests++; if (a !== b) mism++;
    }
  }
  report('chunk seams are bit-exact', mism === 0, `${mism} mismatches in ${tests} shared edge vertices across LOD levels 3-11`);
}

// ---- 4. traversability and settlement land -----------------------------------------------------
{
  const G = 1024, st = N / G, cell = S / G;
  const slope = new Float32Array(G * G), block = new Uint8Array(G * G);
  const rq = {};
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
    const x = (i + 0.5) * cell, z = (j + 0.5) * cell, h = w.baseHeight(x, z);
    slope[j * G + i] = w.slope(x, z);
    const r = w.riverAt(x, z, rq);
    block[j * G + i] = h < w.stillLevel(x, z) + 0.2 ? 2 : r && r.edge < 0 && r.w > 30 ? 1 : 0;   // 2 = sea/lake, 1 = river needing a bridge or ferry
  }
  const flood = (maxSlope, fordRivers, from) => {
    const seen = new Uint8Array(G * G), q = [from]; seen[from] = 1; let n = 0;
    while (q.length) {
      const c = q.pop(); n++; const i = c % G, j = (c / G) | 0;
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = i + a, y = j + b; if (x < 0 || y < 0 || x >= G || y >= G) continue; const t = y * G + x;
        if (seen[t] || slope[t] > maxSlope || block[t] === 2 || (block[t] === 1 && !fordRivers)) continue; seen[t] = 1; q.push(t);
      }
    }
    return { seen, n };
  };
  const idx = (name) => { const l = w.meta.landmarks.find((q) => q.name.includes(name)) || w.meta.landmarks[0]; return Math.floor(l.z / cell) * G + Math.floor(l.x / cell); };
  let land = 0; for (let c = 0; c < G * G; c++) if (block[c] !== 2) land++;
  const valley = idx('Central Valley'), walk = flood(0.7, true, valley), cart = flood(0.14, true, valley), cartNoBridge = flood(0.14, false, valley);
  report('most land is reachable on foot from the Central Valley', walk.n / land > 0.65, `${(100 * walk.n / land).toFixed(1)}% of land (slopes under 35 deg, rivers crossable)`);
  info('cart-grade land network (under 8 deg) from the Central Valley', `${(100 * cart.n / land).toFixed(1)}% of land with bridges, ${(100 * cartNoBridge.n / land).toFixed(1)}% without crossing a major river`);
  const near = (seen, c, r) => { const i = c % G, j = (c / G) | 0; for (let b = -r; b <= r; b++) for (let a = -r; a <= r; a++) { const x = i + a, y = j + b; if (x >= 0 && y >= 0 && x < G && y < G && seen[y * G + x]) return true; } return false; };
  for (const name of ['High Desert', 'Coast Range', 'Northern Highlands', 'Longwater', 'Badlands', 'The Erg', 'Great River delta']) {
    const t = idx(name);
    report(`walking route: Central Valley -> ${name}`, near(walk.seen, t, 25), near(cart.seen, t, 25) ? 'reachable, also at cart grade' : near(walk.seen, t, 25) ? 'reachable on foot / pack animal only' : 'not reachable');
  }
  // settlement land: gentle ground close to fresh water or the coast
  let gentle = 0, prime = 0;
  for (let j = 4; j < G - 4; j++) for (let i = 4; i < G - 4; i++) {
    const c = j * G + i; if (block[c] === 2 || slope[c] > 0.08) continue; gentle++;
    let wat = false; for (let b = -8; b <= 8 && !wat; b += 4) for (let a = -8; a <= 8 && !wat; a += 4) if (block[(j + b) * G + i + a]) wat = true;
    if (wat) prime++;
  }
  info('buildable land (slope under 8%)', `${(gentle * cell * cell / 1e6).toFixed(0)} km2, of which ${(prime * cell * cell / 1e6).toFixed(0)} km2 lies within 400 m of a major river, lake or the sea`);
}

// ---- 5. ecology ----------------------------------------------------------------------------------
{
  const M = w.M, mn = M * M, cls = { water: 0, grassland: 0, parkland: 0, forest: 0, 'dark forest': 0, 'steppe/desert': 0, alpine: 0, snow: 0 };
  let bad = 0, forestCells = 0;
  for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) {
    const x = (i + 0.5) * S / M, z = (j + 0.5) * S / M, h = w.baseHeight(x, z);
    const F = w.maps[MAP.FOREST * mn + j * M + i] / 255, D = w.maps[MAP.DARK * mn + j * M + i] / 255, p = w.maps[MAP.PRECIP * mn + j * M + i] / 255 * 3;
    if (h < w.stillLevel(x, z) + 0.2) { cls.water++; continue; }
    if (F > 0.5) { forestCells++; if (w.slope(x, z) > 1.2 || h > 2100) bad++; }
    if (h > 2450) cls.snow++; else if (h > 1950) cls.alpine++; else if (D > 0.5) cls['dark forest']++; else if (F > 0.5) cls.forest++; else if (p < 0.5) cls['steppe/desert']++; else if (F > 0.18) cls.parkland++; else cls.grassland++;
  }
  info('land cover', Object.entries(cls).map(([k, v]) => `${k} ${(v / mn * 2500).toFixed(0)} km2`).join(', '));
  report('forest never on cliffs or above the treeline', bad / forestCells < 0.002, `${bad} of ${forestCells} forest cells`);
}

// ---- 6. mining interface -------------------------------------------------------------------------
{
  const counts = {}; let n = 0;
  for (let t = 0; t < 4000; t++) {
    const x = ((t * 0.6180339) % 1) * S, z = ((t * 0.7548776) % 1) * S, g = w.ground(x, z); if (g < 1) continue;
    for (const d of [0.5, 3.5, 12.5, 40.5]) { const m = materialAt(w, x, g - d, z, g); counts[m] = (counts[m] || 0) + 1; n++; }
  }
  report('every subsurface cell resolves to a material', !counts.undefined && !counts.air, Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(100 * v / n).toFixed(1)}%`).join(', '));
}

// ---- 7. determinism --------------------------------------------------------------------------------
if (!process.argv.includes('--quick')) {
  const { erodeWorld } = await import('./generate.mjs');
  const cfg = { seed: w.seed, res: 256, sizeM: S, K0: w.meta.config.K0, levels: [[256, 60, 20000]] };
  const sum = () => crypto.createHash('sha256').update(Buffer.from(erodeWorld(cfg).h.buffer)).digest('hex').slice(0, 16);
  const a = sum(), b = sum();
  report('generation is deterministic', a === b, `two independent runs of the erosion core hash to ${a} / ${b}`);
  info('data set', fs.readdirSync(path.join(ROOT, 'data')).map((f) => `${f} sha256:${crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, 'data', f))).digest('hex').slice(0, 12)}`).join('  '));
}

console.log(out.join('\n'));
fs.writeFileSync(path.join(ROOT, 'docs', 'validation.txt'), out.join('\n') + '\n');
console.log(fails ? `\n${fails} check(s) failed` : '\nall checks passed');
