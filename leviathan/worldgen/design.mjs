// Geographic design of the world: the large-scale tectonic and structural template.
// Everything here is an analytic field over (x east, y north) in kilometres; erosion does the rest.
//
// Composition (a convergent-margin transect, west to east):
//   Ocean -> Coast Range -> Central Valley -> the Spine (alpine arc + stratovolcano) -> high desert Plateau
// with a glacially scoured marine Sound entering from the north-west, a Northern Highlands arc
// around it, and one antecedent river (the Great River) crossing the Spine through a gorge.
import { noise2, fbm, ridged, smoothstep, sat, clamp, hash2 } from '../shared/noise.mjs';
import { ROCK } from '../shared/geology.mjs';
import { seededDesign, playSize } from './layout.mjs';

export const WORLD_KM = 50;

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  let t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const qx = ax + dx * t - px, qy = ay + dy * t - py;
  return [Math.sqrt(qx * qx + qy * qy), t];
}
// distance to polyline + arc-length parameter (km) of the nearest point
function polyDist(px, py, pts) {
  let best = 1e9, bs = 0, acc = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const [d, t] = segDist(px, py, a[0], a[1], b[0], b[1]);
    if (d < best) { best = d; bs = acc + t * len; }
    acc += len;
  }
  return [best, bs];
}
const gauss = (d, s) => Math.exp(-(d * d) / (2 * s * s));

export const SPINE = [[35, -3], [33.8, 9], [35.6, 19], [34.9, 28], [33.2, 35.5], [29.2, 41.5], [22.5, 46.3], [12, 49.3], [3, 51]];
export const SPINE_N = [[33.2, 35.5], [35.4, 42.5], [37.2, 52]];
// the Crown: a Himalaya-scale massif in the north-east, where the Spine meets the plateau margin
export const CROWN = [[33.5, 38.5], [37.5, 43], [42.5, 46.3], [48.5, 48.2]];
export const GORGE = [[43.5, 23.2], [39.5, 22.2], [35, 23], [31.5, 22.4], [28, 22]];
export const VOLCANO = { x: 30.9, y: 11.0, h: 2550, r0: 2.9 };
// the Sound: polylines [x, y, radius] (km)
const SOUND = [
  [[0, 39.0, 1.7], [4, 39.3, 1.3], [7.5, 39.9, 1.15], [10.5, 39.5, 1.9], [13.5, 39.3, 3.0], [16.5, 38.9, 2.7], [18.6, 38.4, 2.0]], // Strait + inner basin
  [[17.4, 38.2, 1.9], [17.9, 36.2, 1.35], [17.5, 34.4, 1.1], [18.3, 32.6, 0.9]],   // south arm to the Great River delta
  [[18.4, 38.6, 1.8], [20.6, 39.7, 1.3], [22.6, 40.2, 0.9], [24.6, 40.0, 0.55]],   // east bay
  [[12.9, 41.2, 0.8], [13.5, 42.8, 0.55], [12.9, 44.3, 0.5], [13.6, 45.9, 0.4]],   // west fjord
  [[20.4, 40.2, 0.8], [21.6, 42.0, 0.6], [21.3, 43.8, 0.55], [22.6, 45.6, 0.45]],  // east fjord
  [[9.2, 40.6, 0.7], [9.0, 42.4, 0.45], [9.9, 43.6, 0.35]],                         // outer fjord
];
const ISLANDS = [[13.4, 39.2, 1.15], [16.3, 37.4, 0.55], [2.3, 24.5, 0.5], [2.9, 12.2, 0.38], [2.6, 46.3, 0.42]];

// Variant B ("1B"): the Sound is widened into a central sea that reaches down the valley, and the
// north is cold (see finish.mjs). Variant A is the original layout.
let VARIANT = 'A';
export function setVariant(v) { VARIANT = v; }
// B: a central ocean ringed by land; no long mountain chain, just one short alpine range in the
// south-east, a low highland arc in the north, and a single Himalayan-scale massif above the sea.
const GULF = [[[15, 37.5, 4.6], [18, 33, 7.0], [21, 27, 8.3], [22.6, 21, 6.6], [21.6, 15.5, 3.4]]];
const GULF_ISLANDS = [[18, 30.5, 1.4], [23.2, 24.6, 1.0], [16.4, 35, 0.6], [24.6, 29.6, 0.7], [20.5, 19.5, 0.55]];
const SPINE_B = [[34.4, 4], [33.6, 10.5], [35.0, 17.5]];
const HIGH_B = [[28.5, 43.5], [22.5, 46.3], [12, 49.3], [3, 51]];
const CROWN_B = [[31.0, 41.6], [34.4, 43.6]];
export function designAt(xk, yk, seed) {
  if (VARIANT === 'S') return seededDesign(xk, yk, seed);     // seed-driven layout: see layout.mjs
  // domain warp so nothing follows a ruler
  const wx = xk + 1.25 * fbm(xk / 9, yk / 9, 3, seed + 11) + 0.32 * fbm(xk / 2.1, yk / 2.1, 3, seed + 12);
  const wy = yk + 1.25 * fbm(xk / 9, yk / 9, 3, seed + 13) + 0.32 * fbm(xk / 2.1, yk / 2.1, 3, seed + 14);

  // ---- land / sea -------------------------------------------------------------------------
  const xc = 5.0 + 1.3 * Math.sin(wy / 6.5 + 0.8) + 0.7 * Math.sin(wy / 2.7 + 2.0);
  // layout C: the outer ocean only takes the north-west corner; everywhere else the land runs to the edge
  let land = VARIANT === 'C' ? 16.6 - (-0.77 * wx + 0.64 * wy) : wx - xc;
  const sx = wx + 0.6 * fbm(xk / 1.3, yk / 1.3, 3, seed + 16) + 0.7 * noise2(xk / 3.7, yk / 3.7, seed + 26), sy = wy + 0.6 * fbm(xk / 1.3, yk / 1.3, 3, seed + 17) + 0.7 * noise2(xk / 3.7, yk / 3.7, seed + 27);
  for (const pl of (VARIANT !== 'A' ? SOUND.concat(GULF) : SOUND)) for (let q = 0; q < pl.length - 1; q++) {
    const a = pl[q], b = pl[q + 1];
    const [d, t] = segDist(sx, sy, a[0], a[1], b[0], b[1]);
    land = Math.min(land, d - (a[2] + (b[2] - a[2]) * t));
  }
  land += 0.16 * fbm(xk / 0.55, yk / 0.55, 3, seed + 18) + 0.5 * Math.max(0, fbm(xk / 3.3, yk / 3.3, 2, seed + 19)) * Math.exp(-Math.abs(land) / 1.5) * (land > -1 ? -1 : 0);
  if (VARIANT !== 'A') {
    // Islands are drowned hills, not discs: each is stretched along its own axis, its outline is pushed
    // in and out by headlands and coves at two scales, and the sea-floor warp above bends the whole shape.
    const isl = ISLANDS.concat(GULF_ISLANDS);
    for (let k = 0; k < isl.length; k++) {
      const c = isl[k], ang = hash2(k, 3, seed + 151) * Math.PI, asp = 1.25 + 0.55 * hash2(k, 5, seed + 152);
      const dx = sx - c[0], dy = sy - c[1], ca = Math.cos(ang), sa = Math.sin(ang);
      const d = Math.hypot((dx * ca + dy * sa) / asp, (-dx * sa + dy * ca) * asp);
      const r = c[2] * (1 + 0.42 * fbm(xk / (c[2] * 1.6) + k * 7.3, yk / (c[2] * 1.6), 3, seed + 153) + 0.16 * noise2(xk / (c[2] * 0.35), yk / (c[2] * 0.35), seed + 154));
      land = Math.max(land, r - d);
    }
  } else for (const c of ISLANDS) land = Math.max(land, c[2] - Math.hypot(wx - c[0], wy - c[1]) * (1 + 0.25 * noise2(xk * 1.3, yk * 1.3, seed + 15)));

  // ---- structural elements ------------------------------------------------------------------
  // Layout C ("around the ocean"): nothing is arranged in north-south strips. Clockwise from the north:
  // fjord highlands, the great massif (NE), the mesa and sand sea (a wedge in the east and south-east),
  // prairie (S), a compact alpine group (SW), rolling hills (W), the strait and outer ocean (NW).
  const VB = VARIANT !== 'A', VC = VARIANT === 'C';
  let [dS, sS] = VC ? [1e9, 0] : polyDist(wx, wy, VB ? SPINE_B : SPINE);
  const gA = VC ? Math.max(gauss(Math.hypot(wx - 9, wy - 9.5), 3.7), 0.85 * gauss(Math.hypot(wx - 13.8, wy - 6), 3.0)) * (0.9 + 0.2 * noise2(xk / 2.2, yk / 2.2, seed + 36)) : 0;
  const [dN] = VB ? [1e9] : polyDist(wx, wy, SPINE_N);
  const northBranch = dN < dS;
  if (northBranch) { dS = dN; sS = 20; }
  // amplitude along the arc: full alpine height in the main N-S section, lower in the highland arc
  let ampS = northBranch ? 0.86 : 1.0 - 0.5 * smoothstep(38, 50, sS);
  ampS *= 0.94 + 0.14 * noise2(sS / 5.5, 3.7, seed + 21) + 0.07 * noise2(sS / 1.9, 9.1, seed + 22);
  if (VB) ampS *= 1.3;                    // B's one alpine range is short but properly high and snowy
  const gS = gauss(dS, VB ? 3.8 : 4.8 - 1.2 * smoothstep(38, 50, sS));
  const gH = VB ? 0.5 * gauss(polyDist(wx, wy, HIGH_B)[0], 3.6) : 0;        // B: low northern highlands
  const gSA = Math.max(gS * ampS, gH);
  const [dG] = polyDist(xk + 0.35 * noise2(xk / 3, yk / 3, seed + 23), yk + 0.5 * noise2(xk / 3.5, yk / 3.5, seed + 24), GORGE);
  const gG = gauss(dG, 1.05);

  const xcr = 9.6 + 1.0 * Math.sin(wy / 6.0);
  const gCR = gauss(wx - xcr, 2.5) * (1 - smoothstep(29.5, 34, wy)) * (0.75 + 0.35 * noise2(wy / 4.5, 1.3, seed + 25)) * (VC ? 0 : 1);
  const [dCr, sCr] = polyDist(wx, wy, VB ? CROWN_B : CROWN);
  const gC = gauss(dCr, VB ? 5.4 : 4.1) * (0.86 + 0.26 * noise2(sCr / 4.2, 5.3, seed + 28) + 0.1 * noise2(sCr / 1.6, 2.2, seed + 29));
  const plateau = (VC ? smoothstep(24, 27.5, 0.906 * wx - 0.423 * wy) : smoothstep(38.2, 41.2, wx)) * (1 - smoothstep(0.08, 0.4, gC));
  const dGorgeMouth = Math.hypot(xk - 43.5, yk - 23.2);

  // ---- uplift (mm/yr) -------------------------------------------------------------------------
  let U = 0.012 + 0.034 * smoothstep(0.1, 0.65, fbm(xk / 7.5, yk / 7.5, 3, seed + 31)) * (1 - plateau);
  U += 0.27 * gCR;
  if (VC) U += 2.0 * gA + 0.2 * (gauss(Math.hypot(wx - 6, wy - 24), 4) + gauss(Math.hypot(wx - 9.5, wy - 32.5), 3.2));
  U += 1.15 * gSA * (1 - 0.75 * plateau);
  U += (VB ? 2.5 : 0.95) * gC;    // the chain ends where the resistant plateau begins
  U += 0.05 * plateau + 0.10 * smoothstep(47.3, 50, wx) + 0.08 * smoothstep(47.5, 50, wy) * plateau;
  U += 0.012 * (0.5 + 0.5 * noise2(xk / 1.1, yk / 1.1, seed + 35)) * (1 - plateau);
  U += (VC ? 0.08 : 0.24) * smoothstep(3.2, 0, wy) * smoothstep(8, 12, wx);
  U += 0.06 * ridged(xk / 3.2, yk / 3.2, 3, seed + 32) * (0.3 + gS + gCR);
  U *= 1 - 0.86 * gG;
  // wave and ice planation: skerries and the immediate shore zone do not build relief
  U *= 0.12 + 0.88 * smoothstep(0.0, 0.7, land);

  // ---- initial surface ------------------------------------------------------------------------
  let h0;
  if (land < 0) h0 = -Math.min(260, 3 + 55 * Math.pow(-land, 1.3));
  else {
    h0 = 6 + 24 * sat(land / 3) + 190 * gCR + 1800 * gA + 950 * gSA + (VB ? 2600 : 1500) * gC + 12 * fbm(xk / 2, yk / 2, 3, seed + 33);
    h0 += plateau * (1100 + 10 * dGorgeMouth + 45 * fbm(xk / 5, yk / 5, 3, seed + 34));
    const notch = 105 + 40 * Math.max(0, xk - 28);
    h0 = h0 + (Math.min(h0, notch) - h0) * Math.sqrt(gG);
    h0 = Math.max(h0, 1.5);
  }

  // ---- lithology ------------------------------------------------------------------------------
  let rock = ROCK.ALLUVIUM;
  const wob = 0.9 * noise2(xk / 2.6, yk / 2.6, seed + 41);
  if (plateau > 0.5) rock = ROCK.SANDSTONE;
  else if (gC > 0.1) rock = dCr + wob < 2.7 ? ROCK.GRANITE : ROCK.SCHIST;
  else if (gA > 0.1) rock = gA > 0.42 ? ROCK.GRANITE : ROCK.SCHIST;
  else if (gS > 0.08 || gH > 0.04) {
    const side = wx - (33.5 + 0); // rough west/east of axis for the main section
    if (dS + wob < 1.9) rock = ROCK.GRANITE;
    else rock = ROCK.SCHIST;
    if (!northBranch && sS > 40 && fbm(xk / 4, yk / 4, 2, seed + 42) > 0.22) rock = ROCK.GRANITE;
  } else if (gCR > 0.1 || (wx < 14 && wy < 33)) rock = ROCK.GREYWACKE;
  else if (wy > 41 || wx < 9) rock = ROCK.SCHIST;
  // badlands basin and a soft belt on the plateau
  const badl = plateau > 0.5 && Math.hypot((wx - 45.3) / 3.4, (wy - 8.6) / 4.2) + 0.5 * fbm(xk / 1.4, yk / 1.4, 3, seed + 46) < 1;
  if (badl) rock = ROCK.SHALE;

  // fold-belt stripes in the Coast Range: alternating hard and soft beds striking N-S
  let kmod = 1;
  if (rock === ROCK.GREYWACKE) kmod = 0.75 + 0.75 * sat(0.5 + 0.9 * Math.sin((wx + 0.8 * Math.sin(wy / 3.1)) * 3.4));
  if (rock === ROCK.SCHIST) kmod = 0.85 + 0.4 * sat(0.5 + noise2(xk / 1.7, yk / 1.7, seed + 43));

  if (rock === ROCK.SANDSTONE) kmod = 0.3;
  if (badl) kmod = 0.7;
  // stratigraphic offset for the layered plateau (dip + undulation)
  const strat = 6 * dGorgeMouth + 70 * fbm(xk / 8, yk / 8, 2, seed + 44) + 14 * noise2(xk / 1.2, yk / 1.2, seed + 45);

  // the erg: a sand sea banked against the plateau interior, downwind of the badlands
  let erg = plateau * smoothstep(1.2, 0.3, Math.hypot((wx - 46.4) / 2.5, (wy - 15.2) / 4.3) + 0.28 * fbm(xk / 1.6, yk / 1.6, 2, seed + 47));
  // variant B: the Great Sand Sea fills the south-east of the plateau, in the deepest rain shadow
  if (VARIANT !== 'A') erg = Math.max(erg, plateau * smoothstep(27.5, 22, wy + 1.5 * noise2(xk / 4, yk / 4, seed + 48)) * smoothstep(41.6, 44.6, wx + 1.2 * noise2(xk / 3, yk / 3, seed + 49)));
  return { land, U: U * 1e-3, h0, rock, kmod, strat, gG, plateau, erg };
}

// volcanic cone, applied late so that only its youngest erosion is modelled
export const VOLCANO_ENABLED = false;   // isolated cones read as artificial 'point' mountains; the range stands on its own
export function volcanoHeight(xk, yk, seed) {
  if (!VOLCANO_ENABLED) return [-1e9, 1e9];
  const r = Math.hypot(xk - VOLCANO.x, yk - VOLCANO.y) * (1 + 0.07 * noise2(xk / 1.5, yk / 1.5, seed + 51));
  let h = VOLCANO.h * Math.exp(-r / VOLCANO.r0) * (1 + 0.035 * noise2(xk * 0.9, yk * 0.9, seed + 52));
  h -= 170 * Math.exp(-(r * r) / (2 * 0.26 * 0.26));
  return [h, r];
}

export function buildDesign(R, seed, domain = { x0: 0, size: WORLD_KM }) {
  const n = R * R;
  const d = {
    R, land: new Float32Array(n), U: new Float32Array(n), h0: new Float32Array(n), rock: new Uint8Array(n),
    kmod: new Float32Array(n), strat: new Float32Array(n), gorge: new Float32Array(n), mesa: new Float32Array(n), erg: new Float32Array(n),
  };
  const shelf = null;   // (the seeded world's coasts, lakes and islands come out of the simulation; see generate.mjs)
  for (let j = 0; j < R; j++) for (let i = 0; i < R; i++) {
    const p = designAt(domain.x0 + (i + 0.5) / R * domain.size, domain.x0 + (j + 0.5) / R * domain.size, seed);
    const c = j * R + i; if (shelf) shelf[c] = p.shelf || 0;
    d.land[c] = p.land; d.U[c] = p.U; d.h0[c] = p.h0; d.rock[c] = p.rock; d.kmod[c] = p.kmod; d.strat[c] = p.strat; d.gorge[c] = p.gG; d.mesa[c] = p.plateau; d.erg[c] = p.erg;
  }
  // seeded world: one sea, no lakes, no specks (see oneSea below), then its coasts are left to erosion
  if (VARIANT === 'S') oneSea(d, R, domain.size / R, seed, domain);
  if (shelf) {
    // Relief grows with distance from the sea: rolling ground and ranges start from a coastal lowland instead of
    // standing straight out of the water. Tablelands are exempt, so where one meets the sea it ends in a cliff.
    if (!process.env.LEV_RAW_SEA) oneSea(d, R, domain.size / R, seed, domain);
    const dist = new Float32Array(n).fill(1e9), cell = domain.size / R, D = 1.41421356;
    for (let c = 0; c < n; c++) if (d.land[c] < 0) dist[c] = 0;
    for (let j = 0; j < R; j++) for (let i = 0; i < R; i++) { const c = j * R + i; let v = dist[c];
      if (i > 0) v = Math.min(v, dist[c - 1] + 1); if (j > 0) { v = Math.min(v, dist[c - R] + 1); if (i > 0) v = Math.min(v, dist[c - R - 1] + D); if (i < R - 1) v = Math.min(v, dist[c - R + 1] + D); } dist[c] = v; }
    for (let j = R - 1; j >= 0; j--) for (let i = R - 1; i >= 0; i--) { const c = j * R + i; let v = dist[c];
      if (i < R - 1) v = Math.min(v, dist[c + 1] + 1); if (j < R - 1) { v = Math.min(v, dist[c + R] + 1); if (i < R - 1) v = Math.min(v, dist[c + R + 1] + D); if (i > 0) v = Math.min(v, dist[c + R - 1] + D); } dist[c] = v; }
    for (let c = 0; c < n; c++) {
      if (d.land[c] < 0) continue;
      const km = dist[c] * cell, t = Math.min(1, Math.max(0, (km - 0.2) / 3.0)), k0 = t * t * (3 - 2 * t), k = k0 + (1 - k0) * shelf[c];
      const low = Math.min(d.h0[c], 5 + 9 * km);
      d.h0[c] = low + (d.h0[c] - low) * k; d.U[c] = 0.012e-3 + Math.max(0, d.U[c] - 0.012e-3) * k;
    }
  }
  return d;
}

// One sea, no lakes. Inland water separated from the main sea by only a short neck of low ground is joined across
// that neck; otherwise it is filled in as low ground. No long channels are dug. A sizeable arm of the outer sea
// (water reaching the edge of the world) is left as it is. Specks of land too small to be islands are drowned.
function oneSea(d, R, cellKm, seed, domain) {
  // only the playable world counts: two waters that meet beyond the border are still separate for anyone inside it
  const [PWk, PHk] = VARIANT === 'S' ? playSize() : [WORLD_KM, WORLD_KM];
  const lo = Math.max(0, Math.ceil((0 - domain.x0) / cellKm - 0.5)), hi = Math.min(R - 1, Math.floor((PWk - domain.x0) / cellKm - 0.5)), hiY = Math.min(R - 1, Math.floor((PHk - domain.x0) / cellKm - 0.5));
  const inPlay = (x, y) => x >= lo && y >= lo && x <= hi && y <= hiY;
  const n = R * R, comp = new Int32Array(n), stack = new Int32Array(n), cost = new Float32Array(n), prev = new Int32Array(n);
  const label = () => {
    comp.fill(-1); const sizes = [], edge = []; let nc = 0;
    for (let s0 = 0; s0 < n; s0++) {
      if (d.land[s0] >= 0 || comp[s0] >= 0 || !inPlay(s0 % R, (s0 / R) | 0)) continue;
      let sp = 0, cnt = 0, e = false; stack[sp++] = s0; comp[s0] = nc;
      while (sp) {
        const c = stack[--sp], i = c % R, j = (c / R) | 0; cnt++; if (i === lo || j === lo || i === hi || j === hiY) e = true;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const x = i + di, y = j + dj; if (!inPlay(x, y)) continue; const q = y * R + x; if (d.land[q] < 0 && comp[q] < 0) { comp[q] = nc; stack[sp++] = q; } }
      }
      sizes.push(cnt); edge.push(e); nc++;
    }
    let big = 0; for (let k = 1; k < nc; k++) if (sizes[k] > sizes[big]) big = k;
    return { sizes, edge, nc, big };
  };
  // what it costs to cut a strait through one cell
  // (a coherent random factor makes the cheapest route wander like a natural channel instead of running straight)
  const weight = (q) => (d.land[q] < 0 ? 0.12 : d.mesa[q] > 0.25 || d.U[q] > 0.45e-3 ? Infinity
    : (1 + 0.5 * d.land[q] + 2.2e4 * Math.max(0, d.U[q] - 0.03e-3)) * (0.45 + 1.5 * sat(0.5 + 1.3 * noise2((q % R) * cellKm / 2.6, ((q / R) | 0) * cellKm / 2.6, seed + 96)))
      * (1 + 7 * sat(1 - Math.min(q % R - lo, hi - q % R, ((q / R) | 0) - lo, hi - ((q / R) | 0)) * cellKm / 3)));       // and it keeps off the border
  const hk = new Float32Array(n * 2), hv = new Int32Array(n * 2);
  for (let round = 0; round < 5; round++) {
    const L = label(); if (L.nc <= 1) return;
    // cheapest route from the main sea to everywhere (Dijkstra, binary heap)
    cost.fill(Infinity); let hn = 0;
    const push = (k, v) => { let i = hn++; while (i > 0) { const p = (i - 1) >> 1; if (hk[p] <= k) break; hk[i] = hk[p]; hv[i] = hv[p]; i = p; } hk[i] = k; hv[i] = v; };
    const pop = () => { const v = hv[0], k = hk[--hn], w = hv[hn]; let i = 0; for (;;) { let c = 2 * i + 1; if (c >= hn) break; if (c + 1 < hn && hk[c + 1] < hk[c]) c++; if (hk[c] >= k) break; hk[i] = hk[c]; hv[i] = hv[c]; i = c; } hk[i] = k; hv[i] = w; return v; };
    for (let c = 0; c < n; c++) if (comp[c] === L.big) { cost[c] = 0; prev[c] = -1; const i = c % R, j = (c / R) | 0; if (i && j && i < R - 1 && j < R - 1 && (d.land[c - 1] >= 0 || d.land[c + 1] >= 0 || d.land[c - R] >= 0 || d.land[c + R] >= 0)) push(0, c); }
    while (hn) {
      const k0 = hk[0], c = pop(); if (k0 > cost[c]) continue;
      const i = c % R, j = (c / R) | 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue; const x = i + di, y = j + dj; if (!inPlay(x, y)) continue;
        const q = y * R + x; if (comp[q] === L.big) continue;
        const w = weight(q); if (w === Infinity) continue;
        const nk = k0 + w * cellKm * (di && dj ? 1.4142 : 1); if (nk < cost[q]) { cost[q] = nk; prev[q] = c; if (hn < hk.length - 1) push(nk, q); }
      }
    }
    // the cheapest landing point of every other body, and whether the strait is worth it
    const best = new Int32Array(L.nc).fill(-1);
    for (let c = 0; c < n; c++) { const k = comp[c]; if (k >= 0 && k !== L.big && cost[c] < Infinity && (best[k] < 0 || cost[c] < cost[best[k]])) best[k] = c; }
    let carved = 0;
    for (let k = 0; k < L.nc; k++) {
      if (process.env.LEV_DEBUG_SEA && k !== L.big && best[k] < 0 && L.sizes[k] * cellKm * cellKm > 0.5) console.log(`round ${round} body ${k}: ${(L.sizes[k] * cellKm * cellKm).toFixed(1)} km2 edge=${L.edge[k]} UNREACHED`);
      if (k === L.big || best[k] < 0) continue;
      if (process.env.LEV_DEBUG_SEA && L.sizes[k] * cellKm * cellKm > 0.5) console.log(`round ${round} body ${k}: ${(L.sizes[k] * cellKm * cellKm).toFixed(1)} km2 edge=${L.edge[k]} cost=${cost[best[k]].toFixed(1)} at ${(best[k] % R * cellKm + domain.x0).toFixed(1)},${(((best[k] / R) | 0) * cellKm + domain.x0).toFixed(1)}`);
      const areaKm2 = L.sizes[k] * cellKm * cellKm; if (areaKm2 < 2 || cost[best[k]] > 4.5) continue;   // an arm of the outer sea is always joined; an inland pond only across a short neck
      for (let c = best[k]; c >= 0 && comp[c] !== L.big; c = prev[c]) {
        if (d.land[c] < 0) continue;
        const i = c % R, j = (c / R) | 0, wKm = 1.25 + 0.9 * noise2(i * cellKm / 1.9, j * cellKm / 1.9, seed + 97), rc = Math.max(1, wKm / 2 / cellKm), ri = Math.ceil(rc);
        for (let dj = -ri; dj <= ri; dj++) for (let di = -ri; di <= ri; di++) {
          const x = i + di, y = j + dj; if (x < 0 || y < 0 || x >= R || y >= R) continue;
          const t = Math.hypot(di, dj) / rc; if (t >= 1) continue;
          const q = y * R + x, v = -0.32 * (1 - t * t) - 0.02; if (v < d.land[q]) d.land[q] = v;
        }
        carved++;
      }
    }
    if (!carved) break;
  }
  const L = label();
  for (let c = 0; c < n; c++) { const k = comp[c]; if (k >= 0 && k !== L.big && !(L.edge[k] && L.sizes[k] * cellKm * cellKm >= 3)) { d.land[c] = 0.35; d.h0[c] = 4 + 3 * Math.min(1, -Math.min(0, d.h0[c]) / 40); } }
  // drown specks of land: an island has to be a couple of square kilometres at least
  comp.fill(-1);
  for (let s0 = 0; s0 < n; s0++) {
    if (d.land[s0] < 0 || comp[s0] >= 0) continue;
    let sp = 0, cnt = 0; stack[sp++] = s0; comp[s0] = 1; const first = cnt;
    const cells = [];
    while (sp) {
      const c = stack[--sp], i = c % R, j = (c / R) | 0; cnt++; if (cells.length < 9000) cells.push(c);
      if (i > 0 && d.land[c - 1] >= 0 && comp[c - 1] < 0) { comp[c - 1] = 1; stack[sp++] = c - 1; }
      if (i < R - 1 && d.land[c + 1] >= 0 && comp[c + 1] < 0) { comp[c + 1] = 1; stack[sp++] = c + 1; }
      if (j > 0 && d.land[c - R] >= 0 && comp[c - R] < 0) { comp[c - R] = 1; stack[sp++] = c - R; }
      if (j < R - 1 && d.land[c + R] >= 0 && comp[c + R] < 0) { comp[c + R] = 1; stack[sp++] = c + R; }
    }
    if (cnt * cellKm * cellKm < 2.2 && cnt <= cells.length) for (const c of cells) d.land[c] = -0.25;
  }
}
