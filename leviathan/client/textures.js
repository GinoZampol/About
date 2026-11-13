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

export function buildTextures(data, aniso) {
  const meta = data.meta, M = meta.mapRes, mn = M * M, maps = data.maps;
  const A = new Uint8Array(mn * 4), B = new Uint8Array(mn * 4), R = new Uint8Array(mn);
  for (let k = 0; k < mn; k++) {
    A[k * 4] = maps[MAP.PRECIP * mn + k]; A[k * 4 + 1] = maps[MAP.FOREST * mn + k]; A[k * 4 + 2] = maps[MAP.DARK * mn + k]; A[k * 4 + 3] = maps[MAP.WET * mn + k];
    B[k * 4] = maps[MAP.SAND * mn + k]; B[k * 4 + 1] = maps[MAP.AO * mn + k]; B[k * 4 + 2] = maps[MAP.STRAT * mn + k]; B[k * 4 + 3] = 255;
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
    nt[k + 2] = data.rivermask[Math.floor(j * RM / T) * RM + Math.floor(i * RM / T)]; nt[k + 3] = 255;
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
    rock: dataTex(R, M, M, THREE.RedFormat, { nearest: true }), norm: dataTex(nt, T, T, THREE.RGBAFormat, { aniso }),
    noise: dataTex(nz, NS, NS, THREE.RGBAFormat, { repeat: true, aniso }), noiseN: dataTex(nn, NS, NS, THREE.RGBAFormat, { repeat: true, aniso }),
    hgrid: hg, hgridRes: T,
  };
}
