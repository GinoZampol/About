// Finishing stages: glacial/fluvial valley shaping, lakes, final hydrology, river network,
// climate + ecology maps, and export of the runtime data set.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { noise2, fbm, smoothstep, sat, hash2 } from '../shared/noise.mjs';
import { ROCK, ROCK_TALUS, rockAt } from '../shared/geology.mjs';
import { encodeU16, H_OFFSET, H_SCALE } from '../shared/codec.mjs';
import { makeCtx, flood, route, accumulate, computePrecip, boxBlur, DX8, DY8, DD8 } from './erosion.mjs';
import { renderMap } from './preview.mjs';
import { VOLCANO, GORGE, WORLD_KM } from './design.mjs';

const ELA = 1700;          // ice-age equilibrium line altitude (m)
const Q_RIVER = 1.2e6;     // effective drainage (m^2) where a perennial channel starts
const gz = (buf) => zlib.gzipSync(Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength), { level: 7 });

export async function finishWorld(world, cfg, ROOT, log) {
  const { h, N, g } = world;
  const n = N * N, dx = cfg.sizeM / N, sea = g.sea, seed = cfg.seed;
  const ctx = makeCtx(N);
  // wind-blown sand buries the fine drainage of the erg
  {
    const r = Math.max(1, Math.round(130 / dx)), hb = boxBlur(boxBlur(h, N, r), N, r);
    for (let c = 0; c < n; c++) if (!sea[c] && g.erg[c] > 0.01) h[c] += (hb[c] - h[c]) * Math.min(1, g.erg[c] * 1.3);
  }
  let P = computePrecip(h, sea, N, dx);

  // ---- A. ice flux from a mass-balance accumulation --------------------------------------------
  flood(ctx, h, sea, dx); route(ctx, sea, dx, seed + 900); accumulate(ctx, sea, P, dx);
  const ice = new Float64Array(n);
  {
    const { order, rec, cnt } = ctx, a = dx * dx;
    for (let q = cnt - 1; q >= 0; q--) {
      const c = order[q];
      const yk = ((c / N) | 0) / N * WORLD_KM;
      const ela = ELA - 450 * smoothstep(36, 46, yk);     // maritime north: lower snowline
      let bal = 0.004 * (h[c] - ela) * (0.4 + P[c]) * a;
      // below the snowline the whole glacier tongue melts, not just the one-cell flow path
      if (bal < 0) bal *= Math.max(1, 2 * 90 * Math.pow(Math.max(ice[c], 1) / 1e6, 0.3) / dx);
      let v = ice[c] + bal;
      if (v < 0) v = 0;
      ice[c] = v;
      const r = rec[c]; if (!sea[r]) ice[r] += v;
    }
  }

  // ---- B. valley stamps: U-shaped glacial troughs and river floodplains ------------------------
  {
    const src = Float32Array.from(h), { Q } = ctx;
    let ns = 0;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const c = j * N + i; if (sea[c]) continue;
      const qk = Q[c] / 1e6, ik = ice[c] / 1e6;
      if (qk < 6 && ik < 2) continue;
      const Wg = ik > 0.5 ? Math.min(900, 90 * Math.pow(ik, 0.3)) : 0;
      const Dg = ik > 0.5 ? Math.min(210, 13 * Math.pow(ik, 0.4)) * (1 - sat(g.gorge[c] * 3)) * smoothstep(60, 220, src[c]) : 0;
      // rivers on resistant plateau rock stay confined in their canyons
      const conf = g.rock[c] === ROCK.SANDSTONE ? 0.3 : g.gorge[c] > 0.3 ? 0.45 : 1;
      const w = Math.min(620, 14 * Math.sqrt(qk)) * conf + 0.35 * Wg;
      const R = 22 + 1.1 * Wg;
      const z0 = src[c] - Dg;
      const rmax = w + Math.sqrt(2 * R * 700);
      const rc = Math.ceil(rmax / dx);
      ns++;
      for (let b = -rc; b <= rc; b++) {
        const y = j + b; if (y < 0 || y >= N) continue;
        for (let a = -rc; a <= rc; a++) {
          const x = i + a; if (x < 0 || x >= N) continue;
          const d = Math.sqrt(a * a + b * b) * dx; if (d > rmax) continue;
          const t = y * N + x; if (sea[t]) continue;
          const rise = d <= w ? 0.004 * d : 0.004 * w + (d - w) * (d - w) / (2 * R);
          const z = z0 + rise;
          if (z < h[t]) h[t] = z;
        }
      }
    }
    log(`valley stamps: ${ns} channel cells`);
  }

  // ---- B2. designed lake basins: glacial overdeepening of two trunk valleys -----------------------
  const carveLake = (x0, x1, y0, y1, minH, skipKm, lenKm, depth, w0, w1, R = 260) => {
    const { Q, order, rec, cnt } = ctx;
    let best = -1, bq = 0;
    for (let j = Math.floor(y0 / 50 * N); j < y1 / 50 * N; j++) for (let i = Math.floor(x0 / 50 * N); i < x1 / 50 * N; i++) {
      const c = j * N + i; if (!sea[c] && h[c] > minH && Q[c] > bq) { bq = Q[c]; best = c; }
    }
    if (best < 0) return;
    // walk upstream along the trunk (largest donor)
    const donorOf = new Map();
    const pathCells = [best]; let cur = best, len = 0;
    while (len < (skipKm + lenKm) * 1000) {
      const i = cur % N, j = (cur / N) | 0; let nb = -1, nq = 0;
      for (let k = 0; k < 8; k++) {
        const x = i + DX8[k], y = j + DY8[k]; if (x < 0 || y < 0 || x >= N || y >= N) continue;
        const t = y * N + x; if (!sea[t] && rec[t] === cur && Q[t] > nq) { nq = Q[t]; nb = t; }
      }
      if (nb < 0) break;
      len += Math.hypot((nb % N) - i, ((nb / N) | 0) - j) * dx; pathCells.push(nb); cur = nb;
    }
    let acc = 0, zsill = null; const snap = Float32Array.from(h);
    for (let q = 1; q < pathCells.length; q++) {
      const c = pathCells[q], pc = pathCells[q - 1], i = c % N, j = (c / N) | 0;
      acc += Math.hypot(i - (pc % N), j - ((pc / N) | 0)) * dx;
      const s = (acc - skipKm * 1000) / (lenKm * 1000); if (s <= 0 || s >= 1) continue;
      if (zsill === null) zsill = snap[c];
      if (snap[c] - zsill > 1.6 * depth) break;   // the river has climbed out of the basin
      const bump = Math.pow(Math.sin(Math.PI * s), 0.6);
      const D = depth * bump, w = (w0 + (w1 - w0) * bump) * (0.8 + 0.4 * noise2(acc / 900, 1.7, seed + 80));
      const z0 = Math.min(snap[c], zsill - D), rmax = w + Math.sqrt(2 * R * Math.min(500, depth * 2.5)), rc = Math.ceil(rmax / dx);
      for (let b = -rc; b <= rc; b++) for (let a = -rc; a <= rc; a++) {
        const x = i + a, y = j + b; if (x < 0 || y < 0 || x >= N || y >= N) continue;
        const d = Math.sqrt(a * a + b * b) * dx; if (d > rmax) continue;
        const t = y * N + x; if (sea[t]) continue;
        const z = z0 + (d <= w ? 0.01 * d : 0.01 * w + (d - w) * (d - w) / (2 * R));
        if (z < h[t]) h[t] = z;
      }
    }
  };
  flood(ctx, h, sea, dx); route(ctx, sea, dx, seed + 902); accumulate(ctx, sea, P, dx);
  carveLake(22, 31, 40.6, 48, 12, 1.2, 9.5, 120, 380, 720);     // Longwater, in the great northern trough
  carveLake(26.5, 30.5, 25, 34, 260, 0.5, 3.6, 60, 140, 260, 70);   // an alpine valley lake on the Spine's west flank
  carveLake(9, 12, 6, 20, 150, 0.4, 2.0, 28, 90, 170, 50);         // a small Coast Range lake

  // ---- C. the sea floods everything below sea level that is connected to it (fjords) -----------
  {
    const stack = [];
    for (let c = 0; c < n; c++) if (sea[c]) stack.push(c);
    let added = 0;
    while (stack.length) {
      const c = stack.pop(), i = c % N, j = (c / N) | 0;
      for (let k = 0; k < 8; k += 2) {
        const x = i + DX8[k], y = j + DY8[k]; if (x < 0 || y < 0 || x >= N || y >= N) continue;
        const t = y * N + x;
        if (!sea[t] && h[t] < -0.5 && ((t / N) | 0) / N * WORLD_KM > 33) { sea[t] = 1; added++; stack.push(t); }
      }
    }
    log(`fjord flooding: ${added} cells joined the sea`);
  }

  // ---- D. talus relaxation: settle every wall left by the stamps (Dijkstra-style, lowest cells first) ---
  {
    const cap = n * 3, hk = new Float32Array(cap), hi = new Int32Array(cap); let hs = 0, lowered = 0;
    const push = (c, k) => { if (hs >= cap) return; let i = hs++; while (i > 0) { const p = (i - 1) >> 1; if (hk[p] <= k) break; hk[i] = hk[p]; hi[i] = hi[p]; i = p; } hk[i] = k; hi[i] = c; };
    const pop = () => { const top = hi[0]; hs--; if (hs > 0) { const k = hk[hs], c = hi[hs]; let i = 0; for (;;) { let l = 2 * i + 1; if (l >= hs) break; if (l + 1 < hs && hk[l + 1] < hk[l]) l++; if (hk[l] >= k) break; hk[i] = hk[l]; hi[i] = hi[l]; i = l; } hk[i] = k; hi[i] = c; } return top; };
    for (let c = 0; c < n; c++) push(c, sea[c] ? 0 : h[c]);
    while (hs > 0) {
      const k0 = hk[0], c = pop(), hc = sea[c] ? 0 : h[c];
      if (k0 > hc + 1e-3) continue;                    // stale entry
      const i = c % N, j = (c / N) | 0;
      for (let k = 0; k < 8; k++) {
        const x = i + DX8[k], y = j + DY8[k]; if (x < 0 || y < 0 || x >= N || y >= N) continue;
        const t = y * N + x; if (sea[t]) continue;
        const lim = hc + ROCK_TALUS[rockAt(g.rock[t], h[t], g.strat[t])] * g.tmod[t] * DD8[k] * dx;
        if (h[t] > lim) { h[t] = lim; lowered++; push(t, lim); }
      }
    }
    log(`talus settling lowered ${lowered} cells`);
  }
  { let mx = 0, cnt = 0; for (let j = 0; j < N - 1; j++) for (let i = 0; i < N - 1; i++) { const c = j * N + i; if (sea[c] || sea[c + 1] || sea[c + N]) continue; const d = Math.max(Math.abs(h[c + 1] - h[c]), Math.abs(h[c + N] - h[c])); if (d > mx) mx = d; if (d > 60) cnt++; } log(`talus relaxation done: max step ${mx.toFixed(1)} m, ${cnt} steps over 60 m`); }

  // ---- E. lakes: keep the significant basins, silt up the rest ---------------------------------
  flood(ctx, h, sea, dx);
  const lakeId = new Int32Array(n), lakes = [];
  {
    const f = ctx.f, comp = new Int32Array(n).fill(-1), stack = [];
    const comps = [];
    for (let s = 0; s < n; s++) {
      if (sea[s] || comp[s] >= 0 || f[s] - h[s] < 1.0) continue;
      const id = comps.length; let area = 0, lvl = 1e9, maxD = 0, sx = 0, sy = 0; const cells = [];
      comp[s] = id; stack.push(s);
      while (stack.length) {
        const c = stack.pop(), i = c % N, j = (c / N) | 0;
        cells.push(c); area++; if (f[c] < lvl) lvl = f[c]; if (f[c] - h[c] > maxD) maxD = f[c] - h[c]; sx += i; sy += j;
        for (let k = 0; k < 8; k += 2) {
          const x = i + DX8[k], y = j + DY8[k]; if (x < 0 || y < 0 || x >= N || y >= N) continue;
          const t = y * N + x;
          if (!sea[t] && comp[t] < 0 && f[t] - h[t] >= 1.0) { comp[t] = id; stack.push(t); }
        }
      }
      comps.push({ area: area * dx * dx, lvl, maxD, cx: sx / area, cy: sy / area, cells });
    }
    const keep = comps.filter((c) => c.area > 0.15e6 && c.maxD > 4).sort((a, b) => b.area - a.area).slice(0, 14);
    const keepSet = new Set(keep);
    log('basins: ' + comps.slice().sort((a, b) => b.area - a.area).slice(0, 10).map((c) => `${(c.area / 1e6).toFixed(2)}km2/${c.maxD.toFixed(0)}m@${(c.cx / N * 50).toFixed(0)},${(c.cy / N * 50).toFixed(0)}`).join(' '));
    for (const cp of comps.slice().sort((a, b) => b.area - a.area)) {
      if (keepSet.has(cp)) {
        const id = lakes.length + 1;
        // limit depth so lake beds stay plausible and give shallow shelving shores
        for (const c of cp.cells) { lakeId[c] = id; if (cp.lvl - h[c] > 160) h[c] = cp.lvl - 160; }
        lakes.push({ id, level: cp.lvl, areaKm2: cp.area / 1e6, maxDepth: Math.min(160, cp.maxD), x: (cp.cx + 0.5) * dx, y: (cp.cy + 0.5) * dx });
      } else for (const c of cp.cells) h[c] = f[c];   // sediment-filled basin => flat valley floor
    }
    // shallow sub-1m ponds everywhere else are simply levelled
    for (let c = 0; c < n; c++) if (!sea[c] && !lakeId[c] && f[c] > h[c]) h[c] = f[c];
    log(`lakes kept: ${lakes.length} (largest ${lakes[0] ? lakes[0].areaKm2.toFixed(1) : 0} km2), basins silted: ${comps.length - lakes.length}`);
  }

  // ---- F. final hydrology ---------------------------------------------------------------------
  P = computePrecip(h, sea, N, dx);
  flood(ctx, h, sea, dx); route(ctx, sea, dx, seed + 901); accumulate(ctx, sea, P, dx);
  const { f, Q, rec } = ctx;
  const surf = new Float32Array(n); // water-or-ground surface
  for (let c = 0; c < n; c++) surf[c] = sea[c] ? 0 : lakeId[c] ? lakes[lakeId[c] - 1].level : h[c];

  // ---- G. river network as smooth polylines ---------------------------------------------------
  const isRiver = new Uint8Array(n), nd = new Uint8Array(n);
  for (let c = 0; c < n; c++) isRiver[c] = !sea[c] && !lakeId[c] && Q[c] >= Q_RIVER ? 1 : 0;
  for (let c = 0; c < n; c++) if (isRiver[c] && isRiver[rec[c]]) nd[rec[c]]++;
  const segs = [];
  const cellXY = (c) => [((c % N) + 0.5) * dx, (((c / N) | 0) + 0.5) * dx];
  for (let s = 0; s < n; s++) {
    if (!isRiver[s] || nd[s] === 1) continue;
    const pts = []; let c = s;
    for (;;) {
      const [x, y] = cellXY(c);
      if (sea[c] || lakeId[c]) { pts.push({ x, y, z: surf[c], q: pts[pts.length - 1].q, water: 1 }); break; }
      pts.push({ x, y, z: f[c], q: Q[c] / 1e6, water: 0 });
      if (c !== s && nd[c] >= 2) break;
      c = rec[c];
    }
    if (pts.length >= 2) segs.push(pts);
  }
  let totalLen = 0, npts = 0, uphill = 0;
  for (const pts of segs) {
    const m = pts.length, last = pts[m - 1];
    // smooth plan-form (ends pinned so junctions stay connected)
    for (let it = 0; it < 5; it++) {
      let px = pts[0].x, py = pts[0].y;
      for (let k = 1; k < m - 1; k++) {
        const nx = 0.25 * px + 0.5 * pts[k].x + 0.25 * pts[k + 1].x, ny = 0.25 * py + 0.5 * pts[k].y + 0.25 * pts[k + 1].y;
        px = pts[k].x; py = pts[k].y; pts[k].x = nx; pts[k].y = ny;
      }
    }
    // long profile: monotone, then smoothed (averaging keeps it monotone)
    for (let k = 1; k < m; k++) if (pts[k].z > pts[k - 1].z) { uphill++; pts[k].z = pts[k - 1].z; }
    for (let it = 0; it < 6; it++) {
      let pz = pts[0].z;
      for (let k = 1; k < m - 1; k++) { const nz = 0.25 * pz + 0.5 * pts[k].z + 0.25 * pts[k + 1].z; pz = pts[k].z; pts[k].z = nz; }
    }
    // hydraulic geometry
    for (let k = 0; k < m; k++) {
      const p = pts[k], a = pts[Math.max(0, k - 2)], b = pts[Math.min(m - 1, k + 2)];
      const ds = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      p.s = Math.max(0, (a.z - b.z) / ds);
      p.w = Math.min(190, Math.max(2.5, 3.2 * Math.sqrt(p.q))) * Math.min(1.1, Math.max(0.6, 1.25 - 4 * p.s));
      p.d = 0.35 * Math.pow(p.q, 0.36);
    }
    // meanders on low-gradient reaches
    let phase = hash2(segs.indexOf(pts), 7, seed) * 6.28, sAcc = 0;
    const arc = [0]; for (let k = 1; k < m; k++) arc.push(arc[k - 1] + Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y));
    const offs = [];
    for (let k = 0; k < m; k++) {
      const p = pts[k];
      if (k > 0) { sAcc = arc[k] - arc[k - 1]; phase += sAcc * 6.2832 / (11 * p.w) * (1 + 0.35 * noise2(arc[k] / (30 * p.w), p.x * 1e-4, seed + 60)); }
      const taper = smoothstep(0, 5 * p.w, arc[k]) * smoothstep(0, 5 * p.w, arc[m - 1] - arc[k]);
      const amp = Math.min(1.9 * p.w, 110) * smoothstep(0.0045, 0.001, p.s) * taper * (p.w > 5 ? 1 : 0);
      const a = pts[Math.max(0, k - 1)], b = pts[Math.min(m - 1, k + 1)];
      const tl = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      offs.push([-(b.y - a.y) / tl * amp * Math.sin(phase), (b.x - a.x) / tl * amp * Math.sin(phase)]);
    }
    for (let k = 1; k < m - 1; k++) { pts[k].x += offs[k][0]; pts[k].y += offs[k][1]; }
    for (let k = 1; k < m - 1; k++) { pts[k].x = 0.25 * pts[k - 1].x + 0.5 * pts[k].x + 0.25 * pts[k + 1].x; pts[k].y = 0.25 * pts[k - 1].y + 0.5 * pts[k].y + 0.25 * pts[k + 1].y; }
    // water surface sits slightly below the valley floor; never below the receiving water body
    const base = last.water ? last.z : -1e9;
    for (let k = 0; k < m; k++) { const p = pts[k]; if (!p.water) p.z = Math.max(base, p.z - (0.25 + 0.12 * p.d)); }
    for (let k = 1; k < m; k++) if (pts[k].z > pts[k - 1].z) pts[k].z = pts[k - 1].z;
    totalLen += arc[m - 1]; npts += m;
  }
  log(`rivers: ${segs.length} segments, ${(totalLen / 1000).toFixed(0)} km, ${npts} points, profile fixes ${uphill}`);

  // ---- H. map-resolution environmental rasters ------------------------------------------------
  const M = Math.min(1024, N), st = N / M, mdx = cfg.sizeM / M, mn = M * M;
  const mh = new Float32Array(mn), mP = new Float32Array(mn), mQ = new Float32Array(mn), mSlope = new Float32Array(mn);
  const mRock = new Uint8Array(mn), mStrat = new Float32Array(mn), mWater = new Uint8Array(mn), mMesa = new Uint8Array(mn), mFlow = new Uint8Array(mn), mErg = new Float32Array(mn);
  for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) {
    let sh = 0, sp = 0, q = 0, ss = 0, wat = 0;
    for (let b = 0; b < st; b++) for (let a = 0; a < st; a++) {
      const x = i * st + a, y = j * st + b, c = y * N + x;
      sh += h[c]; sp += P[c]; if (Q[c] > q) q = Q[c];
      const gx = (h[y * N + Math.min(N - 1, x + 1)] - h[y * N + Math.max(0, x - 1)]) / (2 * dx), gy = (h[Math.min(N - 1, y + 1) * N + x] - h[Math.max(0, y - 1) * N + x]) / (2 * dx);
      ss += Math.sqrt(gx * gx + gy * gy);
      if (sea[c] || lakeId[c]) wat++;
    }
    const k = st * st, m = j * M + i, cc = Math.floor((j + 0.5) * st) * N + Math.floor((i + 0.5) * st);
    mh[m] = sh / k; mP[m] = sp / k; mQ[m] = q; mSlope[m] = ss / k; mRock[m] = g.rock[cc]; mStrat[m] = g.strat[cc]; mMesa[m] = Math.round(255 * sat(g.mesa[cc])); mErg[m] = g.erg[cc]; mFlow[m] = Math.round(255 * sat(Math.log10(q / 1e6 + 1) / 3)); mWater[m] = wat * 2 > k ? 1 : 0;
  }
  // ambient occlusion from horizon angles
  const mAO = new Uint8Array(mn);
  {
    const steps = [1, 2, 3, 5, 8, 12, 18, 26];
    for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) {
      const z = Math.max(0, mh[j * M + i]); let occ = 0;
      for (let k = 0; k < 8; k++) {
        let mt = 0;
        for (const s of steps) {
          const x = i + DX8[k] * s, y = j + DY8[k] * s; if (x < 0 || y < 0 || x >= M || y >= M) break;
          const t = (Math.max(0, mh[y * M + x]) - z) / (s * DD8[k] * mdx); if (t > mt) mt = t;
        }
        occ += mt / Math.sqrt(1 + mt * mt);
      }
      mAO[j * M + i] = Math.round(255 * sat(1 - 0.95 * occ / 8));
    }
  }
  // distance to open water (for riparian / shore effects), in cells, capped
  const wdist = new Float32Array(mn).fill(40);
  {
    const queue = [];
    for (let m = 0; m < mn; m++) if (mWater[m] || mQ[m] > 40e6) { wdist[m] = 0; queue.push(m); }
    for (let qi = 0; qi < queue.length; qi++) {
      const m = queue[qi], i = m % M, j = (m / M) | 0, dcur = wdist[m]; if (dcur >= 39) continue;
      for (let k = 0; k < 8; k += 2) {
        const x = i + DX8[k], y = j + DY8[k]; if (x < 0 || y < 0 || x >= M || y >= M) continue;
        const t = y * M + x; if (wdist[t] > dcur + 1) { wdist[t] = dcur + 1; queue.push(t); }
      }
    }
  }
  // present-day glaciers: ice accumulates above today's snowline and flows down the valleys until it melts
  const mIce = new Uint8Array(mn);
  {
    const { order, cnt } = ctx, a = dx * dx, ice2 = new Float64Array(n), ELA_NOW = 3050, acc = new Float32Array(mn);
    for (let q = cnt - 1; q >= 0; q--) {
      const c = order[q];
      let bal = 0.004 * (h[c] - ELA_NOW) * (0.4 + P[c]) * a;
      if (bal < 0) bal *= Math.max(1, 2 * 70 * Math.pow(Math.max(ice2[c], 1) / 1e6, 0.3) / dx);
      const v = Math.max(0, ice2[c] + bal); ice2[c] = v;
      const r = rec[c]; if (!sea[r]) ice2[r] += v;
    }
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const c = j * N + i, ik = ice2[c] / 1e6; if (ik < 0.25) continue;
      const rad = Math.min(420, 70 * Math.pow(ik, 0.3)), rc = Math.ceil(rad / mdx), mi = Math.floor(i / st), mj = Math.floor(j / st);
      for (let b = -rc; b <= rc; b++) for (let aa = -rc; aa <= rc; aa++) {
        const x = mi + aa, y = mj + b; if (x < 0 || y < 0 || x >= M || y >= M || aa * aa + b * b > rc * rc) continue;
        if (mh[y * M + x] < h[c] + 70) acc[y * M + x] = 1;
      }
    }
    const bl = boxBlur(acc, M, 1);
    for (let m = 0; m < mn; m++) mIce[m] = Math.round(255 * sat(bl[m] * 1.3));
  }
  const mPrec = new Uint8Array(mn), mForest = new Uint8Array(mn), mDark = new Uint8Array(mn), mWet = new Uint8Array(mn), mSand = new Uint8Array(mn), mStratB = new Uint8Array(mn);
  const reliefR = Math.round(700 / mdx);
  const hBlur = boxBlur(mh, M, reliefR);
  for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) {
    const m = j * M + i, z = mh[m], p = mP[m], sl = mSlope[m];
    const xk = (i + 0.5) / M * WORLD_KM, yk = (j + 0.5) / M * WORLD_KM;
    mPrec[m] = Math.round(255 * sat(p / 3));
    mStratB[m] = Math.round(sat((mStrat[m] + 100) / 510) * 255);
    if (mWater[m]) continue;
    const qk = mQ[m] / 1e6;
    // wetness: floodplains, deltas, lake margins
    const flat = smoothstep(0.035, 0.008, sl);
    let wet = flat * smoothstep(8, 120, qk) * 0.8 + flat * smoothstep(5, 0, wdist[m]) * smoothstep(6, 1.5, z - (hBlur[m] - 3)) * 0.5;
    wet = sat(wet * smoothstep(0.25, 0.6, p) + (z < 2.2 ? 0.5 * flat : 0));
    mWet[m] = Math.round(255 * wet);
    // forest canopy cover: moisture, temperature (treeline), slope, with patchiness
    const treeline = 1930 + 90 * noise2(xk / 3, yk / 3, seed + 70);
    const pe = p * (1 + 0.5 * smoothstep(14, 0, wdist[m])) + 0.25 * smoothstep(10, 150, qk) + 0.12 * fbm(xk / 2.4, yk / 2.4, 3, seed + 71);
    let F = smoothstep(0.42, 0.95, pe) * (1 - smoothstep(treeline - 260, treeline, z)) * (1 - smoothstep(0.85, 1.2, sl));
    F *= 0.75 + 0.25 * smoothstep(-0.25, 0.15, fbm(xk / 0.9, yk / 0.9, 3, seed + 72));   // glades and meadows
    F *= 1 - 0.85 * smoothstep(0.75, 1, wet);                                           // open marsh
    if (z < 3) F *= smoothstep(1.0, 3, z);
    mForest[m] = Math.round(255 * sat(F));
    // ancient "dark" forest: very wet, mild, sheltered ground
    const D = smoothstep(1.0, 1.45, pe) * smoothstep(1000, 550, z) * smoothstep(0.7, 0.35, sl) * smoothstep(0.5, 0.8, F);
    mDark[m] = Math.round(255 * sat(D));
    // sand: beaches, and dune fields on dry, flat, low-lying plateau ground
    let sand = smoothstep(2.6, 0.8, z) * smoothstep(0.08, 0.03, sl);
    if (p < 0.34 && mRock[m] !== ROCK.ALLUVIUM && mMesa[m] > 140) sand = Math.max(sand, smoothstep(0.34, 0.26, p) * smoothstep(0.05, 0.02, sl) * smoothstep(-0.1, 0.2, fbm(xk / 4.5, yk / 4.5, 2, seed + 73)) * smoothstep(40, 8, qk));
    sand = Math.max(sand, sat(mErg[m] * 1.4) * smoothstep(0.45, 0.15, sl));
    mSand[m] = Math.round(255 * sat(sand));
  }

  // ---- I. export (client convention: x east, z south; row 0 = north) --------------------------
  const out = path.join(ROOT, 'data'); fs.mkdirSync(out, { recursive: true });
  const flip = (src, R, Ctor) => { const o = new Ctor(R * R); for (let j = 0; j < R; j++) for (let i = 0; i < R; i++) o[(R - 1 - j) * R + i] = src[j * R + i]; return o; };
  const hq = new Uint16Array(n);
  for (let c = 0; c < n; c++) hq[c] = Math.max(0, Math.min(65535, Math.round((h[c] + H_OFFSET) / H_SCALE)));
  fs.writeFileSync(path.join(out, 'height.bin'), gz(encodeU16(flip(hq, N, Uint16Array), N)));
  // still-water level raster (decimetres; -32768 = none => sea level applies), dilated one cell
  const LN = Math.min(2048, N), lst = N / LN, lvl = new Int16Array(LN * LN).fill(-32768);
  for (let j = 0; j < LN; j++) for (let i = 0; i < LN; i++) {
    let id = 0;
    for (let b = -1; b <= lst && !id; b++) for (let a = -1; a <= lst && !id; a++) {
      const x = i * lst + a, y = j * lst + b; if (x < 0 || y < 0 || x >= N || y >= N) continue;
      id = lakeId[y * N + x];
    }
    if (id) lvl[j * LN + i] = Math.round(lakes[id - 1].level * 10);
  }
  fs.writeFileSync(path.join(out, 'lakes.bin'), gz(flip(lvl, LN, Int16Array)));
  const maps = new Uint8Array(mn * 11);
  [mRock, mStratB, mPrec, mForest, mDark, mWet, mSand, mAO, mMesa, mFlow, mIce].forEach((a, k) => maps.set(flip(a, M, Uint8Array), k * mn));
  fs.writeFileSync(path.join(out, 'maps.bin'), gz(maps));
  // rivers
  const S = cfg.sizeM;
  const rv = new Float32Array(npts * 5), offsArr = new Uint32Array(segs.length + 1);
  let o = 0;
  segs.forEach((pts, si) => { offsArr[si] = o; for (const p of pts) { rv.set([p.x, S - p.y, p.z, p.w, p.d], o * 5); o++; } });
  offsArr[segs.length] = o;
  const rbuf = Buffer.concat([Buffer.from(new Uint32Array([segs.length, npts]).buffer), Buffer.from(offsArr.buffer), Buffer.from(rv.buffer)]);
  fs.writeFileSync(path.join(out, 'rivers.bin'), zlib.gzipSync(rbuf, { level: 7 }));
  // river coverage mask for distant shading
  const RN = Math.min(2048, N), rdx = S / RN, rmask = new Uint8Array(RN * RN);
  for (const pts of segs) for (const p of pts) {
    const hw = p.w / 2, r = Math.ceil((hw + rdx) / rdx), ci = Math.floor(p.x / rdx), cj = Math.floor((S - p.y) / rdx);
    for (let b = -r; b <= r; b++) for (let a = -r; a <= r; a++) {
      const x = ci + a, y = cj + b; if (x < 0 || y < 0 || x >= RN || y >= RN) continue;
      const d = Math.hypot((x + 0.5) * rdx - p.x, (y + 0.5) * rdx - (S - p.y));
      const cov = Math.round(255 * sat((hw - d) / rdx + 0.5) * Math.min(1, p.w / rdx + 0.25));
      if (cov > rmask[y * RN + x]) rmask[y * RN + x] = cov;
    }
  }
  fs.writeFileSync(path.join(out, 'rivermask.bin'), gz(rmask));

  // landmarks (client coordinates)
  const peak = (x0, x1, y0, y1, pred) => {
    let best = -1, bz = -1e9;
    for (let j = Math.floor(y0 / 50 * N); j < Math.min(N, y1 / 50 * N); j++) for (let i = Math.floor(x0 / 50 * N); i < Math.min(N, x1 / 50 * N); i++) {
      const c = j * N + i; if (h[c] > bz && (!pred || pred(c))) { bz = h[c]; best = c; }
    }
    const [x, y] = cellXY(best); return { x, z: S - y, h: bz };
  };
  let mouth = { q: 0 };
  for (const pts of segs) { const l = pts[pts.length - 1]; if (l.water && l.z === 0 && l.q > mouth.q) mouth = l; }
  const lm = (name, p, note) => ({ name, x: Math.round(p.x), z: Math.round(p.z), h: Math.round(p.h ?? 0), note });
  const km = (x, y) => ({ x: x * 1000, z: S - y * 1000 });
  const landmarks = [
    lm('Mount Leviathan', peak(30, 39, 4, 40, (c) => g.rock[c] === ROCK.GRANITE), 'highest summit of the Spine, the granite core of the alpine chain'),
    lm('Ashfall Peak', peak(VOLCANO.x - 1.5, VOLCANO.x + 1.5, VOLCANO.y - 1.5, VOLCANO.y + 1.5), 'stratovolcano on the western shoulder of the Spine'),
    lm('The Erg', km(46.4, 15.2), 'dune sea on the plateau interior'),
    lm('The Crown', peak(33, 49, 38, 49.5), 'the great ice massif of the north-east, the roof of the world'),
    lm('Great River delta', { x: mouth.x, z: S - mouth.y }, 'mouth of the Great River at the head of the Sound'),
    lm('The Gorge', km(GORGE[2][0], GORGE[2][1]), 'antecedent water gap through the Spine: the low-level route east'),
    lm('The Tor', peak(19.4, 21.4, 12.6, 14.6), 'granite monadnock above the Central Valley'),
    lm('Central Valley', km(20, 22), 'prairie and parkland lowland'),
    lm('Coast Range', peak(6, 13, 4, 30), 'rain-forested fold belt'),
    lm('The Sound', km(14.5, 38.8), 'glacially scoured marine inlet'),
    lm('Northern Highlands', peak(8, 30, 42, 50), 'fjord-cut schist uplands'),
    lm('High Desert canyonlands', km(45, 27), 'layered plateau cut by the upper Great River'),
    lm('Badlands', km(45.3, 8.6), 'soft shale basin'),
    ...lakes.slice(0, 5).map((l, k) => lm(k === 0 ? 'Longwater (largest lake)' : `Lake ${k + 1}`, { x: l.x, z: S - l.y, h: l.level }, `${l.areaKm2.toFixed(1)} km2, up to ${l.maxDepth.toFixed(0)} m deep`)),
  ];
  let landCells = 0, hmax = 0; for (let c = 0; c < n; c++) { if (!sea[c]) landCells++; if (h[c] > hmax) hmax = h[c]; }
  const meta = {
    name: 'The Leviathan', version: 1, seed, sizeM: S, heightRes: N, mapRes: M, lakeRes: LN, riverMaskRes: RN,
    hOffset: H_OFFSET, hScale: H_SCALE, seaLevel: 0, maxElevation: Math.round(hmax),
    landKm2: Math.round(landCells * dx * dx / 1e6), riverKm: Math.round(totalLen / 1000),
    mapChannels: ['rock', 'strat', 'precip', 'forest', 'dark', 'wet', 'sand', 'ao', 'mesa', 'flow', 'ice'],
    lakes: lakes.map((l) => ({ level: +l.level.toFixed(2), areaKm2: +l.areaKm2.toFixed(2), x: Math.round(l.x), z: Math.round(S - l.y) })),
    landmarks, config: { K0: cfg.K0, levels: cfg.levels.filter((l) => l[0] <= N), ELA, Q_RIVER },
  };
  fs.writeFileSync(path.join(out, 'world.json'), JSON.stringify(meta, null, 1));

  // previews
  const prev = path.join(ROOT, 'docs'); fs.mkdirSync(prev, { recursive: true });
  const lakeF = new Float32Array(n); for (let c = 0; c < n; c++) lakeF[c] = lakeId[c];
  renderMap(path.join(prev, 'map_relief.png'), h, N, dx, { Q, qThr: Q_RIVER * 2, lake: lakeF });
  const mi = (c) => Math.min(M - 1, Math.floor(((c / N) | 0) / st)) * M + Math.min(M - 1, Math.floor((c % N) / st));
  renderMap(path.join(prev, 'map_ecology.png'), h, N, dx, {
    Q, qThr: Q_RIVER * 6, lake: lakeF,
    color: (c, z) => {
      if (z <= 0 && sea[c]) return [40, 78, 120];
      const m = mi(c), F = mForest[m] / 255, D = mDark[m] / 255, p = mP[m], sn = smoothstep(2350, 2650, z);
      let r = 150 + 60 * sat(1 - p * 1.6), gg = 150 + 10 * sat(p), b = 92;           // grass -> dry steppe
      if (p < 0.4) { const t = smoothstep(0.4, 0.2, p); r += (196 - r) * t; gg += (160 - gg) * t; b += (118 - b) * t; }
      const rk = z > 1950 ? smoothstep(1950, 2200, z) : 0; r += (140 - r) * rk; gg += (138 - gg) * rk; b += (136 - b) * rk;
      r += (58 - r) * F; gg += (98 - gg) * F; b += (52 - b) * F;
      r += (22 - r) * D; gg += (52 - gg) * D; b += (36 - b) * D;
      const sd = mSand[m] / 255; r += (226 - r) * sd; gg += (206 - gg) * sd; b += (150 - b) * sd;
      const w = mWet[m] / 255; r += (92 - r) * w * 0.6; gg += (120 - gg) * w * 0.6; b += (84 - b) * w * 0.6;
      r += (245 - r) * sn; gg += (247 - gg) * sn; b += (250 - b) * sn;
      return [r, gg, b];
    },
  });
  const sizes = fs.readdirSync(out).map((f2) => `${f2} ${(fs.statSync(path.join(out, f2)).size / 1e6).toFixed(2)}MB`).join(', ');
  log('exported:', sizes);
  return meta;
}
