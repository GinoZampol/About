// Ambient life: bird flocks, wind-borne particles (pollen, snow, sand) and procedural sound
// (wind, running water, birdsong). All of it reads the world around the player.
import * as THREE from 'three';
import { MAP } from '../shared/world.mjs';

export class Life {
  constructor({ scene, world, camera, shared }) {
    this.world = world; this.camera = camera; this.shared = shared; this.t = 0;
    // ---- birds: a few loose flocks wheeling over the country near the player -----------------
    this.flocks = [];
    for (let f = 0; f < 4; f++) {
      const n = 9 + f * 4, geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 18), 3));
      const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x15171a, side: THREE.DoubleSide }));
      mesh.frustumCulled = false; scene.add(mesh);
      this.flocks.push({ n, mesh, c: new THREE.Vector3(1e9, 0, 0), ang: f * 1.7, r: 120 + f * 70, sp: 9 + f * 2, alt: 50 + f * 35, seed: f * 13.1 });
    }
    // ---- particles in the air around the camera -----------------------------------------------
    const NP = 700, pos = new Float32Array(NP * 3); this.NP = NP; this.BOX = 46;
    for (let k = 0; k < NP * 3; k++) pos[k] = (Math.random() - 0.5) * this.BOX;
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.pmat = new THREE.PointsMaterial({ size: 0.06, color: 0xfff6d8, transparent: true, opacity: 0.6, depthWrite: false, sizeAttenuation: true });
    this.points = new THREE.Points(pg, this.pmat); this.points.frustumCulled = false; this.points.renderOrder = 8; scene.add(this.points);
    this.audio = null; this.muted = false; this.env = { forest: 0, water: 0, alt: 0, sand: 0, snow: 0 };
    const start = () => { if (!this.audio) this._initAudio(); };
    addEventListener('pointerdown', start, { once: true }); addEventListener('keydown', start, { once: true });
    addEventListener('keydown', (e) => { if (e.code === 'KeyN') { this.muted = !this.muted; if (this.audio) this.audio.master.gain.value = this.muted ? 0 : 0.55; } });
  }

  _initAudio() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      const ctx = new AC(), master = ctx.createGain(); master.gain.value = this.muted ? 0 : 0.55; master.connect(ctx.destination);
      const buf = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate), d = buf.getChannelData(0); let b = 0;
      for (let k = 0; k < d.length; k++) { b = 0.985 * b + 0.15 * (Math.random() * 2 - 1); d[k] = b; }     // brown-ish noise
      const noise = (type, f, q) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = ctx.createGain(); g.gain.value = 0; s.connect(fl); fl.connect(g); g.connect(master); s.start(); return { fl, g }; };
      this.audio = { ctx, master, wind: noise('lowpass', 500, 0.4), water: noise('bandpass', 1500, 0.6), nextChirp: 0 };
    } catch { this.audio = null; }
  }
  _chirp() {
    const { ctx, master } = this.audio, t0 = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    const f0 = 2400 + Math.random() * 2600, notes = 2 + Math.floor(Math.random() * 4);
    o.type = 'sine'; g.gain.value = 0; o.connect(g); g.connect(master);
    for (let k = 0; k < notes; k++) {
      const t = t0 + k * (0.09 + Math.random() * 0.05);
      o.frequency.setValueAtTime(f0 * (1 + 0.25 * Math.random()), t); o.frequency.exponentialRampToValueAtTime(f0 * (0.75 + 0.5 * Math.random()), t + 0.07);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05 + 0.05 * Math.random(), t + 0.012); g.gain.linearRampToValueAtTime(0, t + 0.075);
    }
    o.start(t0); o.stop(t0 + notes * 0.15 + 0.1);
  }

  update(dt, timeOfDay) {
    this.t += dt;
    const w = this.world, p = this.camera.position, t = this.t;
    const g = w.ground(p.x, p.z), agl = p.y - g, env = this.env;
    env.forest = w.map(MAP.FOREST, p.x, p.z); env.sand = w.map(MAP.SAND, p.x, p.z) * (g > 50 ? 1 : 0); env.snow = g > 2500 ? 1 : 0; env.alt = p.y;
    const rv = w.riverAt(p.x, p.z, this._rq || (this._rq = {}));
    const nearRiver = rv ? Math.max(0, 1 - Math.max(0, rv.edge) / 60) * Math.min(1, rv.w / 12) : 0;
    env.water = Math.max(nearRiver, g < 3 && w.baseHeight(p.x, p.z) < 6 ? 0.5 : 0) * Math.max(0, 1 - agl / 150);
    const day = timeOfDay > 5.5 && timeOfDay < 20.5;

    // birds
    for (const f of this.flocks) {
      if (Math.hypot(f.c.x - p.x, f.c.z - p.z) > 1400) { const a = Math.random() * 6.28; f.c.set(p.x + Math.cos(a) * (250 + Math.random() * 500), 0, p.z + Math.sin(a) * (250 + Math.random() * 500)); }
      f.ang += dt * f.sp / f.r;
      const cx = f.c.x + Math.cos(f.ang) * f.r, cz = f.c.z + Math.sin(f.ang) * f.r, cy = Math.max(w.ground(cx, cz), 0) + f.alt + 12 * Math.sin(t * 0.21 + f.seed);
      const hx = -Math.sin(f.ang), hz = Math.cos(f.ang), arr = f.mesh.geometry.attributes.position.array;
      f.mesh.visible = day && cy < 3200;
      for (let b = 0; b < f.n; b++) {
        const s1 = Math.sin(b * 12.9898 + f.seed) * 43758.5453, r1 = s1 - Math.floor(s1), s2 = Math.sin(b * 78.233 + f.seed) * 12543.123, r2 = s2 - Math.floor(s2);
        const lag = (r1 - 0.5) * 34 + 4 * Math.sin(t * 0.7 + b), side = (r2 - 0.5) * 30 + 3 * Math.sin(t * 0.9 + b * 2.1);
        const bx = cx + hx * lag - hz * side, bz = cz + hz * lag + hx * side, by = cy + (r1 - r2) * 9 + Math.sin(t * 1.3 + b) * 1.5;
        const flap = Math.sin(t * (9 + r1 * 4) + b * 1.7) * 0.55, span = 0.75, o = b * 18;
        // body point, two wings (each a triangle hinged on the body line)
        const nx = bx + hx * 0.35, nz = bz + hz * 0.35, tx = bx - hx * 0.35, tz = bz - hz * 0.35;
        for (let s = 0; s < 2; s++) {
          const sg = s ? 1 : -1, wx = bx - hz * span * sg * Math.cos(flap), wz = bz + hx * span * sg * Math.cos(flap), wy = by + span * Math.sin(flap);
          arr.set([nx, by, nz, tx, by, tz, wx, wy, wz], o + s * 9);
        }
      }
      f.mesh.geometry.attributes.position.needsUpdate = true;
    }

    // particles: what the wind carries depends on where you stand
    const arr = this.points.geometry.attributes.position.array, B = this.BOX, hb = B / 2;
    let vx = 1.6, vy = 0.05, vz = 0.7, wob = 0.5;
    if (env.snow) { this.pmat.color.setRGB(1, 1, 1); this.pmat.size = 0.09; this.pmat.opacity = 0.85; vx = 5; vy = -1.2; vz = 2; wob = 0.9; }
    else if (env.sand > 0.4) { this.pmat.color.setRGB(0.86, 0.72, 0.5); this.pmat.size = 0.045; this.pmat.opacity = 0.55; vx = 7; vy = 0.1; vz = 2.5; wob = 0.4; }
    else { this.pmat.color.setRGB(1, 0.96, 0.82); this.pmat.size = 0.05; this.pmat.opacity = day ? 0.5 : 0.15; }
    this.points.visible = agl < 120;
    for (let k = 0; k < this.NP; k++) {
      const o = k * 3;
      arr[o] += (vx + wob * Math.sin(t * 1.3 + k)) * dt; arr[o + 1] += (vy + wob * 0.6 * Math.sin(t * 1.7 + k * 1.3)) * dt; arr[o + 2] += (vz + wob * Math.cos(t * 1.1 + k * 0.7)) * dt;
      for (let a = 0; a < 3; a++) { const c = a === 0 ? p.x : a === 1 ? p.y : p.z; let v = arr[o + a] - c; if (v > hb) arr[o + a] -= B; else if (v < -hb) arr[o + a] += B; }
    }
    this.points.geometry.attributes.position.needsUpdate = true;

    // sound
    if (this.audio) {
      const a = this.audio, now = a.ctx.currentTime, gust = 0.6 + 0.4 * Math.sin(t * 0.23) * Math.sin(t * 0.071 + 1.3);
      const exposure = Math.min(1, 0.25 + p.y / 2600 + (1 - env.forest) * 0.25 + Math.min(1, agl / 200) * 0.4);
      a.wind.g.gain.setTargetAtTime(0.9 * exposure * gust, now, 0.4); a.wind.fl.frequency.setTargetAtTime(280 + 700 * exposure * gust, now, 0.5);
      a.water.g.gain.setTargetAtTime(1.1 * env.water, now, 0.3);
      if (day && env.forest > 0.15 && agl < 60 && g < 1900 && now > a.nextChirp) { this._chirp(); a.nextChirp = now + 0.4 + Math.random() * (3.5 - 2.5 * env.forest); }
    }
  }
}
