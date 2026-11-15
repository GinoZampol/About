// Scenery beyond the playable border: a coarser run of the same world model over a 66 km square
// (8 km of margin on every side). Writes data/outer.bin and records it in data/world.json.
//   node worldgen/outer.mjs      (run after generate.mjs; about 1.5 minutes)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { erodeWorld } from './generate.mjs';
import { encodeU16, H_OFFSET, H_SCALE } from '../shared/codec.mjs';
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const metaFile = path.join(ROOT, 'data', 'world.json'), meta = JSON.parse(fs.readFileSync(metaFile));
const MARGIN = 8, R = 1024, size = 50 + 2 * MARGIN;
const { h } = erodeWorld({ seed: meta.seed, res: R, sizeM: size * 1000, K0: meta.config.K0, levels: [[256, 110, 20000], [512, 60, 10000], [1024, 40, 6000]], domain: { x0: -MARGIN, size } });
const q = new Uint16Array(R * R);
for (let j = 0; j < R; j++) for (let i = 0; i < R; i++) q[(R - 1 - j) * R + i] = Math.max(0, Math.min(65535, Math.round((h[j * R + i] + H_OFFSET) / H_SCALE)));
const enc = encodeU16(q, R);
fs.writeFileSync(path.join(ROOT, 'data', 'outer.bin'), zlib.gzipSync(Buffer.from(enc.buffer, enc.byteOffset, enc.byteLength), { level: 7 }));
meta.outer = { res: R, x0: -MARGIN * 1000, size: size * 1000 };
fs.writeFileSync(metaFile, JSON.stringify(meta, null, 1));
console.log('outer world written');
