// The Leviathan world generator. Deterministic: same seed + config => identical world.
//   node worldgen/generate.mjs [--res 4096] [--seed 7] [--stage erode|finish]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hash2, noise2 } from '../shared/noise.mjs';
import { buildDesign, volcanoHeight, WORLD_KM } from './design.mjs';
import { makeCtx, erodeStep, upsample2, resample, computePrecip, flood, route, accumulate } from './erosion.mjs';
import { renderMap } from './preview.mjs';
import { ROCK } from '../shared/geology.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
export const CFG = {
  seed: +arg('seed', 7),
  res: +arg('res', 4096),
  sizeM: WORLD_KM * 1000,
  K0: 5.2e-6,
  // multigrid schedule: [resolution, iterations, dt years]
  levels: [[256, 110, 20000], [512, 60, 10000], [1024, 40, 6000], [2048, 30, 8000], [4096, 18, 7000]],
};
const CACHE = path.join(ROOT, '.cache'); fs.mkdirSync(CACHE, { recursive: true });
const T0 = Date.now(); const log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(1)}s]`, ...a);

function fieldsFor(design, N) {
  const R = design.R;
  const g = {
    land: resample(design.land, R, N), U: resample(design.U, R, N), rock: resample(design.rock, R, N, true),
    kmod: resample(design.kmod, R, N), strat: resample(design.strat, R, N), h0: resample(design.h0, R, N), gorge: resample(design.gorge, R, N), mesa: resample(design.mesa, R, N), erg: resample(design.erg, R, N),
  };
  const sea = new Uint8Array(N * N);
  for (let c = 0; c < N * N; c++) {
    sea[c] = g.land[c] < 0 ? 1 : 0;
    // sea floor comes straight from the shoreline distance (interpolating h0 across the coast would lift it)
    if (sea[c]) g.h0[c] = -Math.min(260, 3 + 55 * Math.pow(-g.land[c], 1.3));
    else if (g.h0[c] < 1.5) g.h0[c] = 1.5;
  }
  g.sea = sea;
  // rock-mass strength varies from place to place: without this every mountain face settles at
  // exactly the same critical angle and the range looks faceted
  const tm = new Float32Array(N * N), cs = 50000 / N;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = (i + 0.5) * cs, y = (j + 0.5) * cs;
    const v = 0.98 + 0.42 * noise2(x / 420, y / 420, CFG.seed + 91) + 0.26 * noise2(x / 130, y / 130, CFG.seed + 92) + 0.3 * Math.max(0, noise2(x / 900, y / 900, CFG.seed + 93));
    tm[j * N + i] = Math.max(0.5, Math.min(1.9, v));
  }
  g.tmod = tm;
  return g;
}

export function erodeWorld(cfg) {
  const design = buildDesign(Math.min(1024, cfg.res), cfg.seed);
  log('design built');
  let h = null, N = 0, g = null, P = null;
  for (const [res, iters, dt] of cfg.levels) {
    if (res > cfg.res) break;
    const dx = cfg.sizeM / res;
    g = fieldsFor(design, res);
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
    const ctx = makeCtx(N);
    for (let it = 0; it < iters; it++) {
      if (it % 15 === 0) P = computePrecip(h, g.sea, N, dx);
      erodeStep(ctx, h, g.sea, g, P, dx, dt, cfg.K0, cfg.seed + res);
    }
    let mx = 0; for (let c = 0; c < N * N; c++) if (h[c] > mx) mx = h[c];
    log(`level ${res}: ${iters} it, max elevation ${mx.toFixed(0)} m`);
  }
  return { h, N, g, P };
}

function stats(h, N, g) {
  const reg = (x0, x1, y0, y1) => {
    let mx = -1e9, sum = 0, cnt = 0;
    for (let j = Math.floor(y0 / 50 * N); j < y1 / 50 * N; j++) for (let i = Math.floor(x0 / 50 * N); i < x1 / 50 * N; i++) {
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
  const cacheFile = path.join(CACHE, `eroded_${CFG.res}_${CFG.seed}.f32`);
  let world;
  if (stage === 'finish' && fs.existsSync(cacheFile)) {
    const buf = fs.readFileSync(cacheFile);
    const h = new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4).slice();
    const N = CFG.res;
    const design = buildDesign(Math.min(1024, N), CFG.seed);
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
