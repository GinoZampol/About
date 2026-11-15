// Seed-driven world layout ("variant S"). Nothing is placed by hand. The seed gives a handful of crustal
// plates with drift directions; where two plates converge a range rises along their (warped) boundary,
// with foothills falling away on both flanks; where they part the land stays low. A broad basin field
// that deepens toward the middle of the map, plus the ranges, gives the elevation tendency; the sea is
// simply everything below a level chosen so that about a quarter of the world is water. Coasts, islands,
// plains and hill country are whatever that field happens to produce. The same seed gives the same world.
import { noise2, fbm, ridged, smoothstep, sat, mulberry32 } from '../shared/noise.mjs';
import { ROCK } from '../shared/geology.mjs';

const gauss = (d, s) => Math.exp(-(d * d) / (2 * s * s));
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  let t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy + 1e-9);
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return [Math.hypot(ax + dx * t - px, ay + dy * t - py), t];
}

// tectonic fields at a point: range strengths by rank, plate id, distance to the nearest plate boundary
function fields(L, xk, yk) {
  const seed = L.seed;
  const sx = xk + 3.2 * fbm(xk / 19, yk / 19, 3, seed + 11) + 1.1 * fbm(xk / 6, yk / 6, 3, seed + 12) + 0.3 * fbm(xk / 1.9, yk / 1.9, 2, seed + 15);
  const sy = yk + 3.2 * fbm(xk / 19, yk / 19, 3, seed + 13) + 1.1 * fbm(xk / 6, yk / 6, 3, seed + 14) + 0.3 * fbm(xk / 1.9, yk / 1.9, 2, seed + 16);
  let i1 = 0, i2 = 0, d1 = 1e9, d2 = 1e9, d3 = 1e9;
  for (let k = 0; k < L.plates.length; k++) { const d = Math.hypot(sx - L.plates[k][0], sy - L.plates[k][1]); if (d < d1) { d3 = d2; d2 = d1; i2 = i1; d1 = d; i1 = k; } else if (d < d2) { d3 = d2; d2 = d; i2 = k; } else if (d < d3) d3 = d; }
  const db = (d2 - d1) / 2, key = i1 < i2 ? i1 * 16 + i2 : i2 * 16 + i1;
  // the basin is not a circle: its centre distance is measured in strongly warped space
  const bx = xk + 7 * fbm(xk / 26, yk / 26, 3, seed + 17) + 2.5 * fbm(xk / 9, yk / 9, 3, seed + 18), by = yk + 7 * fbm(xk / 26, yk / 26, 3, seed + 19) + 2.5 * fbm(xk / 9, yk / 9, 3, seed + 20);
  const rr = Math.hypot((bx - 25) * L.sq[0] + (by - 25) * L.sq[1], (by - 25) * L.sq[2] + (bx - 25) * L.sq[1]), inner = smoothstep(4, 11, rr);
  let gC = 0, gA = 0, gHl = 0;
  const amp = L.amp ? L.amp.get(key) : 0;
  if (amp) {                                 // a range fades toward a triple junction, leaving a pass there
    const strike = smoothstep(-0.5, 0.05, fbm(xk / 10 + key, yk / 10, 2, seed + 21)) * (0.78 + 0.3 * noise2(xk / 2.4, yk / 2.4, seed + 22)) * inner * smoothstep(0, 2.6, (d3 - d2) / 2);
    const rank = L.rank.get(key);
    if (rank === 0) gC = (0.8 * gauss(db, 4.0) + 0.2 * gauss(db, 8.5)) * strike;
    else if (rank <= 2) gA = amp * (0.75 * gauss(db, 2.5) + 0.25 * gauss(db, 5.5)) * strike;
    else gHl = amp * gauss(db, 3.4) * strike;
  }
  // foothills: every range stands in a broad apron of hill country
  gHl += 0.2 * gC * (1 - gC) + 0.25 * gA * (1 - gA) + 0.15 * smoothstep(0.1, 0.6, fbm(xk / 9, yk / 9, 3, seed + 23)) * inner * gauss(db, 9);
  return { sx, sy, i1, db, key, rr, gC, gA, gHl };
}
function tendency(L, xk, yk, f) {
  const seed = L.seed;
  return 0.8 * (smoothstep(2, 22, f.rr) - 0.5) + 0.8 * fbm(xk / 15, yk / 15, 4, seed + 61) + 0.26 * fbm(xk / 5.5, yk / 5.5, 3, seed + 62)
    + 0.07 * fbm(xk / 1.7, yk / 1.7, 3, seed + 63) + 1.3 * (f.gC + f.gA) + 1.6 * f.gHl;
}

let cache = null;
export function getLayout(seed) {
  if (cache && cache.seed === seed) return cache;
  const r = mulberry32((Math.imul(seed | 0, 2654435761) ^ 0x9e3779b9) >>> 0);
  const L = { seed, plates: [] };
  { const a = r() * Math.PI, e = 1.15 + r() * 0.45; L.sq = [Math.cos(a) / e, Math.sin(a) / e, Math.cos(a) * e]; L.sq = [Math.cos(a) * Math.cos(a) / e + Math.sin(a) * Math.sin(a) * e, Math.cos(a) * Math.sin(a) * (1 / e - e), Math.sin(a) * Math.sin(a) / e + Math.cos(a) * Math.cos(a) * e]; }
  for (let k = 0, n = 6 + Math.floor(r() * 3); k < n; k++) { const a = r() * Math.PI * 2, v = 0.45 + 0.55 * r(); L.plates.push([-4 + r() * 58, -4 + r() * 58, Math.cos(a) * v, Math.sin(a) * v]); }
  // which plate pairs actually share a boundary on land, and how hard they converge there
  const G = 96, score = new Map(), samp = [];
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
    const xk = (i + 0.5) / G * 50, yk = (j + 0.5) / G * 50, f = fields(L, xk, yk); samp.push(f);
    if (f.db < 2.5 && f.rr > 9) score.set(f.key, (score.get(f.key) || 0) + 1);
  }
  const pairs = [];
  for (const [key, cnt] of score) {
    const a = L.plates[key >> 4], b = L.plates[key & 15], nx = b[0] - a[0], ny = b[1] - a[1], nl = Math.hypot(nx, ny) || 1;
    const conv = ((a[2] - b[2]) * nx + (a[3] - b[3]) * ny) / nl;
    if (conv > 0.1 && cnt > 30) pairs.push([key, conv * Math.sqrt(cnt), conv]);
  }
  pairs.sort((p, q) => q[1] - p[1]);
  L.amp = new Map(); L.rank = new Map();
  pairs.forEach((p, k) => { L.rank.set(p[0], k); L.amp.set(p[0], k === 0 ? 1 : k === 1 ? 0.66 : k === 2 ? 0.5 : 0.2 + 0.08 * sat(p[2])); });
  // sea level: the quantile of the tendency field that leaves the chosen share of the world under water
  const seaShare = 0.22 + r() * 0.07, E = new Float32Array(G * G);
  let best = [0, 0, 0], bestA = [0, 0, 0];
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
    const xk = (i + 0.5) / G * 50, yk = (j + 0.5) / G * 50, f = fields(L, xk, yk); E[j * G + i] = tendency(L, xk, yk, f);
    if (f.gC > best[2]) best = [xk, yk, f.gC]; if (f.gA > bestA[2]) bestA = [xk, yk, f.gA];
  }
  L.T = Float32Array.from(E).sort()[Math.floor(seaShare * G * G)];
  let cx = 0, cy = 0, cn = 0;
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) if (E[j * G + i] < L.T) { cx += (i + 0.5) / G * 50; cy += (j + 0.5) / G * 50; cn++; }
  L.c = [cx / cn, cy / cn]; L.massif = best; L.alpsCentre = bestA;
  // the tableland: the interior of the plate that lies farthest from the sea and from the great range
  let pb = 0, ps = -1e9;
  L.plates.forEach((p, k) => { if (p[0] < 5 || p[0] > 45 || p[1] < 5 || p[1] > 45) return; const sc = Math.hypot(p[0] - L.c[0], p[1] - L.c[1]) + 0.6 * Math.hypot(p[0] - best[0], p[1] - best[1]) - (tendency(L, p[0], p[1], fields(L, p[0], p[1])) < L.T + 0.4 ? 100 : 0); if (sc > ps) { ps = sc; pb = k; } });
  const P = L.plates[pb], tc = Math.hypot(L.c[0] - P[0], L.c[1] - P[1]) || 1, ux = (L.c[0] - P[0]) / tc, uy = (L.c[1] - P[1]) / tc, sgn = r() < 0.5 ? 1 : -1;
  L.table = { plate: pb, x: P[0], y: P[1], rad: 6.2 + r() * 1.6 };
  L.mouth = [P[0] + ux * (L.table.rad + 0.5), P[1] + uy * (L.table.rad + 0.5)];
  L.gorge = [[P[0] + ux * 1.5, P[1] + uy * 1.5], [P[0] + ux * (L.table.rad - 1.5) - uy * (r() - 0.5) * 2, P[1] + uy * (L.table.rad - 1.5) + ux * (r() - 0.5) * 2], [P[0] + ux * (L.table.rad + 4), P[1] + uy * (L.table.rad + 4)]];
  L.sand = [P[0] - ux * 2.2 - uy * sgn * 2.2, P[1] - uy * 2.2 + ux * sgn * 2.2, 2.4 + r() * 0.8, 3.0 + r() * 0.9];
  L.badlands = [P[0] + uy * sgn * 3.4, P[1] - ux * sgn * 3.4, 2 + r() * 0.6, 2.4 + r() * 0.7];
  return (cache = L);
}

export function seededDesign(xk, yk, seed) {
  const L = getLayout(seed), f = fields(L, xk, yk), { sx, sy, gC, gA, gHl } = f;
  // ---- land / sea: whatever lies below the level is sea ------------------------------------------
  const land = (tendency(L, xk, yk, f) - L.T) * 13;
  // ---- the tableland ---------------------------------------------------------------------------
  const T = L.table, dT = Math.hypot(sx - T.x, sy - T.y) + 1.6 * fbm(xk / 4.5, yk / 4.5, 3, seed + 65);
  const plateau = smoothstep(T.rad, T.rad - 2.2, dT) * smoothstep(0.5, 2.5, land) * (1 - smoothstep(0.08, 0.4, gC)) * (1 - smoothstep(0.06, 0.3, gA));
  let dG = 1e9; for (let k = 0; k < L.gorge.length - 1; k++) dG = Math.min(dG, segDist(sx + 0.35 * noise2(xk / 3, yk / 3, seed + 23), sy + 0.5 * noise2(xk / 3.5, yk / 3.5, seed + 24), L.gorge[k][0], L.gorge[k][1], L.gorge[k + 1][0], L.gorge[k + 1][1])[0]);
  const gG = gauss(dG, 1.05) * smoothstep(0, 0.3, plateau + gauss(Math.hypot(sx - L.mouth[0], sy - L.mouth[1]), 3)), dGM = Math.hypot(sx - L.mouth[0], sy - L.mouth[1]);

  // ---- uplift ----------------------------------------------------------------------------------
  let U = 0.012 + 0.034 * smoothstep(0.1, 0.65, fbm(xk / 7.5, yk / 7.5, 3, seed + 31)) * (1 - plateau);
  U += gHl + 2.0 * gA + 2.5 * gC + 0.05 * plateau;
  U += 0.012 * (0.5 + 0.5 * noise2(xk / 1.1, yk / 1.1, seed + 35)) * (1 - plateau);
  U += 0.06 * ridged(xk / 3.2, yk / 3.2, 3, seed + 32) * (0.3 + gA + gHl * 3);
  U *= 1 - 0.86 * gG;
  U *= 0.12 + 0.88 * smoothstep(0.0, 0.7, land);

  // ---- initial surface -------------------------------------------------------------------------
  let h0;
  if (land < 0) h0 = -Math.min(260, 3 + 55 * Math.pow(-land, 1.3));
  else {
    h0 = 6 + 24 * sat(land / 3) + 600 * gHl + 1800 * gA + 2600 * gC + 12 * fbm(xk / 2, yk / 2, 3, seed + 33);
    h0 += plateau * (1100 + 10 * dGM + 45 * fbm(xk / 5, yk / 5, 3, seed + 34));
    const notch = 105 + 40 * Math.max(0, dGM - 1);
    h0 = Math.max(1.5, h0 + (Math.min(h0, notch) - h0) * Math.sqrt(gG));
  }

  // ---- lithology ---------------------------------------------------------------------------------
  let rock = ROCK.ALLUVIUM;
  const wob = 0.9 * noise2(xk / 2.6, yk / 2.6, seed + 41);
  if (plateau > 0.5) rock = ROCK.SANDSTONE;
  else if (gC > 0.1) rock = gC > 0.5 + 0.12 * wob ? ROCK.GRANITE : ROCK.SCHIST;
  else if (gA > 0.1) rock = gA > 0.4 ? ROCK.GRANITE : ROCK.SCHIST;
  else if (gHl > 0.05) rock = ROCK.GREYWACKE;
  else if (land > 7 + 2 * wob) rock = fbm(xk / 9, yk / 9, 2, seed + 42) > 0 ? ROCK.SCHIST : ROCK.GREYWACKE;
  const wx = sx, wy = sy, bl = L.badlands, badl = plateau > 0.5 && Math.hypot((wx - bl[0]) / bl[2], (wy - bl[1]) / bl[3]) + 0.5 * fbm(xk / 1.4, yk / 1.4, 3, seed + 46) < 1;
  if (badl) rock = ROCK.SHALE;
  let kmod = 1;
  if (rock === ROCK.GREYWACKE) kmod = 0.8 + 0.6 * sat(0.5 + 0.9 * noise2(xk / 2.3, yk / 2.3, seed + 47));
  if (rock === ROCK.SCHIST) kmod = 0.85 + 0.4 * sat(0.5 + noise2(xk / 1.7, yk / 1.7, seed + 43));
  if (rock === ROCK.SANDSTONE) kmod = 0.3;
  if (badl) kmod = 0.7;
  const strat = 6 * dGM + 70 * fbm(xk / 8, yk / 8, 2, seed + 44) + 14 * noise2(xk / 1.2, yk / 1.2, seed + 45);
  const sd = L.sand, erg = plateau * smoothstep(1.2, 0.3, Math.hypot((wx - sd[0]) / sd[2], (wy - sd[1]) / sd[3]) + 0.28 * fbm(xk / 1.6, yk / 1.6, 2, seed + 48));
  return { land, U: U * 1e-3, h0, rock, kmod, strat, gG, plateau, erg };
}
