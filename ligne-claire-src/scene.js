import * as THREE from 'three';
THREE.ColorManagement.enabled = false;
const V3 = THREE.Vector3;
const P = new URLSearchParams(location.search);
const W = 1952, H = 1352, SS = +(P.get('ss') || 2);
const INK = '#12131f';
const LAMP = [0.75, 1.13, -0.9];

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.setPixelRatio(1);
renderer.setSize(W * SS, H * SS, false);

const scene = new THREE.Scene();
let nextId = 1;
const newId = () => nextId++;

// ---------- helpers ----------
function place(o3, o) {
  if (o.p) o3.position.set(...o.p);
  if (o.r) o3.rotation.set(...o.r);
  if (o.s !== undefined) (typeof o.s === 'number' ? o3.scale.setScalar(o.s) : o3.scale.set(...o.s));
  (o.in || scene).add(o3);
  return o3;
}
function m(geo, color, o = {}) {
  const mat = new THREE.ShaderMaterial({ uniforms: { col: { value: new THREE.Color(color) }, raw: { value: o.raw ? 1 : 0 } }, side: o.double ? THREE.DoubleSide : THREE.FrontSide,
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform vec3 col; uniform float raw; varying vec3 vW; void main(){ vec3 c = col;
      if(raw < .5){ float d = distance(vW, vec3(${LAMP.join(',')}));
        vec3 night = c*vec3(0.36,0.43,0.62) + vec3(0.03,0.05,0.12);
        vec3 warm = c*vec3(1.0,0.95,0.80) + vec3(0.04,0.02,0.0);
        vec3 mid = c*vec3(0.70,0.62,0.66) + vec3(0.03,0.03,0.06);
        c = vW.y < 0.776 ? night : (d < 1.02 ? warm : (d < 1.5 ? mid : night)); }
      gl_FragColor = vec4(c, 1.); }` });
  const me = new THREE.Mesh(geo, mat);
  me.userData = { ink: !!o.ink, crease: !!o.crease, eid: o.eid ?? newId() };
  return place(me, o);
}
const G = (o = {}) => place(new THREE.Group(), o);
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const sph = (r = 1) => new THREE.SphereGeometry(r, 40, 24);
const cyl = (r1, r2, h, open = false, ts = 0, tl = Math.PI * 2) => new THREE.CylinderGeometry(r1, r2, h, 40, 1, open, ts, tl);
const cap = (r, l) => new THREE.CapsuleGeometry(r, l, 10, 24);
const tor = (R, r, arc = Math.PI * 2) => new THREE.TorusGeometry(R, r, 12, 64, arc);
const plane = (w, h) => new THREE.PlaneGeometry(w, h);
const circ = (r, ts = 0, tl = Math.PI * 2) => new THREE.CircleGeometry(r, 40, ts, tl);
function between(me, a, b) {
  const A = new V3(...a), B = new V3(...b);
  me.position.copy(A).add(B).multiplyScalar(0.5);
  me.quaternion.setFromUnitVectors(new V3(0, 1, 0), B.clone().sub(A).normalize());
  return A.distanceTo(B);
}
function limb(a, b, r, color, o = {}) {
  const len = new V3(...a).distanceTo(new V3(...b));
  const me = m(cap(r, len), color, o); between(me, a, b); return me;
}
function rod(a, b, r, color, o = {}) {
  const len = new V3(...a).distanceTo(new V3(...b));
  const me = m(cyl(r, r, len), color, o); between(me, a, b); return me;
}
function tube(pts, r, color, o = {}) {
  const c = new THREE.CatmullRomCurve3(pts.map(p => new V3(...p)));
  return m(new THREE.TubeGeometry(c, 80, r, 10, false), color, o);
}
function lathe(pts, color, o = {}) {
  return m(new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), 48), color, { double: true, ...o });
}
function poly(pts, color, o = {}) {
  const s = new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], p[1])));
  return m(new THREE.ShapeGeometry(s), color, { double: true, ...o });
}
function blob(pts, color, o = {}) {
  const c = new THREE.CatmullRomCurve3(pts.map(p => new V3(p[0], p[1], 0)), true);
  const s = new THREE.Shape(c.getPoints(80).map(p => new THREE.Vector2(p.x, p.y)));
  return m(new THREE.ShapeGeometry(s), color, { double: true, ...o });
}
function extrSide(pts, width, color, o = {}) { // profile (z,y), extruded along x
  const s = new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], p[1])));
  const g = new THREE.ExtrudeGeometry(s, { depth: width, bevelEnabled: false });
  g.translate(0, 0, -width / 2); g.rotateY(-Math.PI / 2);
  return m(g, color, { crease: true, ...o });
}
let seed = 7;
const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const BOOKC = ['#b5352a', '#2d6fb3', '#4c9a5a', '#f2c230', '#7a4a8c', '#d97a4c', '#2f5d4a', '#e9e2cf', '#22335c', '#c9843f'];
const pick = () => BOOKC[Math.floor(rnd() * BOOKC.length)];
function book(w, h, d, color, o = {}) { // lying book with visible pages
  const g = G(o); const id = newId();
  m(box(w, 0.006, d), color, { p: [0, h - 0.003, 0], crease: true, eid: id, in: g });
  m(box(w, 0.006, d), color, { p: [0, 0.003, 0], crease: true, eid: id, in: g });
  m(box(0.008, h, d), color, { p: [-w / 2 + 0.004, h / 2, 0], crease: true, eid: id, in: g });
  m(box(w - 0.014, h - 0.012, d - 0.012), '#fbf3dc', { p: [0.003, h / 2, 0], crease: true, in: g });
  return g;
}

// ---------- ROOM ----------
m(box(10, 0.1, 10), '#c68b4e', { p: [0, -0.05, 0] });
for (let x = -4; x < 3; x += 0.24) {
  m(box(0.007, 0.002, 8), '#7a4f24', { p: [x, 0.001, 0], ink: true });
}
// rug
m(box(2.9, 0.012, 2.0), '#a8423a', { p: [0.25, 0.006, -0.55] });
m(box(2.6, 0.012, 1.7), '#e9d8a6', { p: [0.25, 0.008, -0.55] });
m(box(2.42, 0.012, 1.52), '#a8423a', { p: [0.25, 0.010, -0.55] });
// walls
m(box(10, 3.4, 0.1), '#f1e3b4', { p: [0, 1.7, -2.65] });
m(box(0.1, 3.4, 10), '#e7d6a2', { p: [3.05, 1.7, 0] });
{
  const id = newId();
  m(box(10, 0.95, 0.03), '#6e9c9a', { p: [0, 0.475, -2.585] });
  m(box(10, 0.06, 0.05), '#4f7c7b', { p: [0, 0.97, -2.575], crease: true, eid: id });
  m(box(10, 0.13, 0.045), '#4f7c7b', { p: [0, 0.065, -2.578], crease: true, eid: id });
  for (let x = -3.9; x < 3; x += 0.55) m(box(0.007, 0.8, 0.002), INK, { p: [x, 0.53, -2.569], ink: true });
  m(box(0.03, 0.95, 10), '#64908e', { p: [2.985, 0.475, 0] });
  m(box(0.05, 0.06, 10), '#4f7c7b', { p: [2.975, 0.97, 0], crease: true, eid: id });
  m(box(0.045, 0.13, 10), '#4f7c7b', { p: [2.978, 0.065, 0], crease: true, eid: id });
  for (let z = -2.1; z < 3; z += 0.55) m(box(0.002, 0.8, 0.007), INK, { p: [2.969, 0.53, z], ink: true });
}

// ---------- WINDOW ----------
{
  const g = G({ p: [-1.2, 1.68, -2.6] });
  const v = (geo, c, o) => m(geo, c, { in: g, raw: true, ...o });
  v(plane(1.2, 1.3), '#1f2d5c', { p: [0, 0, 0.004] });
  poly([[0.42, 0.2], [-0.62, 0.5], [-0.62, 0.24], [0.42, 0.15]], '#3a4d8c', { p: [0, 0, 0.0042], ink: true, raw: true, in: g });
  for (let i = 0; i < 16; i++) v(circ(0.007), '#fdf3c4', { p: [-0.55 + rnd() * 1.1, 0.0 + rnd() * 0.6, 0.0043], ink: true });
  v(circ(0.1), '#fdf3c4', { p: [-0.3, 0.38, 0.0046] });
  let id = newId();
  [[-0.18, 0.3, .05], [-0.1, 0.32, .065], [0.0, 0.3, .05], [0.07, 0.29, .035]].forEach(c => v(circ(c[2]), '#34447a', { p: [c[0], c[1], 0.0048], eid: id }));
  id = newId();
  [[-0.4, -0.2, .26], [-0.1, -0.22, .2], [-0.62, -0.22, .16]].forEach(c => v(circ(c[2]), '#14234a', { p: [c[0], c[1], 0.005], s: [1, 0.55, 1], eid: id }));
  [[-0.5, -0.17], [-0.42, -0.14], [-0.2, -0.17], [-0.3, -0.19], [-0.08, -0.18]].forEach(c => v(plane(0.022, 0.022), '#f6d55c', { p: [c[0], c[1], 0.0053], ink: true }));
  poly([[0.365, -0.2], [0.475, -0.2], [0.455, 0.14], [0.385, 0.14]], '#dfe5f2', { p: [0, 0, 0.0052], raw: true, in: g });
  v(plane(0.094, 0.07), '#b5352a', { p: [0.42, -0.07, 0.0054], ink: true });
  v(plane(0.078, 0.06), '#b5352a', { p: [0.42, 0.07, 0.0054], ink: true });
  v(plane(0.1, 0.07), '#fff3a8', { p: [0.42, 0.175, 0.0055] });
  poly([[0.35, 0.21], [0.49, 0.21], [0.42, 0.3]], '#8f2a22', { p: [0, 0, 0.0055], raw: true, in: g });
  v(circ(0.17), '#2a2f4a', { p: [0.45, -0.24, 0.0057], s: [1, 0.45, 1] });
  v(plane(1.2, 0.42), '#16305e', { p: [0, -0.44, 0.006] });
  [[-0.3, -0.28, .2], [-0.3, -0.33, .14], [-0.31, -0.38, .17], [-0.29, -0.43, .1], [-0.3, -0.49, .13], [-0.31, -0.55, .07], [-0.3, -0.61, .1]].forEach(c => v(plane(c[2], 0.012), '#fdf3c4', { p: [c[0], c[1], 0.0062], ink: true }));
  for (let i = 0; i < 9; i++) v(plane(0.07, 0.007), '#4466a8', { p: [0.0 + rnd() * 0.5, -0.62 + rnd() * 0.25, 0.0063], ink: true });
  const s = G({ p: [0.12, 0.02, 0.007], s: 0.85, in: g }); const w = (geo, c, o) => m(geo, c, { in: s, raw: true, ...o });
  id = newId();
  [[0.02, -0.06, .04], [0.1, -0.01, .055], [0.2, 0.04, .07]].forEach(c => w(circ(c[2]), '#34447a', { p: [c[0], c[1], -0.0004], eid: id }));
  w(plane(0.007, 0.2), INK, { p: [-0.22, -0.22, 0], ink: true }); w(plane(0.007, 0.18), INK, { p: [0.16, -0.23, 0], ink: true });
  w(plane(0.07, 0.12), '#b5352a', { p: [-0.03, -0.2, 0.0002] });
  w(plane(0.07, 0.035), '#0f1830', { p: [-0.03, -0.158, 0.0004], ink: true });
  w(plane(0.3, 0.075), '#c9d2e6', { p: [-0.03, -0.275, 0.0004] });
  for (let i = 0; i < 5; i++) w(circ(0.011), '#f6d55c', { p: [-0.14 + i * 0.055, -0.27, 0.0006], ink: true });
  poly([[-0.32, -0.31], [0.26, -0.31], [0.2, -0.43], [-0.26, -0.43]], '#0f1830', { p: [0, 0, 0.0006], raw: true, in: s });
  poly([[-0.275, -0.4], [0.215, -0.4], [0.2, -0.43], [-0.26, -0.43]], '#7a2a2a', { p: [0, 0, 0.0008], ink: true, raw: true, in: s });
  // frame
  id = newId(); const FR = '#f7f1e1';
  m(box(1.38, 0.09, 0.08), FR, { p: [0, 0.695, 0.04], crease: true, eid: id, in: g });
  m(box(1.38, 0.09, 0.08), FR, { p: [0, -0.695, 0.04], crease: true, eid: id, in: g });
  m(box(0.09, 1.3, 0.08), FR, { p: [-0.645, 0, 0.04], crease: true, eid: id, in: g });
  m(box(0.09, 1.3, 0.08), FR, { p: [0.645, 0, 0.04], crease: true, eid: id, in: g });
  m(box(0.045, 1.3, 0.04), FR, { p: [0, 0, 0.02], crease: true, eid: id, in: g });
  m(box(1.2, 0.045, 0.04), FR, { p: [0, 0.12, 0.02], crease: true, eid: id, in: g });
  m(sph(0.022), '#d9a441', { p: [0, 0.12, 0.05], in: g });
  m(box(1.56, 0.05, 0.22), FR, { p: [0, -0.765, 0.11], crease: true, in: g });
  // curtains
  const curtain = (x0, x1, ph) => {
    const pts = [], N = 60;
    for (let i = 0; i <= N; i++) { const x = x0 + (x1 - x0) * i / N; pts.push([x, -(0.15 + 0.022 * Math.sin(ph + x * 55))]); }
    for (let i = N; i >= 0; i--) { const x = x0 + (x1 - x0) * i / N; pts.push([x, -(0.115 + 0.022 * Math.sin(ph + x * 55))]); }
    const sh = new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], p[1])));
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 1.66, bevelEnabled: false }); geo.rotateX(-Math.PI / 2);
    m(geo, '#3f7f5f', { p: [0, -0.8, 0], in: g });
    for (let n = -20; n < 20; n++) { const x = (-Math.PI / 2 + 2 * Math.PI * n - ph) / 55; if (x > x0 + 0.02 && x < x1 - 0.02) m(box(0.007, 1.56, 0.002), '#1b3d2d', { p: [x, 0.02, 0.1295], ink: true, in: g }); }
  };
  curtain(-0.94, -0.56, 0); curtain(0.6, 0.94, 1.2);
  rod([-1.02, 0.87, 0.14], [1.02, 0.87, 0.14], 0.016, '#d9a441', { in: g });
  m(sph(0.04), '#d9a441', { p: [-1.02, 0.87, 0.14], in: g }); m(sph(0.04), '#d9a441', { p: [1.02, 0.87, 0.14], in: g });
  // cactus
  const c = G({ p: [0.2, -0.74, 0.12], in: g });
  lathe([[0, 0], [0.05, 0], [0.068, 0.1], [0.075, 0.1], [0.075, 0.125], [0, 0.125]], '#c8623a', { in: c });
  id = newId();
  limb([0, 0.13, 0], [0, 0.27, 0], 0.04, '#4c9a5a', { in: c, eid: id });
  limb([0.03, 0.19, 0], [0.085, 0.2, 0], 0.02, '#4c9a5a', { in: c, eid: id });
  limb([0.085, 0.2, 0], [0.09, 0.27, 0], 0.02, '#4c9a5a', { in: c, eid: id });
  m(sph(0.02), '#e9638a', { p: [0, 0.315, 0], in: c });
}
// ---------- WALL MAP ----------
{
  const g = G({ p: [0.2, 1.82, -2.6] });
  rod([-0.3, 0.36, 0.01], [0, 0.5, 0.01], 0.004, INK, { ink: true, in: g }); rod([0.3, 0.36, 0.01], [0, 0.5, 0.01], 0.004, INK, { ink: true, in: g });
  m(sph(0.014), '#d9a441', { p: [0, 0.5, 0.012], in: g });
  const id = newId(), WD = '#8b5a2b';
  m(box(1.02, 0.06, 0.045), WD, { p: [0, 0.34, 0.022], crease: true, eid: id, in: g });
  m(box(1.02, 0.06, 0.045), WD, { p: [0, -0.34, 0.022], crease: true, eid: id, in: g });
  m(box(0.06, 0.62, 0.045), WD, { p: [-0.48, 0, 0.022], crease: true, eid: id, in: g });
  m(box(0.06, 0.62, 0.045), WD, { p: [0.48, 0, 0.022], crease: true, eid: id, in: g });
  m(plane(0.9, 0.62), '#bfe0ea', { p: [0, 0, 0.004], in: g });
  for (let x = -0.3; x < 0.4; x += 0.15) m(plane(0.004, 0.62), '#7fb0bf', { p: [x, 0, 0.005], ink: true, in: g });
  for (let y = -0.2; y < 0.3; y += 0.15) m(plane(0.9, 0.004), '#7fb0bf', { p: [0, y, 0.005], ink: true, in: g });
  blob([[-0.44, 0.2], [-0.3, 0.28], [-0.2, 0.2], [-0.22, 0.08], [-0.3, 0.02], [-0.36, -0.05], [-0.44, 0.0]], '#e6d595', { p: [0, 0, 0.006], in: g });
  blob([[-0.08, 0.25], [0.05, 0.29], [0.2, 0.25], [0.32, 0.18], [0.44, 0.22], [0.44, -0.02], [0.3, -0.06], [0.2, 0.0], [0.1, -0.04], [0.0, 0.05], [-0.1, 0.12]], '#cfe0a0', { p: [0, 0, 0.006], in: g });
  blob([[-0.2, -0.08], [-0.08, -0.1], [-0.04, -0.2], [-0.12, -0.27], [-0.24, -0.22]], '#f0b98a', { p: [0, 0, 0.006], in: g });
  blob([[0.2, -0.15], [0.31, -0.13], [0.34, -0.22], [0.22, -0.26]], '#e6d595', { p: [0, 0, 0.006], in: g });
  const rc = new THREE.CatmullRomCurve3([[-0.3, 0.12], [-0.22, -0.02], [-0.13, -0.17], [0.0, -0.1], [0.1, -0.0], [0.2, -0.06], [0.26, -0.19]].map(p => new V3(p[0], p[1], 0)));
  const rp = rc.getSpacedPoints(34);
  for (let i = 0; i < rp.length - 1; i += 2) { const a = rp[i], b = rp[i + 1]; m(plane(a.distanceTo(b), 0.012), '#c22b1e', { p: [(a.x + b.x) / 2, (a.y + b.y) / 2, 0.008], r: [0, 0, Math.atan2(b.y - a.y, b.x - a.x)], ink: true, in: g }); }
  m(plane(0.07, 0.016), '#c22b1e', { p: [0.27, -0.2, 0.009], r: [0, 0, 0.78], ink: true, in: g }); m(plane(0.07, 0.016), '#c22b1e', { p: [0.27, -0.2, 0.009], r: [0, 0, -0.78], ink: true, in: g });
  m(sph(0.018), '#c22b1e', { p: [-0.3, 0.12, 0.016], in: g }); m(sph(0.018), '#f6d55c', { p: [-0.13, -0.17, 0.016], in: g }); m(sph(0.018), '#2d6fb3', { p: [0.1, 0.0, 0.016], in: g });
  m(circ(0.06), '#ffffff', { p: [-0.36, -0.21, 0.007], in: g });
  poly([[0, 0.055], [0.014, 0], [0, -0.055], [-0.014, 0]], INK, { p: [-0.36, -0.21, 0.008], ink: true, in: g });
  poly([[0.055, 0], [0, 0.014], [-0.055, 0], [0, -0.014]], '#d8452e', { p: [-0.36, -0.21, 0.0085], ink: true, in: g });
}

// ---------- BOOKCASE ----------
{
  const g = G({ p: [1.95, 0, -2.44] }); const id = newId(), WD = '#8b5a2b';
  m(box(0.96, 2.0, 0.02), '#5d3a1c', { p: [0, 1.0, -0.15], in: g });
  m(box(0.045, 2.0, 0.32), WD, { p: [-0.5, 1.0, 0], crease: true, eid: id, in: g });
  m(box(0.045, 2.0, 0.32), WD, { p: [0.5, 1.0, 0], crease: true, eid: id, in: g });
  m(box(1.1, 0.05, 0.36), WD, { p: [0, 2.02, 0], crease: true, eid: id, in: g });
  m(box(0.96, 0.1, 0.32), WD, { p: [0, 0.05, 0], crease: true, eid: id, in: g });
  [0.55, 0.98, 1.38, 1.72].forEach(y => m(box(0.96, 0.03, 0.3), WD, { p: [0, y, 0], crease: true, eid: id, in: g }));
  const row = (y, x0, x1, maxH, lean) => {
    let x = x0;
    while (true) {
      const w = 0.032 + rnd() * 0.035, h = Math.min(maxH - 0.03, 0.22 + rnd() * 0.12), d = 0.19 + rnd() * 0.05;
      if (x + w > x1) break; const c = pick();
      m(box(w, h, d), c, { p: [x + w / 2, y + h / 2, 0.14 - d / 2], crease: true, in: g });
      m(box(w, 0.014, 0.002), c == '#f2c230' || c == '#e9e2cf' ? '#b5352a' : '#f6d55c', { p: [x + w / 2, y + h * 0.82, 0.141], ink: true, in: g });
      m(box(w, 0.014, 0.002), c == '#f2c230' || c == '#e9e2cf' ? '#b5352a' : '#f6d55c', { p: [x + w / 2, y + h * 0.15, 0.141], ink: true, in: g });
      x += w + 0.003;
    }
    if (lean) m(box(0.04, 0.25, 0.2), pick(), { p: [x + 0.055, y + 0.122, 0.04], r: [0, 0, 0.28], crease: true, in: g });
  };
  row(0.1, -0.47, 0.47, 0.43); row(0.565, -0.47, 0.12, 0.4, true); row(0.995, -0.47, 0.47, 0.37); row(1.395, -0.47, 0.05, 0.31, true); row(1.735, -0.1, 0.47, 0.26);
}

// ---------- SUITCASE + UMBRELLA ----------
{
  const g = G({ p: [-1.28, 0, -0.95], r: [0, 0.3, 0] }); const LE = '#a8672f';
  m(box(0.72, 0.46, 0.22), LE, { p: [0, 0.23, 0], crease: true, in: g });
  const sid = newId();
  [-0.2, 0.2].forEach(x => { m(box(0.055, 0.47, 0.23), '#6b4320', { p: [x, 0.23, 0], crease: true, eid: sid, in: g }); m(box(0.04, 0.05, 0.01), '#d9a441', { p: [x, 0.3, 0.117], crease: true, in: g }); });
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => m(box(0.07, 0.07, 0.232), '#d9a441', { p: [a * 0.328, 0.23 + b * 0.198, 0], crease: true, in: g }));
  m(tor(0.07, 0.013, Math.PI), '#4a2f18', { p: [0, 0.46, 0], in: g });
  m(circ(0.075), '#d8452e', { p: [-0.02, 0.26, 0.112], in: g }); m(circ(0.05), '#ffffff', { p: [-0.02, 0.26, 0.113], ink: true, in: g });
  poly([[-0.03, -0.02], [0.03, -0.02], [0, 0.03]], '#2d6fb3', { p: [-0.02, 0.255, 0.114], ink: true, in: g });
  // umbrella leaning on the desk
  const u = G({}); const a = new V3(-0.98, 0, -0.42), b = new V3(-0.76, 0.98, -0.58);
  u.position.copy(a); u.quaternion.setFromUnitVectors(new V3(0, 1, 0), b.clone().sub(a).normalize());
  m(cyl(0.006, 0.006, 0.08), '#c9c9c9', { p: [0, 0.04, 0], in: u });
  m(cyl(0.042, 0.012, 0.66), '#2a2f3a', { p: [0, 0.41, 0], in: u });
  m(cyl(0.014, 0.014, 0.12), '#b5803f', { p: [0, 0.8, 0], in: u });
  m(tor(0.04, 0.014, Math.PI), '#b5803f', { p: [0.04, 0.86, 0], in: u });
  for (let i = 0; i < 6; i++) { const t = i * Math.PI / 3; rod([0.012 * Math.cos(t), 0.09, 0.012 * Math.sin(t)], [0.042 * Math.cos(t), 0.74, 0.042 * Math.sin(t)], 0.002, INK, { ink: true, in: u }); }
}
// ---------- DESK ----------
const desk = G({ p: [0.2, 0, -0.6] });
{
  const g = desk, D1 = '#a5622f', D2 = '#b8713a';
  m(box(1.96, 0.055, 0.96), '#c9843f', { p: [0, 0.7525, 0], crease: true, in: g });
  [-0.66, 0.66].forEach(x => {
    m(box(0.5, 0.725, 0.84), D1, { p: [x, 0.3625, 0], crease: true, in: g });
    [0.6, 0.385, 0.17].forEach(y => {
      m(box(0.42, 0.185, 0.02), D2, { p: [x, y, 0.425], crease: true, in: g });
      limb([x - 0.05, y, 0.447], [x + 0.05, y, 0.447], 0.013, '#d9a441', { in: g });
    });
  });
  m(box(0.03, 0.56, 0.62), D2, { p: [-0.915, 0.38, 0], crease: true, in: g });
  m(box(0.82, 0.13, 0.84), D1, { p: [0, 0.66, 0], crease: true, in: g });
  m(box(0.72, 0.085, 0.02), D2, { p: [0, 0.66, 0.425], crease: true, in: g });
  m(sph(0.022), '#d9a441', { p: [0, 0.66, 0.445], in: g });
  m(box(0.82, 0.5, 0.03), '#8a4f24', { p: [0, 0.4, -0.3], crease: true, in: g });
  // blotter
  
}
const top = (x, z, o = {}) => G({ p: [x, 0.78, z], in: desk, ...o });

// cat
let catHead;
{
  const g = top(-0.4, -0.08, { r: [0, 0.75, 0] }), OR = '#e8892f', CR = '#fff4e2', id = newId();
  const tid = newId();
  tube([[0, 0.03, -0.09], [-0.1, 0.028, -0.16], [-0.19, 0.028, -0.08], [-0.18, 0.03, 0.04]], 0.024, OR, { eid: tid, in: g });
  m(sph(0.024), OR, { p: [-0.18, 0.03, 0.04], eid: tid, in: g });
  m(sph(1), OR, { p: [0, 0.14, 0], s: [0.1, 0.145, 0.115], eid: id, in: g });
  m(sph(1), OR, { p: [0, 0.085, -0.03], s: [0.12, 0.09, 0.125], eid: id, in: g });
  m(sph(1), CR, { p: [0, 0.15, 0.072], s: [0.058, 0.095, 0.05], in: g });
  [-0.042, 0.042].forEach(x => { limb([x, 0.13, 0.09], [x, 0.03, 0.105], 0.023, OR, { in: g }); m(sph(0.03), CR, { p: [x, 0.02, 0.118], s: [1, 0.7, 1.2], in: g }); });
  [[0.2, -0.094], [0.15, -0.112], [0.25, -0.06]].forEach(([y, z]) => m(sph(1), '#b55f17', { p: [0, y, z], s: [0.075, 0.011, 0.02], ink: true, in: g }));
  [[0.2, 0.075], [0.15, 0.09]].forEach(([y, x]) => { m(sph(1), '#b55f17', { p: [x, y, -0.03], s: [0.02, 0.011, 0.06], ink: true, in: g }); m(sph(1), '#b55f17', { p: [-x, y, -0.03], s: [0.02, 0.011, 0.06], ink: true, in: g }); });
  m(tor(0.052, 0.009), '#2d6fb3', { p: [0, 0.262, 0.035], r: [Math.PI / 2 - 0.3, 0, 0], in: g });
  m(sph(0.016), '#f6d55c', { p: [0, 0.243, 0.09], in: g });
  const h = G({ p: [0, 0.335, 0.05], r: [-0.3, -0.25, 0], in: g }); catHead = h; const hid = newId();
  m(sph(0.08), OR, { s: [1.1, 0.95, 1], eid: hid, in: h });
  [-1, 1].forEach(sx => {
    m(new THREE.ConeGeometry(0.034, 0.075, 20), OR, { p: [sx * 0.05, 0.085, -0.005], r: [0, 0, -sx * 0.35], eid: hid, in: h });
    m(new THREE.ConeGeometry(0.018, 0.045, 12), '#f4b6a6', { p: [sx * 0.05, 0.078, 0.014], r: [0, 0, -sx * 0.35], ink: true, in: h });
    m(sph(1), INK, { p: [sx * 0.032, 0.012, 0.073], s: [0.011, 0.017, 0.005], ink: true, in: h });
    rod([sx * 0.03, -0.022, 0.07], [sx * 0.125, -0.008, 0.05], 0.0022, INK, { ink: true, in: h });
    rod([sx * 0.03, -0.028, 0.07], [sx * 0.12, -0.04, 0.05], 0.0022, INK, { ink: true, in: h });
  });
  m(sph(1), CR, { p: [0, -0.024, 0.062], s: [0.036, 0.024, 0.022], ink: true, in: h });
  m(sph(0.009), '#d86a6a', { p: [0, -0.012, 0.084], ink: true, in: h });
  [-0.016, 0, 0.016].forEach(x => m(sph(1), '#b55f17', { p: [x, 0.07, 0.025], s: [0.005, 0.008, 0.028], ink: true, in: h }));
}
// typewriter
{
  const g = top(0.76, 0.17, { r: [0, -0.35, 0] }), TB = '#3d5566';
  extrSide([[-0.15, 0], [0.18, 0], [0.18, 0.03], [0.03, 0.115], [-0.15, 0.115]], 0.36, TB, { in: g });
  for (let k = 0; k < 4; k++) for (let i = 0; i < 10; i++) {
    const t = (k + 0.5) / 4, z = 0.168 - 0.135 * t, y = 0.03 + 0.085 * (0.18 - z) / 0.15 + 0.012;
    m(cyl(0.0115, 0.0115, 0.01), '#f4ecd8', { p: [-0.14 + i * 0.03 + k * 0.006, y, z], r: [0.5, 0, 0], in: g });
  }
  m(box(0.2, 0.01, 0.02), '#f4ecd8', { p: [0, 0.036, 0.185], in: g });
  m(cyl(0.085, 0.085, 0.012), '#26333d', { p: [0, 0.117, -0.045], in: g });
  const pid = newId();
  m(cyl(0.03, 0.03, 0.44), '#2a2a2a', { p: [0, 0.15, -0.1], r: [0, 0, Math.PI / 2], eid: pid, in: g });
  m(cyl(0.04, 0.04, 0.025), '#55595e', { p: [-0.23, 0.15, -0.1], r: [0, 0, Math.PI / 2], in: g }); m(cyl(0.04, 0.04, 0.025), '#55595e', { p: [0.23, 0.15, -0.1], r: [0, 0, Math.PI / 2], in: g });
  const pp = G({ p: [0, 0.165, -0.1], r: [-0.22, 0, 0], in: g });
  m(box(0.22, 0.28, 0.003), '#fffdf4', { p: [0, 0.14, 0], crease: true, in: pp });
  [0.05, 0.08, 0.11, 0.14].forEach((y, i) => m(plane(i == 3 ? 0.09 : 0.16, 0.007), '#7b7469', { p: [i == 3 ? -0.035 : 0, y, 0.003], ink: true, in: pp }));
  rod([-0.2, 0.16, -0.08], [-0.27, 0.215, 0.0], 0.005, INK, { ink: true, in: g }); m(sph(0.012), '#d9a441', { p: [-0.27, 0.215, 0.0], in: g });
}
// envelope
{
  const g = top(-0.05, 0.3, { r: [0, 0.35, 0] });
  m(box(0.22, 0.005, 0.14), '#f3e3b5', { p: [0, 0.0025, 0], in: g });
  rod([-0.11, 0.0055, -0.07], [0, 0.0055, 0.01], 0.002, INK, { ink: true, in: g }); rod([0.11, 0.0055, -0.07], [0, 0.0055, 0.01], 0.002, INK, { ink: true, in: g });
  m(box(0.032, 0.003, 0.038), '#2d9a8a', { p: [0.075, 0.006, 0.04], in: g });
  m(tor(0.022, 0.002), INK, { p: [0.04, 0.006, 0.035], r: [Math.PI / 2, 0, 0], ink: true, in: g });
}
// coffee
{
  const g = top(0.2, 0.16);
  m(cyl(0.08, 0.06, 0.012), '#fffdf4', { p: [0, 0.006, 0], in: g });
  m(tor(0.02, 0.0065, Math.PI), '#fffdf4', { p: [0.046, 0.048, 0], r: [0, 0, -Math.PI / 2], in: g });
  m(cyl(0.05, 0.036, 0.066), '#fffdf4', { p: [0, 0.045, 0], in: g });
  m(cyl(0.0468, 0.0432, 0.016, true), '#2d6fb3', { p: [0, 0.05, 0], ink: true, in: g });
  m(circ(0.043), '#5a3418', { p: [0, 0.0785, 0], r: [-Math.PI / 2, 0, 0], in: g });
  tube([[0, 0.1, 0], [0.014, 0.135, 0], [-0.012, 0.17, 0], [0.012, 0.205, 0], [0, 0.235, 0]], 0.003, INK, { ink: true, in: g });
  tube([[0.03, 0.11, 0], [0.042, 0.14, 0], [0.02, 0.17, 0], [0.036, 0.2, 0]], 0.003, INK, { ink: true, in: g });
}
// banker's lamp
{
  const g = top(0.55, -0.3, { r: [0, -0.2, 0] }), BR = '#d9a441';
  lathe([[0, 0], [0.1, 0], [0.1, 0.016], [0.04, 0.032], [0.014, 0.05]], BR, { in: g });
  m(cyl(0.012, 0.012, 0.3), BR, { p: [0, 0.19, 0], in: g });
  const sid = newId(), s = G({ p: [0, 0.345, 0.02], in: g });
  m(cyl(0.085, 0.085, 0.3, true, 0, Math.PI), '#2e8b57', { r: [0, 0, Math.PI / 2], double: true, eid: sid, in: s });
  m(circ(0.085, 0, Math.PI), '#2e8b57', { p: [0.15, 0, 0], r: [0, Math.PI / 2, 0], double: true, eid: sid, in: s });
  m(circ(0.085, 0, Math.PI), '#2e8b57', { p: [-0.15, 0, 0], r: [0, Math.PI / 2, 0], double: true, eid: sid, in: s });
  m(box(0.3, 0.004, 0.17), '#fff3a8', { p: [0, 0.002, 0], raw: true, in: s });
  m(sph(0.014), BR, { p: [0, 0.092, 0], in: s });
  m(box(0.2, 0.004, 0.004), '#8fd3a8', { p: [0, 0.078, 0.036], ink: true, in: s });
  rod([0.09, 0, 0.07], [0.09, -0.09, 0.07], 0.002, INK, { ink: true, in: s }); m(sph(0.009), BR, { p: [0.09, -0.095, 0.07], in: s });
}
// globe
{
  const g = top(-0.78, -0.28, { r: [0, 0.4, 0] }), BR = '#d9a441', R = 0.15;
  lathe([[0, 0], [0.09, 0], [0.09, 0.014], [0.03, 0.03], [0.014, 0.05]], BR, { in: g });
  m(cyl(0.012, 0.012, 0.1), BR, { p: [0, 0.095, 0], in: g });
  const c = G({ p: [-0.066, 0.3, 0], in: g });
  m(tor(0.167, 0.008, Math.PI), BR, { r: [0, 0, -Math.PI / 2 + 0.41], in: c });
  const ax = G({ r: [0, 0, 0.41], in: c });
  m(sph(0.012), BR, { p: [0, 0.165, 0], in: ax }); m(sph(0.012), BR, { p: [0, -0.165, 0], in: ax });
  const sp = G({ r: [0, 0.55, 0], in: ax });
  m(sph(R), '#6fb4d6', { in: sp });
  const capOn = (lat, lon, ang, color, eid) => {
    const me = m(new THREE.SphereGeometry(R * 1.012, 24, 8, 0, Math.PI * 2, 0, ang), color, { eid, in: sp });
    const la = lat * Math.PI / 180, lo = lon * Math.PI / 180;
    me.quaternion.setFromUnitVectors(new V3(0, 1, 0), new V3(Math.cos(la) * Math.cos(lo), Math.sin(la), Math.cos(la) * Math.sin(lo)));
  };
  let id = newId(); [[42, 15, .34], [20, 38, .3], [55, 50, .26], [2, 22, .22], [30, 62, .2]].forEach(a => capOn(a[0], a[1], a[2], '#8cc36b', id));
  id = newId(); [[-12, 105, .3], [10, 124, .28], [-32, 112, .2], [28, 110, .2]].forEach(a => capOn(a[0], a[1], a[2], '#e6d595', id));
  id = newId(); [[30, -62, .3], [2, -50, .26], [-25, -44, .22], [48, -80, .24]].forEach(a => capOn(a[0], a[1], a[2], '#8cc36b', id));
  id = newId(); [[-20, 200, .25], [0, 215, .2], [35, 190, .28]].forEach(a => capOn(a[0], a[1], a[2], '#f0b98a', id));
  capOn(90, 0, 0.2, '#ffffff', newId());
  [-40, 0, 40].forEach(l => m(tor(R * 1.004 * Math.cos(l * Math.PI / 180), 0.0018), '#2c5f7a', { p: [0, R * Math.sin(l * Math.PI / 180), 0], r: [Math.PI / 2, 0, 0], ink: true, in: sp }));
}

// ---------- HEROINE ----------
let head;
{
  const g = G({ p: [0.38, 0, -1.32], r: [0, -0.2, 0] }), RED = '#d8452e', SK = '#f6c9a0', HA = '#26211f';
  [-0.07, 0.07].forEach(x => { limb([x, 0.42, 0], [x, 0.08, 0], 0.045, '#2a2f3a', { in: g }); m(sph(1), '#6b4320', { p: [x, 0.04, 0.04], s: [0.055, 0.04, 0.11], in: g }); });
  const cid = newId();
  lathe([[0.22, 0.36], [0.19, 0.7], [0.15, 0.99], [0.155, 1.06], [0.178, 1.2], [0.182, 1.3], [0.15, 1.37], [0.07, 1.41], [0, 1.41]], RED, { s: [1, 1, 0.64], eid: cid, in: g });
  [-1, 1].forEach(sx => m(sph(0.068), RED, { p: [sx * 0.17, 1.325, 0], eid: cid, in: g }));
  m(tor(0.154, 0.017), '#a82d1f', { p: [0, 1.0, 0], r: [Math.PI / 2, 0, 0], s: [1, 0.64, 1], in: g });
  m(box(0.04, 0.045, 0.012), '#d9a441', { p: [0, 1.0, 0.112], crease: true, in: g });
  m(sph(0.013), '#f6d55c', { p: [0.06, 1.1, 0.103], in: g }); m(sph(0.013), '#f6d55c', { p: [-0.06, 1.1, 0.103], in: g });
  m(cyl(0.04, 0.046, 0.1), SK, { p: [0, 1.44, 0], in: g });
  const sc = newId(), MU = '#f2c230';
  m(tor(0.072, 0.034), MU, { p: [0, 1.405, 0.005], r: [Math.PI / 2, 0, 0], s: [1, 0.9, 1], eid: sc, in: g });
  m(box(0.075, 0.27, 0.022), MU, { p: [0.085, 1.26, 0.105], r: [0.06, 0, 0.1], eid: newId(), in: g });
  [0, 1, 2].forEach(i => m(box(0.075, 0.016, 0.002), '#b5352a', { p: [0.085 - (0.07 - i * 0.07) * 0.1, 1.19 + i * 0.07, 0.117 + i * 0.004], r: [0.06, 0, 0.1], ink: true, in: g }));
  // arms holding letter
  const lid = newId();
  [-1, 1].forEach(sx => {
    const aid = newId();
    limb([sx * 0.185, 1.31, 0], [sx * 0.25, 1.09, 0.07], 0.052, RED, { eid: aid, in: g });
    limb([sx * 0.25, 1.09, 0.07], [sx * 0.135, 1.14, 0.27], 0.046, RED, { eid: aid, in: g });
    m(cyl(0.05, 0.05, 0.03), '#a82d1f', { eid: newId(), in: g, p: [sx * 0.14, 1.138, 0.262], r: [1.2, 0, sx * 0.5] });
    m(sph(1), SK, { p: [sx * 0.11, 1.155, 0.305], s: [0.034, 0.042, 0.04], in: g });
  });
  const L = G({ p: [0, 1.2, 0.325], r: [-0.42, 0, 0.04], in: g });
  m(box(0.21, 0.28, 0.003), '#fffdf4', { crease: true, eid: lid, in: L });
  m(plane(0.21, 0.004), '#b9b2a3', { p: [0, 0.045, 0.0025], ink: true, in: L }); m(plane(0.21, 0.004), '#b9b2a3', { p: [0, -0.05, 0.0025], ink: true, in: L });
  m(circ(0.02), '#b5352a', { p: [0, -0.003, 0.003], in: L });
  [-1, 1].forEach(sx => limb([sx * 0.1, 1.2, 0.325], [sx * 0.075, 1.19, 0.345], 0.012, SK, { in: g }));
  // head
  const h = G({ p: [0, 1.575, 0.012], r: [0.2, -0.12, 0], in: g }); head = h;
  m(sph(1), SK, { s: [0.098, 0.115, 0.105], in: h });
  const hid = newId();
  m(sph(1), HA, { p: [0, 0.02, -0.024], s: [0.109, 0.118, 0.112], eid: hid, in: h });
  m(sph(1), HA, { p: [0.012, 0.086, 0.05], s: [0.096, 0.042, 0.062], r: [0, 0, -0.12], eid: hid, in: h });
  [-1, 1].forEach(sx => {
    m(sph(1), HA, { p: [sx * 0.09, -0.045, -0.005], s: [0.03, 0.085, 0.06], eid: hid, in: h });
    m(sph(1), INK, { p: [sx * 0.035, 0.0, 0.097], s: [0.0095, 0.0135, 0.005], ink: true, in: h });
    m(box(0.032, 0.0055, 0.004), INK, { p: [sx * 0.037, 0.034, 0.093], r: [0, sx * 0.3, -sx * 0.22], ink: true, in: h });
  });
  m(tor(0.011, 0.0028, Math.PI * 0.85), INK, { p: [-0.003, -0.026, 0.1035], r: [0.1, 0, -Math.PI / 2 - 0.2], ink: true, in: h });
  m(sph(1), INK, { p: [0, -0.066, 0.083], s: [0.017, 0.0145, 0.004], ink: true, in: h });
  m(sph(1), '#8f2a22', { p: [0, -0.066, 0.0845], s: [0.012, 0.0095, 0.004], ink: true, in: h });
  m(sph(1), '#f0a48c', { p: [0.058, -0.035, 0.074], s: [0.016, 0.01, 0.006], ink: true, in: h });
  m(sph(1), '#f0a48c', { p: [-0.058, -0.035, 0.074], s: [0.016, 0.01, 0.006], ink: true, in: h });
  m(box(0.06, 0.004, 0.004), '#6a625c', { p: [0.02, 0.118, 0.045], r: [0, 0.3, -0.25], ink: true, in: h });
}

// ---------- CAMERA ----------
const cam = new THREE.PerspectiveCamera(+(P.get('fov') || 32), W / H, 0.5, 40);
cam.position.set(-1.1, 1.75, 3.3);
cam.lookAt(0.0, 1.17, -1.0);
scene.updateMatrixWorld(true);
cam.updateMatrixWorld(true);

// ---------- RENDER: beauty + edge-id passes, then ink composite ----------
const RW = W * SS, RH = H * SS;
const rtC = new THREE.WebGLRenderTarget(RW, RH, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
const rtE = new THREE.WebGLRenderTarget(RW, RH, { type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
renderer.setRenderTarget(rtC); renderer.setClearColor('#6a7fae', 1); renderer.clear(); renderer.render(scene, cam);
const vs = `varying vec3 vN; void main(){ vN = normalMatrix*normal; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`;
const fs = `uniform float id, cr; varying vec3 vN; void main(){ vec3 n = normalize(vN); if(!gl_FrontFacing) n = -n; gl_FragColor = vec4(mix(vec3(0.,0.,1.), n, cr), id); }`;
scene.traverse(o => {
  if (!o.isMesh) return;
  if (o.userData.ink) { o.visible = false; return; }
  o.material = new THREE.ShaderMaterial({ uniforms: { id: { value: (o.userData.eid % 2000) + 1 }, cr: { value: o.userData.crease ? 1 : 0 } }, vertexShader: vs, fragmentShader: fs, side: o.material.side, blending: THREE.NoBlending });
});
renderer.setRenderTarget(rtE); renderer.setClearColor(0x0000ff, 0); renderer.clear(); renderer.render(scene, cam);
const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
  uniforms: { tC: { value: rtC.texture }, tE: { value: rtE.texture }, px: { value: new THREE.Vector2(1 / RW, 1 / RH) }, R: { value: +(P.get('lw') || 2.1) * SS } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`,
  fragmentShader: `uniform sampler2D tC, tE; uniform vec2 px; uniform float R; varying vec2 vUv;
    void main(){ vec4 c = texture2D(tC, vUv); vec4 e = texture2D(tE, vUv); float edge = 0.;
      for(int i=0;i<20;i++){ float a = 6.2831853*float(i)/20.;
        for(int k=1;k<=2;k++){ vec4 s = texture2D(tE, vUv + vec2(cos(a), sin(a))*R*float(k)*0.5*px);
          if(abs(s.a-e.a) > 0.5 || dot(s.rgb, e.rgb) < 0.55) edge = 1.; } }
      gl_FragColor = vec4(mix(c.rgb, vec3(0.07,0.07,0.12), edge), 1.); }`,
  depthTest: false
}));
const qs = new THREE.Scene(); qs.add(quad);
renderer.setRenderTarget(null); renderer.render(qs, new THREE.Camera());

// ---------- 2D lettering overlay ----------
const proj = (o3, off = [0, 0, 0]) => { const v = o3.localToWorld(new V3(...off)).project(cam); return [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H]; };
const [hx, hy] = proj(head, [0, 0.16, 0]);
const [fx, fy] = proj(head, [0, 0, 0]);
const svg = document.getElementById('o');
const bw = 800, bh = 150, by = 30, bx = Math.min(Math.max(hx - 330, 600), W - bw - 30);
const tx = Math.min(Math.max(hx - 20, bx + 80), bx + bw - 140);
let marks = '';
[[1.3, -0.45], [1.38, 0.0], [0.95, -0.95]].forEach(([dx, dy]) => { const r1 = 78, r2 = 112; marks += `<line x1="${fx + dx * r1}" y1="${fy + dy * r1}" x2="${fx + dx * r2}" y2="${fy + dy * r2}"/>`; });
svg.innerHTML = `
  <g stroke="#12131f" stroke-width="5" stroke-linecap="round" fill="none">${marks}</g>
  <path d="M${bx + 26},${by} H${bx + bw - 26} a26,26 0 0 1 26,26 V${by + bh - 26} a26,26 0 0 1 -26,26 H${tx + 70} L${hx + 6},${hy - 14} L${tx},${by + bh} H${bx + 26} a26,26 0 0 1 -26,-26 V${by + 26} a26,26 0 0 1 26,-26 Z" fill="#fff" stroke="#12131f" stroke-width="5" stroke-linejoin="round"/>
  <g font-family="Comic Neue" font-weight="700" font-style="italic" font-size="35" text-anchor="middle" fill="#12131f">
    <text x="${bx + bw / 2}" y="${by + 64}">MARMALADE… THIS WAS POSTED FROM A</text>
    <text x="${bx + bw / 2}" y="${by + 112}">HARBOUR THAT VANISHED IN 1907!</text>
  </g>
  <rect x="-3" y="-3" width="330" height="70" fill="#f6d55c" stroke="#12131f" stroke-width="5"/>
  <g font-family="Comic Neue" font-weight="700" font-size="31" fill="#12131f">
    <text x="24" y="45">THAT NIGHT…</text>
  </g>`;
document.fonts.load('italic 700 35px "Comic Neue"').then(() => document.fonts.load('700 31px "Comic Neue"')).then(() => { window.done = true; });
