// Seeded world ("variant S"): physical forcing only. Nothing here draws a coastline, a range or a plateau
// outline. The seed sets the slow tectonic and climatic causes, and the landscape evolution model in
// generate.mjs (uplift + stream-power erosion + talus + soil creep, with rain computed from the evolving
// relief) produces the land from them over a few million simulated years.
//
//   vertical motion  a broad basin somewhere near the middle of the world has been sinking (a rift or
//                    back-arc basin); the crust around it rises, more on average the further out, but
//                    unevenly. The sea is simply where the ground is below sea level.
//   thickening       crustal thickening varies in broad blobs; where it is strongest the crust is pushed up
//                    fastest. The strongest blob in the world becomes its great massif, weaker ones lesser
//                    mountains, hill country and uplands. Nothing forces them into lines.
//   volcanism        one to three volcanic centres rise from the floor of the basin; one of them is instead a
//                    tilted limestone block that stands as a plateau island with cliffed shores.
//   climate          the rain comes on one wind from a random direction and is computed from the relief as it
//                    forms, so windward slopes are wet and the lee of high ground is dry.
//   sedimentary      the region that ends up driest keeps its old, flat-lying sedimentary cover (in humid
//   cover            country it would long since have been stripped). Layered hard and soft beds, uplifted as a
//                    block, erode into one continuous tableland of canyons, mesas and badlands.
//
// The only numbers chosen by taste are the rates and the share of the world under water; positions all come
// from the seed through the fields above.
import { noise2, fbm, smoothstep, sat, mulberry32 } from '../shared/noise.mjs';
import { ROCK } from '../shared/geology.mjs';
import { computePrecipDir } from './erosion.mjs';

const PLAY = 50, X0 = -3, SIZE = 56, G = 192;             // the layout grid covers the generated domain (playable world + hidden margin)
const T0 = 0.9e6;                                         // years of uplift already expressed in the starting surface
const gridAt = (i) => X0 + (i + 0.5) / G * SIZE;
const gauss = (d, s) => Math.exp(-(d * d) / (2 * s * s));
function sample(grid, xk, yk) {
  const fx = Math.min(G - 1.001, Math.max(0, (xk - X0) / SIZE * G - 0.5)), fy = Math.min(G - 1.001, Math.max(0, (yk - X0) / SIZE * G - 0.5));
  const i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j, c = j * G + i;
  return (grid[c] * (1 - u) + grid[c + 1] * u) * (1 - v) + (grid[c + G] * (1 - u) + grid[c + G + 1] * u) * v;
}
let cache = null;
// 1 = thickening fades within 9 km of the border (the great massif stands inside the world); 0 = open edges, where
// mountains run up to the border and past it like everything else (`--edges open`)
let EDGE_FADE = 1;
export function setEdgeFade(v) { if (v !== EDGE_FADE) { EDGE_FADE = v; cache = null; } }

function warp(L, xk, yk) {
  const s = L.seed;
  return [xk + 5.5 * fbm(xk / 24 + L.o[0], yk / 24, 3, s + 11) + 1.6 * fbm(xk / 7.5, yk / 7.5 + L.o[1], 3, s + 12),
          yk + 5.5 * fbm(xk / 24, yk / 24 + L.o[2], 3, s + 13) + 1.6 * fbm(xk / 7.5 + L.o[3], yk / 7.5, 3, s + 14)];
}
// crustal thickening before it is scaled to this world; kept out of the sinking basin, and weaker within 9 km of the
// border so the great massif stands inside the world rather than cut in half by it
function thick(L, xk, yk, wx, wy, dB) {
  const s = L.seed;
  return fbm(wx / 33 + L.o[2], wy / 33 + L.o[3], 2, s + 21) + 0.3 * fbm(wx / 12, wy / 12 + L.o[4], 2, s + 22)
    - 0.4 * EDGE_FADE * smoothstep(9, 0, Math.min(xk, yk, PLAY - xk, PLAY - yk)) - 0.5 * (1 - smoothstep(0.95, 1.6, dB));
}
// The tectonic fields at a point.
function tect(L, xk, yk) {
  const s = L.seed, [wx, wy] = warp(L, xk, yk);
  // the basin: an elongated bowl whose outline is itself irregular
  const ax = wx - L.B[0], ay = wy - L.B[1], ex = ax * L.e[0] + ay * L.e[1], ey = -ax * L.e[1] + ay * L.e[0];
  const dB = Math.hypot(ex / L.e[2], ey * L.e[2]) / (L.RB * (1 + 0.32 * fbm(xk / 10 + L.o[4], yk / 10, 3, s + 61)));
  // regional vertical motion (mm/yr): the basin sinks, the flanks rise unevenly, more on average further out
  const flank = smoothstep(0.85, 2.3, dB) * (0.25 + 1.25 * sat(0.5 + 1.1 * fbm(xk / 15 + L.o[5], yk / 15, 3, s + 62)));
  const reg = -0.5 * (1 - smoothstep(0.45, 1.05, dB)) + 0.02 * flank;
  const th = thick(L, xk, yk, wx, wy, dB), t = L.thMax ? (th - L.th50) / (L.thMax - L.th50) : 0;
  // the great massif, built the way the 1B world's was: a broad crustal bulge (Gaussian, 5.4 km) along a short axis
  // at the thickest point of the crust, uplifting fast enough to stand over 5 km
  let gC = 0;
  if (L.mseg) { const [ax, ay, bx, by] = L.mseg, dx = bx - ax, dy = by - ay; let u = ((wx - ax) * dx + (wy - ay) * dy) / (dx * dx + dy * dy); u = Math.max(0, Math.min(1, u));
    const d = Math.hypot(ax + dx * u - wx, ay + dy * u - wy); gC = gauss(d, 5.4) * (0.86 + 0.26 * noise2(u * 1.7 + L.o[0], 5.3, s + 28) + 0.1 * noise2(xk / 1.6, yk / 1.6, s + 29)); }
  const mt = Math.pow(smoothstep(0.42, 0.85, t), 1.6) * (0.9 + 0.2 * noise2(xk / 2.4, yk / 2.4, s + 23)) * (1 - Math.min(1, gC * 2));   // lesser mountains (0..1)
  const foot = smoothstep(0.22, 0.5, t) * (1 - smoothstep(0.55, 0.8, t));                                       // the rising ground around it
  const hill = sat(smoothstep(0.05, 0.42, fbm(wx / 9.5 + L.o[1], wy / 9.5, 3, s + 25)) * smoothstep(0.95, 1.45, dB) + 0.7 * foot) * (1 - sat(mt * 3));
  return { wx, wy, dB, reg, t, mt, hill, gC };
}

export function getLayout(seed) {
  if (cache && cache.seed === seed) return cache;
  const r = mulberry32((Math.imul(seed | 0, 2654435761) ^ 0x9e3779b9) >>> 0);
  const L = { seed, o: Array.from({ length: 6 }, () => r() * 97), islands: [], alpsCentre: [0, 0, 0], thMax: 0, th50: 0 };
  L.B = [25 + (r() - 0.5) * 16, 25 + (r() - 0.5) * 16];
  { const a = r() * Math.PI; L.e = [Math.cos(a), Math.sin(a), Math.sqrt(1.1 + r() * 0.5)]; }
  L.RB = 11 + r() * 3;
  L.dir = Math.floor(r() * 4); L.windSlope = (r() - 0.5) * 0.8;                 // the rain wind: which side it comes from, and how far it veers
  const n = G * G, inPlay = (x, y) => x >= 0 && y >= 0 && x <= PLAY && y <= PLAY;

  // 1. scale the thickening to this world: its strongest point becomes the great massif
  const raw = [], raw0 = [];
  let thMax = -1e9;
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
    const x = gridAt(i), y = gridAt(j), f = tect(L, x, y), v = thick(L, x, y, f.wx, f.wy, f.dB);
    raw.push(v); raw0.push(v); if (inPlay(x, y) && v > thMax) thMax = v;
  }
  raw.sort((a, b) => a - b); L.th50 = raw[Math.floor(raw.length * 0.5)];
  // The scale is set by area, not by the single highest point: the thickest 2% of the world reaches t = 0.75. So
  // every world's great massif has a broad enough base to stand high with slopes rock can hold, instead of a
  // needle in one world and a sprawling plateau in another.
  { const pv = []; for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) if (inPlay(gridAt(i), gridAt(j))) pv.push(raw0[j * G + i]);
    pv.sort((a, b) => a - b); const q = pv[Math.floor(pv.length * 0.98)]; L.thMax = L.th50 + Math.max(0.05, (q - L.th50) / 0.75); }
  { // the thickest point inside the world (kept 9 km in from the border) carries the great massif
    let best = -1e9, bx = 25, by = 25;
    for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) { const x = gridAt(i), y = gridAt(j); if (Math.min(x, y, PLAY - x, PLAY - y) < 9) continue; const v = raw0[j * G + i]; if (v > best) { best = v; bx = x; by = y; } }
    const f = tect(L, bx, by), a = r() * Math.PI; L.mseg = [f.wx - Math.cos(a) * 2, f.wy - Math.sin(a) * 2, f.wx + Math.cos(a) * 2, f.wy + Math.sin(a) * 2]; L.massif = [bx, by]; }

  // 2. volcanic centres in the deep basin, and one limestone block
  const T = new Array(n);
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) T[j * G + i] = tect(L, gridAt(i), gridAt(j));
  { const deep = []; for (let c = 0; c < n; c++) if (T[c].dB < 0.5 && inPlay(gridAt(c % G), gridAt((c / G) | 0))) deep.push(c);
    const want = 1 + Math.floor(r() * 3);
    for (let tries = 0; tries < 400 && L.islands.length < want && deep.length; tries++) {
      const c = deep[Math.floor(r() * deep.length)], x = gridAt(c % G), y = gridAt((c / G) | 0);
      if (L.islands.some((q) => Math.hypot(q[0] - x, q[1] - y) < 8)) continue;
      // [x, y, radius km, limestone block?, axis, elongation]
      L.islands.push([x, y, 1.5 + r() * 1.2, L.islands.length === 0 && r() < 0.6 ? 1 : 0, r() * Math.PI, 1.15 + r() * 0.4]);
    } }

  // 3. the starting surface, and the sea level that leaves the chosen share of the world under water
  const z = new Float32Array(n), U = new Float32Array(n);
  for (let c = 0; c < n; c++) { const p = forcing(L, gridAt(c % G), gridAt((c / G) | 0), T[c], 0); z[c] = p.h0raw; U[c] = p.U; }
  const play = []; for (let c = 0; c < n; c++) if (inPlay(gridAt(c % G), gridAt((c / G) | 0))) play.push(z[c]);
  play.sort((a, b) => a - b); L.z0 = play[Math.floor(play.length * (0.27 + r() * 0.07))];

  // 4. The sedimentary cover. Flat-lying sandstone and shale survive only where three things hold, as they do in
  //    nature: the crust there was never thickened (where it was, the basement has been pushed up and the cover
  //    stripped off it, so canyon country and alpine mountains do not mix); the country is far from the sea (the
  //    central sea feeds moisture to every shore around it); and it lies in the lee of high ground. Where those
  //    hold best is one region, grown outward as a single compact country, a small part of the world.
  const hp = new Float32Array(n), sea = new Uint8Array(n);
  for (let c = 0; c < n; c++) { const zz = z[c] - L.z0; sea[c] = zz < 0 ? 1 : 0; hp[c] = Math.max(0, zz + 0.84e3 * Math.max(0, U[c])); }
  const P = computePrecipDir(hp, sea, G, SIZE * 1000 / G, L.dir, L.windSlope, true);
  const seaD = new Float32Array(n);                                                        // km to the nearest sea
  { const cell = SIZE / G; for (let c = 0; c < n; c++) seaD[c] = sea[c] ? 0 : 1e9;
    for (let pass = 0; pass < 2; pass++) for (let k = 0; k < n; k++) {
      const c = pass ? n - 1 - k : k, i = c % G, j = (c / G) | 0; if (!seaD[c]) continue;
      const nb = pass ? [[i + 1, j], [i, j + 1], [i + 1, j + 1], [i - 1, j + 1]] : [[i - 1, j], [i, j - 1], [i - 1, j - 1], [i + 1, j - 1]];
      for (const [x, y] of nb) if (x >= 0 && y >= 0 && x < G && y < G) seaD[c] = Math.min(seaD[c], seaD[y * G + x] + cell * Math.hypot(x - i, y - j));
    } }
  const score = new Float32Array(n).fill(-9), land = [];
  for (let c = 0; c < n; c++) {
    const x = gridAt(c % G), y = gridAt((c / G) | 0);
    if (sea[c] || seaD[c] < 2 || T[c].dB < 1.0 || T[c].t > 0.34 || T[c].gC > 0.08 || Math.min(x, y, PLAY - x, PLAY - y) < -2.5) continue;
    score[c] = -P[c] + 0.06 * Math.min(seaD[c], 9) - 0.6 * T[c].hill + 0.12 * fbm(x / 13 + L.o[5], y / 13, 2, seed + 31); if (inPlay(x, y)) land.push(c);
  }
  L.table = new Float32Array(n); L.tdist = new Float32Array(n);
  let tx = 0, ty = 0, tn = 0;
  const nLand = (() => { let k = 0; for (let c = 0; c < n; c++) if (!sea[c] && inPlay(gridAt(c % G), gridAt((c / G) | 0))) k++; return k; })();
  if (land.length) {
    const target = Math.min(land.length, Math.round(nLand * (0.075 + r() * 0.03))), rad = Math.sqrt(target * (SIZE / G) ** 2 / Math.PI);
    // One country, roughly round, as an eroded outlier of an old basin's cover is. It is centred on the best spot
    // (score averaged over a country-sized window, ground that cannot carry the cover counting against it); its
    // outline is a warped circle; it keeps only ground that can carry the cover and is connected to its centre, and
    // where it reaches the border it simply carries on past it. So it is never a strip or a scatter of pieces.
    const avg = new Float32Array(n), w = Math.max(2, Math.round(rad * 0.8 / (SIZE / G)));
    { const tmp = new Float32Array(n), v = (c) => (score[c] > -9 ? score[c] : -3.5);
      for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) { let a = 0; for (let d = -w; d <= w; d++) a += v(j * G + Math.min(G - 1, Math.max(0, i + d))); tmp[j * G + i] = a; }
      for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) { let a = 0; for (let d = -w; d <= w; d++) a += tmp[Math.min(G - 1, Math.max(0, j + d)) * G + i]; avg[j * G + i] = a; } }
    let start = -1;
    for (const c of land) { const x = gridAt(c % G), y = gridAt((c / G) | 0); if (Math.min(x, y, PLAY - x, PLAY - y) < 0.5) continue; if (start < 0 || avg[c] > avg[start]) start = c; }
    if (start < 0) { start = land[0]; for (const c of land) if (avg[c] > avg[start]) start = c; }
    // the circle widens until the connected ground inside it reaches the cover's share of the world
    const sx0 = gridAt(start % G), sy0 = gridAt((start / G) | 0), inside = new Uint8Array(n);
    let comp = [];
    for (let k = 1.1; k < 1.75; k += 0.1) {
      inside.fill(0);
      for (let c = 0; c < n; c++) {
        if (score[c] <= -9) continue;
        const x = gridAt(c % G), y = gridAt((c / G) | 0), a = Math.atan2(y - sy0, x - sx0);
        const R = rad * k * (1 + 0.22 * noise2(Math.cos(a) * 1.6 + L.o[3], Math.sin(a) * 1.6, seed + 32) + 0.08 * noise2(Math.cos(a) * 4.5 + L.o[4], Math.sin(a) * 4.5, seed + 33));
        if (Math.hypot(x - sx0, y - sy0) < R) inside[c] = 1;
      }
      inside[start] = 1; comp = [start]; const got = new Uint8Array(n); got[start] = 1;
      for (let h = 0; h < comp.length; h++) { const c = comp[h], i = c % G; for (const q of [c - 1, c + 1, c - G, c + G]) { if (q < 0 || q >= n || Math.abs((q % G) - i) > 1 || !inside[q] || got[q]) continue; got[q] = 1; comp.push(q); } }
      if (comp.filter((c) => inPlay(gridAt(c % G), gridAt((c / G) | 0))).length >= target) break;
    }
    for (const c of comp) { L.table[c] = 1; tx += gridAt(c % G); ty += gridAt((c / G) | 0); tn++; }
    // no islands of other country inside it: ground the badlands enclose is badlands too
    { const out = new Uint8Array(n), st = [];
      for (let i = 0; i < G; i++) for (const c of [i, (G - 1) * G + i, i * G, i * G + G - 1]) if (!L.table[c] && !out[c]) { out[c] = 1; st.push(c); }
      while (st.length) { const c = st.pop(), i = c % G; for (const q of [c - 1, c + 1, c - G, c + G]) { if (q < 0 || q >= n || Math.abs((q % G) - i) > 1 || out[q] || L.table[q]) continue; out[q] = 1; st.push(q); } }
      for (let c = 0; c < n; c++) if (!L.table[c] && !out[c]) { L.table[c] = 1; tx += gridAt(c % G); ty += gridAt((c / G) | 0); tn++; } }
    // Beyond the border the world goes on: where the badlands reach the border they carry straight on through the
    // hidden margin to the edge of the simulation, so they neither end nor slope down just past the wall.
    { const k = (v) => Math.min(G - 1, Math.max(0, Math.floor((Math.min(PLAY - 0.05, Math.max(0.05, v)) - X0) / SIZE * G)));
      for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) { const x = gridAt(i), y = gridAt(j); if (inPlay(x, y)) continue; L.table[j * G + i] = L.table[k(y) * G + k(x)]; } }
    // distance in from the edge of the cover (km): the tableland stands higher toward its interior
    const D = L.tdist, cell = SIZE / G; for (let c = 0; c < n; c++) D[c] = L.table[c] ? 1e9 : 0;
    for (let pass = 0; pass < 2; pass++) for (let k = 0; k < n; k++) {
      const c = pass ? n - 1 - k : k, i = c % G, j = (c / G) | 0; if (!D[c]) continue;
      const nb = pass ? [[i + 1, j], [i, j + 1], [i + 1, j + 1], [i - 1, j + 1]] : [[i - 1, j], [i, j - 1], [i - 1, j - 1], [i + 1, j - 1]];
      for (const [x, y] of nb) if (x >= 0 && y >= 0 && x < G && y < G) D[c] = Math.min(D[c], D[y * G + x] + cell * Math.hypot(x - i, y - j));
    }
    for (let pass = 0; pass < 2; pass++) { const t = Float32Array.from(L.table); for (let j = 1; j < G - 1; j++) for (let i = 1; i < G - 1; i++) { const c = j * G + i; L.table[c] = (t[c] * 2 + t[c - 1] + t[c + 1] + t[c - G] + t[c + G]) / 6; } }
  }
  L.tableC = tn ? [tx / tn, ty / tn] : [25, 25]; L.c = L.B;
  L.seaShare = 0.3 + r() * 0.06;                  // the share of the world the sea covers once it has risen to its present level
  return (cache = L);
}

// Uplift rate and starting surface at one point. `plateau` is the sedimentary cover (0 while it is not yet known).
function forcing(L, xk, yk, f, plateau) {
  const s = L.seed, { reg, mt, hill } = f;
  let isl = 0, chalk = 0;
  for (const q of L.islands) {
    const dx = xk - q[0], dy = yk - q[1], ca = Math.cos(q[4]), sa = Math.sin(q[4]);
    const d = Math.hypot((dx * ca + dy * sa) / q[5], (-dx * sa + dy * ca) * q[5]) / (q[2] * (1 + 0.32 * fbm(xk / (q[2] * 1.3) + q[0], yk / (q[2] * 1.3), 3, s + 93)));
    if (q[3]) chalk = Math.max(chalk, smoothstep(1.0, 0.72, d)); else isl = Math.max(isl, gauss(d, 0.5));
  }
  // uplift rate (mm/yr)
  // away from hills and mountains the crust barely moves, so most of the land stays low plains
  let U = reg + 0.006 + 0.02 * smoothstep(0.1, 0.65, fbm(xk / 7.5, yk / 7.5, 3, s + 31));
  U += 2.5 * f.gC + 1.8 * mt + 0.3 * hill * (1 - plateau) + 1.15 * isl + 0.62 * chalk;
  U += 0.012 * (0.5 + 0.5 * noise2(xk / 1.1, yk / 1.1, s + 35)) * (1 - plateau);
  // The block rises steadily from a low start (as the Colorado Plateau did): the rivers already flowing across it keep
  // cutting down as it rises, so canyons run right through its interior instead of only nibbling at its edges.
  U = U * (1 - plateau) + plateau * Math.max(U, 0.3);
  // the starting surface: an old lowland, plus the uplift (or sinking) already expressed
  const h0raw = 30 + 25 * fbm(xk / 6, yk / 6, 3, s + 33) + U * 1e-3 * T0 + 400 * f.gC;
  return { U, h0raw, isl, chalk };
}

export function seededDesign(xk, yk, seed) {
  const L = getLayout(seed), f = tect(L, xk, yk), cover = smoothstep(0.42, 0.62, sample(L.table, xk, yk) + 0.13 * fbm(xk / 4.6, yk / 4.6, 3, seed + 65) + 0.05 * fbm(xk / 1.5, yk / 1.5, 2, seed + 66));   // an eroded, ragged edge
  const p = forcing(L, xk, yk, f, cover), { mt, hill } = f;
  let h0 = p.h0raw - L.z0;
  if (p.chalk > 0) h0 = Math.max(h0, 6 + 110 * p.chalk);                                                       // the block stands as a flat-topped island
  const plateau = cover * smoothstep(-40, 40, h0);
  if (plateau > 0) h0 += plateau * (300 + 14 * Math.min(10, sample(L.tdist, xk, yk)) + 30 * fbm(xk / 5, yk / 5, 3, seed + 34));
  h0 = h0 < 0 ? Math.max(-380, h0) : Math.max(1.5, h0);
  // rock
  let rock = ROCK.ALLUVIUM;
  const wob = 0.9 * noise2(xk / 2.6, yk / 2.6, seed + 41), belt = fbm(f.wx / 9, f.wy / 9, 2, seed + 42);
  if (plateau > 0.5) rock = ROCK.SANDSTONE;
  else if (p.chalk > 0.3) rock = ROCK.LIMESTONE;
  else if (p.isl > 0.25) rock = ROCK.BASALT;
  else if (mt > 0.42 + 0.1 * wob) rock = ROCK.GRANITE;
  else if (mt > 0.06) rock = ROCK.SCHIST;
  else if (hill > 0.2) rock = belt > 0.14 ? ROCK.LIMESTONE : ROCK.GREYWACKE;
  else if (f.dB > 1.5 + 0.2 * wob) rock = belt > 0 ? ROCK.SCHIST : ROCK.GREYWACKE;
  const badl = plateau > 0.5 && fbm(xk / 2.4 + L.o[5], yk / 2.4, 3, seed + 46) > 0.22;                     // softer shale country inside the tableland
  if (badl) rock = ROCK.SHALE;
  let kmod = 1;
  if (rock === ROCK.GREYWACKE) kmod = 0.8 + 0.6 * sat(0.5 + 0.9 * noise2(xk / 2.3, yk / 2.3, seed + 47));
  if (rock === ROCK.SCHIST) kmod = 0.85 + 0.4 * sat(0.5 + noise2(xk / 1.7, yk / 1.7, seed + 43));
  if (rock === ROCK.LIMESTONE) kmod = 0.9;
  if (rock === ROCK.SANDSTONE) kmod = 0.3;
  if (badl) kmod = 0.7;
  const strat = 70 * fbm(xk / 8, yk / 8, 2, seed + 44) + 14 * noise2(xk / 1.2, yk / 1.2, seed + 45);
  return { land: h0 / 40, U: p.U * 1e-3, h0, rock, kmod, strat, gG: 0, plateau, erg: 0 };
}
