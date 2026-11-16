// Seeded large-scale world ("variant S"). Nothing is placed by hand and there are no per-world options: the
// seed alone decides the world. The large structure follows cause and effect rather than a list of features:
//
//   crust      one smooth field says how much the crust has thickened. Where it is thickest the land stands
//              as a great range with real width and ridge structure; lower values give lesser ranges, then
//              hill country, then plains. The thickest spot in the world sets the scale, so every world has
//              one range that towers over the rest.
//   sea        the land tends lower toward a basin somewhere near the middle; sea is whatever lies below the
//              level that leaves about three tenths of the world under water.
//   climate    the rain comes on one wind. Ground in the lee of high mountains is dry.
//   tableland  the driest lee ground that is not itself mountain is an old sedimentary tableland: layered rock
//              that erosion cuts into canyons and badlands. Its place is a consequence of the range and the wind.
//   islands    one to three stand in the open sea, as far from any shore as the sea allows; one of them is a
//              low limestone plateau that meets the water in cliffs.
//
// Erosion, rivers, rain and vegetation are simulated afterwards on top of this (generate.mjs, finish.mjs).
import { noise2, fbm, ridged, smoothstep, sat, mulberry32 } from '../shared/noise.mjs';
import { ROCK } from '../shared/geology.mjs';

const PLAY = 50, X0 = -3, SIZE = 56, G = 160;             // layout grid covers the generated domain (playable world + hidden margin)
let WIND = 0.5;                                           // same meaning as computePrecip's slope: the wind blows toward +x, rising `WIND` in y
let cache = null;
export function setWind(slope) { if (slope !== WIND) { WIND = slope; cache = null; } }

function warp(L, xk, yk) {
  const s = L.seed;
  return [xk + 4.2 * fbm(xk / 23 + L.o[0], yk / 23, 3, s + 11) + 1.3 * fbm(xk / 7, yk / 7 + L.o[1], 3, s + 12),
          yk + 4.2 * fbm(xk / 23, yk / 23 + L.o[2], 3, s + 13) + 1.3 * fbm(xk / 7 + L.o[3], yk / 7, 3, s + 14)];
}
// crustal thickening before it is scaled to this world; it fades toward the border so the great range is not cut off by it
function crustRaw(L, xk, yk, wx, wy) {
  const edge = Math.min(xk, yk, PLAY - xk, PLAY - yk);
  return fbm(wx / 34 + L.o[4], wy / 34 + L.o[5], 3, L.seed + 21) - 0.28 * smoothstep(10, 0, edge);
}
// relief at a point: g = mountain strength (1 = the great range), hill = hill country, up = gentle uplands
function relief(L, xk, yk) {
  const s = L.seed, [wx, wy] = warp(L, xk, yk);
  const cr = sat((crustRaw(L, xk, yk, wx, wy) - L.i0) / (L.i1 - L.i0));
  const body = smoothstep(0.4, 0.96, cr);                                                  // thick enough to stand as mountains
  const rd = ridged(wx / 19 + L.o[1], wy / 19 + L.o[4], 3, s + 22);                        // the ranges' own grain: crests and the saddles between them
  const g = body * (0.46 + 0.54 * smoothstep(0.2, 0.75, rd)) * (0.92 + 0.16 * noise2(xk / 2.6, yk / 2.6, s + 23));
  const foot = smoothstep(0.1, 0.48, cr) * (1 - body);                                     // foothills around every range
  const lone = smoothstep(0.22, 0.5, fbm(wx / 12 + L.o[2], wy / 12, 3, s + 25)) * (1 - smoothstep(0.1, 0.4, cr));   // hill country of its own, out on the plains
  const hill = Math.min(1, foot * (0.5 + 0.5 * ridged(wx / 8, wy / 8, 2, s + 24)) + 0.8 * lone * (0.55 + 0.45 * ridged(wx / 6.5, wy / 6.5, 2, s + 26)));
  const up = smoothstep(0.12, 0.24, fbm(xk / 12, yk / 12 + L.o[3], 3, s + 71) + 0.06 * fbm(xk / 2.2, yk / 2.2, 3, s + 72));
  return { wx, wy, cr, g, hill, up };
}
// elevation tendency: sea is where this lies below L.T
function tendency(L, xk, yk, f) {
  const s = L.seed, rr = Math.hypot(f.wx - L.basin[0], f.wy - L.basin[1]);
  return 0.75 * (smoothstep(2, 23, rr) - 0.5) + 0.7 * fbm(f.wx / 16, f.wy / 16, 4, s + 61) + 0.22 * fbm(xk / 5.5, yk / 5.5, 3, s + 62)
    + 0.1 * fbm(xk / 1.7, yk / 1.7, 3, s + 63) + 1.5 * f.g + 0.5 * f.hill + 0.15 * f.up;
}
const gridAt = (i) => X0 + (i + 0.5) / G * SIZE;
function sample(grid, xk, yk) {
  const fx = Math.min(G - 1.001, Math.max(0, (xk - X0) / SIZE * G - 0.5)), fy = Math.min(G - 1.001, Math.max(0, (yk - X0) / SIZE * G - 0.5));
  const i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j, c = j * G + i;
  return (grid[c] * (1 - u) + grid[c + 1] * u) * (1 - v) + (grid[c + G] * (1 - u) + grid[c + G + 1] * u) * v;
}

export function getLayout(seed) {
  if (cache && cache.seed === seed) return cache;
  const r = mulberry32((Math.imul(seed | 0, 2654435761) ^ 0x9e3779b9) >>> 0);
  const L = { seed, o: [r() * 97, r() * 97, r() * 97, r() * 97, r() * 97, r() * 97], basin: [25 + (r() - 0.5) * 12, 25 + (r() - 0.5) * 12], i0: 0, i1: 1, T: 0, islands: [], alpsCentre: [25, 25, 0] };
  const n = G * G, inPlay = (x, y) => x >= 0 && y >= 0 && x <= PLAY && y <= PLAY;

  // 1. scale the crust field to this world: the median is where relief begins, the thickest interior spot is the great range
  const raw = new Float32Array(n);
  let i1 = -1e9;
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
    const x = gridAt(i), y = gridAt(j), [wx, wy] = warp(L, x, y), v = crustRaw(L, x, y, wx, wy); raw[j * G + i] = v;
    if (inPlay(x, y) && v > i1) i1 = v;
  }
  L.i0 = Float32Array.from(raw).sort()[Math.floor(n * 0.5)]; L.i1 = Math.max(i1, L.i0 + 0.05);

  // 2. relief and elevation tendency on the grid; 3. the sea level
  const gG = new Float32Array(n), hG = new Float32Array(n), E = new Float32Array(n), playE = [];
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
    const x = gridAt(i), y = gridAt(j), f = relief(L, x, y), c = j * G + i;
    gG[c] = f.g; hG[c] = f.hill; E[c] = tendency(L, x, y, f); if (inPlay(x, y)) playE.push(E[c]);
  }
  const seaShare = 0.27 + r() * 0.06;
  L.T = Float32Array.from(playE).sort()[Math.floor(seaShare * playE.length)];

  // 4. rain shadow: how much mountain stands upwind of each place (nearer and higher counts for more)
  const wl = Math.hypot(1, WIND), wxk = 1 / wl, wyk = WIND / wl, shadow = new Float32Array(n);
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
    const x = gridAt(i), y = gridAt(j); let s = 0;
    for (let t = 1.5; t <= 26; t += 1.5) { const px = x - wxk * t, py = y - wyk * t; if (px < X0 || py < X0 || px > X0 + SIZE || py > X0 + SIZE) break; s = Math.max(s, sample(gG, px, py) * Math.exp(-t / 28)); }
    shadow[j * G + i] = s;
  }
  // 5. the tableland: the driest lee ground that is neither sea, shore nor mountain; a set share of the land, wherever that falls
  const blur = (src, rad) => { const tmp = new Float32Array(n), out = new Float32Array(n);
    for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) { let a = 0, k = 0; for (let d = -rad; d <= rad; d++) { const x = i + d; if (x >= 0 && x < G) { a += src[j * G + x]; k++; } } tmp[j * G + i] = a / k; }
    for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) { let a = 0, k = 0; for (let d = -rad; d <= rad; d++) { const y = j + d; if (y >= 0 && y < G) { a += tmp[y * G + i]; k++; } } out[j * G + i] = a / k; }
    return out; };
  const nearMt = blur(gG, Math.round(4.5 / (SIZE / G)));                                    // the tableland lies out in the lee, not on the mountain's own foot
  const score = new Float32Array(n).fill(-9), landScores = [];
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
    const c = j * G + i, x = gridAt(i), y = gridAt(j); if (E[c] < L.T + 0.1) continue;
    score[c] = shadow[c] - 1.5 * gG[c] - 1.6 * nearMt[c] - 0.5 * hG[c] + 0.16 * fbm(x / 15 + L.o[5], y / 15, 2, seed + 31) + 0.2 * sat((E[c] - L.T) / 0.5);
    if (inPlay(x, y)) landScores.push(score[c]);
  }
  // It is one connected country, not scattered patches: it grows outward from the driest lee spot, always taking
  // the next-driest ground it touches, until it covers its share of the land.
  L.table = new Float32Array(n);
  let tx = 0, ty = 0, tn = 0;
  if (landScores.length) {
    let start = -1; for (let c = 0; c < n; c++) if (score[c] > -9 && inPlay(gridAt(c % G), gridAt((c / G) | 0)) && (start < 0 || score[c] > score[start])) start = c;
    const target = Math.round(landScores.length * (0.1 + r() * 0.04)), seen = new Uint8Array(n), hk = [], hv = [];
    const push = (k, v) => { let i = hk.length; hk.push(k); hv.push(v); while (i > 0) { const p = (i - 1) >> 1; if (hk[p] >= hk[i]) break; [hk[p], hk[i]] = [hk[i], hk[p]]; [hv[p], hv[i]] = [hv[i], hv[p]]; i = p; } };
    const pop = () => { const v = hv[0], lk = hk.pop(), lv = hv.pop(); if (hk.length) { hk[0] = lk; hv[0] = lv; let i = 0; for (;;) { let c = 2 * i + 1; if (c >= hk.length) break; if (c + 1 < hk.length && hk[c + 1] > hk[c]) c++; if (hk[c] <= hk[i]) break; [hk[c], hk[i]] = [hk[i], hk[c]]; [hv[c], hv[i]] = [hv[i], hv[c]]; i = c; } } return v; };
    const sx0 = gridAt(start % G), sy0 = gridAt((start / G) | 0), pri = (q) => score[q] - 0.016 * Math.hypot(gridAt(q % G) - sx0, gridAt((q / G) | 0) - sy0);   // and it stays compact
    push(score[start], start); seen[start] = 1;
    for (let got = 0; got < target && hk.length;) {
      const c = pop(), i = c % G, j = (c / G) | 0; L.table[c] = 1; if (inPlay(gridAt(i), gridAt(j))) got++;
      tx += gridAt(i); ty += gridAt(j); tn++;
      for (const q of [c - 1, c + 1, c - G, c + G]) { if (q < 0 || q >= n || seen[q] || score[q] <= -9 || Math.abs((q % G) - i) > 1) continue; seen[q] = 1; push(pri(q), q); }
    }
    for (let pass = 0; pass < 2; pass++) {                                                 // soften the grid edge; the real outline gets its detail in seededDesign
      const t = Float32Array.from(L.table);
      for (let j = 1; j < G - 1; j++) for (let i = 1; i < G - 1; i++) { const c = j * G + i; L.table[c] = (t[c] * 2 + t[c - 1] + t[c + 1] + t[c - G] + t[c + G]) / 6; }
    }
  }
  L.tableC = tn ? [tx / tn, ty / tn] : [25, 25];
  L.shadow = shadow;

  // 6. islands: one to three, each as far from every shore (and from each other) as the sea allows
  const dist = new Float32Array(n).fill(1e9), D = Math.SQRT2;
  for (let c = 0; c < n; c++) if (E[c] >= L.T) dist[c] = 0;
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) { const c = j * G + i; let v = dist[c]; if (i) v = Math.min(v, dist[c - 1] + 1); if (j) { v = Math.min(v, dist[c - G] + 1); if (i) v = Math.min(v, dist[c - G - 1] + D); if (i < G - 1) v = Math.min(v, dist[c - G + 1] + D); } dist[c] = v; }
  for (let j = G - 1; j >= 0; j--) for (let i = G - 1; i >= 0; i--) { const c = j * G + i; let v = dist[c]; if (i < G - 1) v = Math.min(v, dist[c + 1] + 1); if (j < G - 1) { v = Math.min(v, dist[c + G] + 1); if (i < G - 1) v = Math.min(v, dist[c + G + 1] + D); if (i) v = Math.min(v, dist[c + G - 1] + D); } dist[c] = v; }
  const cell = SIZE / G, want = 1 + Math.floor(r() * 3);
  for (let k = 0; k < want; k++) {
    let best = -1, bd = 0;
    for (let c = 0; c < n; c++) {
      const x = gridAt(c % G), y = gridAt((c / G) | 0); if (x < 4 || y < 4 || x > PLAY - 4 || y > PLAY - 4) continue;
      let d = Math.min(dist[c] * cell, Math.min(x, y, PLAY - x, PLAY - y)); for (const q of L.islands) d = Math.min(d, (Math.hypot(q[5] - x, q[6] - y) - q[2]) * 0.8);
      if (d > bd) { bd = d; best = c; }
    }
    if (best < 0 || bd < 3.4) break;                                                       // no open water left: this world has fewer islands
    const x = gridAt(best % G), y = gridAt((best / G) | 0), [wx, wy] = warp(L, x, y);
    L.islands.push([wx, wy, Math.min(bd - 1.9, 1.5 + r() * 1.4), r() * Math.PI, 1.12 + r() * 0.4, x, y]);
  }
  let cx = 0, cy = 0, cn = 0;
  for (let c = 0; c < n; c++) { const x = gridAt(c % G), y = gridAt((c / G) | 0); if (E[c] < L.T && inPlay(x, y)) { cx += x; cy += y; cn++; } }
  L.c = cn ? [cx / cn, cy / cn] : [25, 25];
  return (cache = L);
}

export function seededDesign(xk, yk, seed) {
  const L = getLayout(seed), f = relief(L, xk, yk), { wx, wy, g, hill, up } = f;
  // ---- land / sea, and the islands of the open sea ---------------------------------------------------------
  let e = tendency(L, xk, yk, f), chalk = 0, isle = 0;
  for (let k = 0; k < L.islands.length; k++) {
    const q = L.islands[k], dx = wx - q[0], dy = wy - q[1], ca = Math.cos(q[3]), sa = Math.sin(q[3]);
    const d = Math.hypot((dx * ca + dy * sa) / q[4], (-dx * sa + dy * ca) * q[4]) / (q[2] * (1 + 0.36 * fbm(xk / (q[2] * 1.4) + q[0], yk / (q[2] * 1.4), 3, seed + 93) + 0.1 * noise2(xk / 0.45, yk / 0.45, seed + 94)));
    if (d < 1.2) { e = Math.max(e, L.T + 0.6 * smoothstep(1.15, 0.5, d) - 0.25); isle = Math.max(isle, smoothstep(1.0, 0.6, d)); if (k === 0) chalk = smoothstep(0.98, 0.8, d); }
  }
  const land = (e - L.T) * 13;
  // ---- the tableland ----------------------------------------------------------------------------------------
  const plateau = smoothstep(0.4, 0.6, sample(L.table, xk, yk) + 0.13 * fbm(xk / 3.2, yk / 3.2, 3, seed + 65)) * smoothstep(0.4, 2.2, land) * (1 - smoothstep(0.1, 0.4, g));
  const dT = Math.hypot(xk - L.tableC[0], yk - L.tableC[1]);

  // ---- uplift (mm/yr) ---------------------------------------------------------------------------------------
  let U = 0.006 * up + 0.012 + 0.034 * smoothstep(0.1, 0.65, fbm(xk / 7.5, yk / 7.5, 3, seed + 31)) * (1 - plateau);
  U += 2.5 * g + 0.27 * hill * (1 - plateau) + 0.05 * plateau + 0.05 * isle * (1 - chalk);
  U += 0.012 * (0.5 + 0.5 * noise2(xk / 1.1, yk / 1.1, seed + 35)) * (1 - plateau);
  U += 0.06 * ridged(xk / 3.2, yk / 3.2, 3, seed + 32) * (0.3 + g + hill) * (1 - plateau);
  U *= 0.12 + 0.88 * smoothstep(0.0, 0.7, land);

  // ---- initial surface (m) ----------------------------------------------------------------------------------
  let h0;
  if (land < 0) h0 = -Math.min(260, 3 + 55 * Math.pow(-land, 1.3));
  else {
    h0 = 6 + 24 * sat(land / 3) + 130 * up * sat(land / 2.5) + 190 * hill + 2600 * g + 12 * fbm(xk / 2, yk / 2, 3, seed + 33);
    h0 += plateau * (760 + 13 * Math.min(26, land) + 9 * dT + 45 * fbm(xk / 5, yk / 5, 3, seed + 34));
    if (chalk > 0) h0 = Math.max(h0, 6 + (92 + 38 * fbm(xk / 1.3, yk / 1.3, 3, seed + 36)) * chalk * smoothstep(0, 0.5, land));
    h0 = Math.max(1.5, h0);
  }

  // ---- rock ---------------------------------------------------------------------------------------------------
  let rock = ROCK.ALLUVIUM;
  const wob = 0.9 * noise2(xk / 2.6, yk / 2.6, seed + 41), belt = fbm(wx / 9, wy / 9, 2, seed + 42);
  if (plateau > 0.5) rock = ROCK.SANDSTONE;
  else if (g > 0.5 + 0.1 * wob) rock = ROCK.GRANITE;
  else if (g > 0.1) rock = ROCK.SCHIST;
  else if (chalk > 0.3) rock = ROCK.LIMESTONE;
  else if (hill > 0.18) rock = belt > 0.12 ? ROCK.LIMESTONE : ROCK.GREYWACKE;
  else if (land > 7 + 2 * wob) rock = belt > 0 ? ROCK.SCHIST : ROCK.GREYWACKE;
  const badl = plateau > 0.5 && fbm(xk / 2.4, yk / 2.4, 3, seed + 46) > 0.2;                // softer shale country inside the tableland
  if (badl) rock = ROCK.SHALE;
  let kmod = 1;
  if (rock === ROCK.GREYWACKE) kmod = 0.8 + 0.6 * sat(0.5 + 0.9 * noise2(xk / 2.3, yk / 2.3, seed + 47));
  if (rock === ROCK.SCHIST) kmod = 0.85 + 0.4 * sat(0.5 + noise2(xk / 1.7, yk / 1.7, seed + 43));
  if (rock === ROCK.LIMESTONE) kmod = 0.9;
  if (rock === ROCK.SANDSTONE) kmod = 0.3;
  if (badl) kmod = 0.7;
  const strat = 6 * dT + 70 * fbm(xk / 8, yk / 8, 2, seed + 44) + 14 * noise2(xk / 1.2, yk / 1.2, seed + 45);
  return { land, U: U * 1e-3, h0, rock, kmod, strat, gG: 0, plateau, erg: 0, shelf: Math.max(plateau, f.up, chalk) };
}
