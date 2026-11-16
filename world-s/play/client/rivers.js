// River water surfaces: ribbons along the generated channel polylines (the channels themselves are
// carved into the terrain by World.ground()).
import * as THREE from 'three';

export function buildRivers(world, material, scene) {
  const P = world.rPts, off = world.rSegOff, nSeg = off.length - 1, TILE = 5000;
  const buckets = new Map();
  const X = [-1.1, -0.55, 0, 0.55, 1.1];
  for (let s = 0; s < nSeg; s++) {
    const a = off[s], b = off[s + 1], m = b - a; if (m < 2) continue;
    const mid = (a + (m >> 1)) * 5, key = Math.floor(P[mid] / TILE) + ',' + Math.floor(P[mid + 1] / TILE);
    let bk = buckets.get(key); if (!bk) { bk = { pos: [], depth: [], flow: [], idx: [] }; buckets.set(key, bk); }
    let along = 0; const base = bk.pos.length / 3;
    for (let k = 0; k < m; k++) {
      const p = (a + k) * 5, p0 = (a + Math.max(0, k - 1)) * 5, p1 = (a + Math.min(m - 1, k + 1)) * 5;
      let tx = P[p1] - P[p0], tz = P[p1 + 1] - P[p0 + 1]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
      if (k > 0) along += Math.hypot(P[p] - P[p - 5], P[p + 1] - P[p - 4]);
      const hw = P[p + 3] / 2, slope = Math.max(0, (P[p0 + 2] - P[p1 + 2]) / tl);
      const turb = Math.min(1, slope * 14);
      for (let c = 0; c < 5; c++) {
        bk.pos.push(P[p] - tz * X[c] * hw, P[p + 2] + 0.03, P[p + 1] + tx * X[c] * hw);
        bk.depth.push(c === 2 ? P[p + 4] : c === 1 || c === 3 ? P[p + 4] * 0.7 : 0.0);
        bk.flow.push(along, X[c], turb);
      }
      if (k > 0) for (let c = 0; c < 4; c++) {
        const i0 = base + (k - 1) * 5 + c, i1 = i0 + 1, j0 = i0 + 5, j1 = j0 + 1;
        bk.idx.push(i0, i1, j0, i1, j1, j0);
      }
    }
  }
  const group = new THREE.Group(); let tris = 0;
  for (const bk of buckets.values()) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(bk.pos, 3));
    g.setAttribute('aDepth', new THREE.Float32BufferAttribute(bk.depth, 1));
    g.setAttribute('aFlow', new THREE.Float32BufferAttribute(bk.flow, 3));
    g.setIndex(bk.idx); g.computeBoundingSphere(); tris += bk.idx.length / 3;
    const mesh = new THREE.Mesh(g, material); mesh.renderOrder = 6; mesh.matrixAutoUpdate = false;
    group.add(mesh);
  }
  scene.add(group);
  return { group, tris };
}
