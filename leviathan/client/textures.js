// Runtime textures: environmental maps from the data set, a global normal map, and tileable noise.
import * as THREE from 'three';
import { hash2 } from '../shared/noise.mjs';
import { MAP } from '../shared/world.mjs';

function pnoise(x, y, P, seed) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10), v = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const g = (i, j, dx, dy) => { const a = hash2(((i % P) + P) % P, ((j % P) + P) % P, seed) * 6.2831853; return Math.cos(a) * dx + Math.sin(a) * dy; };
  const a = g(ix, iy, fx, fy), b = g(ix + 1, iy, fx - 1, fy), c = g(ix, iy + 1, fx, fy - 1), d = g(ix + 1, iy + 1, fx - 1, fy - 1);
  return a + (b - a) * u + (c - a + (a - b + d - c) * u) * v;
}
function tileFbm(size, period, oct, seed, gain = 0.55) {
  const out = new Float32Array(size * size);
  let amp = 1, P = period;
  for (let o = 0; o < oct; o++) {
    for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) out[j * size + i] += amp * pnoise(i / size * P, j / size * P, P, seed + o * 17);
    amp *= gain; P *= 2;
  }
  let mn = 1e9, mx = -1e9; for (const v of out) { if (v < mn) mn = v; if (v > mx) mx = v; }
  for (let k = 0; k < out.length; k++) out[k] = (out[k] - mn) / (mx - mn);
  return out;
}
function dataTex(arr, w, h, fmt, opts = {}) {
  const t = new THREE.DataTexture(arr, w, h, fmt, THREE.UnsignedByteType);
  t.wrapS = t.wrapT = opts.repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.magFilter = opts.nearest ? THREE.NearestFilter : THREE.LinearFilter;
  t.minFilter = opts.nearest ? THREE.NearestFilter : THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = !opts.nearest; t.anisotropy = opts.aniso || 1; t.needsUpdate = true;
  return t;
}

function blurBox(src, N, r) {
  const tmp = new Float32Array(N * N), out = new Float32Array(N * N), inv = 1 / (2 * r + 1), cl = (v) => (v < 0 ? 0 : v > N - 1 ? N - 1 : v);
  for (let j = 0; j < N; j++) { let s = 0; for (let i = -r; i <= r; i++) s += src[j * N + cl(i)]; for (let i = 0; i < N; i++) { tmp[j * N + i] = s * inv; s += src[j * N + cl(i + r + 1)] - src[j * N + cl(i - r)]; } }
  for (let i = 0; i < N; i++) { let s = 0; for (let j = -r; j <= r; j++) s += tmp[cl(j) * N + i]; for (let j = 0; j < N; j++) { out[j * N + i] = s * inv; s += tmp[cl(j + r + 1) * N + i] - tmp[cl(j - r) * N + i]; } }
  return out;
}

// World-scale terrain shadows: one linear sweep across the height grid away from the sun, carrying
// the shadow ceiling along each sun ray. Recomputed when the sun moves (a few tens of ms).
export function terrainShadow(tex, sunDir, out) {
  const T = tex.hgridRes, hg = tex.hgrid, sea = tex.seaH, cell = tex.cell;
  const hl = Math.hypot(sunDir.x, sunDir.z) || 1e-6, dx = -sunDir.x / hl, dz = -sunDir.z / hl, tanE = Math.max(0.02, sunDir.y / hl);
  const xDom = Math.abs(dx) >= Math.abs(dz), r = xDom ? dz / Math.abs(dx) : dx / Math.abs(dz);
  const fwd = xDom ? dx > 0 : dz > 0, drop = cell * Math.sqrt(1 + r * r) * tanE;
  for (let l0 = -T; l0 < 2 * T; l0++) {
    let s = -1e9;
    for (let k = 0; k < T; k++) {
      const a = fwd ? k : T - 1 - k, b = Math.round(l0 + k * r);
      s -= drop;
      if (b < 0 || b >= T) continue;
      const c = xDom ? b * T + a : a * T + b;
      let h = hg[c]; if (h < sea) h = sea;
      if (h >= s - 1.5) { out[c] = 255; if (h > s) s = h; }
      else { const t = (s - h - 1.5) / 14; out[c] = t >= 1 ? 0 : Math.round(255 * (1 - t)); }
    }
  }
  return out;
}

export function buildTextures(data, aniso) {
  const meta = data.meta, M = meta.mapRes, mn = M * M, maps = data.maps;
  const A = new Uint8Array(mn * 4), B = new Uint8Array(mn * 4), R = new Uint8Array(mn);
  const FL = new Uint8Array(mn * 2);
  for (let k = 0; k < mn; k++) { FL[k * 2] = maps[MAP.FLOW * mn + k]; FL[k * 2 + 1] = maps[MAP.ICE * mn + k]; }
  for (let k = 0; k < mn; k++) {
    A[k * 4] = maps[MAP.PRECIP * mn + k]; A[k * 4 + 1] = maps[MAP.FOREST * mn + k]; A[k * 4 + 2] = maps[MAP.DARK * mn + k]; A[k * 4 + 3] = maps[MAP.WET * mn + k];
    B[k * 4] = maps[MAP.SAND * mn + k]; B[k * 4 + 1] = maps[MAP.AO * mn + k]; B[k * 4 + 2] = maps[MAP.STRAT * mn + k]; B[k * 4 + 3] = maps[MAP.MESA * mn + k];
    R[k] = maps[MAP.ROCK * mn + k];
  }
  // global normal map at half height resolution (max 2048), river coverage in B
  const N = meta.heightRes, T = Math.min(2048, N), st = N / T, hg = new Float32Array(T * T), H = data.height;
  for (let j = 0; j < T; j++) for (let i = 0; i < T; i++) {
    let s = 0; for (let b = 0; b < st; b++) for (let a = 0; a < st; a++) s += H[(j * st + b) * N + i * st + a];
    hg[j * T + i] = s / (st * st) * meta.hScale;
  }
  const nt = new Uint8Array(T * T * 4), cell = meta.sizeM / T, RM = meta.riverMaskRes;
  for (let j = 0; j < T; j++) for (let i = 0; i < T; i++) {
    const gx = (hg[j * T + Math.min(T - 1, i + 1)] - hg[j * T + Math.max(0, i - 1)]) / (2 * cell), gz = (hg[Math.min(T - 1, j + 1) * T + i] - hg[Math.max(0, j - 1) * T + i]) / (2 * cell);
    const l = 1 / Math.sqrt(gx * gx + gz * gz + 1), k = (j * T + i) * 4;
    nt[k] = Math.round((-gx * l * 0.5 + 0.5) * 255); nt[k + 1] = Math.round((-gz * l * 0.5 + 0.5) * 255);
    nt[k + 2] = data.rivermask[Math.floor(j * RM / T) * RM + Math.floor(i * RM / T)];
  }
  // landform curvature (concave = hollows and gullies, convex = spurs and crests) at two scales
  {
    const b1 = blurBox(hg, T, 2), b2 = blurBox(hg, T, 9);
    for (let k = 0; k < T * T; k++) nt[k * 4 + 3] = Math.max(0, Math.min(255, Math.round(127.5 + (b1[k] - hg[k]) * 14 + (b2[k] - hg[k]) * 2.2)));
  }
  // noise
  const NS = 512, ch = [tileFbm(NS, 4, 6, 1), tileFbm(NS, 6, 5, 2), tileFbm(NS, 8, 5, 3), tileFbm(NS, 5, 6, 4)];
  const nz = new Uint8Array(NS * NS * 4);
  for (let k = 0; k < NS * NS; k++) for (let c = 0; c < 4; c++) nz[k * 4 + c] = Math.round(255 * Math.min(1, Math.max(0, (ch[c][k] - 0.5) * 1.5 + 0.5)));
  const hN = tileFbm(NS, 6, 6, 9, 0.62), nn = new Uint8Array(NS * NS * 4);
  for (let j = 0; j < NS; j++) for (let i = 0; i < NS; i++) {
    const gx = (hN[j * NS + (i + 1) % NS] - hN[j * NS + (i + NS - 1) % NS]) * 26, gy = (hN[((j + 1) % NS) * NS + i] - hN[((j + NS - 1) % NS) * NS + i]) * 26;
    const l = 1 / Math.sqrt(gx * gx + gy * gy + 1), k = (j * NS + i) * 4;
    nn[k] = Math.round((-gx * l * 0.5 + 0.5) * 255); nn[k + 1] = Math.round((-gy * l * 0.5 + 0.5) * 255); nn[k + 2] = Math.round((l * 0.5 + 0.5) * 255); nn[k + 3] = Math.round(hN[j * NS + i] * 255);
  }
  return {
    mapA: dataTex(A, M, M, THREE.RGBAFormat, { aniso }), mapB: dataTex(B, M, M, THREE.RGBAFormat, { aniso }),
    rock: dataTex(R, M, M, THREE.RedFormat, { nearest: true }), flow: dataTex(FL, M, M, THREE.RGFormat, {}), seaH: meta.hOffset, cell, norm: dataTex(nt, T, T, THREE.RGBAFormat, { aniso }),
    noise: dataTex(nz, NS, NS, THREE.RGBAFormat, { repeat: true, aniso }), noiseN: dataTex(nn, NS, NS, THREE.RGBAFormat, { repeat: true, aniso }),
    hgrid: hg, hgridRes: T,
  };
}
