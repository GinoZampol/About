// Seed-driven world layout ("variant S"). Nothing is placed by hand: the seed decides where the ocean
// sits, which way its strait opens, and at what bearing around it the great massif, the alpine peaks,
// the mesa country, the hills and the sand sea lie. Features are arranged around the central ocean by
// compass bearing, never in parallel strips. The same seed always gives the same layout.
import { noise2, fbm, ridged, smoothstep, sat, hash2, mulberry32 } from '../shared/noise.mjs';
import { ROCK } from '../shared/geology.mjs';

const TAU = Math.PI * 2;
const gauss = (d, s) => Math.exp(-(d * d) / (2 * s * s));
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  let t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy + 1e-9);
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return [Math.hypot(ax + dx * t - px, ay + dy * t - py), t];
}

let cache = null;
export function getLayout(seed) {
  if (cache && cache.seed === seed) return cache;
  const r = mulberry32((Math.imul(seed | 0, 2654435761) ^ 0x9e3779b9) >>> 0);
  const c = [25 + (r() - 0.5) * 5, 25 + (r() - 0.5) * 5], R = 8.2 + r() * 1.6;
  const at = (b, d) => [c[0] + Math.cos(b) * d, c[1] + Math.sin(b) * d];
  // five things share the horizon around the ocean; their order and bearings come from the seed
  const slots = ['massif', 'mesa', 'alps', 'hills', 'gate'];
  for (let k = slots.length - 1; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [slots[k], slots[j]] = [slots[j], slots[k]]; }
  const t0 = r() * TAU, dir = r() < 0.5 ? 1 : -1, bearing = {};
  slots.forEach((s, k) => { bearing[s] = t0 + dir * (k / slots.length) * TAU + (r() - 0.5) * 0.45; });

  const mp = at(bearing.massif, 16.5 + r() * 3), ma = r() * Math.PI;
  const massif = [mp[0] - Math.cos(ma) * 2, mp[1] - Math.sin(ma) * 2, mp[0] + Math.cos(ma) * 2, mp[1] + Math.sin(ma) * 2];
  const ac = at(bearing.alps, 15.5 + r() * 3.5), peaks = [];
  for (let k = 0, n = 3 + Math.floor(r() * 2); k < n; k++) { const a = r() * TAU, d = k === 0 ? 0 : 2.6 + r() * 2.4; peaks.push([ac[0] + Math.cos(a) * d, ac[1] + Math.sin(a) * d, 2.5 + r() * 1.1, 0.72 + r() * 0.3]); }
  const hills = [];
  for (let k = 0; k < 3; k++) { const p = at(bearing.hills + (k - 1) * 0.42 + (r() - 0.5) * 0.2, 12.5 + r() * 7); hills.push([p[0], p[1], 3 + r() * 1.6, 0.16 + r() * 0.1]); }
  const hw = 0.85 + r() * 0.3, Rin = R + 4.5 + r() * 2, sgn = r() < 0.5 ? 1 : -1;
  const islands = [];
  for (let k = 0, n = 4 + Math.floor(r() * 3); k < n; k++) { const p = at(r() * TAU, R * (0.22 + 0.5 * r())); islands.push([p[0], p[1], 0.5 + r() * 0.95]); }
  cache = {
    seed, c, R, bearing, order: slots, massif, peaks, alpsCentre: ac, hills,
    mesa: { b: bearing.mesa, hw, Rin },
    gate: { b: bearing.gate, Dout: 19 + r() * 2.5 },
    islands,
    sand: [...at(bearing.mesa + sgn * hw * 0.45, Rin + 9 + r() * 3), 4.2 + r() * 1.5, 5.5 + r() * 2],
    badlands: [...at(bearing.mesa - sgn * hw * 0.5, Rin + 6.5 + r() * 2), 3 + r(), 3.6 + r()],
    mouth: at(bearing.mesa, Rin + 1.5),
    gorge: [at(bearing.mesa, Rin + 4.5), at(bearing.mesa + (r() - 0.5) * 0.12, Rin), at(bearing.mesa, R + 0.5)],
  };
  return cache;
}

export function seededDesign(xk, yk, seed) {
  const L = getLayout(seed), c = L.c;
  const wx = xk + 1.25 * fbm(xk / 9, yk / 9, 3, seed + 11) + 0.32 * fbm(xk / 2.1, yk / 2.1, 3, seed + 12);
  const wy = yk + 1.25 * fbm(xk / 9, yk / 9, 3, seed + 13) + 0.32 * fbm(xk / 2.1, yk / 2.1, 3, seed + 14);
  const sx = wx + 0.6 * fbm(xk / 1.3, yk / 1.3, 3, seed + 16) + 0.7 * noise2(xk / 3.7, yk / 3.7, seed + 26), sy = wy + 0.6 * fbm(xk / 1.3, yk / 1.3, 3, seed + 17) + 0.7 * noise2(xk / 3.7, yk / 3.7, seed + 27);
  const dxc = sx - c[0], dyc = sy - c[1], rr = Math.hypot(dxc, dyc), th = Math.atan2(dyc, dxc);

  // ---- land / sea: the central ocean, its strait, and the outer ocean beyond it ----------------
  const Rloc = L.R * (1 + 0.28 * fbm(xk / 8, yk / 8, 3, seed + 61) + 0.1 * fbm(xk / 2.6, yk / 2.6, 2, seed + 62));
  let land = rr - Rloc;
  const gx = Math.cos(L.gate.b), gy = Math.sin(L.gate.b), ug = dxc * gx + dyc * gy;
  land = Math.min(land, L.gate.Dout - ug + 2.4 * fbm(xk / 6, yk / 6, 3, seed + 63));
  { const [d] = segDist(sx, sy, c[0] + gx * (L.R - 2), c[1] + gy * (L.R - 2), c[0] + gx * (L.gate.Dout + 2), c[1] + gy * (L.gate.Dout + 2)); land = Math.min(land, d - (1.35 + 0.5 * noise2(xk / 3, yk / 3, seed + 64))); }
  land += 0.16 * fbm(xk / 0.55, yk / 0.55, 3, seed + 18) + 0.5 * Math.max(0, fbm(xk / 3.3, yk / 3.3, 2, seed + 19)) * Math.exp(-Math.abs(land) / 1.5) * (land > -1 ? -1 : 0);
  for (let k = 0; k < L.islands.length; k++) {
    const i = L.islands[k], ang = hash2(k, 3, seed + 151) * Math.PI, asp = 1.25 + 0.55 * hash2(k, 5, seed + 152);
    const dx = sx - i[0], dy = sy - i[1], ca = Math.cos(ang), sa = Math.sin(ang);
    const d = Math.hypot((dx * ca + dy * sa) / asp, (-dx * sa + dy * ca) * asp);
    land = Math.max(land, i[2] * (1 + 0.42 * fbm(xk / (i[2] * 1.6) + k * 7.3, yk / (i[2] * 1.6), 3, seed + 153) + 0.16 * noise2(xk / (i[2] * 0.35), yk / (i[2] * 0.35), seed + 154)) - d);
  }

  // ---- structure ---------------------------------------------------------------------------------
  const [dCr, tCr] = segDist(wx, wy, L.massif[0], L.massif[1], L.massif[2], L.massif[3]);
  const gC = gauss(dCr, 5.4) * (0.86 + 0.26 * noise2(tCr * 1.2, 5.3, seed + 28) + 0.1 * noise2(xk / 1.6, yk / 1.6, seed + 29));
  // separate alpine peaks with real cols between them, not a wall
  let gA = 0; for (const p of L.peaks) gA = Math.max(gA, p[3] * gauss(Math.hypot(wx - p[0], wy - p[1]), p[2]));
  gA *= 0.9 + 0.22 * noise2(xk / 2.2, yk / 2.2, seed + 36);
  let gHl = 0; for (const p of L.hills) gHl += p[3] * gauss(Math.hypot(wx - p[0], wy - p[1]), p[2]);
  let aw = Math.abs(th - L.mesa.b) % TAU; if (aw > Math.PI) aw = TAU - aw;
  const plateau = smoothstep(L.mesa.hw + 0.14, L.mesa.hw - 0.14, aw + 0.17 * fbm(xk / 5, yk / 5, 2, seed + 65))
    * smoothstep(L.mesa.Rin, L.mesa.Rin + 3.2, rr + 1.3 * noise2(xk / 4, yk / 4, seed + 66)) * (1 - smoothstep(0.08, 0.4, gC)) * (1 - smoothstep(0.06, 0.3, gA));
  let dG = 1e9; for (let k = 0; k < L.gorge.length - 1; k++) dG = Math.min(dG, segDist(xk + 0.35 * noise2(xk / 3, yk / 3, seed + 23), yk + 0.5 * noise2(xk / 3.5, yk / 3.5, seed + 24), L.gorge[k][0], L.gorge[k][1], L.gorge[k + 1][0], L.gorge[k + 1][1])[0]);
  const gG = gauss(dG, 1.05), dGM = Math.hypot(xk - L.mouth[0], yk - L.mouth[1]);

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
    const notch = 105 + 40 * Math.max(0, rr - (L.R + 1.5));
    h0 = Math.max(1.5, h0 + (Math.min(h0, notch) - h0) * Math.sqrt(gG));
  }

  // ---- lithology ---------------------------------------------------------------------------------
  let rock = ROCK.ALLUVIUM;
  const wob = 0.9 * noise2(xk / 2.6, yk / 2.6, seed + 41);
  if (plateau > 0.5) rock = ROCK.SANDSTONE;
  else if (gC > 0.1) rock = dCr + wob < 2.7 ? ROCK.GRANITE : ROCK.SCHIST;
  else if (gA > 0.1) rock = gA > 0.4 ? ROCK.GRANITE : ROCK.SCHIST;
  else if (gHl > 0.05) rock = ROCK.GREYWACKE;
  else if (rr > L.R + 7 + 2 * wob) rock = fbm(xk / 9, yk / 9, 2, seed + 42) > 0 ? ROCK.SCHIST : ROCK.GREYWACKE;
  const bl = L.badlands, badl = plateau > 0.5 && Math.hypot((wx - bl[0]) / bl[2], (wy - bl[1]) / bl[3]) + 0.5 * fbm(xk / 1.4, yk / 1.4, 3, seed + 46) < 1;
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
