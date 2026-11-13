// Binary codecs for world data. Files are gzip streams (Node zlib / browser DecompressionStream).

// 16-bit raster <-> byte planes of zig-zag residuals of a 2D (left + up - upleft) predictor.
export function encodeU16(src, N) {
  const out = new Uint8Array(N * N * 2);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const c = j * N + i;
    const a = i > 0 ? src[c - 1] : 0, b = j > 0 ? src[c - N] : 0, d = i > 0 && j > 0 ? src[c - N - 1] : 0;
    const pred = j === 0 ? a : i === 0 ? b : a + b - d;
    const r = ((src[c] - pred) << 16) >> 16;      // wrap to int16
    const z = ((r << 1) ^ (r >> 15)) & 0xffff;   // zig-zag
    out[c] = z & 255; out[N * N + c] = z >> 8;
  }
  return out;
}
export function decodeU16(bytes, N) {
  const out = new Uint16Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const c = j * N + i;
    const z = bytes[c] | (bytes[N * N + c] << 8);
    const r = (z >>> 1) ^ -(z & 1);
    const a = i > 0 ? out[c - 1] : 0, b = j > 0 ? out[c - N] : 0, d = i > 0 && j > 0 ? out[c - N - 1] : 0;
    const pred = j === 0 ? a : i === 0 ? b : a + b - d;
    out[c] = (pred + r) & 0xffff;
  }
  return out;
}
export const H_OFFSET = 300, H_SCALE = 1 / 16; // metres = u16 * H_SCALE - H_OFFSET
