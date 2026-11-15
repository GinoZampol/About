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

// Crust velocity at a point of (warped) space: plate velocities blended over a width `sig` at the boundaries.
function velocity(L, x, y, sig, out) {
  let d1 = 1e9; const P = L.plates, n = P.length, d = L._d;
  for (let k = 0; k < n; k++) { d[k] = Math.hypot(x - P[k][0], y - P[k][1]); if (d[k] < d1) d1 = d[k]; }
  let w = 0, vx = 0, vy = 0;
  for (let k = 0; k < n; k++) { const e = Math.exp(-(d[k] - d1) / sig); w += e; vx += e * P[k][2]; vy += e * P[k][3]; }
  out[0] = vx / w; out[1] = vy / w;
}
// convergence = -div(v): positive where crust piles up, negative where it is pulled apart
function convergence(L, x, y, sig) {
  const h = 0.4, a = L._a, b = L._b;
  velocity(L, x + h, y, sig, a); velocity(L, x - h, y, sig, b); let c = a[0] - b[0];
  velocity(L, x, y + h, sig, a); velocity(L, x, y - h, sig, b); c += a[1] - b[1];
  return -c / (2 * h) * sig;                       // times sig: independent of the blending width
}
// tectonic fields at a point
function fields(L, xk, yk) {
  const seed = L.seed;
  const sx = xk + 3.2 * fbm(xk / 19, yk / 19, 3, seed + 11) + 1.1 * fbm(xk / 6, yk / 6, 3, seed + 12) + 0.3 * fbm(xk / 1.9, yk / 1.9, 2, seed + 15);
  const sy = yk + 3.2 * fbm(xk / 19, yk / 19, 3, seed + 13) + 1.1 * fbm(xk / 6, yk / 6, 3, seed + 14) + 0.3 * fbm(xk / 1.9, yk / 1.9, 2, seed + 16);
  const cN = Math.min(1.2, convergence(L, sx, sy, 2.2) * L.norm), cW = Math.max(-1.2, Math.min(1.2, convergence(L, sx, sy, 5.5) * L.norm));   // range core, and the broad belt around it
  // along-strike variety: summits and passes
  const m = Math.max(0, cN) * (0.62 + 0.5 * fbm(xk / 8, yk / 8, 2, seed + 21) + 0.16 * noise2(xk / 2.4, yk / 2.4, seed + 22));
  const gC = Math.max(0, m - 0.5) * 1.6, gA = Math.min(m, 0.5);
  const gHl = 0.3 * Math.max(0, cW) * (1 - sat(m * 1.6)) * (0.6 + 0.6 * smoothstep(-0.3, 0.4, fbm(xk / 7, yk / 7, 3, seed + 23)));
  const rift = Math.max(0, -cW);
  return { sx, sy, rr: Math.hypot(sx - L.hot[0], sy - L.hot[1]), gC, gA, gHl, rift };
}
// elevation tendency: rifts and the spreading centre sink, ranges and their belts rise, broad swells do the rest
function tendency(L, xk, yk, f) {
  const seed = L.seed;
  return 0.6 * (smoothstep(2, 21, f.rr) - 0.5) - 0.8 * f.rift + 0.72 * fbm(xk / 15, yk / 15, 4, seed + 61) + 0.32 * fbm(xk / 5.5, yk / 5.5, 3, seed + 62)
    + 0.1 * fbm(xk / 1.7, yk / 1.7, 3, seed + 63) + 1.3 * (f.gC + f.gA) + 1.6 * f.gHl;
}

let cache = null;
export function getLayout(seed) {
  if (cache && cache.seed === seed) return cache;
  const r = mulberry32((Math.imul(seed | 0, 2654435761) ^ 0x9e3779b9) >>> 0);
  // a spreading centre lies somewhere under the middle of the world: plates drift away from it, each with
  // its own extra motion, so the middle is pulled apart (sea) and the plates collide further out (ranges)
  const L = { seed, plates: [], hot: [25 + (r() - 0.5) * 8, 25 + (r() - 0.5) * 8], norm: 1, _a: [0, 0], _b: [0, 0] };
  for (let k = 0, n = 7 + Math.floor(r() * 3); k < n; k++) {
    const x = -4 + r() * 58, y = -4 + r() * 58, dl = Math.hypot(x - L.hot[0], y - L.hot[1]) || 1, a = r() * Math.PI * 2, v = 0.55 + 0.5 * r();
    L.plates.push([x, y, 0.45 * (x - L.hot[0]) / dl + Math.cos(a) * v, 0.45 * (y - L.hot[1]) / dl + Math.sin(a) * v]);
  }
  L._d = new Float64Array(L.plates.length);
  const G = 96, at = (i) => (i + 0.5) / G * 50;
  // the hardest collision in this world sets the scale: it becomes the great range
  // (the 98th percentile rather than the single highest sample, so one sharp corner does not dwarf everything else)
  const cs = []; for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) cs.push(convergence(L, at(i), at(j), 2.2));
  cs.sort((p, q) => p - q); L.norm = 1 / Math.max(1e-6, cs[Math.floor(cs.length * 0.98)]);
  // sea level: the quantile of the tendency field that leaves the chosen share of the world under water
  const seaShare = 0.24 + r() * 0.08, E = new Float32Array(G * G);
  let best = [25, 25, 0], bestA = [25, 25, 0];
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
    const xk = at(i), yk = at(j), f = fields(L, xk, yk); E[j * G + i] = tendency(L, xk, yk, f);
    if (f.gC > best[2]) best = [xk, yk, f.gC];
  }
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {     // the finest range well away from the great one
    const xk = at(i), yk = at(j), f = fields(L, xk, yk), sc = f.gA * smoothstep(8, 16, Math.hypot(xk - best[0], yk - best[1])); if (sc > bestA[2]) bestA = [xk, yk, sc];
  }
  L.T = Float32Array.from(E).sort()[Math.floor(seaShare * G * G)];
  let cx = 0, cy = 0, cn = 0;
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) if (E[j * G + i] < L.T) { cx += at(i); cy += at(j); cn++; }
  L.c = [cx / cn, cy / cn]; L.massif = best; L.alpsCentre = bestA;
  // the tableland: the interior of the plate that lies farthest from the sea and from the great range
  let pb = 0, ps = -1e9;
  L.plates.forEach((p, k) => { if (p[0] < 5 || p[0] > 45 || p[1] < 5 || p[1] > 45) return; const sc = Math.hypot(p[0] - L.c[0], p[1] - L.c[1]) + 0.6 * Math.hypot(p[0] - best[0], p[1] - best[1]) - (tendency(L, p[0], p[1], fields(L, p[0], p[1])) < L.T + 0.4 ? 100 : 0); if (sc > ps) { ps = sc; pb = k; } });
  const P = L.plates[pb], tc = Math.hypot(L.c[0] - P[0], L.c[1] - P[1]) || 1, ux = (L.c[0] - P[0]) / tc, uy = (L.c[1] - P[1]) / tc, sgn = r() < 0.5 ? 1 : -1;
  L.table = { plate: pb, x: P[0], y: P[1], rad: 4.8 + r() * 1.2 };
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
