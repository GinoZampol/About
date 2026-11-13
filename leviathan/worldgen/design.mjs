// Geographic design of the world: the large-scale tectonic and structural template.
// Everything here is an analytic field over (x east, y north) in kilometres; erosion does the rest.
//
// Composition (a convergent-margin transect, west to east):
//   Ocean -> Coast Range -> Central Valley -> the Spine (alpine arc + stratovolcano) -> high desert Plateau
// with a glacially scoured marine Sound entering from the north-west, a Northern Highlands arc
// around it, and one antecedent river (the Great River) crossing the Spine through a gorge.
import { noise2, fbm, ridged, smoothstep, sat, clamp } from '../shared/noise.mjs';
import { ROCK } from '../shared/geology.mjs';

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

export function designAt(xk, yk, seed) {
  // domain warp so nothing follows a ruler
  const wx = xk + 1.25 * fbm(xk / 9, yk / 9, 3, seed + 11) + 0.32 * fbm(xk / 2.1, yk / 2.1, 3, seed + 12);
  const wy = yk + 1.25 * fbm(xk / 9, yk / 9, 3, seed + 13) + 0.32 * fbm(xk / 2.1, yk / 2.1, 3, seed + 14);

  // ---- land / sea -------------------------------------------------------------------------
  const xc = 5.0 + 1.3 * Math.sin(wy / 6.5 + 0.8) + 0.7 * Math.sin(wy / 2.7 + 2.0);
  let land = wx - xc;
  const sx = wx + 0.6 * fbm(xk / 1.3, yk / 1.3, 3, seed + 16) + 0.7 * noise2(xk / 3.7, yk / 3.7, seed + 26), sy = wy + 0.6 * fbm(xk / 1.3, yk / 1.3, 3, seed + 17) + 0.7 * noise2(xk / 3.7, yk / 3.7, seed + 27);
  for (const pl of SOUND) for (let q = 0; q < pl.length - 1; q++) {
    const a = pl[q], b = pl[q + 1];
    const [d, t] = segDist(sx, sy, a[0], a[1], b[0], b[1]);
    land = Math.min(land, d - (a[2] + (b[2] - a[2]) * t));
  }
  land += 0.16 * fbm(xk / 0.55, yk / 0.55, 3, seed + 18) + 0.5 * Math.max(0, fbm(xk / 3.3, yk / 3.3, 2, seed + 19)) * Math.exp(-Math.abs(land) / 1.5) * (land > -1 ? -1 : 0);
  for (const c of ISLANDS) land = Math.max(land, c[2] - Math.hypot(wx - c[0], wy - c[1]) * (1 + 0.25 * noise2(xk * 1.3, yk * 1.3, seed + 15)));

  // ---- structural elements ------------------------------------------------------------------
  let [dS, sS] = polyDist(wx, wy, SPINE);
  const [dN] = polyDist(wx, wy, SPINE_N);
  const northBranch = dN < dS;
  if (northBranch) { dS = dN; sS = 20; }
  // amplitude along the arc: full alpine height in the main N-S section, lower in the highland arc
  let ampS = northBranch ? 0.86 : 1.0 - 0.5 * smoothstep(38, 50, sS);
  ampS *= 0.94 + 0.14 * noise2(sS / 5.5, 3.7, seed + 21) + 0.07 * noise2(sS / 1.9, 9.1, seed + 22);
  const gS = gauss(dS, 4.8 - 1.2 * smoothstep(38, 50, sS));
  const [dG] = polyDist(xk + 0.35 * noise2(xk / 3, yk / 3, seed + 23), yk + 0.5 * noise2(xk / 3.5, yk / 3.5, seed + 24), GORGE);
  const gG = gauss(dG, 1.05);

  const xcr = 9.6 + 1.0 * Math.sin(wy / 6.0);
  const gCR = gauss(wx - xcr, 2.5) * (1 - smoothstep(29.5, 34, wy)) * (0.75 + 0.35 * noise2(wy / 4.5, 1.3, seed + 25));
  const plateau = smoothstep(38.2, 41.2, wx);
  const dGorgeMouth = Math.hypot(xk - 43.5, yk - 23.2);

  // ---- uplift (mm/yr) -------------------------------------------------------------------------
  let U = 0.012 + 0.034 * smoothstep(0.1, 0.65, fbm(xk / 7.5, yk / 7.5, 3, seed + 31)) * (1 - plateau);
  U += 0.27 * gCR;
  U += 1.02 * gS * ampS * (1 - 0.75 * plateau);    // the chain ends where the resistant plateau begins
  U += 0.05 * plateau + 0.10 * smoothstep(47.3, 50, wx) + 0.08 * smoothstep(47.5, 50, wy) * plateau;
  U += 0.012 * (0.5 + 0.5 * noise2(xk / 1.1, yk / 1.1, seed + 35)) * (1 - plateau);
  U += 0.24 * smoothstep(3.2, 0, wy) * smoothstep(8, 12, wx);
  U += 0.30 * gauss(Math.hypot(wx - 20.4, wy - 13.6), 0.85);          // the Tor: a granite monadnock in the valley
  U += 0.06 * ridged(xk / 3.2, yk / 3.2, 3, seed + 32) * (0.3 + gS + gCR);
  U *= 1 - 0.86 * gG;
  // wave and ice planation: skerries and the immediate shore zone do not build relief
  U *= 0.12 + 0.88 * smoothstep(0.0, 0.7, land);

  // ---- initial surface ------------------------------------------------------------------------
  let h0;
  if (land < 0) h0 = -Math.min(260, 3 + 55 * Math.pow(-land, 1.3));
  else {
    h0 = 6 + 24 * sat(land / 3) + 190 * gCR + 950 * gS * ampS + 12 * fbm(xk / 2, yk / 2, 3, seed + 33);
    h0 += plateau * (1100 + 10 * dGorgeMouth + 45 * fbm(xk / 5, yk / 5, 3, seed + 34));
    const notch = 105 + 40 * Math.max(0, xk - 28);
    h0 = h0 + (Math.min(h0, notch) - h0) * Math.sqrt(gG);
    h0 = Math.max(h0, 1.5);
  }

  // ---- lithology ------------------------------------------------------------------------------
  let rock = ROCK.ALLUVIUM;
  const wob = 0.9 * noise2(xk / 2.6, yk / 2.6, seed + 41);
  if (plateau > 0.5) rock = ROCK.SANDSTONE;
  else if (gS > 0.08) {
    const side = wx - (33.5 + 0); // rough west/east of axis for the main section
    if (dS + wob < 1.9) rock = ROCK.GRANITE;
    else if (!northBranch && sS < 38 && side < 0 && dS + wob > 3.0 && dS + wob < 4.7) rock = ROCK.LIMESTONE;
    else rock = ROCK.SCHIST;
    if (!northBranch && sS > 40 && fbm(xk / 4, yk / 4, 2, seed + 42) > 0.22) rock = ROCK.GRANITE;
  } else if (gCR > 0.1 || (wx < 14 && wy < 33)) rock = ROCK.GREYWACKE;
  else if (wy > 41 || wx < 9) rock = ROCK.SCHIST;
  if (Math.hypot(wx - 20.4, wy - 13.6) < 1.3) rock = ROCK.GRANITE;
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
  const erg = plateau * smoothstep(1.0, 0.5, Math.hypot((wx - 46.4) / 2.5, (wy - 15.2) / 4.3) + 0.28 * fbm(xk / 1.6, yk / 1.6, 2, seed + 47));
  return { land, U: U * 1e-3, h0, rock, kmod, strat, gG, plateau, erg };
}

// volcanic cone, applied late so that only its youngest erosion is modelled
export function volcanoHeight(xk, yk, seed) {
  const r = Math.hypot(xk - VOLCANO.x, yk - VOLCANO.y) * (1 + 0.07 * noise2(xk / 1.5, yk / 1.5, seed + 51));
  let h = VOLCANO.h * Math.exp(-r / VOLCANO.r0) * (1 + 0.035 * noise2(xk * 0.9, yk * 0.9, seed + 52));
  h -= 170 * Math.exp(-(r * r) / (2 * 0.26 * 0.26));
  return [h, r];
}

export function buildDesign(R, seed) {
  const n = R * R;
  const d = {
    R, land: new Float32Array(n), U: new Float32Array(n), h0: new Float32Array(n), rock: new Uint8Array(n),
    kmod: new Float32Array(n), strat: new Float32Array(n), gorge: new Float32Array(n), mesa: new Float32Array(n), erg: new Float32Array(n),
  };
  for (let j = 0; j < R; j++) for (let i = 0; i < R; i++) {
    const p = designAt((i + 0.5) / R * WORLD_KM, (j + 0.5) / R * WORLD_KM, seed);
    const c = j * R + i;
    d.land[c] = p.land; d.U[c] = p.U; d.h0[c] = p.h0; d.rock[c] = p.rock; d.kmod[c] = p.kmod; d.strat[c] = p.strat; d.gorge[c] = p.gG; d.mesa[c] = p.plateau; d.erg[c] = p.erg;
  }
  return d;
}
