// Runtime world model. One instance lives on the main thread (collision, gameplay queries) and one
// in every terrain worker (meshing). It turns the generated data set into a continuous, deterministic
// ground function:   ground(x, z) = eroded base (bicubic) + geology-driven detail + river channels + edits
// Coordinates: x east, z south, y up, metres. Origin = north-west corner of the world.
import { noise2, fbm, ridged, smoothstep, sat, hash2 } from './noise.mjs';
import { ROCK, rockAt } from './geology.mjs';
import { decodeU16 } from './codec.mjs';

export const MAP = { ROCK: 0, STRAT: 1, PRECIP: 2, FOREST: 3, DARK: 4, WET: 5, SAND: 6, AO: 7, MESA: 8, FLOW: 9 };
const RIVER_CELL = 128;
// value noise with analytic derivatives (for erosion-style fractal relief)
const _nd = { dx: 0, dz: 0 };
function vnd(x, z, seed) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10), w = fz * fz * fz * (fz * (fz * 6 - 15) + 10);
  const du = 30 * fx * fx * (fx - 1) * (fx - 1), dw = 30 * fz * fz * (fz - 1) * (fz - 1);
  const a = hash2(ix, iz, seed), b = hash2(ix + 1, iz, seed), c = hash2(ix, iz + 1, seed), d = hash2(ix + 1, iz + 1, seed);
  const k1 = b - a, k2 = c - a, k4 = a - b - c + d;
  _nd.dx = du * (k1 + k4 * w); _nd.dz = dw * (k2 + k4 * u);
  return a + k1 * u + k2 * w + k4 * u * w;
}

async function gunzip(buf) {
  if (typeof DecompressionStream !== 'undefined') {
    const s = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Uint8Array(await new Response(s).arrayBuffer());
  }
  const zlib = await import('node:zlib');
  return new Uint8Array(zlib.gunzipSync(Buffer.from(buf)));
}

// Loads and decodes the data set. `read(name)` returns an ArrayBuffer/Uint8Array for a file name.
export async function loadWorldData(read, onProgress = () => {}) {
  const meta = JSON.parse(new TextDecoder().decode(await read('world.json')));
  const names = ['height.bin', 'lakes.bin', 'maps.bin', 'rivers.bin', 'rivermask.bin'];
  let done = 0;
  const raw = await Promise.all(names.map(async (n) => { const b = await gunzip(await read(n)); onProgress(++done / names.length); return b; }));
  const al = (u8) => u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
  return {
    meta,
    height: decodeU16(raw[0], meta.heightRes),
    lakes: new Int16Array(al(raw[1])),
    maps: raw[2],
    rivers: al(raw[3]),
    rivermask: raw[4],
  };
}

export class World {
  constructor(data) {
    this.meta = data.meta;
    this.S = data.meta.sizeM;
    this.N = data.meta.heightRes; this.H = data.height;
    this.hs = data.meta.hScale; this.ho = data.meta.hOffset;
    this.inv = this.N / this.S;
    this.M = data.meta.mapRes; this.maps = data.maps; this.minv = this.M / this.S;
    this.LN = data.meta.lakeRes; this.lakes = data.lakes;
    this.seed = data.meta.seed;
    this.edits = new Map();           // 1 m column edits (mining / earthworks), metres of height change
    this._initRivers(data.rivers);
    this._initSlope();
  }

  // ---- rasters -----------------------------------------------------------------------------
  baseHeight(x, z) {
    const N = this.N, H = this.H;
    let u = x * this.inv - 0.5, v = z * this.inv - 0.5;
    if (u < 0) u = 0; else if (u > N - 1) u = N - 1;
    if (v < 0) v = 0; else if (v > N - 1) v = N - 1;
    const i = Math.floor(u), j = Math.floor(v), fx = u - i, fy = v - j;
    const i0 = i > 0 ? i - 1 : 0, i2 = i < N - 1 ? i + 1 : N - 1, i3 = i < N - 2 ? i + 2 : N - 1;
    const j0 = j > 0 ? j - 1 : 0, j2 = j < N - 1 ? j + 1 : N - 1, j3 = j < N - 2 ? j + 2 : N - 1;
    const wx0 = ((-0.5 * fx + 1) * fx - 0.5) * fx, wx1 = (1.5 * fx - 2.5) * fx * fx + 1, wx2 = ((-1.5 * fx + 2) * fx + 0.5) * fx, wx3 = (0.5 * fx - 0.5) * fx * fx;
    const wy0 = ((-0.5 * fy + 1) * fy - 0.5) * fy, wy1 = (1.5 * fy - 2.5) * fy * fy + 1, wy2 = ((-1.5 * fy + 2) * fy + 0.5) * fy, wy3 = (0.5 * fy - 0.5) * fy * fy;
    let r = j0 * N; const a = H[r + i0] * wx0 + H[r + i] * wx1 + H[r + i2] * wx2 + H[r + i3] * wx3;
    r = j * N; const b = H[r + i0] * wx0 + H[r + i] * wx1 + H[r + i2] * wx2 + H[r + i3] * wx3;
    r = j2 * N; const c = H[r + i0] * wx0 + H[r + i] * wx1 + H[r + i2] * wx2 + H[r + i3] * wx3;
    r = j3 * N; const d = H[r + i0] * wx0 + H[r + i] * wx1 + H[r + i2] * wx2 + H[r + i3] * wx3;
    return (a * wy0 + b * wy1 + c * wy2 + d * wy3) * this.hs - this.ho;
  }

  // bilinear sample of an 8-bit map channel, 0..1
  map(ch, x, z) {
    const M = this.M, o = ch * M * M, m = this.maps;
    let u = x * this.minv - 0.5, v = z * this.minv - 0.5;
    if (u < 0) u = 0; else if (u > M - 1.001) u = M - 1.001;
    if (v < 0) v = 0; else if (v > M - 1.001) v = M - 1.001;
    const i = Math.floor(u), j = Math.floor(v), fx = u - i, fy = v - j, p = o + j * M + i;
    const a = m[p], b = m[p + 1], c = m[p + M], d = m[p + M + 1];
    return (a + (b - a) * fx + (c - a + (a - b + d - c) * fx) * fy) / 255;
  }
  mapNearest(ch, x, z) {
    const M = this.M;
    let i = Math.floor(x * this.minv), j = Math.floor(z * this.minv);
    i = i < 0 ? 0 : i > M - 1 ? M - 1 : i; j = j < 0 ? 0 : j > M - 1 ? M - 1 : j;
    return this.maps[ch * M * M + j * M + i];
  }
  stratOffset(x, z) { return this.map(MAP.STRAT, x, z) * 510 - 100; }
  rockAt(x, z, h) { return rockAt(this.mapNearest(MAP.ROCK, x, z), h, this.stratOffset(x, z)); }

  _initSlope() {
    // slope magnitude of the base terrain at map resolution (drives detail and ecology)
    const M = this.M, S = this.S, sl = new Float32Array(M * M), d = S / M;
    for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) {
      const x = (i + 0.5) * d, z = (j + 0.5) * d, e = d * 0.5;
      const gx = (this._hNear(x + e, z) - this._hNear(x - e, z)) / (2 * e), gz = (this._hNear(x, z + e) - this._hNear(x, z - e)) / (2 * e);
      sl[j * M + i] = Math.sqrt(gx * gx + gz * gz);
    }
    this.slopeMap = sl;
  }
  _hNear(x, z) {
    const N = this.N; let i = Math.floor(x * this.inv), j = Math.floor(z * this.inv);
    i = i < 0 ? 0 : i > N - 1 ? N - 1 : i; j = j < 0 ? 0 : j > N - 1 ? N - 1 : j;
    return this.H[j * N + i] * this.hs - this.ho;
  }
  slope(x, z) {
    const M = this.M, m = this.slopeMap;
    let u = x * this.minv - 0.5, v = z * this.minv - 0.5;
    if (u < 0) u = 0; else if (u > M - 1.001) u = M - 1.001;
    if (v < 0) v = 0; else if (v > M - 1.001) v = M - 1.001;
    const i = Math.floor(u), j = Math.floor(v), fx = u - i, fy = v - j, p = j * M + i;
    const a = m[p], b = m[p + 1], c = m[p + M], d = m[p + M + 1];
    return a + (b - a) * fx + (c - a + (a - b + d - c) * fx) * fy;
  }

  // ---- geology-driven detail below the resolution of the eroded base -------------------------
  // `cell` = sampling interval of the caller; wavelengths that it cannot resolve are faded out.
  detail(x, z, h, cell) {
    const seed = this.seed, s = this.slope(x, z);
    const band = (wl) => { const t = wl / (2.6 * cell + 1e-6) - 0.45; return t < 0 ? 0 : t > 1 ? 1 : t; };
    let d = 0;
    // slope relief: spurs, rills and gullies. Octaves are damped where the accumulated gradient
    // is already steep, which gives the branching, water-worn look of real hillsides.
    const sandHere = this.map(MAP.SAND, x, z);
    let relief = smoothstep(0.10, 0.55, s) * (1 - sandHere);
    relief *= 1 - smoothstep(0.03, 0.12, this.map(MAP.FLOW, x, z));     // valley floors and river banks stay as eroded
    // keep lake rims and shores intact
    { const LN = this.LN, li = Math.floor(x / this.S * LN), lj = Math.floor(z / this.S * LN); const lv = li >= 0 && lj >= 0 && li < LN && lj < LN ? this.lakes[lj * LN + li] : -32768; relief *= smoothstep(1, 22, h - (lv === -32768 ? 0 : lv / 10)); }
    if (relief > 0.01) {
      let a = 0, b = 1, gx = 0, gz = 0, px = x / 230, pz = z / 230, wl = 230;
      for (let o = 0; o < 6; o++) {
        const bw = band(wl); if (bw <= 0) break;
        const n = vnd(px, pz, seed + 230 + o);
        gx += _nd.dx; gz += _nd.dz;
        a += bw * b * n / (1 + gx * gx + gz * gz);
        b *= 0.5; wl *= 0.5;
        const tx = px * 1.6 - pz * 1.2; pz = px * 1.2 + pz * 1.6; px = tx;
      }
      d += relief * 30 * (a - 0.72);
    }
    const steep = smoothstep(0.5, 0.95, s) + smoothstep(2050, 2500, h) * 0.5;
    const rocky = steep > 1 ? 1 : steep;
    // soil-mantled ground: gentle swales and hummocks, nearly absent on floodplains
    const wet = this.map(MAP.WET, x, z);
    const soilAmp = (1 - rocky) * (1 - 0.8 * wet) * smoothstep(0.004, 0.06, s + 0.012);
    if (soilAmp > 0.01) {
      const b1 = band(60), b2 = band(9);
      if (b1 > 0) d += soilAmp * b1 * 0.9 * fbm(x / 60, z / 60, 2, seed + 201);
      if (b2 > 0) d += soilAmp * b2 * 0.16 * fbm(x / 9, z / 9, 2, seed + 202);
    }
    if (rocky > 0.02 || s > 0.22) {
      const rk = this.rockAt(x, z, h);
      const layered = rk === ROCK.SANDSTONE || rk === ROCK.LIMESTONE || rk === ROCK.SHALE || rk === ROCK.BASALT;
      // craggy relief of exposed bedrock: buttresses, ribs and gullies
      const b1 = band(90), b2 = band(22), b3 = band(5);
      const amp = rocky * (rk === ROCK.SHALE ? 0.45 : rk === ROCK.GRANITE || rk === ROCK.LIMESTONE ? 1.25 : 1);
      if (amp > 0.01) {
        if (b1 > 0) d += amp * b1 * 5 * (ridged(x / 90, z / 90, 2, seed + 203) - 0.55);
        if (b2 > 0) d += amp * b2 * 2.6 * (ridged(x / 22, z / 22, 2, seed + 204) - 0.5);
        if (b3 > 0) d += amp * b3 * 0.55 * fbm(x / 5, z / 5, 2, seed + 205);
      }
      // bedding: sedimentary and lava layers weather into ledges and risers
      if (layered && rk !== ROCK.SHALE && this.map(MAP.MESA, x, z) > 0.5) {
        const T = rk === ROCK.BASALT ? 22 : 17;
        const bt = band(T) * smoothstep(0.45, 0.8, s) * 0.8;
        if (bt > 0) {
          // irregular bed thickness: a warped stratigraphic coordinate, never an even staircase
          let t = (h + this.stratOffset(x, z) * 0.15 + 4 * noise2(x / 110, z / 110, seed + 206)) / T;
          t += 0.38 * Math.sin(t * 2.3 + 1.7) + 0.2 * Math.sin(t * 5.1);
          const g = t - Math.floor(t);
          d += bt * T * 0.6 * (smoothstep(0.5, 1.0, g) - g);
        }
      }
    }
    // dunes
    const sand = sandHere;
    if (sand > 0.03 && h > 6) {
      const b1 = band(150), b2 = band(16);
      if (b1 > 0) {
        const ph = (x * 0.94 + z * 0.34) / 150 + 1.3 * fbm(x / 420, z / 420, 2, seed + 207);
        const p = ph - Math.floor(ph);
        const prof = p < 0.72 ? p / 0.72 : (1 - p) / 0.28;
        d += sand * b1 * (17 + 9 * noise2(x / 800, z / 800, seed + 208)) * (prof * prof * (3 - 2 * prof) - 0.4);
      }
      if (b2 > 0) d += sand * b2 * 0.45 * Math.sin((x * 0.9 + z * 0.43) / 16 * 6.283 + 3 * noise2(x / 40, z / 40, seed + 209));
    }
    return d;
  }

  // ---- rivers ----------------------------------------------------------------------------------
  _initRivers(buf) {
    const u32 = new Uint32Array(buf, 0, 2), nSeg = u32[0], nPts = u32[1];
    this.rSegOff = new Uint32Array(buf, 8, nSeg + 1);
    this.rPts = new Float32Array(buf, 8 + (nSeg + 1) * 4, nPts * 5);
    const G = Math.ceil(this.S / RIVER_CELL); this.rG = G;
    const counts = new Uint32Array(G * G + 1), P = this.rPts;
    const reach = (w) => w * 0.5 + Math.min(60, 4 + 1.2 * w) + 1;
    const each = (fn) => {
      for (let s = 0; s < nSeg; s++) for (let k = this.rSegOff[s]; k < this.rSegOff[s + 1] - 1; k++) {
        const ax = P[k * 5], az = P[k * 5 + 1], bx = P[k * 5 + 5], bz = P[k * 5 + 6], r = reach(Math.max(P[k * 5 + 3], P[k * 5 + 8]));
        const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - r) / RIVER_CELL)), i1 = Math.min(G - 1, Math.floor((Math.max(ax, bx) + r) / RIVER_CELL));
        const j0 = Math.max(0, Math.floor((Math.min(az, bz) - r) / RIVER_CELL)), j1 = Math.min(G - 1, Math.floor((Math.max(az, bz) + r) / RIVER_CELL));
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) fn(j * G + i, k);
      }
    };
    each((c) => { counts[c + 1]++; });
    for (let c = 0; c < G * G; c++) counts[c + 1] += counts[c];
    const list = new Uint32Array(counts[G * G]), fill = counts.slice(0, G * G);
    each((c, k) => { list[fill[c]++] = k; });
    this.rStart = counts; this.rList = list;
  }

  // Nearest river channel: returns edge distance (negative inside the channel) or null.
  // out = {edge, zw, w, d}
  riverAt(x, z, out) {
    const G = this.rG, i = Math.floor(x / RIVER_CELL), j = Math.floor(z / RIVER_CELL);
    if (i < 0 || j < 0 || i >= G || j >= G) return null;
    const c = j * G + i, P = this.rPts; let best = 1e9, found = false;
    for (let q = this.rStart[c]; q < this.rStart[c + 1]; q++) {
      const k = this.rList[q] * 5;
      const ax = P[k], az = P[k + 1], dx = P[k + 5] - ax, dz = P[k + 6] - az;
      let t = ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz + 1e-9); t = t < 0 ? 0 : t > 1 ? 1 : t;
      const ex = ax + dx * t - x, ez = az + dz * t - z, w = P[k + 3] + (P[k + 8] - P[k + 3]) * t;
      const edge = Math.sqrt(ex * ex + ez * ez) - w * 0.5;
      if (edge < best) { best = edge; found = true; out.edge = edge; out.w = w; out.zw = P[k + 2] + (P[k + 7] - P[k + 2]) * t; out.d = P[k + 4] + (P[k + 9] - P[k + 4]) * t; }
    }
    return found ? out : null;
  }

  _carve(x, z, h) {
    const G = this.rG, i = Math.floor(x / RIVER_CELL), j = Math.floor(z / RIVER_CELL);
    if (i < 0 || j < 0 || i >= G || j >= G) return h;
    const c = j * G + i, e = this.rStart[c + 1]; let q = this.rStart[c];
    if (q === e) return h;
    const P = this.rPts; let res = h;
    for (; q < e; q++) {
      const k = this.rList[q] * 5;
      const ax = P[k], az = P[k + 1], dx = P[k + 5] - ax, dz = P[k + 6] - az;
      let t = ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz + 1e-9); t = t < 0 ? 0 : t > 1 ? 1 : t;
      const ex = ax + dx * t - x, ez = az + dz * t - z, dist = Math.sqrt(ex * ex + ez * ez);
      const w = P[k + 3] + (P[k + 8] - P[k + 3]) * t, hw = w * 0.5, B = Math.min(60, 4 + 1.2 * w);
      if (dist > hw + B) continue;
      const zw = P[k + 2] + (P[k + 7] - P[k + 2]) * t, dep = P[k + 4] + (P[k + 9] - P[k + 4]) * t;
      let hc;
      if (dist < hw) { const u = dist / hw; hc = zw - 0.18 - dep * Math.pow(1 - u * u, 0.7); }
      else {
        const u = (dist - hw) / B, tt = u * u * (3 - 2 * u);
        const bank = zw - 0.18 + 0.9 * Math.min(1, u * 4) + 0.5 * u;
        hc = bank + (h - bank) * tt;
      }
      if (hc < res) res = hc;
    }
    return res;
  }

  // ---- the ground ----------------------------------------------------------------------------
  ground(x, z, cell = 0) {
    const S = this.S;
    const cx = x < 0 ? 0 : x > S ? S : x, cz = z < 0 ? 0 : z > S ? S : z;
    let h = this.baseHeight(cx, cz);
    if (cell < 40) h += this.detail(cx, cz, h, cell);
    if (cell < 30) h = this._carve(cx, cz, h);
    if (this.edits.size && cell < 2) h += this._edit(x, z);
    return h;
  }

  normal(x, z, out, e = 0.5) {
    const gx = (this.ground(x + e, z) - this.ground(x - e, z)) / (2 * e), gz = (this.ground(x, z + e) - this.ground(x, z - e)) / (2 * e);
    const l = 1 / Math.sqrt(gx * gx + gz * gz + 1);
    out.x = -gx * l; out.y = l; out.z = -gz * l; return out;
  }

  // level of standing water (lake or sea) that applies at this position
  stillLevel(x, z) {
    const LN = this.LN; let i = Math.floor(x / this.S * LN), j = Math.floor(z / this.S * LN);
    if (i < 0 || j < 0 || i >= LN || j >= LN) return 0;
    const v = this.lakes[j * LN + i];
    return v === -32768 ? 0 : v / 10;
  }

  // water surface elevation at a point, or -Infinity when dry (for swimming / buoyancy / placement)
  waterSurface(x, z, ground) {
    const g = ground === undefined ? this.ground(x, z) : ground;
    let w = -Infinity;
    const lvl = this.stillLevel(x, z);
    if (g < lvl) w = lvl;
    const r = this.riverAt(x, z, this._rq || (this._rq = {}));
    if (r && r.edge < 0 && r.zw > g && r.zw > w) w = r.zw;
    return w;
  }

  // ---- earthworks ------------------------------------------------------------------------------
  // Player terrain modification lives in a sparse layer on top of the immutable generated world.
  static editKey(ix, iz) { return ix * 65536 + iz; }
  setEdit(ix, iz, dh) { const k = World.editKey(ix, iz); if (Math.abs(dh) < 1e-3) this.edits.delete(k); else this.edits.set(k, dh); }
  getEdit(ix, iz) { return this.edits.get(World.editKey(ix, iz)) || 0; }
  _edit(x, z) {
    const u = x - 0.5, v = z - 0.5, i = Math.floor(u), j = Math.floor(v), fx = u - i, fy = v - j;
    const a = this.getEdit(i, j), b = this.getEdit(i + 1, j), c = this.getEdit(i, j + 1), d = this.getEdit(i + 1, j + 1);
    if (a === 0 && b === 0 && c === 0 && d === 0) return 0;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    return a + (b - a) * sx + (c - a + (a - b + d - c) * sx) * sy;
  }

  // ---- ecology at a point (used for vegetation placement and gameplay queries) -----------------
  climate(x, z, h) {
    const precip = this.map(MAP.PRECIP, x, z) * 3;                 // 1 = 1000 mm/yr
    const temp = 12.5 - 0.0062 * Math.max(0, h) - 2.0 * (1 - z / this.S); // deg C, mean annual
    return { precip, temp };
  }
}
