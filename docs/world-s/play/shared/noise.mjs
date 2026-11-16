// Deterministic noise primitives shared by the generator (Node) and the client (browser + workers).
// Everything here is integer-hash based so results are bit-identical on every machine.

export function hash2(ix, iy, seed) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function hash3(ix, iy, iz, seed) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(iz, 2147483647) ^ Math.imul(seed | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function grad(ix, iy, seed, dx, dy) {
  const a = hash2(ix, iy, seed) * 6.283185307179586;
  return Math.cos(a) * dx + Math.sin(a) * dy;
}

// Gradient noise, range about [-1, 1].
export function noise2(x, y, seed = 0) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  const v = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const a = grad(ix, iy, seed, fx, fy);
  const b = grad(ix + 1, iy, seed, fx - 1, fy);
  const c = grad(ix, iy + 1, seed, fx, fy - 1);
  const d = grad(ix + 1, iy + 1, seed, fx - 1, fy - 1);
  return (a + (b - a) * u + (c - a + (a - b + d - c) * u) * v) * 1.41;
}

export function fbm(x, y, oct, seed = 0, lac = 2.03, gain = 0.5) {
  let s = 0, a = 1, n = 0;
  for (let o = 0; o < oct; o++) {
    s += a * noise2(x, y, seed + o * 131);
    n += a; a *= gain; x *= lac; y *= lac;
  }
  return s / n;
}

// Ridged multifractal, range about [0, 1], sharp crests.
export function ridged(x, y, oct, seed = 0, lac = 2.03, gain = 0.5) {
  let s = 0, a = 1, n = 0, w = 1;
  for (let o = 0; o < oct; o++) {
    let v = 1 - Math.abs(noise2(x, y, seed + o * 173));
    v *= v;
    s += a * v * w;
    n += a; w = Math.min(1, v * 1.6); a *= gain; x *= lac; y *= lac;
  }
  return s / n;
}

// Value noise in 3D (used for subsurface ore bodies), range [0, 1].
export function vnoise3(x, y, z, seed = 0) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  let fx = x - ix, fy = y - iy, fz = z - iz;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
  const l = (a, b, t) => a + (b - a) * t;
  const c = (dx, dy, dz) => hash3(ix + dx, iy + dy, iz + dz, seed);
  return l(l(l(c(0, 0, 0), c(1, 0, 0), fx), l(c(0, 1, 0), c(1, 1, 0), fx), fy),
           l(l(c(0, 0, 1), c(1, 0, 1), fx), l(c(0, 1, 1), c(1, 1, 1), fx), fy), fz);
}

export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const sat = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export function smoothstep(a, b, x) {
  const t = sat((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}

// Small deterministic PRNG for sequences.
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
