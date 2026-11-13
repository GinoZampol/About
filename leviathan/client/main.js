// The Leviathan - client entry point.
import * as THREE from 'three';
import { CSM } from 'three/addons/csm/CSM.js';
import { loadWorldData, World, MAP } from '../shared/world.mjs';
import { materialAt } from '../shared/subsurface.mjs';
import { ROCK_NAMES } from '../shared/geology.mjs';
import { buildTextures } from './textures.js';
import { makeShared, makeMaterials, setSun } from './materials.js';
import { Terrain } from './terrain.js';
import { buildRivers } from './rivers.js';
import { Vegetation } from './vegetation.js';
import { Player } from './player.js';

const fail = (e) => { const el = document.getElementById('lmsg'); if (el) el.textContent = 'Could not start: ' + (e.reason?.message || e.message || e); };
addEventListener('error', fail); addEventListener('unhandledrejection', fail);
const Q = new URLSearchParams(location.search);
const num = (k, d) => (Q.has(k) ? +Q.get(k) : d);
const QUALITY = {
  low:    { maxLevel: 9,  shadows: 0,    treeDist: 500,  grassDist: 0,  pr: 1 },
  medium: { maxLevel: 10, shadows: 1024, treeDist: 900,  grassDist: 45, pr: 1 },
  high:   { maxLevel: 11, shadows: 2048, treeDist: 1500, grassDist: 70, pr: Math.min(devicePixelRatio, 2) },
};
const quality = QUALITY[Q.get('quality') || (Math.min(innerWidth, innerHeight) < 600 ? 'low' : 'medium')];
const SHOT = Q.has('shot');
if (Q.get('ui') === '0') document.body.classList.add('noui');
const $ = (id) => document.getElementById(id);
const progress = (f, msg) => { $('bar').firstElementChild.style.width = Math.round(f * 100) + '%'; if (msg) $('lmsg').textContent = msg; };

const dataUrl = Q.get('data') || new URL('../data/', import.meta.url).href;
// Hosts that only serve web media types get the binary files wrapped losslessly in PNG pixels (see tools/build_web.mjs).
async function readData(n) {
  const packed = window.LEVIATHAN_DATA === 'png' && n.endsWith('.bin');
  const r = await fetch(dataUrl + (packed ? n.replace('.bin', '.png') : n)); if (!r.ok) throw new Error('missing ' + n);
  if (!packed) return r.arrayBuffer();
  const bmp = await createImageBitmap(await r.blob(), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  const cv = document.createElement('canvas'); cv.width = bmp.width; cv.height = bmp.height;
  const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(bmp, 0, 0);
  const px = cx.getImageData(0, 0, bmp.width, bmp.height).data, len = px[0] | (px[1] << 8) | (px[2] << 16) | (px[4] << 24);
  const out = new Uint8Array(len);
  for (let k = 0, p = 8; k < len; p += 4) { out[k++] = px[p]; if (k < len) out[k++] = px[p + 1]; if (k < len) out[k++] = px[p + 2]; }
  return out.buffer;
}
const data = await loadWorldData(readData, (f) => progress(f * 0.6, 'loading world data'));
progress(0.65, 'building world model');
const world = new World(data);
const S = world.S;

const canvas = $('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(num('pr', quality.pr));
renderer.setSize(innerWidth, innerHeight, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = num('exposure', 0.54);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = quality.shadows > 0; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(num('fov', 62), innerWidth / innerHeight, 0.4, 160000);

progress(0.7, 'building textures');
const tex = buildTextures(data, Math.min(8, renderer.capabilities.getMaxAnisotropy()));
const shared = makeShared();
const opts = { worldSize: S, uTreeDist: { value: quality.treeDist }, uSnowLine: { value: num('snow', 2450) }, uCloud: { value: num('cloud', 0.42) } };
const mats = makeMaterials(shared, tex, opts);

const sky = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), mats.sky);
sky.frustumCulled = false; sky.renderOrder = -10; scene.add(sky);

let csm = null;
if (quality.shadows) {
  csm = new CSM({ maxFar: 2600, cascades: 3, mode: 'practical', parent: scene, shadowMapSize: quality.shadows, lightDirection: new THREE.Vector3(-1, -1, -1).normalize(), camera, lightMargin: 3500, lightFar: 12000, lightIntensity: 1 });
  for (const l of csm.lights) { l.shadow.bias = -0.0004; l.shadow.normalBias = 0.6; }
}

progress(0.8, 'starting terrain workers');
let vegetation = null;
const terrain = new Terrain({ scene, data, makeTerrainMaterial: mats.makeTerrain, waterMaterial: mats.water, maxLevel: num('maxLevel', quality.maxLevel), workers: Math.max(2, Math.min(4, (navigator.hardwareConcurrency || 4) - 1)), onWorkerMessage: (m) => vegetation && vegetation.onMessage(m) });
const rivers = buildRivers(world, mats.river, scene);
vegetation = new Vegetation({ scene, world, terrain, shared, mats, tex, csm, treeDist: quality.treeDist, grassDist: num('grass', quality.grassDist) });
await terrain.ready;

const player = new Player(camera, world, canvas);
player.colliders = (x, z) => vegetation.collidersNear(x, z);
// start position: URL (?pos=x,y,z&look=yawDeg,pitchDeg) or the hills above the Great River delta
{
  const lmDelta = world.meta.landmarks.find((l) => l.name.includes('Central Valley'));
  const p = (Q.get('pos') || `${lmDelta.x},0,${lmDelta.z}`).split(',').map(Number);
  player.teleport(p[0], p[2], p[1] > 0 ? world.ground(p[0], p[2]) + p[1] : undefined);
  if (Q.has('alt')) player.pos.y = +Q.get('alt');
  const l = (Q.get('look') || '200,-4').split(',').map(Number);
  player.yaw = -l[0] * Math.PI / 180; player.pitch = l[1] * Math.PI / 180;      // heading: 0 = north, 90 = east
  player.fly = Q.get('walk') !== '1';
}
let timeOfDay = num('time', 13.5);
function updateSun() {
  const hAng = (timeOfDay - 13) / 12 * Math.PI;                       // solar noon at 13:00
  const lat = 46 * Math.PI / 180, dec = 18 * Math.PI / 180;
  const sinE = Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(hAng);
  const elev = Math.asin(sinE);
  const az = Math.atan2(-Math.sin(hAng) * Math.cos(dec), Math.cos(lat) * Math.sin(dec) - Math.sin(lat) * Math.cos(dec) * Math.cos(hAng)); // from north, clockwise
  // world: +x east, +z south => direction to sun = (sin az, y, -cos az)
  setSun(shared, elev, 0);
  shared.uSunDir.value.set(Math.cos(Math.max(elev, -0.05)) * Math.sin(az), Math.sin(Math.max(elev, -0.05)), -Math.cos(Math.max(elev, -0.05)) * Math.cos(az)).normalize();
  if (csm) { csm.lightDirection.copy(shared.uSunDir.value).multiplyScalar(-1); }
}
updateSun();

// ---- UI ------------------------------------------------------------------------------------
$('help').textContent = 'click: capture mouse   WASD: move   Shift: fast\nF: walk / fly   H: mount   Space / C: up / down\nwheel: fly speed   [ ]: time of day\nM: map + places   G / B: dig / fill 1 m3\nU: hide HUD';
const mapCv = $('map');
function drawMap() {
  const ctx = mapCv.getContext('2d'), W = 512, img = ctx.createImageData(W, W), N = world.N;
  for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) {
    const x = (i + 0.5) / W * S, z = (j + 0.5) / W * S, k = (j * W + i) * 4;
    const ci = Math.min(N - 2, Math.floor(x / S * N)), cj = Math.min(N - 2, Math.floor(z / S * N));
    const h = world.H[cj * N + ci] * world.hs - world.ho, hx = world.H[cj * N + ci + 1] * world.hs - world.ho, hz = world.H[(cj + 1) * N + ci] * world.hs - world.ho;
    const sh = 0.75 + Math.max(-0.4, Math.min(0.5, ((h - hx) + (h - hz)) / (S / N) * 0.5));
    let r, g, b;
    if (h < 0 || h < world.stillLevel(x, z)) { r = 52; g = 92; b = 130; }
    else {
      const F = world.map(MAP.FOREST, x, z), p = world.map(MAP.PRECIP, x, z) * 3;
      r = 170 - 60 * Math.min(1, p); g = 160 - 10 * Math.min(1, p); b = 100;
      r += (60 - r) * F; g += (95 - g) * F; b += (55 - b) * F;
      if (h > 2000) { const t = Math.min(1, (h - 2000) / 500); r += (235 - r) * t; g += (236 - g) * t; b += (240 - b) * t; }
      r *= sh; g *= sh; b *= sh;
    }
    img.data[k] = r; img.data[k + 1] = g; img.data[k + 2] = b; img.data[k + 3] = 255;
  }
  ctx.putImageData(img, 0, 0); mapCv._img = img;
}
let mapOn = false;
function toggleMap() {
  mapOn = !mapOn; mapCv.style.display = mapOn ? 'block' : 'none'; $('places').style.display = mapOn ? 'flex' : 'none';
  if (mapOn && !mapCv._img) { drawMap(); for (const l of world.meta.landmarks) { const b = document.createElement('button'); b.textContent = l.name; b.title = l.note; b.onclick = () => { player.fly = true; player.teleport(l.x, l.z, world.ground(l.x, l.z) + 120); }; $('places').appendChild(b); } }
  if (mapOn) document.exitPointerLock?.();
}
mapCv.addEventListener('click', (e) => { const r = mapCv.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width * S, z = (e.clientY - r.top) / r.height * S; player.fly = true; player.teleport(x, z, world.ground(x, z) + 150); });
let lastDig = '';
function dig(sign) {
  const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
  for (let t = 0.5; t < 9; t += 0.25) {
    const x = player.pos.x + dir.x * t, y = player.pos.y + dir.y * t, z = player.pos.z + dir.z * t;
    if (y <= world.ground(x, z)) {
      const ix = Math.floor(x), iz = Math.floor(z), g = world.ground(ix + 0.5, iz + 0.5);
      lastDig = sign < 0 ? `mined 1 m3 of ${materialAt(world, ix + 0.5, g - 0.5, iz + 0.5, g)}` : 'placed 1 m3 of fill';
      const dh = world.getEdit(ix, iz) + sign;
      world.setEdit(ix, iz, dh); terrain.postAll({ type: 'edit', cells: [[ix, iz, dh]] }); terrain.invalidate(ix + 0.5, iz + 0.5, 3);
      return;
    }
  }
}
addEventListener('keydown', (e) => {
  if (e.code === 'BracketLeft') { timeOfDay = (timeOfDay + 23.75) % 24; updateSun(); }
  if (e.code === 'BracketRight') { timeOfDay = (timeOfDay + 0.25) % 24; updateSun(); }
  if (e.code === 'KeyM') toggleMap();
  if (e.code === 'KeyU') document.body.classList.toggle('noui');
  if (e.code === 'KeyG') dig(-1);
  if (e.code === 'KeyB') dig(1);
});
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); if (csm) csm.updateFrustums(); });

function regionName(x, z, h) {
  const xk = x / 1000, yk = (S - z) / 1000, p = world.map(MAP.PRECIP, x, z) * 3, F = world.map(MAP.FOREST, x, z), D = world.map(MAP.DARK, x, z);
  let land = h < 0.3 ? 'open water' : D > 0.5 ? 'ancient dark forest' : F > 0.55 ? (h > 1000 ? 'montane conifer forest' : 'temperate forest') : h > 2450 ? 'snowfields' : h > 1950 ? 'alpine zone' : p < 0.3 ? 'desert' : p < 0.5 ? 'dry steppe' : F > 0.2 ? 'parkland' : 'grassland';
  const reg = xk > 41 ? 'High Desert plateau' : xk > 38 ? 'the Trench' : (xk > 27 && yk < 40) || (xk > 30) ? 'the Spine' : yk > 43 ? 'Northern Highlands' : yk > 33 && xk < 23 ? 'the Sound' : xk < 14 ? 'Coast Range' : 'Central Valley';
  return `${reg} - ${land}`;
}

// ---- main loop --------------------------------------------------------------------------------
const clock = new THREE.Clock(); let fps = 60, frames = 0, readyFrames = 0, hudT = 0;
window.__stats = () => ({ frames, fps, calls: renderer.info.render.calls, tris: renderer.info.render.triangles, chunks: terrain.stats.chunks, terrainTris: terrain.stats.tris, built: terrain.stats.built, avgBuildMs: terrain.stats.buildMs / Math.max(1, terrain.stats.built), geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, heap: performance.memory ? performance.memory.usedJSHeapSize : 0, veg: vegetation.stats, riverTris: rivers.tris, pos: player.pos.toArray() });
window.__setView = (x, alt, z, yawDeg, pitchDeg, time) => { player.fly = true; player.pos.set(x, world.ground(x, z) + alt, z); player.yaw = -yawDeg * Math.PI / 180; player.pitch = pitchDeg * Math.PI / 180; if (time !== undefined) { timeOfDay = time; updateSun(); } readyFrames = 0; window.__ready = false; };
window.__bench = (n) => { const gl = renderer.getContext(), t = performance.now(); for (let k = 0; k < n; k++) { if (csm) csm.update(); renderer.render(scene, camera); gl.finish(); } return (performance.now() - t) / n; };
window.__world = world; window.__player = player; window.__terrain = terrain;
$('loading').style.display = 'none';

function frame() {
  if (SHOT && window.__ready) return;      // capture mode: hold the finished frame
  const dt = Math.min(0.1, clock.getDelta());
  shared.uTime.value += dt;
  player.update(dt);
  const agl = player.pos.y - world.ground(player.pos.x, player.pos.z);
  camera.near = Math.max(0.3, Math.min(30, agl * 0.04)); camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  sky.position.copy(camera.position); sky.scale.setScalar(camera.far * 0.9);
  terrain.update(camera.position);
  vegetation.update(camera.position, dt);
  const settled = !terrain.busy && !vegetation.busy;
  readyFrames = settled ? readyFrames + 1 : 0;
  if (SHOT && !settled && frames % 20 !== 0) { frames++; return; }       // capture mode: don't waste time drawing while streaming
  if (csm) {
    csm.update();
    const far = Math.min(camera.far, csm.maxFar), b = csm.breaks;
    shared.uSplits.value.set(b[0] * far, b[1] * far, b[2] * far);
  }
  renderer.render(scene, camera);
  frames++;
  if (readyFrames > 3) window.__ready = true;
  fps += ((1 / Math.max(dt, 1e-3)) - fps) * 0.05;
  hudT += dt;
  if (hudT > 0.25) {
    hudT = 0;
    const p = player.pos, g = world.ground(p.x, p.z), c = world.climate(p.x, p.z, g);
    $('hud').textContent = `${regionName(p.x, p.z, g)}\n` +
      `E ${(p.x / 1000).toFixed(2)} km  N ${((S - p.z) / 1000).toFixed(2)} km  elev ${g.toFixed(0)} m${player.fly ? `  (fly ${player.flySpeed.toFixed(0)} m/s)` : player.swimming ? '  (swimming)' : player.mount ? '  (mounted)' : ''}\n` +
      `bedrock ${ROCK_NAMES[world.rockAt(p.x, p.z, g)]}  rain ${(c.precip * 1000).toFixed(0)} mm  ${c.temp.toFixed(1)} C  ${String(Math.floor(timeOfDay)).padStart(2, '0')}:${String(Math.round(timeOfDay % 1 * 60)).padStart(2, '0')}\n` +
      `${fps.toFixed(0)} fps  ${terrain.stats.chunks} chunks  ${(renderer.info.render.triangles / 1e6).toFixed(2)} M tris  ${renderer.info.render.calls} draws${lastDig ? '\n' + lastDig : ''}`;
    if (mapOn && mapCv._img) { const ctx = mapCv.getContext('2d'); ctx.putImageData(mapCv._img, 0, 0); ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.beginPath(); ctx.arc(p.x / S * 512, p.z / S * 512, 4, 0, 7); ctx.fill(); ctx.stroke(); }
  }
}
renderer.setAnimationLoop(frame);
