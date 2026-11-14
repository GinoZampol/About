// Export the world for Unreal Engine 5 (Landscape, which can be built as Nanite, plus Nanite
// static-mesh tiles for hero terrain).
//   node tools/export_unreal.mjs                      landscape heightmap 4033^2 + layer weightmaps + river splines
//   node tools/export_unreal.mjs --size 8129          6.15 m/quad landscape (includes sub-grid relief and river channels)
//   node tools/export_unreal.mjs --mesh 31000,38000,2000,1   OBJ tile: x, z (m, NW corner), size (m), vertex spacing (m)
// Output: export/unreal/ (not committed). Coordinates: world x (east) -> UE X, world z (south) -> UE Y, up -> UE Z, in cm.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadWorldData, World, MAP } from '../shared/world.mjs';
import { writeGrayPNG } from '../worldgen/png.mjs';
import { smoothstep, sat } from '../shared/noise.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const OUT = path.join(ROOT, 'export', 'unreal'); fs.mkdirSync(OUT, { recursive: true });
const data = await loadWorldData((n) => fs.readFileSync(path.join(ROOT, 'data', n)));
const w = new World(data), S = w.S;

if (arg('mesh')) {
  // Dense static-mesh tile for Nanite: every vertex is a sample of the same ground function the game uses.
  const [x0, z0, size, cell] = arg('mesh').split(',').map(Number), n = Math.round(size / cell) + 1;
  const file = path.join(OUT, `tile_${x0}_${z0}_${size}m_${cell}m.obj`), fd = fs.openSync(file, 'w');
  let buf = [`# The Leviathan terrain tile. Units: cm. Origin: tile NW corner at world (${x0}, ${z0}) m.\n`];
  const flush = () => { fs.writeSync(fd, buf.join('')); buf = []; };
  for (let j = 0; j < n; j++) { for (let i = 0; i < n; i++) buf.push(`v ${(i * cell * 100).toFixed(1)} ${(j * cell * 100).toFixed(1)} ${(w.ground(x0 + i * cell, z0 + j * cell, cell) * 100).toFixed(1)}\n`); flush(); }
  for (let j = 0; j < n - 1; j++) { for (let i = 0; i < n - 1; i++) { const a = j * n + i + 1, b = a + 1, c = a + n, d = c + 1; buf.push(`f ${a} ${b} ${c}\nf ${b} ${d} ${c}\n`); } flush(); }
  fs.closeSync(fd);
  console.log(`${file}: ${n * n} vertices, ${(n - 1) * (n - 1) * 2} triangles`);
  process.exit(0);
}

const N = +arg('size', 4033), cell = S / (N - 1);
// Unreal height encoding: Z_cm = (value - 32768) / 128 * ZScale. ZScale 1600 spans 8192 m at 12.5 cm steps.
const Z_SCALE = 1600, Z_MID = 3700;
const hq = new Uint16Array(N * N), hf = new Float32Array(N * N);
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
  const h = w.ground(i * cell, j * cell, cell); hf[j * N + i] = h;
  hq[j * N + i] = Math.max(0, Math.min(65535, Math.round(32768 + (h - Z_MID) * 8)));
}
writeGrayPNG(path.join(OUT, `height_${N}.png`), hq, N, N, 16);

// Landscape layer weightmaps, from the same slope / altitude / climate / geology rules as the game's terrain shader.
const LAYERS = ['Grass', 'DryGrass', 'ForestFloor', 'Rock', 'Scree', 'Sand', 'Snow', 'Wetland'];
const L = LAYERS.map(() => new Uint8Array(N * N));
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
  const c = j * N + i, x = i * cell, z = j * cell, h = hf[c];
  const gx = (hf[j * N + Math.min(N - 1, i + 1)] - hf[j * N + Math.max(0, i - 1)]) / (2 * cell), gz = (hf[Math.min(N - 1, j + 1) * N + i] - hf[Math.max(0, j - 1) * N + i]) / (2 * cell), s = Math.hypot(gx, gz);
  const p = w.map(MAP.PRECIP, x, z) * 3, F = w.map(MAP.FOREST, x, z), wet = w.map(MAP.WET, x, z), sand = w.map(MAP.SAND, x, z);
  let snow = smoothstep(2340, 2560, h) * smoothstep(2.1, 1.2, s);
  let rock = Math.max(smoothstep(0.72, 1.12, s + smoothstep(1900, 2500, h) * 0.45 - sand - F * 0.3), (1 - smoothstep(0.2, 0.48, p)) * smoothstep(0.32, 0.65, s));
  let scree = smoothstep(0.48, 0.74, s) * (1 - rock);
  let wv = [0, 0, 0, rock, scree * 0.7, 0, 0, 0];
  let rest = (1 - rock) * (1 - scree * 0.7);
  const sd = smoothstep(0.25, 0.6, sand); wv[5] = rest * sd; rest *= 1 - sd;
  const wl = wet * 0.65; wv[7] = rest * wl; rest *= 1 - wl;
  const ff = smoothstep(0.3, 0.7, F) * 0.9; wv[2] = rest * ff; rest *= 1 - ff;
  const lush = smoothstep(0.42, 0.9, p + 0.35 * wet); wv[0] = rest * lush; wv[1] = rest * (1 - lush);
  for (let k = 0; k < 8; k++) wv[k] *= 1 - snow; wv[6] = snow;
  let sum = 0; for (let k = 0; k < 8; k++) sum += wv[k];
  for (let k = 0; k < 8; k++) L[k][c] = Math.round(255 * sat(wv[k] / (sum || 1)));
}
LAYERS.forEach((name, k) => writeGrayPNG(path.join(OUT, `layer_${name}_${N}.png`), L[k], N, N, 8));

// rivers as spline control points (cm), lakes, landmarks
const P = w.rPts, off = w.rSegOff, rivers = [];
for (let s = 0; s < off.length - 1; s++) {
  const pts = [];
  for (let k = off[s]; k < off[s + 1]; k += k + 4 < off[s + 1] ? 4 : 1) pts.push([Math.round(P[k * 5] * 100), Math.round(P[k * 5 + 1] * 100), Math.round(P[k * 5 + 2] * 100), Math.round(P[k * 5 + 3] * 100), Math.round(P[k * 5 + 4] * 100)]);
  rivers.push(pts);
}
fs.writeFileSync(path.join(OUT, 'rivers.json'), JSON.stringify({ units: 'cm', fields: ['X', 'Y', 'waterZ', 'width', 'depth'], splines: rivers }));
const meta = {
  heightmap: `height_${N}.png`, resolution: N, quadSizeCm: +(cell * 100).toFixed(3),
  landscapeScale: { X: +(cell * 100).toFixed(4), Y: +(cell * 100).toFixed(4), Z: Z_SCALE },
  landscapeLocationCm: { X: S * 50, Y: S * 50, Z: Z_MID * 100 },
  note: 'Import as a Landscape with these Scale values; Location puts world (0,0) at the NW corner and sea level at Z = 0.',
  seaLevelCm: 0, layers: LAYERS.map((n) => `layer_${n}_${N}.png`),
  lakes: w.meta.lakes.map((l) => ({ X: l.x * 100, Y: l.z * 100, waterZ: Math.round(l.level * 100), areaKm2: l.areaKm2 })),
  landmarks: w.meta.landmarks.map((l) => ({ name: l.name, X: l.x * 100, Y: l.z * 100 })), seed: w.seed,
};
fs.writeFileSync(path.join(OUT, 'landscape.json'), JSON.stringify(meta, null, 1));
console.log(`exported ${N}x${N} landscape (${(cell).toFixed(2)} m quads), ${LAYERS.length} layers, ${rivers.length} river splines -> ${OUT}`);
