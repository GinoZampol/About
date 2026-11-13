import zlib from 'node:zlib';
import fs from 'node:fs';
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td) >>> 0);
  return Buffer.concat([len, td, crc]);
}
// rgb: Uint8Array(w*h*3), row 0 = top
export function writePNG(path, rgb, w, h) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; Buffer.from(rgb.buffer, rgb.byteOffset + y * w * 3, w * 3).copy(raw, y * (w * 3 + 1) + 1); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  fs.writeFileSync(path, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 6 })), chunk('IEND', Buffer.alloc(0))]));
}
// 8-bit or 16-bit greyscale PNG (16-bit is what Unreal's Landscape importer expects for heightmaps)
export function writeGrayPNG(path, data, w, h, bits = 8) {
  const bpp = bits / 8, raw = Buffer.alloc((w * bpp + 1) * h);
  for (let y = 0; y < h; y++) {
    const o = y * (w * bpp + 1); raw[o] = 0;
    if (bits === 8) Buffer.from(data.buffer, data.byteOffset + y * w, w).copy(raw, o + 1);
    else for (let x = 0; x < w; x++) raw.writeUInt16BE(data[y * w + x], o + 1 + x * 2);
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = bits; ihdr[9] = 0;
  fs.writeFileSync(path, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 6 })), chunk('IEND', Buffer.alloc(0))]));
}
