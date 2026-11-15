// First-person movement over the real ground function: walking with gravity, slope limits and
// swimming, plus a free-flight survey mode. Collision uses World.ground(), the same function the
// meshes are built from, so the feet always match the rendered terrain.
import * as THREE from 'three';

export class Player {
  constructor(camera, world, dom) {
    this.cam = camera; this.world = world; this.dom = dom;
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0; this.fly = true; this.flySpeed = 120; this.mount = false;
    this.onGround = false; this.swimming = false; this.eye = 1.7; this.keys = {};
    this.colliders = null;   // optional: (x, z, radius) => iterable of {x, z, r}
    addEventListener('keydown', (e) => { this.keys[e.code] = true; if (e.code === 'KeyF') this.toggleFly(); if (e.code === 'KeyH') this.mount = !this.mount; });
    addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    dom.addEventListener('click', () => { try { if (document.pointerLockElement !== dom) { const p = dom.requestPointerLock?.(); p && p.catch && p.catch(() => {}); } } catch { /* optional */ } });
    addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== dom) return;
      this.yaw -= e.movementX * 0.0022; this.pitch = Math.max(-1.55, Math.min(1.55, this.pitch - e.movementY * 0.0022));
    });
    // touch: left half of the screen is a movement stick, right half looks around
    this.touchMove = { f: 0, r: 0 }; const touches = new Map();
    dom.addEventListener('touchstart', (e) => { for (const t of e.changedTouches) touches.set(t.identifier, { x0: t.clientX, y0: t.clientY, x: t.clientX, y: t.clientY, left: t.clientX < innerWidth / 2 }); e.preventDefault(); }, { passive: false });
    dom.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        const s = touches.get(t.identifier); if (!s) continue;
        if (s.left) { this.touchMove.r = Math.max(-1, Math.min(1, (t.clientX - s.x0) / 60)); this.touchMove.f = Math.max(-1, Math.min(1, (s.y0 - t.clientY) / 60)); }
        else { this.yaw -= (t.clientX - s.x) * 0.005; this.pitch = Math.max(-1.55, Math.min(1.55, this.pitch - (t.clientY - s.y) * 0.005)); }
        s.x = t.clientX; s.y = t.clientY;
      }
      e.preventDefault();
    }, { passive: false });
    const end = (e) => { for (const t of e.changedTouches) { const s = touches.get(t.identifier); if (s && s.left) this.touchMove.f = this.touchMove.r = 0; touches.delete(t.identifier); } };
    dom.addEventListener('touchend', end); dom.addEventListener('touchcancel', end);
    // mouse drag also looks around where pointer lock is unavailable
    let drag = false; dom.addEventListener('mousedown', () => { drag = true; }); addEventListener('mouseup', () => { drag = false; });
    addEventListener('mousemove', (e) => { if (drag && document.pointerLockElement !== dom) { this.yaw -= e.movementX * 0.004; this.pitch = Math.max(-1.55, Math.min(1.55, this.pitch - e.movementY * 0.004)); } });
    addEventListener('wheel', (e) => { if (this.fly) this.flySpeed = Math.max(4, Math.min(3000, this.flySpeed * (e.deltaY < 0 ? 1.25 : 0.8))); });
  }
  toggleFly() { this.fly = !this.fly; this.vel.set(0, 0, 0); }
  teleport(x, z, y) { const g = this.world.ground(x, z); this.pos.set(x, y !== undefined ? Math.max(y, g + this.eye) : g + this.eye, z); this.vel.set(0, 0, 0); }
  update(dt) {
    const k = this.keys, w = this.world, S = w.S;
    const f = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0) + this.touchMove.f, r = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0) + this.touchMove.r;
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    const fx = -sy, fz = -cy, rx = cy, rz = -sy;
    if (this.fly) {
      const sp = this.flySpeed * (k.ShiftLeft ? 4 : 1), cp = Math.cos(this.pitch);
      this.pos.x += (fx * cp * f + rx * r) * sp * dt; this.pos.z += (fz * cp * f + rz * r) * sp * dt;
      this.pos.y += (Math.sin(this.pitch) * f + (k.Space ? 1 : 0) - (k.KeyC ? 1 : 0)) * sp * dt;
      const g = w.ground(this.pos.x, this.pos.z);
      if (this.pos.y < g + 1.2) this.pos.y = g + 1.2;
    } else {
      const g0 = w.ground(this.pos.x, this.pos.z), ws = w.waterSurface(this.pos.x, this.pos.z, g0);
      const feet = this.pos.y - this.eye;
      this.swimming = ws > g0 + 1.3 && feet < ws - 1.0;
      let sp = this.mount ? (k.ShiftLeft ? 14 : 7) : (k.ShiftLeft ? 8.5 : 4.5);
      if (this.swimming) sp = 1.6;
      let mx = fx * f + rx * r, mz = fz * f + rz * r; const ml = Math.hypot(mx, mz);
      if (ml > 0) { mx /= ml; mz /= ml; }
      // slope response: slow down uphill on steep ground, refuse cliffs
      const e = 0.6, gx = (w.ground(this.pos.x + e, this.pos.z) - w.ground(this.pos.x - e, this.pos.z)) / (2 * e), gz = (w.ground(this.pos.x, this.pos.z + e) - w.ground(this.pos.x, this.pos.z - e)) / (2 * e);
      const up = gx * mx + gz * mz, steep = Math.hypot(gx, gz);
      const limit = this.mount ? 0.6 : 1.1;
      if (up > 0) sp *= Math.max(0, 1 - up / limit);
      this.vel.x = mx * sp; this.vel.z = mz * sp;
      if (steep > 1.25 && this.onGround) { this.vel.x -= gx / steep * 6; this.vel.z -= gz / steep * 6; }   // slide off faces steeper than ~50 deg
      if (this.swimming) { this.vel.y += ((ws - 1.25) - feet) * 6 * dt - this.vel.y * 3 * dt; }
      else { this.vel.y -= 20 * dt; if (k.Space && this.onGround) this.vel.y = 6.5; }
      let nx = this.pos.x + this.vel.x * dt, nz = this.pos.z + this.vel.z * dt;
      if (this.colliders) for (const c of this.colliders(nx, nz)) {
        const dx = nx - c.x, dz = nz - c.z, d = Math.hypot(dx, dz), min = c.r + 0.35;
        if (d < min && d > 1e-4 && feet < c.top) { nx = c.x + dx / d * min; nz = c.z + dz / d * min; }
      }
      this.pos.x = nx; this.pos.z = nz; this.pos.y += this.vel.y * dt;
      const g = w.ground(this.pos.x, this.pos.z);
      if (this.pos.y - this.eye <= g) { this.pos.y = g + this.eye; this.vel.y = 0; this.onGround = true; }
      else this.onGround = (this.pos.y - this.eye - g) < 0.25 && this.vel.y <= 0 ? (this.pos.y = g + this.eye, this.vel.y = 0, true) : false;
    }
    this.pos.x = Math.max(5, Math.min(S - 5, this.pos.x)); this.pos.z = Math.max(5, Math.min(S - 5, this.pos.z));
    this.cam.position.copy(this.pos);
    this.cam.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }
}
