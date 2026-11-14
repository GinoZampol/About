// Landscape evolution core: depression-filling flow routing + implicit stream-power incision
// + critical-slope (talus) limiting + hillslope diffusion. All O(n) or O(n log n) per step.
import { hash2 } from '../shared/noise.mjs';
import { ROCK, ROCK_K, ROCK_TALUS, ROCK_DIFF, rockAt, strengthBand } from '../shared/geology.mjs';

export const DX8 = [1, 1, 0, -1, -1, -1, 0, 1];
export const DY8 = [0, 1, 1, 1, 0, -1, -1, -1];
export const DD8 = [1, Math.SQRT2, 1, Math.SQRT2, 1, Math.SQRT2, 1, Math.SQRT2];

export function makeCtx(N) {
  const n = N * N;
  return {
    N, n,
    f: new Float32Array(n), rank: new Int32Array(n), order: new Int32Array(n), cnt: 0,
    rec: new Int32Array(n), recD: new Float32Array(n), Q: new Float64Array(n),
    closed: new Uint8Array(n), pit: new Int32Array(n), hk: new Float32Array(n + 8), hi: new Int32Array(n + 8),
    tmp: new Float32Array(n),
  };
}

// Priority-flood with epsilon gradient (Barnes et al. 2014). Fills ctx.f with a surface that
// drains everywhere to the sea, and ctx.order/ctx.rank with a valid downstream-first ordering.
export function flood(ctx, h, sea, dx) {
  const { N, n, f, rank, order, closed, pit, hk, hi } = ctx;
  const eps = 1e-4 * dx;
  f.set(h); closed.fill(0);
  let hs = 0, qh = 0, qt = 0, cnt = 0;
  const push = (c, k) => {
    let i = hs++;
    while (i > 0) { const p = (i - 1) >> 1; if (hk[p] <= k) break; hk[i] = hk[p]; hi[i] = hi[p]; i = p; }
    hk[i] = k; hi[i] = c;
  };
  const pop = () => {
    const top = hi[0]; hs--;
    if (hs > 0) {
      const k = hk[hs], c = hi[hs]; let i = 0;
      for (;;) {
        let l = 2 * i + 1; if (l >= hs) break;
        if (l + 1 < hs && hk[l + 1] < hk[l]) l++;
        if (hk[l] >= k) break;
        hk[i] = hk[l]; hi[i] = hi[l]; i = l;
      }
      hk[i] = k; hi[i] = c;
    }
    return top;
  };
  for (let c = 0; c < n; c++) if (sea[c]) closed[c] = 1;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const c = j * N + i; if (!sea[c]) continue;
    let coast = false;
    for (let k = 0; k < 8; k++) {
      const x = i + DX8[k], y = j + DY8[k];
      if (x >= 0 && y >= 0 && x < N && y < N && !sea[y * N + x]) { coast = true; break; }
    }
    if (coast) push(c, 0);
  }
  for (;;) {
    let c;
    if (qh < qt) c = pit[qh++]; else if (hs > 0) c = pop(); else break;
    let cz = 0;
    if (!sea[c]) { rank[c] = cnt; order[cnt++] = c; cz = f[c]; }
    const i = c % N, j = (c / N) | 0;
    for (let k = 0; k < 8; k++) {
      const x = i + DX8[k], y = j + DY8[k];
      if (x < 0 || y < 0 || x >= N || y >= N) continue;
      const nb = y * N + x; if (closed[nb]) continue;
      closed[nb] = 1;
      const e = cz + eps * DD8[k];
      if (f[nb] <= e) { f[nb] = e; pit[qt++] = nb; } else push(nb, f[nb]);
    }
  }
  ctx.cnt = cnt;
  return cnt;
}

// Stochastic D8 on the filled surface with a fixed per-cell random number: breaks the
// 8-direction grid bias of plain D8 while keeping channels stable between iterations.
export function route(ctx, sea, dx, seed, pexp = 1.15) {
  const { N, f, rank, order, rec, recD, cnt } = ctx;
  const w = new Float64Array(8);
  for (let q = 0; q < cnt; q++) {
    const c = order[q], i = c % N, j = (c / N) | 0, fc = f[c], rc = rank[c];
    let tot = 0, seaK = -1, best = -1, bw = 0;
    for (let k = 0; k < 8; k++) {
      w[k] = 0;
      const x = i + DX8[k], y = j + DY8[k];
      if (x < 0 || y < 0 || x >= N || y >= N) continue;
      const nb = y * N + x;
      if (sea[nb]) { if (seaK < 0 || DD8[k] < DD8[seaK]) seaK = k; continue; }
      if (rank[nb] < rc && f[nb] < fc) {
        const s = (fc - f[nb]) / DD8[k];
        const ww = Math.pow(s, pexp);
        w[k] = ww; tot += ww;
        if (ww > bw) { bw = ww; best = k; }
      }
    }
    let k = best;
    if (seaK >= 0) k = seaK;
    else if (tot > 0) {
      let u = hash2(i, j, seed) * tot;
      for (let q2 = 0; q2 < 8; q2++) { if (w[q2] > 0) { u -= w[q2]; if (u <= 0) { k = q2; break; } } }
    }
    rec[c] = (j + DY8[k]) * N + i + DX8[k];
    recD[c] = DD8[k] * dx;
  }
}

// Discharge accumulation. P is relative precipitation; result in m^2 of "effective" drainage area.
export function accumulate(ctx, sea, P, dx) {
  const { Q, order, rec, cnt } = ctx;
  const a = dx * dx;
  for (let q = 0; q < cnt; q++) { const c = order[q]; Q[c] = P ? P[c] * a : a; }
  for (let q = cnt - 1; q >= 0; q--) { const c = order[q], r = rec[c]; if (!sea[r]) Q[r] += Q[c]; }
}

// One landscape-evolution step. g holds per-cell fields: U, rock, kmod, strat.
export function erodeStep(ctx, h, sea, g, P, dx, dt, K0, seed) {
  const { N, n, f, order, rec, recD, Q, cnt, tmp } = ctx;
  flood(ctx, h, sea, dx);
  route(ctx, sea, dx, seed);
  accumulate(ctx, sea, P, dx);
  const { U, rock, kmod, strat, tmod } = g;
  for (let q = 0; q < cnt; q++) {
    const c = order[q], r = rec[c], L = recD[c];
    const hr = sea[r] ? 0 : h[r];
    const rk = rockAt(rock[c], f[c], strat[c]);
    const fct = K0 * ROCK_K[rk] * kmod[c] * Math.sqrt(Q[c]) * dt / L;
    let hn = (f[c] + U[c] * dt + fct * hr) / (1 + fct);
    const lim = hr + ROCK_TALUS[rk] * tmod[c] * strengthBand(rk, f[c], strat[c]) * L;
    if (hn > lim) hn = lim;
    if (hn < hr + 1e-4 * L) hn = hr + 1e-4 * L;
    h[c] = hn;
  }
  // hillslope diffusion (soil creep), weaker on bare hard rock
  tmp.set(h);
  for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) {
    const c = j * N + i; if (sea[c]) continue;
    const a = h[c - 1], b = h[c + 1], d = h[c - N], e = h[c + N];
    if (sea[c - 1] || sea[c + 1] || sea[c - N] || sea[c + N]) continue;
    const rk = rockAt(rock[c], h[c], strat[c]);
    tmp[c] = h[c] + ROCK_DIFF[rk] * ((a + b + d + e) * 0.25 - h[c]);
  }
  h.set(tmp);
}

// Bilinear x2 upsample of a cell-centred float grid.
export function upsample2(src, N) {
  const M = N * 2, out = new Float32Array(M * M);
  for (let j = 0; j < M; j++) {
    const y = (j + 0.5) / 2 - 0.5; let y0 = Math.floor(y); const ty = y - y0;
    let y1 = y0 + 1; if (y0 < 0) y0 = 0; if (y1 > N - 1) y1 = N - 1;
    for (let i = 0; i < M; i++) {
      const x = (i + 0.5) / 2 - 0.5; let x0 = Math.floor(x); const tx = x - x0;
      let x1 = x0 + 1; if (x0 < 0) x0 = 0; if (x1 > N - 1) x1 = N - 1;
      const a = src[y0 * N + x0], b = src[y0 * N + x1], c = src[y1 * N + x0], d = src[y1 * N + x1];
      out[j * M + i] = a + (b - a) * tx + (c - a + (a - b + d - c) * tx) * ty;
    }
  }
  return out;
}

// Resample any grid (float bilinear or uint8 nearest) from R to N.
export function resample(src, R, N, nearest = false) {
  if (R === N) return src;
  const out = new src.constructor(N * N);
  for (let j = 0; j < N; j++) {
    const y = (j + 0.5) * R / N - 0.5; let y0 = Math.floor(y); const ty = y - y0;
    let y1 = y0 + 1; y0 = Math.max(0, Math.min(R - 1, y0)); y1 = Math.max(0, Math.min(R - 1, y1));
    for (let i = 0; i < N; i++) {
      const x = (i + 0.5) * R / N - 0.5; let x0 = Math.floor(x); const tx = x - x0;
      let x1 = x0 + 1; x0 = Math.max(0, Math.min(R - 1, x0)); x1 = Math.max(0, Math.min(R - 1, x1));
      if (nearest) out[j * N + i] = src[(ty < 0.5 ? y0 : y1) * R + (tx < 0.5 ? x0 : x1)];
      else {
        const a = src[y0 * R + x0], b = src[y0 * R + x1], c = src[y1 * R + x0], d = src[y1 * R + x1];
        out[j * N + i] = a + (b - a) * tx + (c - a + (a - b + d - c) * tx) * ty;
      }
    }
  }
  return out;
}

export function boxBlur(src, N, r, out) {
  const tmp = new Float32Array(N * N); out = out || new Float32Array(N * N);
  const inv = 1 / (2 * r + 1);
  for (let j = 0; j < N; j++) {
    let s = 0; const o = j * N;
    for (let i = -r; i <= r; i++) s += src[o + Math.max(0, Math.min(N - 1, i))];
    for (let i = 0; i < N; i++) {
      tmp[o + i] = s * inv;
      s += src[o + Math.min(N - 1, i + r + 1)] - src[o + Math.max(0, i - r)];
    }
  }
  for (let i = 0; i < N; i++) {
    let s = 0;
    for (let j = -r; j <= r; j++) s += tmp[Math.max(0, Math.min(N - 1, j)) * N + i];
    for (let j = 0; j < N; j++) {
      out[j * N + i] = s * inv;
      s += tmp[Math.min(N - 1, j + r + 1) * N + i] - tmp[Math.max(0, j - r) * N + i];
    }
  }
  return out;
}

// Orographic precipitation: moist westerlies marched across the terrain. 1.0 ~ 1000 mm/yr.
export function computePrecip(h, sea, N, dx) {
  const hp = new Float32Array(N * N);
  for (let c = 0; c < N * N; c++) hp[c] = h[c] > 0 ? h[c] : 0;
  const r = Math.max(1, Math.round(1400 / dx));
  const hs = boxBlur(boxBlur(hp, N, r), N, r);
  const P = new Float32Array(N * N);
  const km = dx / 1000;
  for (let j = 0; j < N; j++) {
    let M = 1.0, crest = 0;
    for (let i = 0; i < N; i++) {
      const c = j * N + i;
      const s = (hs[j * N + Math.min(N - 1, i + 1)] - hs[j * N + Math.max(0, i - 1)]) / (2 * dx);
      crest = Math.max(hs[c], crest - 12 * km);
      const Me = Math.min(M, Math.exp(-crest / 1350) * 1.25);
      let p = Me * (0.85 + 9.5 * Math.max(0, s));
      if (s < 0) p *= Math.max(0.35, 1 + 7 * s);
      p *= 1 + 0.00012 * Math.min(hs[c], 1800); // slight increase with altitude
      P[c] = p;
      M -= p * km * 0.030;
      M += (1 - M) * km * (sea[c] ? 0.10 : 0.004);
      if (M < 0.05) M = 0.05;
    }
  }
  return boxBlur(P, N, Math.max(1, Math.round(900 / dx)));
}
