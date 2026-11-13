import { writePNG } from './png.mjs';
// Hillshaded hypsometric map. North is up. opts: {water: Float32 level or null, Q, qThr, biome rgb fn}
const RAMP = [[-300, 20, 44, 84], [-1, 60, 110, 150], [0, 196, 190, 150], [40, 126, 158, 96], [300, 104, 140, 86], [800, 136, 138, 96], [1300, 150, 132, 104], [1900, 142, 132, 126], [2500, 232, 232, 236], [3400, 255, 255, 255]];
function ramp(z) {
  for (let i = 1; i < RAMP.length; i++) if (z < RAMP[i][0]) {
    const a = RAMP[i - 1], b = RAMP[i], t = (z - a[0]) / (b[0] - a[0]);
    return [a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t];
  }
  return [255, 255, 255];
}
export function renderMap(path, h, N, dx, opts = {}) {
  const S = opts.size || Math.min(N, 1024), st = N / S;
  const rgb = new Uint8Array(S * S * 3);
  for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
    const i = Math.min(N - 2, Math.max(1, Math.floor((px + 0.5) * st))), j = Math.min(N - 2, Math.max(1, Math.floor((S - 1 - py + 0.5) * st)));
    const c = j * N + i, z = h[c];
    let col = opts.color ? opts.color(c, z) : ramp(z);
    const gx = (h[c + 1] - h[c - 1]) / (2 * dx), gy = (h[c + N] - h[c - N]) / (2 * dx);
    const il = (-gx * -0.6 + -gy * 0.6 + 0.55) / Math.sqrt(gx * gx + gy * gy + 1);
    let sh = z <= 0 && !opts.color ? 1 : 0.35 + 0.95 * Math.max(0, il);
    let r = col[0] * sh, g = col[1] * sh, b = col[2] * sh;
    if (opts.lake && opts.lake[c] > 0) { r = 50; g = 105; b = 160; }
    if (opts.Q) {
      let q = 0;
      const rr = Math.ceil(st / 2);
      for (let b2 = -rr; b2 <= rr; b2++) for (let a2 = -rr; a2 <= rr; a2++) { const v = opts.Q[c + b2 * N + a2] || 0; if (v > q) q = v; }
      if (q > (opts.qThr || 2e6) && z > 0) { const t = Math.min(1, 0.45 + 0.12 * Math.log10(q / (opts.qThr || 2e6))); r += (40 - r) * t; g += (90 - g) * t; b += (190 - b) * t; }
    }
    const o = (py * S + px) * 3;
    rgb[o] = Math.min(255, r); rgb[o + 1] = Math.min(255, g); rgb[o + 2] = Math.min(255, b);
  }
  writePNG(path, rgb, S, S);
}
