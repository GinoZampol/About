// Scores seeds for what makes a good Leviathan world, from the design (before erosion, so seconds per seed):
//   node tools/seed_score.mjs [count]        random seeds      node tools/seed_score.mjs 241191 752500   given seeds
// - badlands: share of the land (a Wild West to settle)
// - islands: real islands, several km² each, in open water (maritime powers)
// - massif: height of the great mountain (the landmark)
// - heartlands: the largest pieces of ordinary land, neither mountain nor badlands (continental powers)
import { buildDesign, setVariant } from '../worldgen/design.mjs';
setVariant('S');
const args = process.argv.slice(2), R = 256, cell = 56 / R, a = cell * cell;
const seeds = args.length > 1 || (args[0] && +args[0] > 1000) ? args.map(Number) : Array.from({ length: +(args[0] || 12) }, () => Math.floor(Math.random() * 1e6));
const inPlay = (i, j) => { const x = -3 + (i + 0.5) * cell, y = -3 + (j + 0.5) * cell; return x >= 0 && y >= 0 && x <= 50 && y <= 50; };
const rows = [];
for (const seed of seeds) {
  const d = buildDesign(R, seed, { x0: -3, size: 56 }), n = R * R;
  let land = 0, bad = 0, hmax = 0;
  for (let c = 0; c < n; c++) { if (!inPlay(c % R, (c / R) | 0) || d.land[c] < 0) continue; land++; if (d.mesa[c] > 0.5) bad++; hmax = Math.max(hmax, d.h0[c]); }
  // connected pieces: islands (land not touching the border), and heartlands (ordinary land, not mountain or badlands)
  const comps = (pred) => { const seen = new Uint8Array(n), out = []; for (let s = 0; s < n; s++) { if (seen[s] || !pred(s)) continue; let k = 0, edge = false; const st = [s]; seen[s] = 1;
    while (st.length) { const c = st.pop(), i = c % R, j = (c / R) | 0; if (inPlay(i, j)) k++; if (i === 0 || j === 0 || i === R - 1 || j === R - 1) edge = true;
      for (const q of [c - 1, c + 1, c - R, c + R]) if (q >= 0 && q < n && Math.abs((q % R) - i) <= 1 && !seen[q] && pred(q)) { seen[q] = 1; st.push(q); } }
    out.push({ km2: k * a, edge }); } return out; };
  const isl = comps((c) => d.land[c] >= 0).filter((p) => !p.edge && p.km2 >= 2);
  const heart = comps((c) => d.land[c] >= 0 && d.mesa[c] < 0.5 && d.U[c] < 0.4e-3).map((p) => p.km2).sort((x, y) => y - x);
  rows.push({ seed, bad: 100 * bad / land, islands: isl.length, islandKm2: isl.reduce((s, p) => s + p.km2, 0), massif: hmax, heart: heart.slice(0, 3).map((x) => Math.round(x)) });
}
console.log('seed     badlands  islands (km²)  massif start  three largest heartlands (km²)');
for (const r of rows) console.log(`${String(r.seed).padEnd(8)} ${r.bad.toFixed(0).padStart(5)}%   ${String(r.islands).padStart(3)} (${r.islandKm2.toFixed(0).padStart(3)})    ${r.massif.toFixed(0).padStart(5)} m     ${r.heart.join(', ')}`);
