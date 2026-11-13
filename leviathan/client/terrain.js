// Streaming terrain: a quadtree of fixed-topology chunks (CDLOD-style), meshed in workers.
// Children replace a parent only when all four are ready, vertices geomorph towards the parent
// level with distance, and skirts cover any residual seams.
import * as THREE from 'three';

export const C = 64;
const SPLIT_K = 2.0;      // a node splits when the camera is closer than SPLIT_K * size

function makeIndex() {
  const n1 = C + 1, idx = [];
  for (let j = 0; j < C; j++) for (let i = 0; i < C; i++) {
    const a = j * n1 + i, b = a + 1, c = a + n1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const base = n1 * n1;
  const strip = (edge, skirt, flip) => {
    for (let k = 0; k < C; k++) {
      const a = edge(k), b = edge(k + 1), c = skirt + k, d = skirt + k + 1;
      if (flip) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
    }
  };
  strip((k) => k, base, false);
  strip((k) => C * n1 + k, base + n1, true);
  strip((k) => k * n1, base + 2 * n1, true);
  strip((k) => k * n1 + C, base + 3 * n1, false);
  return new THREE.BufferAttribute(new Uint16Array(idx), 1);
}

export class Terrain {
  constructor({ scene, data, makeTerrainMaterial, waterMaterial, maxLevel = 11, workers = 3, onWorkerMessage }) {
    this.scene = scene; this.S = data.meta.sizeM; this.maxLevel = maxLevel;
    this.makeMat = makeTerrainMaterial; this.waterMat = waterMaterial;
    this.index = makeIndex();
    this.mats = new Map();
    this.nodes = new Map(); this.nextId = 1;
    this.group = new THREE.Group(); scene.add(this.group);
    this.frame = 0; this.pending = 0; this.visible = [];
    this.stats = { chunks: 0, tris: 0, built: 0, buildMs: 0 };
    this.roots = [];
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) this.roots.push(this._node(0, i * this.S, j * this.S, this.S, null, i !== 0 || j !== 0));
    this.workers = [];
    this.ready = new Promise((res) => {
      let n = 0;
      for (let k = 0; k < workers; k++) {
        const w = new Worker(new URL('./terrainWorker.js', import.meta.url), { type: 'module' });
        w.load = 0;
        w.onmessage = (e) => {
          const m = e.data;
          if (m.type === 'ready') { if (++n === workers) res(); }
          else if (m.type === 'chunk') { w.load--; this._onChunk(m); }
          else { w.load--; onWorkerMessage && onWorkerMessage(m); }
        };
        w.onerror = (e) => console.error('terrain worker error', e.message, e.filename, e.lineno);
        w.postMessage({ type: 'init', data });
        this.workers.push(w);
      }
    });
    this.extraQueue = [];   // non-chunk jobs (vegetation) share the worker pool
  }

  _node(level, x0, z0, size, parent, outer) {
    const n = { id: this.nextId++, level, x0, z0, size, parent, outer, children: null, state: 0, mesh: null, water: null, minY: parent ? parent.minY : -300, maxY: parent ? parent.maxY : 3400, lastUsed: 0, t0: 0 };
    this.nodes.set(n.id, n); return n;
  }
  _dist(n, p) {
    const dx = Math.max(n.x0 - p.x, 0, p.x - (n.x0 + n.size)), dz = Math.max(n.z0 - p.z, 0, p.z - (n.z0 + n.size)), dy = Math.max(n.minY - p.y, 0, p.y - n.maxY);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  _select(n, p, req) {
    n.lastUsed = this.frame;
    const maxL = n.outer ? 3 : this.maxLevel;
    if (n.level < maxL && this._dist(n, p) < SPLIT_K * n.size) {
      if (!n.children) {
        const h = n.size / 2;
        n.children = [this._node(n.level + 1, n.x0, n.z0, h, n, n.outer), this._node(n.level + 1, n.x0 + h, n.z0, h, n, n.outer), this._node(n.level + 1, n.x0, n.z0 + h, h, n, n.outer), this._node(n.level + 1, n.x0 + h, n.z0 + h, h, n, n.outer)];
      }
      let all = true;
      for (const c of n.children) { c.lastUsed = this.frame; if (c.state !== 2) { all = false; if (c.state === 0) req.push(c); } }
      if (all) { for (const c of n.children) this._select(c, p, req); return; }
    }
    if (n.state === 2) this.visible.push(n); else if (n.state === 0) req.push(n);
  }

  update(camPos) {
    this.frame++;
    const req = [], prev = this.visible; this.visible = [];
    for (const r of this.roots) this._select(r, camPos, req);
    for (const n of prev) if (n.mesh) { n.mesh.visible = false; if (n.water) n.water.visible = false; }
    let tris = 0;
    for (const n of this.visible) { n.mesh.visible = true; if (n.water) n.water.visible = true; tris += C * C * 2; }
    this.stats.chunks = this.visible.length; this.stats.tris = tris;
    // dispatch closest-first
    req.sort((a, b) => this._dist(a, camPos) / a.size - this._dist(b, camPos) / b.size);
    for (const n of req) {
      const w = this._freeWorker(); if (!w) break;
      n.state = 1; n.t0 = performance.now(); w.load++; this.pending++;
      w.postMessage({ type: 'build', id: n.id, x0: n.x0, z0: n.z0, size: n.size });
    }
    while (this.extraQueue.length) { const w = this._freeWorker(); if (!w) break; w.load++; w.postMessage(this.extraQueue.shift()); }
    this.wanted = req.length;
    if (this.frame % 120 === 0) this._evict();
  }
  _freeWorker() { let best = null; for (const w of this.workers) if (w.load < 2 && (!best || w.load < best.load)) best = w; return best; }
  get busy() { return this.pending > 0 || this.wanted > 0; }
  postAll(msg) { for (const w of this.workers) w.postMessage(msg); }

  _mat(level, size) {
    let m = this.mats.get(size);
    if (!m) { m = this.makeMat(size / C, size); this.mats.set(size, m); }
    return m;
  }
  _onChunk(m) {
    this.pending--;
    const n = this.nodes.get(m.id); if (!n) return;
    this.stats.built++; this.stats.buildMs += performance.now() - n.t0;
    if (n.mesh) this._dispose(n);     // rebuild (terrain edit)
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(m.pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(m.nrm, 3, true));
    g.setAttribute('aMorph', new THREE.BufferAttribute(m.morph, 1));
    g.setIndex(this.index);
    const cy = (m.minY + m.maxY) / 2, hh = (m.maxY - m.minY) / 2 + n.size / C * 2 + 1;
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(n.size / 2, cy, n.size / 2), Math.sqrt(n.size * n.size / 2 + hh * hh));
    g.boundingBox = new THREE.Box3(new THREE.Vector3(0, m.minY - 2, 0), new THREE.Vector3(n.size, m.maxY + 2, n.size));
    const mesh = new THREE.Mesh(g, this._mat(n.level, n.size));
    mesh.position.set(n.x0, 0, n.z0); mesh.updateMatrixWorld(); mesh.matrixAutoUpdate = false;
    mesh.visible = false; mesh.receiveShadow = true; mesh.castShadow = n.level >= 4;
    this.group.add(mesh);
    n.mesh = mesh; n.minY = m.minY; n.maxY = m.maxY; n.state = 2;
    if (m.water) {
      const wg = new THREE.BufferGeometry();
      wg.setAttribute('position', new THREE.BufferAttribute(m.water.pos, 3));
      wg.setAttribute('aDepth', new THREE.BufferAttribute(m.water.depth, 1));
      wg.setIndex(new THREE.BufferAttribute(m.water.index, 1));
      wg.boundingSphere = new THREE.Sphere(new THREE.Vector3(n.size / 2, m.water.pos[1], n.size / 2), n.size * 0.75);
      const wm = new THREE.Mesh(wg, this.waterMat);
      wm.position.copy(mesh.position); wm.updateMatrixWorld(); wm.matrixAutoUpdate = false; wm.visible = false; wm.renderOrder = 5;
      this.group.add(wm); n.water = wm;
    }
  }
  _dispose(n) {
    if (n.mesh) { this.group.remove(n.mesh); n.mesh.geometry.dispose(); n.mesh = null; }
    if (n.water) { this.group.remove(n.water); n.water.geometry.dispose(); n.water = null; }
    n.state = 0;
  }
  _evict() {
    const drop = (n) => { if (n.children) { for (const c of n.children) drop(c); n.children = null; } if (n.state === 1) { n.state = 0; } this._dispose(n); this.nodes.delete(n.id); };
    const walk = (n) => {
      if (!n.children) return;
      const stale = n.children.every((c) => this.frame - c.lastUsed > 600 && c.state !== 1);
      if (stale) { for (const c of n.children) drop(c); n.children = null; } else for (const c of n.children) walk(c);
    };
    for (const r of this.roots) walk(r);
  }
  // re-mesh the fine chunks that overlap an edited area
  invalidate(x, z, r) {
    for (const n of this.nodes.values()) {
      if (n.state === 2 && n.size / C < 2 && x + r > n.x0 && x - r < n.x0 + n.size && z + r > n.z0 && z - r < n.z0 + n.size) {
        const w = this.workers[0]; n.t0 = performance.now(); this.pending++; w.load++;
        w.postMessage({ type: 'build', id: n.id, x0: n.x0, z0: n.z0, size: n.size });
      }
    }
  }
}
