// The Leviathan world generator. Deterministic: same seed + config => identical world.
//   node worldgen/generate.mjs [--res 4096] [--seed 7] [--stage erode|finish]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hash2, noise2 } from '../shared/noise.mjs';
import { buildDesign, volcanoHeight, WORLD_KM, setVariant } from './design.mjs';
import { getLayout, setEdgeFade, setPlay } from './layout.mjs';
import { makeCtx, erodeStep, upsample2, resample, computePrecip, computePrecipDir, flood, route, accumulate, boxBlur } from './erosion.mjs';
import { renderMap } from './preview.mjs';
import { ROCK } from '../shared/geology.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
export const MARGIN_KM = 3;      // generated margin around the playable 50 km: keeps edge-of-simulation artefacts (rivers
                                 // running along the boundary, ranges sagging to nothing) outside the visible world
// seeded worlds may be rectangular: --size 80x40 gives an 80 km (east-west) by 40 km (north-south) playable world
const [PLAY_W, PLAY_H] = arg('size', '50x50').split('x').map(Number), PLAY_MAX = Math.max(PLAY_W, PLAY_H);
export const CFG = {
  playW: PLAY_W, playH: PLAY_H,
  // --seed random picks a fresh seed and prints it; the number is stored in world.json so the world can be rebuilt
  seed: arg('seed', 7) === 'random' ? Math.floor(Math.random() * 1e6) : +arg('seed', 7),
  variant: arg('variant', 'A'),
  biomes: +arg('biomes', 0),            // seeded worlds: 1 = a climate gradient (snowy tundra and taiga one side, savanna and a sand desert the other)
  edges: arg('edges', 'fade'),           // seeded worlds: 'fade' keeps the great massif inside the world, 'open' lets mountains run past the border
  wind: +arg('wind', 0),                 // rain-bearing wind: 0 = from the west, 0.5 = from the south-west
  outDir: arg('out', arg('variant', 'A') === 'B' ? 'data_b' : 'data'),          // 'A' = original; 'B' = central sea, cold north, coastal marshes
  res: +arg('res', 4096),
  // the generated world is the 50 km playable square plus MARGIN_KM of equally detailed land on every side
  sizeM: (PLAY_MAX + 2 * MARGIN_KM) * 1000,
  domain: { x0: -MARGIN_KM, size: PLAY_MAX + 2 * MARGIN_KM },
  K0: 5.2e-6,
  // multigrid schedule: [resolution, iterations, dt years]
  levels: [[256, 110, 20000], [512, 60, 10000], [1024, 40, 6000], [2048, 30, 8000], [4096, 18, 7000]],
};
const CACHE = path.join(ROOT, '.cache'); fs.mkdirSync(CACHE, { recursive: true });
const T0 = Date.now(); const log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(1)}s]`, ...a);

// Seeded world: the sea is wherever the ground is below sea level, plus a two-cell ring at the edge of the
// generated domain that stands for the land continuing beyond it (an outlet at its own height, so rivers on the
// outer flanks leave the world instead of ponding against its edge). The ring lies in the hidden margin.
const isEdge = (i, j, N) => i < 2 || j < 2 || i >= N - 2 || j >= N - 2;
function seaFrom(h, N, sea = new Uint8Array(N * N)) {
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const c = j * N + i; sea[c] = h[c] < 0 || isEdge(i, j, N) ? 1 : 0; }
  return sea;
}
// After the simulation: the sea rises a little to its present level (at most 3 m), drowning the mouths of the
// valleys into small bays without turning every coast into fjords. Water
// below sea level then cut off from the open sea is a lagoon or pond: small ones are filled in (they would have
// silted up), and specks of land too small to be islands go under.
function settleSea(h, N, dx, log, share) {
  const n = N * N, comp = new Int32Array(n).fill(-1), stack = new Int32Array(n), a = (dx / 1000) ** 2;
  let filled = 0, drowned = 0;
  { const m = Math.round(MARGIN_KM / (WORLD_KM + 2 * MARGIN_KM) * N), z = [];
    for (let j = m; j < N - m; j += 2) for (let i = m; i < N - m; i += 2) z.push(h[j * N + i]);
    z.sort((p, q) => p - q);
    const rise = Math.max(0, Math.min(3, z[Math.floor(z.length * share)]));
    for (let c = 0; c < n; c++) h[c] -= rise;
    log(`sea rose ${rise.toFixed(0)} m to its present level`); }
  // sediment builds a shelf off every shore: the sea floor deepens gradually away from land instead of dropping
  // off the old shoreline in a cliff
  { const d = new Float32Array(n), D = Math.SQRT2 * dx;
    for (let c = 0; c < n; c++) d[c] = h[c] >= 0 ? 0 : 1e9;
    for (let pass = 0; pass < 2; pass++) for (let k = 0; k < n; k++) {
      const c = pass ? n - 1 - k : k, i = c % N, j = (c / N) | 0; if (!d[c]) continue;
      const nb = pass ? [[i + 1, j, dx], [i, j + 1, dx], [i + 1, j + 1, D], [i - 1, j + 1, D]] : [[i - 1, j, dx], [i, j - 1, dx], [i - 1, j - 1, D], [i + 1, j - 1, D]];
      for (const [x, y, w] of nb) if (x >= 0 && y >= 0 && x < N && y < N) d[c] = Math.min(d[c], d[y * N + x] + w);
    }
    for (let c = 0; c < n; c++) if (h[c] < 0) h[c] = Math.max(h[c], -(2 + 0.055 * d[c])); }
  for (const water of [true, false]) {
    comp.fill(-1);
    for (let s0 = 0; s0 < n; s0++) {
      const i0 = s0 % N, j0 = (s0 / N) | 0; if ((h[s0] < 0) !== water || comp[s0] >= 0 || isEdge(i0, j0, N)) continue;
      let sp = 0, cnt = 0, edge = false; stack[sp++] = s0; comp[s0] = 1; const cells = [];
      while (sp) {
        const c = stack[--sp], i = c % N, j = (c / N) | 0; cnt++; if (cells.length < 2000000) cells.push(c);
        for (const [x, y] of [[i - 1, j], [i + 1, j], [i, j - 1], [i, j + 1]]) {
          if (x < 0 || y < 0 || x >= N || y >= N) continue; if (isEdge(x, y, N)) { edge = true; continue; }
          const q = y * N + x; if ((h[q] < 0) === water && comp[q] < 0) { comp[q] = 1; stack[sp++] = q; }
        }
      }
      if (water && !edge && !(cnt * a > 150) && cnt <= cells.length) { for (const c of cells) h[c] = 1.5; filled += cnt; }   // no lakes: only the main sea (and arms of the sea beyond the edge) stays water
      if (!water && !edge && cnt * a < 0.6 && cnt <= cells.length) { for (const c of cells) h[c] = -2; drowned += cnt; }
    }
  }
  log(`sea settled: ${(filled * a).toFixed(1)} km2 of ponds filled, ${(drowned * a).toFixed(2)} km2 of specks drowned`);
}

function fieldsFor(design, N) {
  const R = design.R;
  const g = {
    land: resample(design.land, R, N), U: resample(design.U, R, N), rock: resample(design.rock, R, N, true),
    kmod: resample(design.kmod, R, N), strat: resample(design.strat, R, N), h0: resample(design.h0, R, N), gorge: resample(design.gorge, R, N), mesa: resample(design.mesa, R, N), erg: resample(design.erg, R, N), fen: resample(design.fen, R, N), moor: resample(design.moor, R, N),
  };
  const sea = new Uint8Array(N * N);
  // the sea is fixed from the design, as in 1B: clean coasts that erosion shapes but never floods or drains
  for (let c = 0; c < N * N; c++) {
    sea[c] = g.land[c] < 0 || (CFG.variant === 'S' && isEdge(c % N, (c / N) | 0, N)) ? 1 : 0;
    // sea floor comes straight from the shoreline distance (interpolating h0 across the coast would lift it)
    if (sea[c] && g.land[c] < 0) g.h0[c] = -Math.min(260, 3 + 55 * Math.pow(-g.land[c], 1.3));   // (edge-ring outlets keep their land height)
    else if (g.h0[c] < 1.5) g.h0[c] = 1.5;
  }
  g.sea = sea;
  // Seeded worlds: the sea floor starts at the shoreline itself and deepens with distance from land (a sediment
  // shelf). It used to start 3 m down at the first sea cell while the first land cell stood 1.5 m up, so the coast
  // was a 5 m step that followed the cell grid: a pixelated, sawtoothed shoreline. Now the ground passes through sea
  // level between cells, and the waterline is where the smooth terrain surface meets the water.
  if (CFG.variant === 'S') {
    const n = N * N, dx = CFG.sizeM / N, d = new Float32Array(n), D = Math.SQRT2 * dx;
    for (let c = 0; c < n; c++) d[c] = sea[c] && g.land[c] < 0 ? 1e9 : 0;
    for (let pass = 0; pass < 2; pass++) for (let k = 0; k < n; k++) {
      const c = pass ? n - 1 - k : k, i = c % N, j = (c / N) | 0; if (!d[c]) continue;
      const nb = pass ? [[i + 1, j, dx], [i, j + 1, dx], [i + 1, j + 1, D], [i - 1, j + 1, D]] : [[i - 1, j, dx], [i, j - 1, dx], [i - 1, j - 1, D], [i + 1, j - 1, D]];
      for (const [x, y, w] of nb) if (x >= 0 && y >= 0 && x < N && y < N) d[c] = Math.min(d[c], d[y * N + x] + w);
    }
    for (let c = 0; c < n; c++) if (sea[c] && g.land[c] < 0) g.h0[c] = Math.max(g.h0[c], -(0.3 + 0.045 * (d[c] - dx / 2)));
  }
  // rock-mass strength varies from place to place: without this every mountain face settles at
  // exactly the same critical angle and the range looks faceted
  const tm = new Float32Array(N * N), cs = CFG.sizeM / N;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = (i + 0.5) * cs, y = (j + 0.5) * cs;
    const v = 0.98 + 0.42 * noise2(x / 420, y / 420, CFG.seed + 91) + 0.26 * noise2(x / 130, y / 130, CFG.seed + 92) + 0.3 * Math.max(0, noise2(x / 900, y / 900, CFG.seed + 93));
    tm[j * N + i] = Math.max(0.5, Math.min(1.9, v));
  }
  g.tmod = tm;
  if (CFG.variant === 'S') { const cq = new Float32Array(N * N); for (let c = 0; c < N * N; c++) cq[c] = g.mesa[c] > 0.5 && g.rock[c] === ROCK.SANDSTONE ? 1e4 : 0; g.cutQ = cq; }   // (only the hard caprock resists; soft shale gullies everywhere)
  return g;
}

export function erodeWorld(cfg) {
  // Seeded world: the great massif's uplift rate is calibrated with a quick probe run of the first level, so every
  // world's highest summit lands near its target (4.5-5.5 km, from the seed) rather than anywhere from 3 to 10 km
  // depending on the shape of the thickened zone. (The finer levels add about 27% to the probe's height.)
  if (false) {   // (calibration probe: replaced by the 1B-style massif, whose height needs no calibration)
    const probe = erodeWorld({ ...cfg, levels: [cfg.levels[0]], uScale: 1, probe: true });
    let mx = 0; for (const v of probe.h) if (v > mx) mx = v;
    const target = 4500 + 1000 * hash2(7, 7, cfg.seed);
    cfg.uScale = Math.max(0.35, Math.min(1.8, Math.pow(target / 1.27 / Math.max(1, mx), 1.1)));
    log(`great massif calibrated: mountain uplift x${cfg.uScale.toFixed(2)} for a summit near ${target.toFixed(0)} m`);
  }
  const design = buildDesign(Math.min(1024, cfg.res), cfg.seed, cfg.domain);
  log('design built');
  let h = null, N = 0, g = null, P = null;
  for (const [res, iters, dt] of cfg.levels) {
    if (res > cfg.res) break;
    const dx = cfg.sizeM / res;
    g = fieldsFor(design, res);
    if (cfg.uScale && cfg.uScale !== 1) for (let c = 0; c < res * res; c++) {
      if (g.U[c] > 0.35e-3) g.U[c] = 0.35e-3 + (g.U[c] - 0.35e-3) * cfg.uScale;
      if (g.h0[c] > 400) g.h0[c] = 400 + (g.h0[c] - 400) * cfg.uScale;
    }
    if (!h) h = Float32Array.from(g.h0);
    else {
      h = upsample2(h, N);
      const amp = 0.02 * dx;
      for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) {
        const c = j * res + i;
        if (g.sea[c]) h[c] = g.h0[c];
        else h[c] = Math.max(0.5, h[c]) + (hash2(i, j, cfg.seed + res) - 0.5) * amp;
      }
    }
    N = res;
    if (res === Math.min(1024, cfg.res)) {
      // the volcano is young: build the cone now so only its latest erosion is modelled
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const c = j * N + i; if (g.sea[c]) continue;
        const [vh, r] = volcanoHeight((i + 0.5) / N * WORLD_KM, (j + 0.5) / N * WORLD_KM, cfg.seed);
        if (vh > h[c] - 170 && r < 12) { h[c] = Math.max(h[c], vh); }
        if (r < 0.6) h[c] = Math.min(h[c], vh + 170 > h[c] ? vh : h[c]);
      }
    }
    if (res >= 1024) for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const [vh, r] = volcanoHeight((i + 0.5) / N * WORLD_KM, (j + 0.5) / N * WORLD_KM, cfg.seed);
      if (r < 5.2 && vh > 250) g.rock[j * N + i] = ROCK.BASALT;
    }
    const ctx = makeCtx(N), VSF = cfg.variant === 'S';
    // the country that kept its sedimentary cover is dry, but its rivers (fed from beyond it, and by storms) still cut canyons:
    // over the long run it gets most of the rain the relief would give
    const arid = VSF ? boxBlur(g.mesa, N, Math.max(1, Math.round(300 / dx))) : null;
    for (let it = 0; it < iters; it++) {
      if (it % 15 === 0) { P = cfg.variant === 'S' ? computePrecipDir(h, g.sea, N, dx, getLayout(cfg.seed).dir, getLayout(cfg.seed).windSlope, true) : computePrecip(h, g.sea, N, dx, cfg.wind || 0); if (arid) for (let c = 0; c < N * N; c++) P[c] *= 1 - 0.2 * Math.min(1, arid[c] * 1.4); }
      erodeStep(ctx, h, g.sea, g, P, dx, dt, cfg.K0, cfg.seed + res);
      // the ring at the edge of the simulated area stands for the land beyond it: it keeps the height of the land just
      // inside (a free outflow boundary), so rivers leave the world without cutting an escarpment along its edge
      if (VSF) for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) if (isEdge(i, j, N)) { const c = j * N + i, q = Math.min(N - 3, Math.max(2, j)) * N + Math.min(N - 3, Math.max(2, i)); if (!g.sea[q]) h[c] = h[q]; }
      // the sea floor (and the edge ring, which keeps pace with the land beyond it) moves with the crust
    }
    let mx = 0; for (let c = 0; c < N * N; c++) if (h[c] > mx) mx = h[c];
    log(`level ${res}: ${iters} it, max elevation ${mx.toFixed(0)} m`);
  }
  return { h, N, g, P };
}

function stats(h, N, g) {
  const reg = (x0, x1, y0, y1) => {
    let mx = -1e9, sum = 0, cnt = 0;
    const ki = (km) => (km - CFG.domain.x0) / CFG.domain.size * N;
    for (let j = Math.floor(ki(y0)); j < ki(y1); j++) for (let i = Math.floor(ki(x0)); i < ki(x1); i++) {
      const z = h[j * N + i]; if (z > mx) mx = z; if (z > 0) { sum += z; cnt++; }
    }
    return `max ${mx.toFixed(0)} mean ${(sum / Math.max(1, cnt)).toFixed(0)}`;
  };
  log('coast range ', reg(6, 13, 2, 30));
  log('valley      ', reg(15, 25, 5, 30));
  log('spine       ', reg(28, 40, 0, 40));
  log('highlands   ', reg(5, 30, 42, 50));
  log('plateau     ', reg(41, 50, 0, 50));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const stage = arg('stage', 'all');
  setVariant(CFG.variant); setEdgeFade(CFG.edges === 'open' ? 0 : 1); setPlay(CFG.playW, CFG.playH);
  const cacheFile = path.join(CACHE, `eroded_${CFG.res}_${CFG.seed}${CFG.variant === 'A' ? '' : '_' + CFG.variant}${CFG.wind ? '_w' + CFG.wind : ''}${CFG.edges === 'open' ? '_open' : ''}${PLAY_W !== 50 || PLAY_H !== 50 ? `_${PLAY_W}x${PLAY_H}` : ''}.f32`);
  let world;
  if (stage === 'finish' && fs.existsSync(cacheFile)) {
    const buf = fs.readFileSync(cacheFile);
    const h = new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4).slice();
    const N = CFG.res;
    const design = buildDesign(Math.min(1024, N), CFG.seed, CFG.domain);
    const g = fieldsFor(design, N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const [vh, r] = volcanoHeight((i + 0.5) / N * WORLD_KM, (j + 0.5) / N * WORLD_KM, CFG.seed);
      if (r < 5.2 && vh > 250) g.rock[j * N + i] = ROCK.BASALT;
    }
    world = { h, N, g };
    log('loaded cached erosion');
  } else {
    world = erodeWorld(CFG);
    fs.writeFileSync(cacheFile, Buffer.from(world.h.buffer));
  }
  stats(world.h, world.N, world.g);
  if (stage === 'erode') {
    const dx = CFG.sizeM / world.N, ctx = makeCtx(world.N);
    const P = computePrecip(world.h, world.g.sea, world.N, dx);
    flood(ctx, world.h, world.g.sea, dx); route(ctx, world.g.sea, dx, CFG.seed); accumulate(ctx, world.g.sea, P, dx);
    renderMap(path.join(CACHE, 'eroded.png'), world.h, world.N, dx, { Q: ctx.Q, qThr: 3e6 });
    log('preview written');
  } else {
    const { finishWorld } = await import('./finish.mjs');
    await finishWorld(world, CFG, ROOT, log);
  }
}
