// Ecological placement of trees, shrubs, rocks and ground cover (runs in the terrain workers).
// Everything is a pure function of world position and the world seed, so every client and the
// server agree on where each tree stands. Positions come from global jittered lattices, which
// keeps instances stable when a tile changes level of detail.
import { hash2, noise2, smoothstep } from '../shared/noise.mjs';
import { MAP } from '../shared/world.mjs';
import { ROCK, ROCK_COLOR } from '../shared/geology.mjs';

export const T = { BROADLEAF: 0, CONIFER: 1, GIANT: 2, PINE: 3, BIRCH: 4, SNAG: 5, BUSH: 6, SAGE: 7, ROCK_ROUND: 8, ROCK_SLAB: 9, LOG: 10, FERN: 11, GRASS: 12 };
export const TYPE_COUNT = 13;
const TREE_G = 4.6, ROCK_G = 9, GRASS_G = 0.62;
const rq = {};

class Bins {
  constructor() { this.m = []; this.c = []; for (let i = 0; i < TYPE_COUNT; i++) { this.m.push([]); this.c.push([]); } this.col = []; }
  add(t, x, y, z, s, rot, r, g, b, sy = s, lean = 0) {
    const c = Math.cos(rot) * s, sn = Math.sin(rot) * s;
    this.m[t].push(c, 0, -sn, 0, lean * sy, sy, 0, 0, sn, 0, c, 0, x, y, z, 1);
    this.c[t].push(r, g, b);
  }
  pack(key, extra = {}) {
    const groups = [], transfer = [];
    for (let t = 0; t < TYPE_COUNT; t++) if (this.m[t].length) {
      const mats = new Float32Array(this.m[t]), cols = new Float32Array(this.c[t]);
      groups.push({ t, mats, cols }); transfer.push(mats.buffer, cols.buffer);
    }
    const colliders = new Float32Array(this.col); transfer.push(colliders.buffer);
    return { msg: { type: 'veg', key, groups, colliders, ...extra }, transfer };
  }
}

export function placeVegetation(world, m) {
  return m.kind === 'grass' ? placeGrass(world, m) : placeTrees(world, m);
}

// lod 0: everything; 1: trees, bushes, big rocks; 2: trees only, thinned
function placeTrees(world, { key, x0, z0, size, lod }) {
  const seed = world.seed, bins = new Bins(), S = world.S;
  const i0 = Math.floor(x0 / TREE_G), i1 = Math.ceil((x0 + size) / TREE_G), j0 = Math.floor(z0 / TREE_G), j1 = Math.ceil((z0 + size) / TREE_G);
  for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) {
    const px = (i + hash2(i, j, seed + 401)) * TREE_G, pz = (j + hash2(i, j, seed + 402)) * TREE_G;
    if (px < x0 || px >= x0 + size || pz < z0 || pz >= z0 + size || px < 2 || pz < 2 || px > S - 2 || pz > S - 2) continue;
    const F = world.map(MAP.FOREST, px, pz), precip = world.map(MAP.PRECIP, px, pz) * 3;
    const r3 = hash2(i, j, seed + 403);
    // stand structure: closed forest, or groves and lone trees in open country
    const clump = noise2(px / 26, pz / 26, seed + 410), grove = noise2(px / 140, pz / 140, seed + 411);
    let pTree = F > 0.34 ? Math.min(0.92, F * (0.85 + 0.45 * clump)) : F * (grove > 0.18 ? 2.0 + clump : 0.12);
    let isTree = r3 < pTree;
    if (lod === 2 && isTree && hash2(i, j, seed + 404) > 0.62) continue;
    let shrub = -1;
    if (!isTree && lod < 2) {
      const r6 = hash2(i, j, seed + 405);
      if (precip < 0.62 && r6 < 0.11 * smoothstep(0.12, 0.3, precip) * (1 - F)) shrub = T.SAGE;
      else if (r6 < 0.035 * smoothstep(0.03, 0.2, F) + 0.05 * world.map(MAP.WET, px, pz)) shrub = T.BUSH;
      else if (lod === 0 && F > 0.5 && precip > 0.95 && r6 > 0.72) shrub = T.FERN;
      else if (lod === 0 && F > 0.45 && r6 > 0.6 && r6 < 0.612) shrub = T.LOG;
      if (shrub < 0) continue;
      if (lod === 1 && shrub === T.SAGE && r6 > 0.03) continue;
    } else if (!isTree) continue;
    const h = world.ground(px, pz, 1);
    if (h < 0.7 || h < world.stillLevel(px, pz) + 0.4) continue;
    const rv = world.riverAt(px, pz, rq); if (rv && rv.edge < 1.5 + (isTree ? 1 : 0)) continue;
    const slope = world.slope(px, pz); if (slope > 1.35) continue;
    const tl = 1930 + 90 * noise2(px / 3000, pz / 3000, seed + 70);
    if (h > tl) continue;
    const stunt = 1 - 0.55 * smoothstep(tl - 260, tl, h);
    const r4 = hash2(i, j, seed + 406), r5 = hash2(i, j, seed + 407), rot = hash2(i, j, seed + 408) * 6.283;
    const tintV = 0.8 + 0.4 * hash2(i, j, seed + 409), tintH = 0.92 + 0.16 * r5;
    if (!isTree) {
      if (shrub === T.SAGE) bins.add(T.SAGE, px, h - 0.05, pz, 0.6 + 0.9 * r5, rot, tintV, tintV, tintH);
      else if (shrub === T.BUSH) bins.add(T.BUSH, px, h - 0.1, pz, (0.7 + 1.1 * r5) * stunt, rot, tintV * tintH, tintV, tintV);
      else if (shrub === T.FERN) bins.add(T.FERN, px, h - 0.03, pz, 0.45 + 0.5 * r5, rot, tintV, tintV, tintV);
      else { bins.add(T.LOG, px, h + 0.15, pz, 0.6 + 0.8 * r5, rot, tintV, tintV, tintV); bins.col.push(px, pz, 0.5, h + 0.6); }
      continue;
    }
    const dark = world.map(MAP.DARK, px, pz), wet = world.map(MAP.WET, px, pz);
    let type;
    if (r4 > 0.972) type = T.SNAG;
    else if (dark > 0.42) type = r4 < 0.3 ? T.GIANT : r4 < 0.8 ? T.CONIFER : T.BROADLEAF;
    else if (h > 1150) type = r4 < 0.9 ? T.CONIFER : T.BIRCH;
    else if (precip < 0.64) type = r4 < 0.62 ? T.PINE : T.BROADLEAF;
    else if (wet > 0.3) type = r4 < 0.6 ? T.BIRCH : T.BROADLEAF;
    else {
      const pb = 0.6 * smoothstep(1000, 300, h) * (1 - 0.8 * smoothstep(0.95, 1.4, precip)) + 0.06;
      type = r4 < pb ? T.BROADLEAF : r4 < pb + 0.08 ? T.BIRCH : r4 < pb + 0.13 ? T.PINE : T.CONIFER;
    }
    // age structure: many young trees, a few veterans
    let s = (0.5 + 0.75 * Math.pow(r5, 1.6)) * stunt;
    if (F < 0.34) s *= 1.12;                 // open-grown trees are broader and bigger
    if (lod === 2) s *= 1.12;
    const lean = (hash2(i, j, seed + 412) - 0.5) * 0.08;
    bins.add(type, px, h - 0.25, pz, s, rot, tintV * tintH, tintV, tintV * (2 - tintH), s * (0.9 + 0.25 * hash2(i, j, seed + 413)), lean);
    if (lod === 0) { const tr = type === T.GIANT ? 0.95 : type === T.BIRCH ? 0.18 : 0.33; bins.col.push(px, pz, tr * s, h + 30); }
  }
  if (lod < 2) placeRocks(world, bins, x0, z0, size, lod);
  return bins.pack(key);
}

function placeRocks(world, bins, x0, z0, size, lod) {
  const seed = world.seed, S = world.S;
  const i0 = Math.floor(x0 / ROCK_G), i1 = Math.ceil((x0 + size) / ROCK_G), j0 = Math.floor(z0 / ROCK_G), j1 = Math.ceil((z0 + size) / ROCK_G);
  for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) {
    const r1 = hash2(i, j, seed + 451);
    if (lod === 1 && r1 > 0.07) continue;                     // only the big blocks are kept at distance
    const px = (i + hash2(i, j, seed + 452)) * ROCK_G, pz = (j + hash2(i, j, seed + 453)) * ROCK_G;
    if (px < x0 || px >= x0 + size || pz < z0 || pz >= z0 + size || px < 2 || pz < 2 || px > S - 2 || pz > S - 2) continue;
    const slope = world.slope(px, pz), hb = world.baseHeight(px, pz);
    if (hb < 0.3) continue;
    const precip = world.map(MAP.PRECIP, px, pz) * 3;
    // where rock debris belongs: talus below steep ground, alpine frost-shattered ground,
    // glacial erratics on formerly glaciated floors, block fields in the desert, river bars
    let p = 0.30 * smoothstep(0.42, 0.7, slope) * smoothstep(1.5, 1.0, slope);
    p += 0.16 * smoothstep(1850, 2250, hb);
    p += 0.012 * smoothstep(450, 800, hb);
    p += 0.035 * smoothstep(0.42, 0.25, precip) * (0.4 + smoothstep(0.1, 0.4, slope));
    const rv = world.riverAt(px, pz, rq);
    if (rv && rv.edge < 6 && rv.edge > -rv.w * 0.5 && slope > 0.06) p += 0.35;
    p *= 0.6 + 0.8 * noise2(px / 60, pz / 60, seed + 454);
    if (hash2(i, j, seed + 455) > p) continue;
    const h = world.ground(px, pz, 1);
    if (h < world.stillLevel(px, pz) - 0.3) continue;
    const rk = world.rockAt(px, pz, h), c = ROCK_COLOR[rk];
    let s = Math.min(6, 0.38 / Math.pow(r1 + 0.004, 0.55));    // power-law sizes: mostly cobbles, rare house-size blocks
    if (lod === 1) { if (s < 1.6) continue; }
    const v = 0.75 + 0.5 * hash2(i, j, seed + 456);
    const layered = rk === ROCK.SANDSTONE || rk === ROCK.SHALE || rk === ROCK.LIMESTONE || rk === ROCK.BASALT || rk === ROCK.GREYWACKE;
    const cr = Math.pow(c[0] / 255, 2.2) * v, cg = Math.pow(c[1] / 255, 2.2) * v, cb = Math.pow(c[2] / 255, 2.2) * v;
    bins.add(layered ? T.ROCK_SLAB : T.ROCK_ROUND, px, h - 0.22 * s, pz, s, hash2(i, j, seed + 457) * 6.283, cr, cg, cb, s * (layered ? 0.55 + 0.3 * v : 0.7 + 0.3 * v));
    if (lod === 0 && s > 0.8) bins.col.push(px, pz, s * 0.8, h + s * 0.6);
  }
}

function placeGrass(world, { key, x0, z0, size }) {
  const seed = world.seed, bins = new Bins();
  const i0 = Math.floor(x0 / GRASS_G), i1 = Math.ceil((x0 + size) / GRASS_G), j0 = Math.floor(z0 / GRASS_G), j1 = Math.ceil((z0 + size) / GRASS_G);
  // climate varies slowly: sample once per tile corner region
  const cx = x0 + size / 2, cz = z0 + size / 2;
  const precip = world.map(MAP.PRECIP, cx, cz) * 3, F = world.map(MAP.FOREST, cx, cz), wet = world.map(MAP.WET, cx, cz), sand = world.map(MAP.SAND, cx, cz);
  const m = precip + 0.35 * wet;
  let cover = smoothstep(0.2, 0.55, m) * (1 - 0.75 * smoothstep(0.4, 0.8, F)) * (1 - smoothstep(0.3, 0.6, sand));
  if (cover < 0.03) return bins.pack(key);
  for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) {
    if (hash2(i, j, seed + 470) > cover * (0.75 + 0.5 * noise2(i * GRASS_G / 7, j * GRASS_G / 7, seed + 471))) continue;
    const px = (i + hash2(i, j, seed + 472)) * GRASS_G, pz = (j + hash2(i, j, seed + 473)) * GRASS_G;
    if (px < x0 || px >= x0 + size || pz < z0 || pz >= z0 + size) continue;
    const h = world.ground(px, pz, 0.6);
    if (h < 0.9 || h > 2300 || h < world.stillLevel(px, pz) + 0.25) continue;
    if (world.slope(px, pz) > 0.85) continue;
    const rv = world.riverAt(px, pz, rq); if (rv && rv.edge < 0.6) continue;
    const r = hash2(i, j, seed + 474), v = 0.8 + 0.4 * hash2(i, j, seed + 475);
    const lush = smoothstep(0.42, 0.95, m + (r - 0.5) * 0.3), alp = smoothstep(1450, 2000, h);
    // colour follows the terrain shader's herb layer so tufts and ground read as one surface
    let cr = 0.187 + (0.051 - 0.187) * lush, cg = 0.178 + (0.089 - 0.178) * lush, cb = 0.056 + (0.017 - 0.056) * lush;
    cr += (0.164 - cr) * alp; cg += (0.156 - cg) * alp; cb += (0.043 - cb) * alp;
    const ht = (0.32 + 0.5 * lush + 0.35 * wet) * (1 - 0.5 * alp) * (0.7 + 0.6 * r);
    bins.add(T.GRASS, px, h - 0.04, pz, 0.75 + 0.5 * r, r * 6.283, cr * v * 1.25, cg * v * 1.25, cb * v * 1.25, ht);
  }
  return bins.pack(key);
}
