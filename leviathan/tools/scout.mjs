// Prints candidate viewpoints (client coordinates) derived from the data.
import fs from 'node:fs';
import { loadWorldData, World, MAP } from '../shared/world.mjs';
const data = await loadWorldData((n) => fs.readFileSync(new URL('../data/' + n, import.meta.url)));
const w = new World(data), S = w.S, M = w.M, mn = M * M;
const best = (score) => { let b = -1e9, bx = 0, bz = 0; for (let j = 8; j < M - 8; j += 2) for (let i = 8; i < M - 8; i += 2) { const x = (i + 0.5) * S / M, z = (j + 0.5) * S / M, s = score(x, z, i, j); if (s > b) { b = s; bx = x; bz = z; } } return [Math.round(bx), Math.round(bz), +b.toFixed(2), Math.round(w.baseHeight(bx, bz))]; };
const blur = (ch, i, j, r) => { let s = 0, n = 0; for (let b = -r; b <= r; b += 2) for (let a = -r; a <= r; a += 2) { s += w.maps[ch * mn + (j + b) * M + i + a]; n++; } return s / n / 255; };
console.log('dark forest core', best((x, z, i, j) => blur(MAP.DARK, i, j, 6)));
console.log('dune field', best((x, z, i, j) => w.baseHeight(x, z) > 300 ? blur(MAP.SAND, i, j, 6) : -1));
console.log('wetland', best((x, z, i, j) => blur(MAP.WET, i, j, 5)));
console.log('lakes', JSON.stringify(w.meta.lakes));
for (const l of w.meta.landmarks) console.log(l.name, l.x, l.z, l.h);
// widest river points per region
const P = w.rPts; const pick = (x0, x1, z0, z1) => { let b = 0, r = null; for (let k = 0; k < P.length; k += 5) if (P[k] > x0 && P[k] < x1 && P[k + 1] > z0 && P[k + 1] < z1 && P[k + 3] > b) { b = P[k + 3]; r = [Math.round(P[k]), Math.round(P[k + 1]), Math.round(P[k + 2]), Math.round(P[k + 3])]; } return r; };
console.log('river valley mid', pick(19000, 24000, 24000, 30000));
console.log('river gorge', pick(32000, 37000, 25000, 30000));
console.log('river canyon', pick(43000, 47000, 15000, 26000));
console.log('river alpine', pick(28000, 33000, 14000, 22000));
console.log('river coast range', pick(7000, 12000, 20000, 40000));
// highest relief viewpoint in the Spine: max elevation with deep valley within 3km
console.log('spine crest', best((x, z) => (x > 30000 && x < 39000 && z > 8000 && z < 30000) ? w.baseHeight(x, z) : -1));
console.log('limestone wall', best((x, z, i, j) => w.maps[MAP.ROCK * mn + j * M + i] === 3 && x < 38000 ? w.slope(x, z) : -1));
console.log('canyon rim', best((x, z) => (x > 42000 && z > 12000 && z < 30000 && w.baseHeight(x, z) > 1150) ? w.baseHeight(x, z) - w.baseHeight(x - 500, z + 500) - Math.abs(w.slope(x, z)) * 300 : -1e9));
console.log('fjord head ground', Math.round(w.baseHeight(22300, S - 44800)), Math.round(w.baseHeight(21600, S - 42000)));
