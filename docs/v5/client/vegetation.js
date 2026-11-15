// Vegetation and rock rendering: a small library of procedurally modelled 3D assets (real trunks,
// branches, fronds, leaf clusters, boulders), drawn with GPU instancing in three LOD rings.
import * as THREE from 'three';
import { ATMO, SHADOW_FRAG } from './materials.js';
import { T, TYPE_COUNT } from './vegPlacement.js';
import { mulberry32, hash2 } from '../shared/noise.mjs';

// ---------------------------------------------------------------------------------------------
// geometry builder. vertex colour: r = occlusion, g = wind weight, b = 0 bark | 0.5 solid foliage | 1 card foliage
class Geo {
  constructor() { this.p = []; this.n = []; this.uv = []; this.c = []; this.i = []; }
  v(x, y, z, nx, ny, nz, u, vv, ao, sway, kind) { this.p.push(x, y, z); this.n.push(nx, ny, nz); this.uv.push(u, vv); this.c.push(ao, sway, kind); return this.p.length / 3 - 1; }
  tube(pts, radii, sides, kind = 0, sway0 = 0, sway1 = 0) {
    const rings = [];
    for (let k = 0; k < pts.length; k++) {
      const a = pts[Math.max(0, k - 1)], b = pts[Math.min(pts.length - 1, k + 1)];
      const t = new THREE.Vector3().subVectors(b, a).normalize();
      const u = new THREE.Vector3(1, 0, 0); if (Math.abs(t.x) > 0.9) u.set(0, 0, 1);
      const bx = new THREE.Vector3().crossVectors(t, u).normalize(), by = new THREE.Vector3().crossVectors(t, bx);
      const ring = [];
      for (let s = 0; s <= sides; s++) {
        const an = s / sides * 6.2832, cx = Math.cos(an), cy = Math.sin(an);
        const nx = bx.x * cx + by.x * cy, ny = bx.y * cx + by.y * cy, nz = bx.z * cx + by.z * cy;
        const f = k / (pts.length - 1);
        ring.push(this.v(pts[k].x + nx * radii[k], pts[k].y + ny * radii[k], pts[k].z + nz * radii[k], nx, ny, nz, s / sides * 2, pts[k].y * 0.25, 0.75 + 0.25 * f, sway0 + (sway1 - sway0) * f, kind));
      }
      rings.push(ring);
    }
    for (let k = 0; k < rings.length - 1; k++) for (let s = 0; s < sides; s++) { const a = rings[k][s], b = rings[k][s + 1], c = rings[k + 1][s], d = rings[k + 1][s + 1]; this.i.push(a, b, c, b, d, c); }
  }
  // textured quad; n = shading normal (soft, crown-like), ao0/ao1 = occlusion at v=0 / v=1
  quad(o, ax, ay, n, ao0, ao1, sw0, sw1, kind = 1) {
    const a = this.v(o.x - ax.x, o.y - ax.y, o.z - ax.z, n.x, n.y, n.z, 0, 0, ao0, sw0, kind);
    const b = this.v(o.x + ax.x, o.y + ax.y, o.z + ax.z, n.x, n.y, n.z, 1, 0, ao0, sw0, kind);
    const c = this.v(o.x - ax.x + ay.x, o.y - ax.y + ay.y, o.z - ax.z + ay.z, n.x, n.y, n.z, 0, 1, ao1, sw1, kind);
    const d = this.v(o.x + ax.x + ay.x, o.y + ax.y + ay.y, o.z + ax.z + ay.z, n.x, n.y, n.z, 1, 1, ao1, sw1, kind);
    this.i.push(a, b, c, b, d, c);
  }
  cone(y0, y1, r, sides, rnd, ao0, kind = 0.5) {
    const tip = this.v(0, y1, 0, 0, 1, 0, 0.5, 1, 1, 1, kind);
    const ring = [];
    for (let s = 0; s <= sides; s++) {
      const an = s / sides * 6.2832, rr = r * (0.85 + 0.3 * rnd());
      const nx = Math.cos(an), nz = Math.sin(an), sl = r / (y1 - y0);
      const l = 1 / Math.hypot(1, sl);
      ring.push(this.v(nx * rr, y0 + (rnd() - 0.5) * r * 0.25, nz * rr, nx * l, sl * l, nz * l, s / sides * 3, 0, ao0, 0.6, kind));
    }
    this.p[ring[sides] * 3] = this.p[ring[0] * 3]; this.p[ring[sides] * 3 + 1] = this.p[ring[0] * 3 + 1]; this.p[ring[sides] * 3 + 2] = this.p[ring[0] * 3 + 2];
    for (let s = 0; s < sides; s++) this.i.push(ring[s + 1], ring[s], tip);
  }
  blob(cx, cy, cz, rx, ry, detail, rnd, kind = 0.5, center = null) {
    const g = new THREE.IcosahedronGeometry(1, detail), pos = g.attributes.position, base = this.p.length / 3;
    const seen = new Map();
    for (let k = 0; k < pos.count; k++) {
      const x = pos.getX(k), y = pos.getY(k), z = pos.getZ(k), key = `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
      let f = seen.get(key); if (f === undefined) { f = 0.8 + 0.4 * rnd(); seen.set(key, f); }
      const px = cx + x * rx * f, py = cy + y * ry * f, pz = cz + z * rx * f;
      let nx = x, ny = y, nz = z;
      if (center) { nx = px - center.x; ny = py - center.y; nz = pz - center.z; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l; }
      this.v(px, py, pz, nx, ny, nz, x * 1.5 + rnd() * 0.01, y * 1.5, 0.6 + 0.4 * (y * 0.5 + 0.5), 0.7, kind);
    }
    for (let k = 0; k < pos.count; k++) this.i.push(base + k);
    g.dispose();
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setIndex(this.i); g.computeBoundingSphere(); return g;
  }
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);

function conifer(P, lod, seed) {
  const g = new Geo(), rnd = mulberry32(seed), H = P.H;
  if (lod === 2) { g.cone(H * P.base * 0.9, H, P.R * 0.8, 6, rnd, 0.55); return g.build(); }
  if (lod === 1) {
    g.tube([V(0, 0, 0), V(0, H * 0.9, 0)], [P.tr, 0.04], 5);
    const tiers = 4;
    for (let k = 0; k < tiers; k++) { const t = k / tiers, y0 = H * (P.base + (1 - P.base) * t), y1 = Math.min(H, y0 + H * (1 - P.base) * (1.5 / tiers) + 1); g.cone(y0, y1, P.R * (1 - t * 0.78), 7, rnd, 0.45 + 0.1 * k); }
    return g.build();
  }
  g.tube([V(0, 0, 0), V(0.05, H * 0.3, 0.03), V(-0.03, H * 0.65, 0.02), V(0, H, 0)], [P.tr * 1.15, P.tr * 0.8, P.tr * 0.45, 0.02], 7, 0, 0, 0.3);
  for (let w = 0; w < P.whorls; w++) {
    const t = w / (P.whorls - 1), y = H * (P.base + (1 - P.base) * Math.pow(t, 0.92)), len = P.R * Math.pow(1 - t, 0.72) + 0.4;
    for (let k = 0; k < P.per; k++) {
      const an = k / P.per * 6.2832 + w * 2.4 + rnd() * 0.5, dx = Math.cos(an), dz = Math.sin(an), L = len * (0.8 + 0.4 * rnd());
      const droop = P.droop * (0.7 + 0.6 * rnd()) * (1 - 0.6 * t), wd = L * 0.36;
      const side = V(-dz * wd, 0, dx * wd), n = V(dx * 0.45, 0.9, dz * 0.45).normalize();
      const o1 = V(dx * 0.05, y, dz * 0.05), along1 = V(dx * L * 0.55, L * 0.06, dz * L * 0.55), along2 = V(dx * L * 0.45, -L * droop, dz * L * 0.45);
      // two bent segments of a needle frond
      const a = g.v(o1.x - side.x * 0.5, o1.y, o1.z - side.z * 0.5, n.x, n.y, n.z, 0, 0, 0.35, 0.05, 1), b = g.v(o1.x + side.x * 0.5, o1.y, o1.z + side.z * 0.5, n.x, n.y, n.z, 1, 0, 0.35, 0.05, 1);
      const m = V().addVectors(o1, along1), c = g.v(m.x - side.x, m.y, m.z - side.z, n.x, n.y, n.z, 0, 0.55, 0.7, 0.5, 1), d = g.v(m.x + side.x, m.y, m.z + side.z, n.x, n.y, n.z, 1, 0.55, 0.7, 0.5, 1);
      const e2 = V().addVectors(m, along2), e = g.v(e2.x - side.x * 0.6, e2.y, e2.z - side.z * 0.6, n.x, n.y, n.z, 0, 1, 1, 1, 1), f = g.v(e2.x + side.x * 0.6, e2.y, e2.z + side.z * 0.6, n.x, n.y, n.z, 1, 1, 1, 1, 1);
      g.i.push(a, b, c, b, d, c, c, d, e, d, f, e);
      // a hanging vertical fin gives the bough thickness from the side
      g.quad(V(m.x, m.y - L * 0.02, m.z), V(dx * L * 0.42, -L * droop * 0.4, dz * L * 0.42), V(0, -L * 0.28, 0), V(-dz * 0.5, 0.6, dx * 0.5).normalize(), 0.75, 0.5, 0.5, 0.7);
    }
  }
  for (let k = 0; k < 3; k++) { const an = k * 2.1; g.quad(V(0, H * 0.93, 0), V(Math.cos(an) * 0.5, 0, Math.sin(an) * 0.5), V(0, H * 0.09, 0), V(Math.cos(an + 1.57), 0.5, Math.sin(an + 1.57)).normalize(), 0.8, 1, 0.8, 1); }
  return g.build();
}

function broadleaf(P, lod, seed) {
  const g = new Geo(), rnd = mulberry32(seed), H = P.H, cy = H * P.cy, C = V(0, cy, 0);
  if (lod === 2) { g.blob(0, cy, 0, P.rx, P.ry, 0, rnd, 0.5); return g.build(); }
  const top = V((rnd() - 0.5) * 0.6, H * P.bare, (rnd() - 0.5) * 0.6);
  g.tube([V(0, 0, 0), V(top.x * 0.4, top.y * 0.5, top.z * 0.4), top], [P.tr * 1.2, P.tr * 0.85, P.tr * 0.6], lod ? 5 : 7);
  const nb = lod ? 0 : P.branches, tips = [];
  for (let k = 0; k < P.branches; k++) {
    const an = k / P.branches * 6.2832 + rnd(), r = P.rx * (0.45 + 0.3 * rnd());
    const tip = V(Math.cos(an) * r, cy + (rnd() - 0.3) * P.ry * 0.8, Math.sin(an) * r); tips.push(tip);
    if (k < nb) g.tube([top, V((top.x + tip.x) * 0.5, top.y + (tip.y - top.y) * 0.65, (top.z + tip.z) * 0.5), tip], [P.tr * 0.5, P.tr * 0.3, P.tr * 0.08], 5, 0, 0.05, 0.4);
  }
  if (!lod && P.leader) g.tube([top, V(0, cy + P.ry * 0.7, 0)], [P.tr * 0.55, 0.05], 5, 0, 0.1, 0.4);
  const nClus = lod === 1 ? Math.round(P.clusters * 0.36) : P.clusters, cardK = lod === 1 ? 1.65 : 1;
  for (let k = 0; k < nClus; k++) {
    // leaf clusters fill the crown shell, denser towards the outside
    let d = V(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1); if (d.lengthSq() < 0.01) d.set(0, 1, 0); d.normalize();
    const rr = Math.pow(rnd(), 0.4), p = V(d.x * P.rx * rr, cy + d.y * P.ry * rr, d.z * P.rx * rr);
    const sz = P.card * cardK * (0.75 + 0.5 * rnd()), n = V(d.x, d.y * 0.7 + 0.45, d.z).normalize(), ao = 0.42 + 0.58 * rr * (0.6 + 0.4 * (d.y * 0.5 + 0.5));
    const an = rnd() * 6.2832, ax = V(Math.cos(an) * sz * 0.5, 0, Math.sin(an) * sz * 0.5), up = V((rnd() - 0.5) * 0.5 * sz, sz, (rnd() - 0.5) * 0.5 * sz);
    g.quad(V(p.x, p.y - sz * 0.5, p.z), ax, up, n, ao * 0.85, ao, 0.6, 1);
    g.quad(V(p.x, p.y - sz * 0.5, p.z), V(-ax.z, 0, ax.x), up, n, ao * 0.85, ao, 0.6, 1);
    if (k % 3 === 0 && lod === 0) g.quad(V(p.x - ax.x * 0.3, p.y, p.z - ax.z * 0.3), ax, V(-ax.z * 2, sz * 0.15, ax.x * 2), n, ao, ao, 0.7, 1);
  }
  return g.build();
}

function snag(lod, seed) {
  const g = new Geo(), rnd = mulberry32(seed), H = 13;
  g.tube([V(0, 0, 0), V(0.1, H * 0.5, 0), V(-0.1, H, 0.1)], [0.36, 0.26, 0.1], lod ? 5 : 7);
  if (lod < 2) for (let k = 0; k < 5; k++) { const an = rnd() * 6.28, y = H * (0.45 + 0.5 * rnd()), L = 1.2 + 2 * rnd(); g.tube([V(0, y, 0), V(Math.cos(an) * L, y + L * 0.5, Math.sin(an) * L)], [0.09, 0.02], 4); }
  return g.build();
}
function bush(lod, seed, grey) {
  const g = new Geo(), rnd = mulberry32(seed), C = V(0, 0.5, 0);
  const n = lod ? 4 : grey ? 6 : 9;
  for (let k = 0; k < n; k++) {
    const an = k / n * 6.28 + rnd(), r = 0.45 * rnd() + 0.15, sz = 0.85 + 0.5 * rnd(), p = V(Math.cos(an) * r, 0, Math.sin(an) * r);
    const a2 = rnd() * 6.28, nn = V(Math.cos(an) * 0.6, 0.8, Math.sin(an) * 0.6).normalize();
    g.quad(p, V(Math.cos(a2) * sz * 0.5, 0, Math.sin(a2) * sz * 0.5), V(Math.cos(an) * 0.3, sz, Math.sin(an) * 0.3), nn, 0.45, 1, 0.1, 1);
  }
  return g.build();
}
function fern(seed) {
  const g = new Geo(), rnd = mulberry32(seed);
  for (let k = 0; k < 7; k++) {
    const an = k / 7 * 6.28 + rnd() * 0.5, dx = Math.cos(an), dz = Math.sin(an), L = 0.8 + 0.4 * rnd(), w = 0.2;
    const n = V(dx * 0.3, 0.95, dz * 0.3).normalize(), s = V(-dz * w, 0, dx * w);
    const a = g.v(-s.x * 0.3, 0.05, -s.z * 0.3, n.x, n.y, n.z, 0, 0, 0.4, 0, 1), b = g.v(s.x * 0.3, 0.05, s.z * 0.3, n.x, n.y, n.z, 1, 0, 0.4, 0, 1);
    const c = g.v(dx * L * 0.6 - s.x, 0.5, dz * L * 0.6 - s.z, n.x, n.y, n.z, 0, 0.55, 0.8, 0.5, 1), d = g.v(dx * L * 0.6 + s.x, 0.5, dz * L * 0.6 + s.z, n.x, n.y, n.z, 1, 0.55, 0.8, 0.5, 1);
    const e = g.v(dx * L - s.x * 0.5, 0.32, dz * L - s.z * 0.5, n.x, n.y, n.z, 0, 1, 1, 1, 1), f = g.v(dx * L + s.x * 0.5, 0.32, dz * L + s.z * 0.5, n.x, n.y, n.z, 1, 1, 1, 1, 1);
    g.i.push(a, b, c, b, d, c, c, d, e, d, f, e);
  }
  return g.build();
}
function grassTuft() {
  const g = new Geo();
  for (let k = 0; k < 3; k++) { const an = k * 1.047 + 0.3, ax = V(Math.cos(an) * 0.42, 0, Math.sin(an) * 0.42); g.quad(V(0, 0, 0), ax, V(-ax.z * 0.25, 1, ax.x * 0.25), V(0, 1, 0), 0.45, 1, 0, 1); }
  return g.build();
}
function rock(seed, slab, detail) {
  const rnd = mulberry32(seed), src = new THREE.IcosahedronGeometry(1, detail), pos = src.attributes.position;
  const g = new Geo(), o = [rnd() * 9, rnd() * 9, rnd() * 9];
  const disp = (x, y, z) => {
    let f = 1 + 0.26 * Math.sin(x * 2.1 + o[0]) * Math.sin(y * 2.3 + o[1]) + 0.2 * Math.sin(z * 2.7 + o[2]) * Math.cos(x * 1.7 + o[1]) + 0.1 * Math.sin(x * 5.1 + y * 4.3 + z * 4.7 + o[0]);
    if (slab) { const q = 0.34; x = Math.round(x / q) * q; y = Math.round(y / 0.5) * 0.5; z = Math.round(z / q) * q; }
    return [x * f, y * f * (slab ? 0.8 : 0.85), z * f];
  };
  for (let k = 0; k < pos.count; k += 3) {
    const a = disp(pos.getX(k), pos.getY(k), pos.getZ(k)), b = disp(pos.getX(k + 1), pos.getY(k + 1), pos.getZ(k + 1)), c = disp(pos.getX(k + 2), pos.getY(k + 2), pos.getZ(k + 2));
    const n = V(b[0] - a[0], b[1] - a[1], b[2] - a[2]).cross(V(c[0] - a[0], c[1] - a[1], c[2] - a[2])).normalize();
    for (const p of [a, b, c]) {
      // faceted for bedded rock, smoothed for massive rock
      const l = Math.hypot(p[0], p[1], p[2]) || 1, sm = slab ? 0.15 : 0.7;
      const nx = n.x * (1 - sm) + p[0] / l * sm, ny = n.y * (1 - sm) + p[1] / l * sm, nz = n.z * (1 - sm) + p[2] / l * sm, nl = Math.hypot(nx, ny, nz);
      g.i.push(g.v(p[0], p[1], p[2], nx / nl, ny / nl, nz / nl, p[0] + p[2], p[1], 0.55 + 0.45 * (p[1] * 0.5 + 0.5), 0, 0));
    }
  }
  src.dispose(); return g.build();
}
function log(seed) { const g = new Geo(); g.tube([V(-4, 0.1, 0), V(0, 0.2, 0.15), V(4.5, 0.05, 0)], [0.42, 0.36, 0.26], 6); return g.build(); }

// ---------------------------------------------------------------------------------------------
// procedural textures
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); draw(x, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function makeTextures() {
  const rnd = mulberry32(77);
  const frond = canvasTex(128, 256, (x, w, h) => {
    x.strokeStyle = '#4a3a22'; x.lineWidth = 3; x.beginPath(); x.moveTo(w / 2, 0); x.lineTo(w / 2, h * 0.97); x.stroke();
    for (let k = 0; k < 520; k++) {
      const t = rnd(), y = t * h * 0.97, side = rnd() < 0.5 ? -1 : 1, len = (0.2 + 0.8 * Math.sin(Math.min(1, t * 1.1 + 0.08) * 3.0)) * w * 0.47 * (0.6 + 0.4 * rnd());
      const l = 120 + rnd() * 110; x.strokeStyle = `rgb(${l * 0.72 | 0},${l | 0},${l * 0.55 | 0})`; x.lineWidth = 1.6 + rnd() * 1.6;
      x.beginPath(); x.moveTo(w / 2, y); x.lineTo(w / 2 + side * len, y + len * (0.25 + 0.3 * rnd())); x.stroke();
    }
  });
  const leaves = canvasTex(256, 256, (x, w, h) => {
    x.strokeStyle = '#3d2f1c'; x.lineWidth = 2;
    for (let k = 0; k < 9; k++) { x.beginPath(); x.moveTo(w / 2, h); x.quadraticCurveTo(w / 2 + (rnd() - 0.5) * 80, h * 0.6, w * rnd(), h * rnd() * 0.6); x.stroke(); }
    for (let k = 0; k < 330; k++) {
      const a = rnd() * 6.28, r = Math.pow(rnd(), 0.6) * w * 0.47, px = w / 2 + Math.cos(a) * r, py = h * 0.52 + Math.sin(a) * r * 0.98, l = 105 + rnd() * 130;
      const l2 = l * (0.45 + 0.55 * (k / 330)); x.fillStyle = `rgb(${l2 * 0.8 | 0},${l2 | 0},${l2 * 0.45 | 0})`; x.save(); x.translate(px, py); x.rotate(rnd() * 6.28); x.beginPath(); x.ellipse(0, 0, 8 + rnd() * 6, 4 + rnd() * 2.5, 0, 0, 6.28); x.fill(); x.restore();
    }
  });
  const blades = canvasTex(128, 128, (x, w, h) => {
    for (let k = 0; k < 42; k++) {
      const bx = w * (0.08 + 0.84 * rnd()), top = h * (0.02 + 0.5 * rnd() * rnd()), lean = (rnd() - 0.5) * 34, l = 130 + rnd() * 110, bw = 2.2 + rnd() * 2.4;
      x.fillStyle = `rgb(${l | 0},${l | 0},${l | 0})`; x.beginPath(); x.moveTo(bx - bw, h); x.quadraticCurveTo(bx + lean * 0.3, h * 0.5, bx + lean, top); x.quadraticCurveTo(bx + lean * 0.4 + bw, h * 0.5, bx + bw, h); x.fill();
    }
  });
  const bark = canvasTex(128, 128, (x, w, h) => {
    x.fillStyle = '#8a8a8a'; x.fillRect(0, 0, w, h);
    for (let k = 0; k < 700; k++) { const l = 60 + rnd() * 150; x.strokeStyle = `rgba(${l | 0},${l | 0},${l | 0},0.5)`; x.lineWidth = 1 + rnd() * 2.5; const px = rnd() * w, py = rnd() * h, len = 8 + rnd() * 34; x.beginPath(); x.moveTo(px, py); x.lineTo(px + (rnd() - 0.5) * 4, py + len); x.stroke(); }
  }, true);
  return { frond, leaves, blades, bark };
}

// ---------------------------------------------------------------------------------------------
const VEG_VERT = /* glsl */`
uniform float uFade; uniform float uWind;
varying vec2 vUv; varying vec3 vCol; varying vec3 vTint; varying vec3 vWPos; varying vec3 vN; varying float vViewZ;
#include <common>
#include <shadowmap_pars_vertex>
${ATMO.split('vec3 S(')[0]}
void main() {
  vUv = uv; vCol = color;
  vec3 p = position;
  mat4 im = mat4(1.0);
  #ifdef USE_INSTANCING
  im = instanceMatrix;
  #endif
  #ifdef USE_INSTANCING_COLOR
  vTint = instanceColor;
  #else
  vTint = vec3(1.0);
  #endif
  vec3 origin = (modelMatrix * im * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vec4 worldPosition = modelMatrix * im * vec4(p, 1.0);
  // wind: slow whole-crown sway plus faster leaf flutter, weighted by distance from the trunk
  float ph = origin.x * 0.05 + origin.z * 0.07;
  float sway = sin(uTime * 1.1 + ph) * 0.5 + sin(uTime * 2.7 + ph * 1.7 + p.y) * 0.25;
  float h01 = clamp(p.y / 12.0, 0.0, 1.0);
  worldPosition.xz += uWind * (vec2(0.8, 0.45) * sway * (0.04 * h01 * h01 * 6.0 + color.g * 0.10) + color.g * 0.03 * vec2(sin(uTime * 5.0 + p.x * 3.0), cos(uTime * 4.3 + p.z * 3.0)));
  float d = distance(origin, cameraPosition);
  float fade = 1.0 - smoothstep(uFade * 0.86, uFade, d);
  worldPosition.xyz = origin + (worldPosition.xyz - origin) * fade;
  vWPos = worldPosition.xyz;
  vN = normalize(mat3(modelMatrix * im) * normal);
  vec4 mv = viewMatrix * worldPosition; vViewZ = -mv.z;
  gl_Position = projectionMatrix * mv;
  vec3 transformedNormal = mat3(viewMatrix) * vN;
  #include <shadowmap_vertex>
}
`;
const VEG_FRAG = /* glsl */`
uniform sampler2D uLeaf; uniform sampler2D uBark; uniform sampler2D uNoise;
uniform vec3 uLeafCol; uniform vec3 uBarkCol; uniform float uTrans; uniform float uRockMode;
varying vec2 vUv; varying vec3 vCol; varying vec3 vTint; varying vec3 vWPos; varying vec3 vN; varying float vViewZ;
#include <common>
#include <packing>
#include <shadowmap_pars_fragment>
${ATMO}
${SHADOW_FRAG}
void main() {
  vec3 alb; float trans = 0.0;
  float dist = distance(vWPos, cameraPosition);
  vec3 N = normalize(vN);
  if (vCol.b > 0.75) {
    vec4 t = texture2D(uLeaf, vUv);
    if (t.a * (1.0 + smoothstep(15.0, 120.0, dist) * 1.3) < 0.42) discard;
    alb = uLeafCol * (0.4 + 1.4 * t.g) * vTint; trans = uTrans;
    if (!gl_FrontFacing) N = N;
  } else if (vCol.b > 0.25) {
    vec4 n = texture2D(uNoise, vUv * 0.7);
    alb = uLeafCol * (0.4 + 0.8 * n.g) * vTint * 0.8; trans = uTrans * 0.5;
    N = normalize(N + (n.rgb - 0.5) * 0.9);
  } else {
    vec3 b = texture2D(uBark, vUv).rgb;
    alb = mix(uBarkCol * (0.45 + 1.1 * b.r), vTint * (0.6 + 0.8 * texture2D(uNoise, vUv * 0.35).r) * (0.75 + 0.5 * b.g), uRockMode);
    alb = mix(alb, alb * vec3(0.72, 0.82, 0.62), uRockMode * smoothstep(0.3, 0.9, N.y) * texture2D(uNoise, vWPos.xz * 0.11).b * 0.8);
  }
  float ao = vCol.r;
  float ndl = max(dot(N, uSunDir), 0.0);
  ndl = mix(ndl, 0.4 + 0.6 * ndl, trans);
  float sh = sunShadow(vViewZ, 1.0) * cloudShadow(vWPos);
  vec3 V = normalize(cameraPosition - vWPos);
  float back = pow(max(dot(-V, uSunDir), 0.0), 3.0) * trans;
  vec3 amb = mix(uAmbGround, uAmbSky, N.y * 0.5 + 0.5) * ao;
  vec3 lit = alb * (uSunCol * (ndl * mix(1.0, ao, 0.5) + back * 0.6) * sh + amb);
  gl_FragColor = vec4(applyAtmosphere(lit, vWPos), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;
const lin = (r, g, b) => new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);

export class Vegetation {
  constructor({ scene, world, terrain, shared, mats, tex, csm, treeDist, grassDist }) {
    this.world = world; this.terrain = terrain; this.treeDist = treeDist; this.grassDist = grassDist;
    this.group = new THREE.Group(); scene.add(this.group);
    this.tiles = new Map(); this.pending = 0; this.stats = { instances: 0, tiles: 0 }; this.lastPos = new THREE.Vector3(1e9, 0, 0);
    this.midDist = Math.min(520, treeDist * 0.42); this.nearDist = 130;
    const tx = makeTextures();
    const mat = (leafTex, leafCol, barkCol, o = {}) => {
      const m = new THREE.ShaderMaterial({
        uniforms: { ...mats.base(), uLeaf: { value: leafTex }, uBark: { value: tx.bark }, uNoise: { value: tex.noise }, uLeafCol: { value: leafCol }, uBarkCol: { value: barkCol }, uTrans: { value: o.trans ?? 0.6 }, uRockMode: { value: o.rock ? 1 : 0 }, uFade: { value: o.fade ?? treeDist }, uWind: { value: o.wind ?? 1 } },
        vertexShader: VEG_VERT, fragmentShader: VEG_FRAG, lights: true, vertexColors: true, side: o.rock ? THREE.FrontSide : THREE.DoubleSide,
      });
      m.userData.leafTex = leafTex; return m;
    };
    const bark = lin(0.30, 0.24, 0.18);
    const M = {
      broad: mat(tx.leaves, lin(0.18, 0.26, 0.10), lin(0.33, 0.29, 0.23)), conifer: mat(tx.frond, lin(0.12, 0.20, 0.10), bark, { trans: 0.35 }),
      giant: mat(tx.frond, lin(0.09, 0.16, 0.09), lin(0.33, 0.21, 0.15), { trans: 0.3 }), pine: mat(tx.leaves, lin(0.18, 0.26, 0.13), lin(0.37, 0.28, 0.22), { trans: 0.4 }),
      birch: mat(tx.leaves, lin(0.28, 0.35, 0.15), lin(0.80, 0.79, 0.74)), snag: mat(tx.leaves, lin(0.3, 0.3, 0.3), lin(0.52, 0.49, 0.45), { wind: 0 }),
      bush: mat(tx.leaves, lin(0.22, 0.30, 0.12), bark, { fade: this.midDist }), sage: mat(tx.leaves, lin(0.44, 0.47, 0.36), bark, { fade: this.midDist, trans: 0.3 }),
      rock: mat(tx.leaves, lin(0.5, 0.5, 0.5), bark, { rock: true, wind: 0, fade: this.midDist, trans: 0 }), log: mat(tx.leaves, lin(0.2, 0.3, 0.1), lin(0.34, 0.27, 0.2), { wind: 0, fade: this.midDist }),
      fern: mat(tx.frond, lin(0.19, 0.29, 0.11), bark, { fade: 140 }), grass: mat(tx.blades, new THREE.Color(1, 1, 1), bark, { fade: Math.max(grassDist, 1), trans: 0.7 }),
    };
    this.depthMats = new Map();
    const depthFor = (m) => { const t = m.userData.leafTex; if (!this.depthMats.has(t)) this.depthMats.set(t, new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: t, alphaTest: 0.4, side: THREE.DoubleSide })); return this.depthMats.get(t); };
    const CON = { H: 24, tr: 0.33, base: 0.16, R: 3.7, whorls: 13, per: 5, droop: 0.42 }, GIA = { H: 54, tr: 1.0, base: 0.4, R: 6.6, whorls: 17, per: 6, droop: 0.5 };
    const BRO = { H: 17, tr: 0.36, cy: 0.64, bare: 0.36, rx: 5.2, ry: 4.6, branches: 5, clusters: 34, card: 3.0, leader: true };
    const PIN = { H: 20, tr: 0.3, cy: 0.8, bare: 0.66, rx: 3.3, ry: 2.4, branches: 4, clusters: 16, card: 2.6, leader: true };
    const BIR = { H: 15, tr: 0.15, cy: 0.66, bare: 0.4, rx: 2.5, ry: 4.4, branches: 4, clusters: 20, card: 2.0, leader: true };
    const A = this.assets = [];
    const def = (t, geos, material, shadow = true, alpha = true) => { A[t] = { geos, material, shadow, depth: alpha ? depthFor(material) : undefined }; };
    def(T.BROADLEAF, [0, 1, 2].map((l) => broadleaf(BRO, l, 11)), M.broad);
    def(T.CONIFER, [0, 1, 2].map((l) => conifer(CON, l, 12)), M.conifer);
    def(T.GIANT, [0, 1, 2].map((l) => conifer(GIA, l, 13)), M.giant);
    def(T.PINE, [0, 1, 2].map((l) => broadleaf(PIN, l, 14)), M.pine);
    def(T.BIRCH, [0, 1, 2].map((l) => broadleaf(BIR, l, 15)), M.birch);
    def(T.SNAG, [snag(0, 16), snag(1, 16), snag(2, 16)], M.snag, true, false);
    def(T.BUSH, [bush(0, 17), bush(1, 17)], M.bush);
    def(T.SAGE, [bush(0, 18, true), bush(1, 18, true)], M.sage, false);
    def(T.ROCK_ROUND, [rock(19, false, 2), rock(19, false, 1)], M.rock, true, false);
    def(T.ROCK_SLAB, [rock(20, true, 2), rock(20, true, 1)], M.rock, true, false);
    def(T.LOG, [log(21)], M.log, true, false);
    def(T.FERN, [fern(22)], M.fern, false);
    def(T.GRASS, [grassTuft()], M.grass, false);
    this.colliderTiles = new Map();
  }

  get busy() { return this.pending > 0; }

  _want(pos) {
    const want = new Map(), S = this.world.S, B = 512;
    const dist = (x0, z0, s) => Math.hypot(Math.max(x0 - pos.x, 0, pos.x - x0 - s), Math.max(z0 - pos.z, 0, pos.z - z0 - s));
    const yPen = Math.max(0, pos.y - this.world.ground(pos.x, pos.z) - 150);   // high above the ground the near rings are pointless
    const i0 = Math.max(0, Math.floor((pos.x - this.treeDist) / B)), i1 = Math.min(Math.ceil(S / B) - 1, Math.floor((pos.x + this.treeDist) / B));
    const j0 = Math.max(0, Math.floor((pos.z - this.treeDist) / B)), j1 = Math.min(Math.ceil(S / B) - 1, Math.floor((pos.z + this.treeDist) / B));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x0 = i * B, z0 = j * B, d = dist(x0, z0, B); if (d > this.treeDist) continue;
      if (d + yPen > this.midDist) { want.set(`2:${x0}:${z0}`, { x0, z0, size: B, lod: 2 }); continue; }
      for (let b = 0; b < 2; b++) for (let a = 0; a < 2; a++) {
        const x1 = x0 + a * 256, z1 = z0 + b * 256, d1 = dist(x1, z1, 256);
        if (d1 + yPen > this.nearDist) { want.set(`1:${x1}:${z1}`, { x0: x1, z0: z1, size: 256, lod: 1 }); continue; }
        for (let q = 0; q < 16; q++) { const x2 = x1 + (q & 3) * 64, z2 = z1 + (q >> 2) * 64; const near = dist(x2, z2, 64) < this.nearDist; want.set(`${near ? 0 : 'm'}:${x2}:${z2}`, { x0: x2, z0: z2, size: 64, lod: near ? 0 : 1 }); }
      }
    }
    if (this.grassDist > 0 && yPen < 1) {
      const G = 24, r = this.grassDist;
      for (let j = Math.floor((pos.z - r) / G); j <= Math.floor((pos.z + r) / G); j++) for (let i = Math.floor((pos.x - r) / G); i <= Math.floor((pos.x + r) / G); i++) {
        if (dist(i * G, j * G, G) < r) want.set(`g:${i * G}:${j * G}`, { x0: i * G, z0: j * G, size: G, lod: 0, kind: 'grass' });
      }
    }
    return want;
  }

  update(pos) {
    if (pos.distanceTo(this.lastPos) < 6 && !this.dirty) return;
    this.lastPos.copy(pos); this.dirty = false;
    const want = this._want(pos); this.want = want;
    for (const [key, w] of want) if (!this.tiles.has(key)) {
      this.tiles.set(key, { ...w, state: 1, meshes: [] }); this.pending++;
      this.terrain.extraQueue.push({ type: 'veg', key, x0: w.x0, z0: w.z0, size: w.size, lod: w.lod, kind: w.kind });
    }
    this._sweep();
  }
  // remove tiles that are no longer wanted, but only once whatever replaces them has arrived
  _sweep() {
    const want = this.want; if (!want) return;
    const pendingRects = [];
    for (const [key, t] of this.tiles) if (t.state === 1 && want.has(key)) pendingRects.push(t);
    for (const [key, t] of this.tiles) {
      if (want.has(key) || t.state === 1) continue;
      const covered = t.kind !== 'grass' && pendingRects.some((p) => p.kind !== 'grass' && p.x0 < t.x0 + t.size && p.x0 + p.size > t.x0 && p.z0 < t.z0 + t.size && p.z0 + p.size > t.z0);
      if (covered) continue;
      for (const m of t.meshes) { this.group.remove(m); m.dispose(); this.stats.instances -= m.count; }
      this.tiles.delete(key); this.colliderTiles.delete(key);
    }
    this.stats.tiles = this.tiles.size;
  }
  onMessage(m) {
    if (m.type !== 'veg') return;
    this.pending--;
    const t = this.tiles.get(m.key); if (!t) return;
    t.state = 2;
    if (!this.want || !this.want.has(m.key)) { this.tiles.delete(m.key); this._sweep(); return; }
    const cx = t.x0 + t.size / 2, cz = t.z0 + t.size / 2;
    for (const g of m.groups) {
      const a = this.assets[g.t], geo = a.geos[Math.min(t.lod, a.geos.length - 1)], n = g.mats.length / 16;
      const mesh = new THREE.InstancedMesh(geo, a.material, n);
      mesh.instanceMatrix = new THREE.InstancedBufferAttribute(g.mats, 16); mesh.instanceColor = new THREE.InstancedBufferAttribute(g.cols, 3);
      let minY = 1e9, maxY = -1e9; for (let k = 13; k < g.mats.length; k += 16) { if (g.mats[k] < minY) minY = g.mats[k]; if (g.mats[k] > maxY) maxY = g.mats[k]; }
      mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(cx, (minY + maxY) / 2 + 12, cz), Math.hypot(t.size * 0.75, (maxY - minY) / 2 + 40));
      mesh.frustumCulled = true; mesh.matrixAutoUpdate = false;
      mesh.castShadow = a.shadow && t.lod < 2; mesh.receiveShadow = true; if (a.depth) mesh.customDepthMaterial = a.depth;
      this.group.add(mesh); t.meshes.push(mesh); this.stats.instances += n;
    }
    if (m.colliders.length) this.colliderTiles.set(m.key, m.colliders);
    this.dirty = true; this._sweep();
  }
  collidersNear(x, z) {
    const out = [];
    for (const arr of this.colliderTiles.values()) for (let k = 0; k < arr.length; k += 4) { if (Math.abs(arr[k] - x) < 8 && Math.abs(arr[k + 1] - z) < 8) out.push({ x: arr[k], z: arr[k + 1], r: arr[k + 2], top: arr[k + 3] }); }
    return out;
  }
}
