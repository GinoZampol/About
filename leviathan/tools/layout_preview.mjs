// Top-view previews of seeded layouts, before spending minutes on a full generation.
//   node tools/layout_preview.mjs out.png [--sea=sounds|basin] [--second=auto|none] [--tile=360] [--cols=3] seed seed ...
// Shows the design the generator starts from (sea, plains, hills, ranges, tableland), with the coastal
// lowland rule applied; erosion, rivers and vegetation come later and are not in this picture.
import { buildDesign, setVariant } from '../worldgen/design.mjs';
import { setSeaStyle, setSecond } from '../worldgen/layout.mjs';
import { writePNG } from '../worldgen/png.mjs';
const args = process.argv.slice(2), opt = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const pos = args.filter((a) => !a.startsWith('--')), out = pos[0], seeds = pos.slice(1).map(Number);
const T = +opt('tile', 360), cols = +opt('cols', 3), styles = opt('sea', 'basin').split(',');
const tiles = []; for (const st of styles) for (const s of seeds) tiles.push([st, s]);
const rows = Math.ceil(tiles.length / cols), W = cols * T, H = rows * T, rgb = new Uint8Array(W * H * 3);
setVariant('S'); setSecond(opt('second', 'none'));
tiles.forEach(([style, seed], k) => {
  setSeaStyle(style);
  // the design exactly as the generator builds it (same grid, same hidden margin), cropped to the playable 50 km
  const R = +opt('grid', 1024), MARGIN = 3, SIZE = 50 + 2 * MARGIN, D = buildDesign(R, seed, { x0: -MARGIN, size: SIZE });
  const ox = (k % cols) * T, oy = Math.floor(k / cols) * T, at = (i) => Math.min(R - 1, Math.floor(((i + 0.5) / T * 50 + MARGIN) / SIZE * R));
  let sea = 0;
  for (let j = 0; j < T; j++) for (let i = 0; i < T; i++) {
    const cx = at(i), cy = at(j), c = cy * R + cx, u = D.U[c] * 1e3; let col;
    if (D.land[c] < 0) { sea++; const t = Math.min(1, -D.land[c] / 6); col = [52 - 26 * t, 104 - 44 * t, 168 - 46 * t]; }
    else {
      col = D.mesa[c] > 0.5 ? [201, 146, 98] : u < 0.06 ? [158, 198, 116] : u < 0.3 ? [104, 156, 84] : u < 1.1 ? [142, 136, 124] : [246, 246, 250];
      const hx = D.h0[cy * R + at(Math.min(T - 1, i + 1))] - D.h0[cy * R + at(Math.max(0, i - 1))], hy = D.h0[at(Math.min(T - 1, j + 1)) * R + cx] - D.h0[at(Math.max(0, j - 1)) * R + cx];
      const sh = Math.max(0.55, Math.min(1.3, 1 + (hx - hy) * 0.0016)); col = col.map((v) => Math.min(255, v * sh));
    }
    if (i === 0 || j === 0) col = [16, 18, 22];
    const o = ((oy + T - 1 - j) * W + ox + i) * 3; rgb[o] = col[0]; rgb[o + 1] = col[1]; rgb[o + 2] = col[2];   // north up
  }
  console.log(`${style} seed ${seed}: sea ${(100 * sea / (T * T)).toFixed(0)}%`);
});
writePNG(out, rgb, W, H);
