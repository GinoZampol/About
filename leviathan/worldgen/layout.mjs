// Seeded large-scale world ("variant S"). The seed alone decides the world; nothing is placed by coordinates.
//
// The world is a continental margin, and it has a direction. An ocean lies along one side (the seed chooses which)
// and the rain comes in off it. Going inland the land climbs on average: coastal hill country, a broad lowland, the
// foothills, then the main range, and behind it, in its rain shadow, one continuous high and dry tableland cut into
// canyons and badlands. That order is what makes it read as a real place.
//
// It is kept from turning into parallel stripes by letting every line wander: the whole frame is warped, tilted and
// bowed, an arm of the ocean runs inland to a basin near the middle of the world, the hill country comes in patches,
// and the range rises to one great massif, sinks to a pass where the tableland's river breaks through, and varies
// in height everywhere between.
//
// Erosion, rivers, rain and vegetation are simulated afterwards on top of this (generate.mjs, finish.mjs).
import { noise2, fbm, ridged, smoothstep, sat, mulberry32 } from '../shared/noise.mjs';
import { ROCK } from '../shared/geology.mjs';

const PLAY = 50, X0 = -3, SIZE = 56, G = 160;             // layout grid covers the generated domain (playable world + hidden margin)
const gauss = (d, s) => Math.exp(-(d * d) / (2 * s * s));
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay; let t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy + 1e-9); t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(ax + dx * t - px, ay + dy * t - py);
}
const gridAt = (i) => X0 + (i + 0.5) / G * SIZE;
let cache = null;

// Position in the margin's own frame: s = km inland from the ocean side, v = km along the coast. Both wander.
function frame(L, xk, yk) {
  const seed = L.seed, s0 = L.dir === 0 ? xk : L.dir === 1 ? PLAY - xk : L.dir === 2 ? yk : PLAY - yk, v0 = L.dir < 2 ? yk : xk, q = (v0 - 25) / 25;
  const s = s0 + 10.5 * fbm(xk / 24 + L.o[0], yk / 24, 3, seed + 11) + 2.4 * fbm(xk / 8, yk / 8 + L.o[1], 3, seed + 12) + L.tilt * (v0 - 25) + L.bow * (q * q - 0.33);
  const v = v0 + 3.6 * fbm(xk / 17, yk / 17 + L.o[2], 3, seed + 13) + 1.0 * fbm(xk / 5.5 + L.o[3], yk / 5.5, 2, seed + 14);
  return [s, v];
}
function fields(L, xk, yk) {
  const seed = L.seed, [s, v] = frame(L, xk, yk);
  // ---- the sea: the ocean, the arm that runs inland from it, and the basin at the arm's head -----------------
  let land = s - L.coast - 3.4 * fbm(v / 11 + L.o[4], s / 14, 3, seed + 61);
  const dv = v - L.gulfV - 2.2 * noise2(s / 7.5, L.o[5], seed + 62), run = sat((L.gulfS - s) / (L.gulfS - L.coast));
  land = Math.min(land, Math.max(Math.abs(dv) - L.gulfW * (0.5 + 0.5 * run), s - L.gulfS));
  { const a = (v - L.basin[1]) / L.basin[2], b = (s - L.basin[0]) / L.basin[3];
    land = Math.min(land, (Math.hypot(a, b) - 1) * L.basin[3] * (1 + 0.22 * fbm(xk / 6, yk / 6, 3, seed + 63))); }
  land += 0.5 * fbm(xk / 2.6, yk / 2.6, 3, seed + 64) + 0.14 * fbm(xk / 0.6, yk / 0.6, 3, seed + 18);
  // ---- the main range: its crest wanders, one stretch is the great massif, one is a pass ---------------------
  const dR = s - L.rangeS, along = 0.3 + 0.85 * sat(0.5 + 1.25 * noise2(v / 11.5 + L.o[1], 1.7, seed + 21));
  const gR = 0.5 * gauss(dR, 3.3) * along * (1 - 0.85 * gauss(v - L.passV, 3.4)) * (0.9 + 0.22 * noise2(xk / 2.3, yk / 2.3, seed + 22));
  const dM = Math.hypot(dR - 0.8, (v - L.massifV) * 0.86);
  const gC = gauss(dM, 5.2) * (0.88 + 0.22 * noise2(xk / 3.1, yk / 3.1, seed + 28) + 0.1 * noise2(xk / 1.6, yk / 1.6, seed + 29));
  const g = Math.max(gR, gC);
  // ---- hill country: the coast hills, the foothills in front of the range, lone hills out on the lowland ------
  const patch = (k, w) => smoothstep(-0.12, 0.2, fbm(xk / w + L.o[k], yk / w, 3, seed + 23 + k));
  const coastH = gauss(s - (L.coast + 5.6), 2.5) * patch(2, 8);
  const footH = gauss(dR + 6.2, 2.7) * (0.45 + 0.55 * patch(3, 7)) * (1 - gauss(dM, 6.5));
  const lone = smoothstep(0.24, 0.5, fbm(xk / 9 + L.o[4], yk / 9, 3, seed + 25)) * smoothstep(L.coast + 6, L.coast + 10, s) * smoothstep(L.rangeS - 6, L.rangeS - 10, s);
  const hill = Math.min(1, coastH + 0.8 * footH + 0.6 * lone);
  // ---- the tableland: everything behind the range, one country ------------------------------------------------
  // (it lies behind the high part of the range, where the rain shadow is deepest; behind the low stretches the country is ordinary upland)
  const table = smoothstep(L.rangeS + 3.6, L.rangeS + 6.6, s + 1.1 * fbm(xk / 4.5, yk / 4.5, 3, seed + 65)) * smoothstep(L.tableW, L.tableW - 5, Math.abs(v - L.tableV) + 4.5 * fbm(xk / 11 + L.o[2], yk / 11, 3, seed + 67) + 1.6 * fbm(xk / 5, yk / 5, 3, seed + 66)) * (1 - smoothstep(0.08, 0.4, gC));
  // its river: from the far interior, across the tableland in a canyon, out through the pass to the lowland
  let dG = 1e9; for (let k = 0; k < L.gorge.length - 1; k++) dG = Math.min(dG, segDist(s + 0.4 * noise2(xk / 3, yk / 3, seed + 23), v + 0.5 * noise2(xk / 3.5, yk / 3.5, seed + 24), L.gorge[k][0], L.gorge[k][1], L.gorge[k + 1][0], L.gorge[k + 1][1]));
  const gG = gauss(dG, 1.05), dGM = Math.hypot(s - L.mouth[0], v - L.mouth[1]);
  const up = smoothstep(0.12, 0.24, fbm(xk / 12, yk / 12 + L.o[3], 3, seed + 71) + 0.06 * fbm(xk / 2.2, yk / 2.2, 3, seed + 72)) * (1 - table);
  return { s, v, land, g, gC, hill, table, gG, dGM, up };
}

export function getLayout(seed) {
  if (cache && cache.seed === seed) return cache;
  const r = mulberry32((Math.imul(seed | 0, 2654435761) ^ 0x9e3779b9) >>> 0);
  const L = { seed, o: [r() * 97, r() * 97, r() * 97, r() * 97, r() * 97, r() * 97], islands: [], alpsCentre: [25, 25, 0] };
  L.dir = Math.floor(r() * 4);                           // which side the ocean is on: 0 west, 1 east, 2 south, 3 north
  L.windSlope = (r() - 0.5) * 0.7;                       // the rain wind blows inland, a little across
  L.tilt = (r() - 0.5) * 0.36; L.bow = (r() - 0.5) * 9;
  L.coast = 7 + r() * 2.5; L.rangeS = 34 + r() * 3;
  L.gulfV = 13 + r() * 24; L.gulfW = 3.8 + r() * 2; L.gulfS = 19.5 + r() * 4.5;
  L.basin = [L.gulfS - 1.5 + r() * 2, L.gulfV + (r() - 0.5) * 9, 7.6 + r() * 2.8, 5.4 + r() * 2];     // s, v, half-length along the coast, half-width inland
  L.massifV = 9 + r() * 32;
  { const side = L.massifV > 25 ? -1 : 1, d = 9.5 + r() * 3.5; L.passV = L.massifV + side * d; L.tableV = L.massifV + side * (3.5 + r() * 3); L.tableW = 14.5 + r() * 3.5; }
  const pv = L.passV;
  L.gorge = [[53, pv + (r() - 0.5) * 9], [L.rangeS + 7.5, pv + (r() - 0.5) * 4], [L.rangeS, pv], [L.rangeS - 5.5, pv + (r() - 0.5) * 3]];
  L.mouth = L.gorge[3];

  // islands: one to three in open water, each as far from every shore (and from each other) as the sea allows
  const n = G * G, land = new Float32Array(n), dist = new Float32Array(n).fill(1e9), D = Math.SQRT2;
  let cx = 0, cy = 0, cn = 0, tx = 0, ty = 0, tn = 0;
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
    const x = gridAt(i), y = gridAt(j), f = fields(L, x, y), c = j * G + i; land[c] = f.land; if (f.land >= 0) dist[c] = 0;
    if (x >= 0 && y >= 0 && x <= PLAY && y <= PLAY) { if (f.table > 0.5) { tx += x; ty += y; tn++; } const b = Math.hypot((f.v - L.basin[1]) / L.basin[2], (f.s - L.basin[0]) / L.basin[3]); if (b < 0.6) { cx += x; cy += y; cn++; } }
  }
  L.tableC = tn ? [tx / tn, ty / tn] : [25, 25]; L.c = cn ? [cx / cn, cy / cn] : [25, 25];
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) { const c = j * G + i; let v = dist[c]; if (i) v = Math.min(v, dist[c - 1] + 1); if (j) { v = Math.min(v, dist[c - G] + 1); if (i) v = Math.min(v, dist[c - G - 1] + D); if (i < G - 1) v = Math.min(v, dist[c - G + 1] + D); } dist[c] = v; }
  for (let j = G - 1; j >= 0; j--) for (let i = G - 1; i >= 0; i--) { const c = j * G + i; let v = dist[c]; if (i < G - 1) v = Math.min(v, dist[c + 1] + 1); if (j < G - 1) { v = Math.min(v, dist[c + G] + 1); if (i < G - 1) v = Math.min(v, dist[c + G + 1] + D); if (i) v = Math.min(v, dist[c + G - 1] + D); } dist[c] = v; }
  const cell = SIZE / G, want = 1 + Math.floor(r() * 3);
  for (let k = 0; k < want; k++) {
    let best = -1, bd = 0;
    for (let c = 0; c < n; c++) {
      const x = gridAt(c % G), y = gridAt((c / G) | 0); if (x < 3.5 || y < 3.5 || x > PLAY - 3.5 || y > PLAY - 3.5) continue;
      let d = Math.min(dist[c] * cell, Math.min(x, y, PLAY - x, PLAY - y) + 1.5); for (const q of L.islands) d = Math.min(d, (Math.hypot(q[0] - x, q[1] - y) - q[2]) * 0.8);
      if (d > bd) { bd = d; best = c; }
    }
    if (best < 0 || bd < 2.9) break;                                                       // no open water left: this world has fewer islands
    L.islands.push([gridAt(best % G), gridAt((best / G) | 0), Math.min(bd - 1.6, 1.3 + r() * 1.3), r() * Math.PI, 1.12 + r() * 0.4]);
  }
  return (cache = L);
}

export function seededDesign(xk, yk, seed) {
  const L = getLayout(seed), f = fields(L, xk, yk), { g, gC, hill, gG, dGM, up } = f;
  // ---- land / sea, and the islands of the open sea ---------------------------------------------------------
  let land = f.land, chalk = 0, isle = 0;
  for (let k = 0; k < L.islands.length; k++) {
    const q = L.islands[k], dx = xk - q[0], dy = yk - q[1], ca = Math.cos(q[3]), sa = Math.sin(q[3]);
    const d = Math.hypot((dx * ca + dy * sa) / q[4], (-dx * sa + dy * ca) * q[4]) / (q[2] * (1 + 0.36 * fbm(xk / (q[2] * 1.4) + q[0], yk / (q[2] * 1.4), 3, seed + 93) + 0.1 * noise2(xk / 0.45, yk / 0.45, seed + 94)));
    if (d < 1.2) { land = Math.max(land, 7.8 * smoothstep(1.15, 0.5, d) - 3.2); isle = Math.max(isle, smoothstep(1.0, 0.55, d)); if (k === 0) chalk = smoothstep(0.98, 0.8, d); }
  }
  const plateau = f.table * smoothstep(0.4, 2.2, land);

  // ---- uplift (mm/yr) ---------------------------------------------------------------------------------------
  let U = 0.006 * up + 0.012 + 0.034 * smoothstep(0.1, 0.65, fbm(xk / 7.5, yk / 7.5, 3, seed + 31)) * (1 - plateau);
  U += 2.5 * g * (1 - 0.7 * plateau * (1 - sat(gC * 2))) + 0.27 * hill * (1 - plateau) + 0.05 * plateau + 0.22 * isle * (1 - chalk);
  U += 0.012 * (0.5 + 0.5 * noise2(xk / 1.1, yk / 1.1, seed + 35)) * (1 - plateau);
  U += 0.06 * ridged(xk / 3.2, yk / 3.2, 3, seed + 32) * (0.3 + g + hill) * (1 - plateau);
  U *= 1 - 0.86 * gG;
  U *= 0.12 + 0.88 * smoothstep(0.0, 0.7, land);

  // ---- initial surface (m): the land climbs inland on average ----------------------------------------------
  let h0;
  if (land < 0) h0 = -Math.min(260, 3 + 55 * Math.pow(-land, 1.3));
  else {
    h0 = 6 + 24 * sat(land / 3) + 5 * Math.max(0, Math.min(f.s, L.rangeS) - L.coast) + 130 * up * sat(land / 2.5) + 190 * hill + 2600 * g + 70 * isle + 12 * fbm(xk / 2, yk / 2, 3, seed + 33);
    h0 += plateau * (1050 + 10 * dGM + 45 * fbm(xk / 5, yk / 5, 3, seed + 34));
    const notch = 105 + 40 * Math.max(0, f.s - L.mouth[0]);                                // the canyon floor climbs gently inland
    h0 = h0 + (Math.min(h0, notch) - h0) * Math.sqrt(gG);
    if (chalk > 0) h0 = Math.max(h0, 6 + (92 + 38 * fbm(xk / 1.3, yk / 1.3, 3, seed + 36)) * chalk * smoothstep(0, 0.5, land));
    h0 = Math.max(1.5, h0);
  }

  // ---- rock ---------------------------------------------------------------------------------------------------
  let rock = ROCK.ALLUVIUM;
  const wob = 0.9 * noise2(xk / 2.6, yk / 2.6, seed + 41), belt = fbm(f.v / 9, f.s / 9, 2, seed + 42);
  if (plateau > 0.5) rock = ROCK.SANDSTONE;
  else if (g > 0.5 + 0.1 * wob) rock = ROCK.GRANITE;
  else if (g > 0.1) rock = g > 0.3 && belt > 0.1 ? ROCK.GRANITE : ROCK.SCHIST;
  else if (chalk > 0.3) rock = ROCK.LIMESTONE;
  else if (hill > 0.18) rock = belt > 0.14 ? ROCK.LIMESTONE : ROCK.GREYWACKE;
  else if (f.s > L.rangeS - 9 + 2 * wob) rock = belt > 0 ? ROCK.SCHIST : ROCK.GREYWACKE;
  const badl = plateau > 0.5 && fbm(xk / 2.4 + L.o[5], yk / 2.4, 3, seed + 46) > 0.22;      // softer shale country inside the tableland
  if (badl) rock = ROCK.SHALE;
  let kmod = 1;
  if (rock === ROCK.GREYWACKE) kmod = 0.8 + 0.6 * sat(0.5 + 0.9 * noise2(xk / 2.3, yk / 2.3, seed + 47));
  if (rock === ROCK.SCHIST) kmod = 0.85 + 0.4 * sat(0.5 + noise2(xk / 1.7, yk / 1.7, seed + 43));
  if (rock === ROCK.LIMESTONE) kmod = 0.9;
  if (rock === ROCK.SANDSTONE) kmod = 0.3;
  if (badl) kmod = 0.7;
  const strat = 6 * dGM + 70 * fbm(xk / 8, yk / 8, 2, seed + 44) + 14 * noise2(xk / 1.2, yk / 1.2, seed + 45);
  return { land, U: U * 1e-3, h0, rock, kmod, strat, gG, plateau, erg: 0, shelf: Math.max(plateau, up, chalk, 0.75 * isle) };
}
