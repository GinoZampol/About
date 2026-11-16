// Shaders: shared atmosphere/lighting model, terrain surface, water, sky.
import * as THREE from 'three';

export const ATMO = /* glsl */`
uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uAmbSky; uniform vec3 uAmbGround;
uniform vec3 uFogCol; uniform vec3 uFogSun; uniform vec3 uZenith; uniform float uFogA; uniform float uFogB;
uniform vec3 uSplits; uniform float uTime; uniform vec2 uPlay;   // uPlay: min and max coordinate of the playable square
vec3 S(vec3 c) { return pow(c, vec3(2.2)); }
vec3 skyColor(vec3 rd) {
  float y = max(rd.y, 0.0);
  vec3 c = mix(uFogCol, uZenith, 1.0 - exp(-y * 3.0));
  float sd = max(dot(rd, uSunDir), 0.0);
  c += uFogSun * (0.18 * pow(sd, 6.0) + 0.5 * pow(sd, 48.0));
  return c;
}
// one cloud deck, drifting with the wind; the sky draws it and everything below is shaded by it
uniform float uCloud;
const float CLOUD_H = 4300.0;
float cloudDensity(vec2 p) {
  vec2 q = p + uTime * vec2(15.0, 6.0);
  float n = texture2D(uNoise, q / 23000.0).r * 0.55 + texture2D(uNoise, q / 7100.0 + 0.3).g * 0.30 + texture2D(uNoise, q / 1900.0).b * 0.15;
  return smoothstep(1.0 - uCloud, 1.0 - uCloud + 0.22, n);
}
float cloudShadow(vec3 wpos) {
  if (wpos.y > CLOUD_H) return 1.0;
  vec2 p = wpos.xz + uSunDir.xz * ((CLOUD_H - wpos.y) / max(uSunDir.y, 0.1));
  return 1.0 - 0.6 * cloudDensity(p);
}
// height-attenuated haze with analytic integration along the view ray
vec3 applyAtmosphere(vec3 col, vec3 wpos) {
  vec3 v = wpos - cameraPosition; float d = length(v); vec3 rd = v / d;
  float ry = abs(rd.y) < 1e-4 ? 1e-4 : rd.y;
  float od = uFogA / uFogB * exp(-max(cameraPosition.y, 0.0) * uFogB) * (1.0 - exp(-d * ry * uFogB)) / ry;
  float f = 1.0 - exp(-od);
  float sd = max(dot(rd, uSunDir), 0.0);
  vec3 fc = uFogCol + uFogSun * (0.18 * pow(sd, 6.0));
  return mix(col, fc, clamp(f, 0.0, 1.0));
}
`;

export const SHADOW_FRAG = /* glsl */`
// far = world-scale terrain shadow (1 = lit); cascades add the near detail
float sunShadow(float viewZ, float far) {
  float s = far;
  #if defined(USE_SHADOWMAP) && NUM_DIR_LIGHT_SHADOWS >= 3
  if (viewZ < uSplits.x) s = min(far, getShadow(directionalShadowMap[0], directionalLightShadows[0].shadowMapSize, directionalLightShadows[0].shadowIntensity, directionalLightShadows[0].shadowBias, directionalLightShadows[0].shadowRadius, vDirectionalShadowCoord[0]));
  else if (viewZ < uSplits.y) s = min(far, getShadow(directionalShadowMap[1], directionalLightShadows[1].shadowMapSize, directionalLightShadows[1].shadowIntensity, directionalLightShadows[1].shadowBias, directionalLightShadows[1].shadowRadius, vDirectionalShadowCoord[1]));
  else if (viewZ < uSplits.z) {
    float c = getShadow(directionalShadowMap[2], directionalLightShadows[2].shadowMapSize, directionalLightShadows[2].shadowIntensity, directionalLightShadows[2].shadowBias, directionalLightShadows[2].shadowRadius, vDirectionalShadowCoord[2]);
    s = min(far, mix(c, 1.0, smoothstep(uSplits.z * 0.85, uSplits.z, viewZ)));
  }
  #endif
  return s;
}
`;

const TERRAIN_VERT = /* glsl */`
attribute float aMorph;
uniform float uSize;
varying vec3 vWPos; varying vec3 vN; varying float vViewZ;
#include <common>
#include <shadowmap_pars_vertex>
void main() {
  vec3 p = position;
  vec4 wp0 = modelMatrix * vec4(p, 1.0);
  float d = distance(wp0.xyz, cameraPosition);
  p.y -= aMorph * clamp((d - 3.3 * uSize) / (0.7 * uSize), 0.0, 1.0);
  vec4 worldPosition = modelMatrix * vec4(p, 1.0);
  vWPos = worldPosition.xyz; vN = normal;
  vec4 mv = viewMatrix * worldPosition; vViewZ = -mv.z;
  gl_Position = projectionMatrix * mv;
  vec3 transformedNormal = normalMatrix * normal;
  #include <shadowmap_vertex>
}
`;

const TERRAIN_FRAG = /* glsl */`
uniform sampler2D uMapA; uniform sampler2D uMapB; uniform sampler2D uFlow; uniform sampler2D uShadowTex; uniform sampler2D uRock; uniform sampler2D uNormTex; uniform sampler2D uNoise; uniform sampler2D uNoiseN;
uniform vec3 uCold; uniform float uVariantB; uniform float uCell; uniform float uWorldSize; uniform float uTreeDist; uniform float uSnowLine;
varying vec3 vWPos; varying vec3 vN; varying float vViewZ;
#include <common>
#include <packing>
#include <shadowmap_pars_fragment>
${ATMO}
${SHADOW_FRAG}
vec3 strataColor(int rk);
int rockAt(int base, float z, float off) {
  if (base != 6) return base;
  float zs = z - off;
  if (zs >= 1090.0) { float t = mod(zs - 1090.0, 380.0); return t < 125.0 ? 6 : t < 215.0 ? 3 : t < 300.0 ? 7 : 6; }
  if (zs >= 990.0) return 7; if (zs >= 905.0) return 6;
  if (zs >= 770.0) return 7; if (zs >= 650.0) return 3; if (zs >= 520.0) return 7; return 2;
}
vec3 rockColor(int rk) {
  if (rk == 0) return S(vec3(0.40, 0.36, 0.30));
  if (rk == 1) return S(vec3(0.31, 0.30, 0.28));
  if (rk == 2) return S(vec3(0.38, 0.37, 0.36));
  if (rk == 3) return S(vec3(0.41, 0.40, 0.37));
  if (rk == 4) return S(vec3(0.33, 0.33, 0.32));
  if (rk == 5) return S(vec3(0.25, 0.23, 0.23));
  if (rk == 6) return S(vec3(0.53, 0.36, 0.26));
  return S(vec3(0.50, 0.45, 0.39));
}
// Anti-tiling: every repeating noise lookup is blended with a second copy of itself that is rotated,
// rescaled and offset, with the blend weight varying over kilometres, so no pattern repeats in step.
const mat2 TILE_R = mat2(0.80, -0.60, 0.60, 0.80);
vec4 noTile(sampler2D t, vec2 uv, float k) { return mix(texture2D(t, uv), texture2D(t, TILE_R * uv * 0.87 + vec2(0.37, 0.71)), k); }
vec3 noTileN(sampler2D t, vec2 uv, float k) {
  vec3 a = texture2D(t, uv).xyz * 2.0 - 1.0, b = texture2D(t, TILE_R * uv * 0.87 + vec2(0.37, 0.71)).xyz * 2.0 - 1.0;
  b.xy = b.xy * TILE_R;
  return mix(a, b, k);
}
vec3 strataColor(int rk) { return rk == 3 ? S(vec3(0.66, 0.58, 0.46)) : rockColor(rk); }   // cream cap and ledge-forming beds
void main() {
  // the visible world ends 10 m beyond the playable border
  if (max(max(uPlay.x - vWPos.x, vWPos.x - uPlay.y), max(uPlay.x - vWPos.z, vWPos.z - uPlay.y)) > 10.0) discard;
  vec2 uv = clamp(vWPos.xz / uWorldSize, 0.0005, 0.9995);
  float dist = distance(vWPos, cameraPosition);
  vec4 n3 = (texture2D(uNoise, vWPos.xz / 790.0 + 0.37) + texture2D(uNoise, TILE_R * vWPos.xz / 1130.0 + 0.11) - 1.0) * 0.72 + 0.5;
  float tk = smoothstep(0.3, 0.7, texture2D(uNoise, vWPos.xz / 2310.0 + 0.19).a + (n3.g - 0.5) * 0.6);
  vec4 n1 = noTile(uNoise, vWPos.xz / 5.3, tk);
  vec4 n2 = noTile(uNoise, vWPos.xz / 67.0, 1.0 - tk);
  vec4 A = texture2D(uMapA, uv); vec4 B = texture2D(uMapB, uv);
  vec2 FI = texture2D(uFlow, uv).rg; float flow = FI.r, ice = FI.g;
  // rock provinces meet along irregular, blended contacts rather than a pixel line
  vec2 ruv = uv + (n3.rg - 0.5) * 0.007 + (n2.rg - 0.5) * 0.0016;
  int base = int(texture2D(uRock, ruv).r * 255.0 + 0.5);
  vec4 NT = texture2D(uNormTex, uv);
  vec3 nTex = vec3(NT.r * 2.0 - 1.0, 0.0, NT.g * 2.0 - 1.0); nTex.y = sqrt(max(1.0 - dot(nTex.xz, nTex.xz), 0.02));
  float outside = step(0.5, step(vWPos.x, 0.0) + step(uWorldSize, vWPos.x) + step(vWPos.z, 0.0) + step(uWorldSize, vWPos.z));
  vec3 N = normalize(mix(normalize(vN), nTex, smoothstep(9.0, 24.0, uCell) * (1.0 - outside)));
  float h = vWPos.y;
  float coldT = uCold.x > uCold.y ? clamp((uCold.x - vWPos.z) / (uCold.x - uCold.y), 0.0, 1.0) : 0.0;
  float hc = h + uCold.z * coldT * coldT * (3.0 - 2.0 * coldT);        // altitude as the climate sees it (cold north, variant B)
  float tanS = length(N.xz) / max(N.y, 0.05);
  float precip = A.r * 3.0, forest = A.g, dark = A.b, wet = A.a, sand = B.r, ao = B.g, strat = B.b * 510.0 - 100.0;
  float curv = clamp((NT.a - 0.5) * 2.0, -1.0, 1.0);                      // + hollows, - spurs and crests
  float mesa = smoothstep(0.22, 0.78, B.a + (n2.g - 0.5) * 0.16 + (n3.g - 0.5) * 0.2);        // the layered plateau province, and only it
  float sunny = N.z * min(tanS, 1.0);                                    // + on south-facing slopes

  // ---- soil moisture: climate, then where water actually collects on the landform ------------
  float m = precip * (1.0 + 0.2 * curv + 0.22 * flow - 0.14 * sunny + (n3.r - 0.5) * 0.3 + (n2.r - 0.5) * 0.16) + 0.35 * wet;
  m -= 0.3 * mesa * (1.0 - 0.7 * smoothstep(0.25, 0.55, flow));            // the plateau is dry steppe; only its watercourses stay green
  float detailF = 1.0 - smoothstep(120.0, 700.0, dist);                   // fine speckle only where it can be resolved

  // ---- herb layer -------------------------------------------------------------------------------
  vec3 lush = S(vec3(0.17, 0.27, 0.09)), mid = S(vec3(0.27, 0.34, 0.13)), dry = S(vec3(0.44, 0.42, 0.21)), steppe = S(vec3(0.56, 0.49, 0.34));
  // open grassland is green; only truly dry country (the plateau side) cures to straw and steppe
  // broad, overlapping ramps: steppe, cured grass, green sward and lush growth grade into one another
  // (wide ramps driven by soil moisture: dry steppe, cured grass, green sward and lush growth all appear)
  vec3 grass = mix(dry, mid, smoothstep(0.35, 0.95, m));
  grass = mix(grass, lush, smoothstep(0.95, 1.6, m));
  grass = mix(steppe, grass, smoothstep(0.25, 0.75, m));
  grass = mix(grass, mix(steppe, dry, 0.5), mesa * 0.55);          // plateau herbage is always on the dry side
  grass = mix(grass, S(vec3(0.38, 0.36, 0.22)), smoothstep(1450.0, 2050.0, hc));
  // variant B prairie: tall green-gold grass with the wind running over it in slow waves
  float prairie = uVariantB * (1.0 - smoothstep(0.2, 0.6, forest)) * smoothstep(0.36, 0.52, precip) * (1.0 - smoothstep(0.85, 1.05, precip)) * (1.0 - mesa) * (1.0 - smoothstep(300.0, 700.0, hc)) * (1.0 - wet);
  float gust = texture2D(uNoise, vWPos.xz / 310.0 + uTime * vec2(0.014, 0.006)).r;
  grass = mix(grass, mix(S(vec3(0.33, 0.37, 0.16)), S(vec3(0.47, 0.44, 0.22)), n3.b) * (0.82 + 0.36 * gust), prairie * 0.75);
  grass *= (0.88 + 0.24 * n2.g) * (0.9 + 0.2 * n1.r) * (0.94 + 0.12 * n3.a);
  grass = mix(grass, grass * vec3(1.12, 1.05, 0.86), n3.b * 0.3);                     // cured, seeding patches
  grass = mix(grass, grass * vec3(0.78, 0.94, 0.80), smoothstep(0.55, 0.8, n2.a) * 0.5); // rank, darker swards
  vec3 soil = mix(S(vec3(0.38, 0.32, 0.24)), S(vec3(0.52, 0.46, 0.36)), n3.g);
  soil = mix(soil, mix(S(vec3(0.55, 0.40, 0.29)), S(vec3(0.66, 0.56, 0.42)), n3.g), mesa);
  soil *= 0.9 + 0.2 * n1.g;
  float veg = smoothstep(0.1, 0.62, max(m, precip * 0.85 - 0.3 * mesa) + (n2.r - 0.5) * 0.12 * mix(0.4, 1.0, detailF) + (n1.b - 0.5) * 0.1 * detailF);
  float bare = (1.0 - 0.7 * smoothstep(0.4, 0.6, m)) * mix(0.12, smoothstep(0.62, 0.8, n1.g * 0.45 + n2.b * 0.55 + tanS * 0.22 - curv * 0.12), detailF);  // slips, trails, thin soil on spurs
  vec3 ground = mix(soil, grass, veg * (1.0 - bare * 0.65));
  vec3 litter = mix(S(vec3(0.26, 0.20, 0.12)), S(vec3(0.19, 0.24, 0.10)), n2.b * (0.5 + 0.5 * dark)) * (0.8 + 0.4 * n1.a);
  float ff = smoothstep(0.22, 0.74, forest + (n2.a - 0.5) * 0.35);
  // brown leaf litter is only seen from among the trees; from any distance the forest floor reads green
  ground = mix(ground, mix(S(vec3(0.11, 0.21, 0.07)) * (0.8 + 0.4 * n1.a), litter, 1.0 - smoothstep(18.0, 70.0, dist)), ff * 0.9);
  // marsh: a mosaic of reed beds, sedge and dark peaty pools
  vec3 marsh = mix(S(vec3(0.22, 0.27, 0.13)), S(vec3(0.40, 0.41, 0.20)), smoothstep(0.35, 0.65, n2.a)) * (0.8 + 0.4 * n1.r);
  marsh = mix(marsh, S(vec3(0.08, 0.10, 0.09)), smoothstep(0.56, 0.68, n2.b * 0.6 + n3.g * 0.4) * smoothstep(0.45, 0.8, wet));
  ground = mix(ground, marsh, wet * 0.75);
  // watercourses: green ribbons in humid country, pale gravel washes in dry country
  vec4 n4 = noTile(uNoise, vWPos.xz / 23.0 + 0.61, tk);
  // watercourses tint their surroundings only faintly and unevenly: no band of constant width
  float course = smoothstep(0.3, 0.75, flow + (n2.g - 0.5) * 0.3 + (n3.b - 0.5) * 0.35) * (0.5 + 0.5 * n4.a);
  float arid = 1.0 - smoothstep(0.32, 0.6, precip);
  ground = mix(ground, lush * (0.8 + 0.4 * n1.r), course * (1.0 - arid) * 0.3 * (1.0 - ff));
  ground = mix(ground, S(vec3(0.60, 0.56, 0.48)) * (0.8 + 0.4 * n1.b), course * arid * 0.3);
  vec3 sandC = mix(S(vec3(0.76, 0.69, 0.54)), S(vec3(0.78, 0.60, 0.42)), mesa) * (0.90 + 0.2 * n1.r) * (0.92 + 0.16 * n2.b);
  // sand thins out over a broad, ragged margin and lingers in hollows, so dunes grade into the plateau
  ground = mix(ground, sandC, smoothstep(0.06, 0.72, sand + ((n2.r - 0.5) * 0.25 + (n3.r - 0.5) * 0.35 + curv * 0.18) * smoothstep(0.0, 0.25, sand)) * (1.0 - smoothstep(0.4, 0.8, tanS)));

  // ---- bedrock -------------------------------------------------------------------------------
  float hz = h + (n2.r - 0.5) * 9.0 + (n3.g - 0.5) * 22.0;
  vec3 st = mix(strataColor(rockAt(6, hz + (n1.r - 0.5) * 5.0, strat)), strataColor(rockAt(6, hz - 6.0 + (n1.g - 0.5) * 5.0, strat)), 0.5);
  float bands = sin((h + strat * 0.15) * 0.7 + n3.r * 5.0) * 0.5 + sin(h * 2.3 + n2.g * 4.0) * 0.5;
  // plateau stratigraphy: colour bands follow the beds; outside the plateau mask it is plain grey rock
  vec3 mesaC = mix(rockColor(4), st * (1.0 + 0.12 * bands), mesa);
  vec2 rs = vec2(textureSize(uRock, 0)), tc = ruv * rs - 0.5, tf = floor(tc), fr = tc - tf;
  fr = fr * fr * (3.0 - 2.0 * fr);
  int i00 = int(texture2D(uRock, (tf + vec2(0.5, 0.5)) / rs).r * 255.0 + 0.5), i10 = int(texture2D(uRock, (tf + vec2(1.5, 0.5)) / rs).r * 255.0 + 0.5);
  int i01 = int(texture2D(uRock, (tf + vec2(0.5, 1.5)) / rs).r * 255.0 + 0.5), i11 = int(texture2D(uRock, (tf + vec2(1.5, 1.5)) / rs).r * 255.0 + 0.5);
  vec3 rc = mix(mix(i00 == 6 ? mesaC : rockColor(i00), i10 == 6 ? mesaC : rockColor(i10), fr.x), mix(i01 == 6 ? mesaC : rockColor(i01), i11 == 6 ? mesaC : rockColor(i11), fr.x), fr.y);
  rc = mix(rc, rc * vec3(1.06, 0.98, 0.9), n3.b) * (0.8 + 0.4 * n3.a);
  rc *= (0.84 + 0.32 * n2.g) * (0.9 + 0.2 * n1.b);
  // water stains and joints run down the face
  vec2 perp = normalize(vec2(-N.z, N.x) + 1e-4);
  float streak = texture2D(uNoise, vec2(dot(vWPos.xz, perp) / 9.0, h / 75.0)).r;
  rc *= mix(1.0, 0.66 + 0.62 * streak, smoothstep(0.7, 1.5, tanS));
  rc = mix(rc, rc * vec3(0.78, 0.84, 0.70), smoothstep(0.9, 1.6, precip) * n2.a * 0.7);
  // rock shows through gradually: thin soils on spurs and steep, high ground, in ragged patches
  float rockArg = tanS + (n2.b - 0.5) * 0.6 + (n3.a - 0.5) * 0.55 + (n4.g - 0.5) * 0.35 - curv * 0.3 + smoothstep(1300.0, 2700.0, hc) * 0.75
    - sand - forest * 1.15 - smoothstep(0.8, 1.6, precip) * 0.12 - 0.35 * (1.0 - smoothstep(1100.0, 2300.0, hc)) * smoothstep(0.45, 0.9, precip);
  float rockW = smoothstep(0.85, 1.75, rockArg);
  rockW = max(rockW, (1.0 - veg) * smoothstep(0.32, 0.65, tanS + (n2.b - 0.5) * 0.3) * (1.0 - smoothstep(0.2, 0.5, sand)));
  vec3 col = mix(ground, rc, rockW);
  // scree and debris aprons gather in the hollows below rock; shingle on shores
  float scree = smoothstep(0.6, 1.15, tanS + (n4.b - 0.5) * 0.3 + (n1.r - 0.5) * 0.3 + curv * 0.18 + smoothstep(1700.0, 2300.0, hc) * 0.25) * (1.0 - rockW) * (1.0 - ff * 0.8);
  col = mix(col, rc * 1.05 * (0.85 + 0.3 * n1.g), scree * 0.7);
  float shore = smoothstep(1.6, 0.15, h + (n2.r - 0.5) * 0.8) * (1.0 - rockW);
  col = mix(col, mix(sandC, S(vec3(0.42, 0.40, 0.37)), n2.g) * 0.85, shore);
  col *= mix(1.0, 0.55, smoothstep(0.3, -2.5, h));

  // ---- snow: lingers in shaded hollows, strips from spurs and steep faces ---------------------
  float sn = smoothstep(-110.0, 110.0, hc - uSnowLine + (n3.b - 0.5) * 280.0 + (n2.r - 0.5) * 70.0 - N.z * 160.0 + curv * 260.0) * mix(smoothstep(2.1, 1.2, tanS), smoothstep(5.0, 3.0, tanS), smoothstep(250.0, 800.0, h - uSnowLine));
  sn = max(sn, smoothstep(300.0, 750.0, hc - uSnowLine + (n2.r - 0.5) * 120.0) * smoothstep(6.0, 3.5, tanS));   // summits are white
  col = mix(col, vec3(0.86, 0.90, 0.95), sn);

  // ---- glaciers: snow-covered above the snowline, bare blue-grey ice with moraine stripes below ---
  float gl = smoothstep(0.35, 0.65, ice + (n2.b - 0.5) * 0.2) * smoothstep(1.6, 0.9, tanS) * smoothstep(2100.0, 2600.0, hc);
  vec3 iceC = mix(S(vec3(0.60, 0.70, 0.76)), S(vec3(0.80, 0.86, 0.90)), n2.g) * (0.8 + 0.3 * n1.r);
  iceC = mix(iceC, S(vec3(0.36, 0.34, 0.32)), smoothstep(0.62, 0.8, texture2D(uNoise, vec2(dot(vWPos.xz, perp) / 40.0, dot(vWPos.xz, vec2(perp.y, -perp.x)) / 900.0)).a) * 0.7);
  col = mix(col, mix(iceC, vec3(0.86, 0.90, 0.95), sn), gl);

  // ---- distant forest canopy -------------------------------------------------------------------
  // canopy thins into scattered trees towards its limits rather than ending on a line
  float canopyF = smoothstep(uTreeDist * 0.6, uTreeDist, dist) * smoothstep(0.04, 0.62, forest + (n2.a - 0.5) * 0.3 + (n3.a - 0.5) * 0.25 + (n4.r - 0.5) * 0.4 * (1.0 - smoothstep(0.5, 0.8, forest))) * (1.0 - sn);
  vec3 canopy = mix(S(vec3(0.13, 0.24, 0.07)), S(vec3(0.08, 0.17, 0.08)), smoothstep(450.0, 1100.0, h));
  canopy = mix(canopy, S(vec3(0.06, 0.12, 0.08)), dark);
  canopy *= (0.45 + 1.0 * n1.g) * (0.75 + 0.5 * n2.r) * (0.85 + 0.3 * n3.a);
  col = mix(col, canopy, canopyF);
  col = mix(col, S(vec3(0.16, 0.26, 0.30)), NT.b * smoothstep(300.0, 1200.0, dist) * 0.85);

  // ---- lighting ------------------------------------------------------------------------------
  float nearF = 1.0 - smoothstep(40.0, 320.0, dist);
  vec3 dn = noTileN(uNoiseN, vWPos.xz / 2.7, tk) * nearF + noTileN(uNoiseN, vWPos.xz / 23.0, 1.0 - tk) * (1.0 - smoothstep(300.0, 2500.0, dist)) * 0.6;
  N = normalize(N + vec3(dn.x, 0.0, dn.y) * mix(0.3, 0.55, rockW) * (1.0 - sn * 0.45));
  vec3 dn3 = noTileN(uNoiseN, vWPos.xz / 190.0, tk);
  vec3 dn4 = noTileN(uNoiseN, vWPos.xz / 9.0, 1.0 - tk);
  N = normalize(N + vec3(dn3.x, 0.0, dn3.y) * (0.45 * rockW + 0.18 + 0.3 * sn) + vec3(dn4.x, 0.0, dn4.y) * 0.9 * canopyF);
  float ndl = max(dot(N, uSunDir), 0.0);
  ndl = mix(ndl, 0.35 + 0.65 * ndl, canopyF * 0.6);
  float sh = sunShadow(vViewZ, texture2D(uShadowTex, uv).r) * cloudShadow(vWPos);
  float occ = mix(0.3, 1.0, ao) * (1.0 - 0.3 * max(curv, 0.0));
  vec3 V = normalize(cameraPosition - vWPos);
  // sky fill from above, warm light bounced off sunlit ground from below; cavities darken direct light a little too
  vec3 amb = (mix(uAmbGround, uAmbSky, N.y * 0.5 + 0.5) + uSunCol * col * 0.22 * (1.0 - N.y * 0.6)) * occ;
  vec3 lit = col * (uSunCol * ndl * sh * mix(1.0, occ, 0.35) + amb);
  // grass and leaves: a silvery sheen at grazing view angles, and sunlight glowing through them when lit from behind
  float vegW = clamp(veg * (1.0 - rockW) * (1.0 - sn) * (1.0 - sand) + canopyF * 0.6, 0.0, 1.0);
  float graze = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  float back = pow(max(dot(-V, uSunDir), 0.0), 4.0) * smoothstep(-0.05, 0.25, uSunDir.y);
  lit += vegW * sh * uSunCol * (graze * 0.07 * vec3(0.85, 0.95, 0.75) + back * col * vec3(1.1, 1.35, 0.6) * 0.55);
  float lum = dot(lit, vec3(0.2126, 0.7152, 0.0722));
  lit = max(mix(vec3(lum), lit, 1.06), 0.0);
  lit += uSunCol * sh * sn * 0.25 * pow(max(dot(N, normalize(V + uSunDir)), 0.0), 40.0);
  gl_FragColor = vec4(applyAtmosphere(lit, vWPos), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

const WATER_VERT = /* glsl */`
attribute float aDepth;
#ifdef RIVER
attribute vec3 aFlow;   // along-stream distance, across (-1..1), turbulence
varying vec3 vFlow;
#endif
varying vec3 vWPos; varying float vDepth;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWPos = wp.xyz; vDepth = aDepth;
  #ifdef RIVER
  vFlow = aFlow;
  #endif
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
const WATER_FRAG = /* glsl */`
uniform sampler2D uNoiseN; uniform sampler2D uNoise;
uniform float uWorldSize;
varying vec3 vWPos; varying float vDepth;
#ifdef RIVER
varying vec3 vFlow;
#endif
${ATMO}
void main() {
  float dep = vDepth;
  if (dep < -0.02) discard;
  if (max(max(uPlay.x - vWPos.x, vWPos.x - uPlay.y), max(uPlay.x - vWPos.z, vWPos.z - uPlay.y)) > 10.0) discard;
  float dist = distance(vWPos, cameraPosition);
  vec2 p = vWPos.xz;
  #ifdef RIVER
  vec2 fuv = vec2(vFlow.y * 6.0, vFlow.x);
  float sp = 0.5 + vFlow.z * 2.5;
  vec3 w1 = texture2D(uNoiseN, fuv / 7.0 + vec2(0.0, -uTime * 0.11 * sp)).xyz * 2.0 - 1.0;
  vec3 w2 = texture2D(uNoiseN, fuv / 2.3 + vec2(0.3, -uTime * 0.19 * sp)).xyz * 2.0 - 1.0;
  float rough = 0.10 + 0.5 * vFlow.z;
  #else
  vec3 w1 = texture2D(uNoiseN, p / 11.0 + uTime * vec2(0.013, 0.021)).xyz * 2.0 - 1.0;
  vec3 w2 = texture2D(uNoiseN, p / 37.0 - uTime * vec2(0.011, 0.006)).xyz * 2.0 - 1.0;
  float rough = 0.16 * smoothstep(0.0, 6.0, dep) + 0.05;
  #endif
  float fade = 1.0 - 0.75 * smoothstep(200.0, 3000.0, dist);
  vec3 N = normalize(vec3((w1.x + w2.x) * rough * fade, 1.0, (w1.y + w2.y) * rough * fade));
  vec3 V = normalize(cameraPosition - vWPos);
  float fres = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
  vec3 R = reflect(-V, N); R.y = abs(R.y);
  vec3 refl = skyColor(R);
  float T = exp(-max(dep, 0.0) * 0.45);
  float csh = cloudShadow(vWPos);
  vec3 light = uSunCol * max(uSunDir.y, 0.0) * 0.32 * csh + uAmbSky * 0.55;
  #ifdef RIVER
  vec3 body = mix(S(vec3(0.10, 0.22, 0.20)), S(vec3(0.30, 0.38, 0.28)), T) * light;
  #else
  vec3 body = mix(S(vec3(0.05, 0.18, 0.25)), S(vec3(0.22, 0.42, 0.40)), T) * light;
  #endif
  vec3 col = mix(body, refl, fres);
  col += uSunCol * pow(max(dot(R, uSunDir), 0.0), 220.0) * 2.0 * csh;
  float foam = smoothstep(0.30, 0.0, dep) * smoothstep(0.35, 0.6, texture2D(uNoise, p / 3.0 + uTime * 0.02).r);
  #ifdef RIVER
  foam = max(foam, smoothstep(0.25, 0.8, vFlow.z) * smoothstep(0.3, 0.62, texture2D(uNoise, fuv / 4.0 + vec2(0.0, -uTime * 0.3 * sp)).g));
  #endif
  col = mix(col, light * 0.9, foam * 0.7);
  float alpha = mix(1.0 - T * 0.92, 1.0, max(fres, foam));
  gl_FragColor = vec4(applyAtmosphere(col, vWPos), alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

const SKY_VERT = /* glsl */`
varying vec3 vDir;
void main() { vDir = position; vec4 p = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0); gl_Position = p.xyww; }
`;
const SKY_FRAG = /* glsl */`
uniform sampler2D uNoise;
varying vec3 vDir;
${ATMO}
void main() {
  vec3 rd = normalize(vDir);
  vec3 col = skyColor(rd);
  float sd = max(dot(rd, uSunDir), 0.0);
  col += uSunCol * smoothstep(0.99985, 0.99995, sd) * 6.0;
  if (rd.y > 0.01 && cameraPosition.y < CLOUD_H - 50.0) {
    float tc = (CLOUD_H - cameraPosition.y) / rd.y;
    vec2 p = cameraPosition.xz + rd.xz * tc;
    float n = cloudDensity(p);
    float dns = n * smoothstep(0.01, 0.10, rd.y) * (1.0 - smoothstep(60000.0, 140000.0, tc));
    vec3 cc = uSunCol * (0.26 + 0.1 * pow(sd, 4.0)) + uAmbSky * 0.9;
    cc *= 1.0 - 0.25 * n;
    col = mix(col, mix(uFogCol, cc, smoothstep(0.02, 0.3, rd.y)), dns * 0.92);
  }
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export function makeShared() {
  return {
    uSunDir: { value: new THREE.Vector3(0.3, 0.8, 0.5).normalize() }, uSunCol: { value: new THREE.Color(3, 3, 3) },
    uAmbSky: { value: new THREE.Color(0.4, 0.5, 0.7) }, uAmbGround: { value: new THREE.Color(0.2, 0.18, 0.15) },
    uFogCol: { value: new THREE.Color(0.6, 0.7, 0.85) }, uFogSun: { value: new THREE.Color(1, 0.9, 0.7) }, uZenith: { value: new THREE.Color(0.15, 0.3, 0.65) },
    uFogA: { value: 0.55e-5 }, uFogB: { value: 1 / 1700 }, uSplits: { value: new THREE.Vector3(100, 500, 3000) }, uTime: { value: 0 }, uCloud: { value: 0.42 }, uWorldSize: { value: 50000 }, uPlay: { value: new THREE.Vector2(0, 50000) },
  };
}

// Sun/sky state from the sun's elevation (radians) and azimuth.
export function setSun(sh, elev, azim) {
  const e = Math.max(elev, -0.05);
  sh.uSunDir.value.set(Math.cos(e) * Math.sin(azim), Math.sin(e), Math.cos(e) * Math.cos(azim)).normalize();
  const t = THREE.MathUtils.smoothstep(e, -0.03, 0.45);            // 0 at horizon .. 1 high sun
  const warm = new THREE.Color(1.0, 0.56, 0.28), white = new THREE.Color(1.0, 0.96, 0.9);
  const sunI = 3.3 * THREE.MathUtils.smoothstep(e, -0.04, 0.12);
  sh.uSunCol.value.copy(warm).lerp(white, Math.pow(t, 0.6)).multiplyScalar(sunI);
  sh.uZenith.value.set(0.10, 0.22, 0.52).multiplyScalar(0.35 + 0.65 * t);
  sh.uFogCol.value.set(0.50, 0.63, 0.80).lerp(new THREE.Color(0.75, 0.55, 0.42), 1 - t).multiplyScalar(0.3 + 0.75 * t);
  sh.uFogSun.value.copy(warm).lerp(white, t).multiplyScalar(0.5 + 0.5 * t);
  sh.uAmbSky.value.set(0.50, 0.62, 0.86).multiplyScalar(0.25 + 0.75 * t);
  sh.uAmbGround.value.set(0.30, 0.28, 0.23).multiplyScalar(0.25 + 0.75 * t);
}

export function makeMaterials(shared, tex, opts) {
  const base = () => ({ ...THREE.UniformsUtils.clone(THREE.UniformsLib.lights), ...shared });
  const terrainU = { uMapA: { value: tex.mapA }, uMapB: { value: tex.mapB }, uRock: { value: tex.rock }, uFlow: { value: tex.flow }, uShadowTex: { value: tex.shadow }, uNormTex: { value: tex.norm }, uNoise: { value: tex.noise }, uNoiseN: { value: tex.noiseN }, uWorldSize: { value: opts.worldSize }, uTreeDist: opts.uTreeDist, uSnowLine: opts.uSnowLine, uCold: opts.uCold, uVariantB: { value: opts.variantB ? 1 : 0 } };
  const makeTerrain = (cell, size) => new THREE.ShaderMaterial({
    uniforms: { ...base(), ...terrainU, uCell: { value: cell }, uSize: { value: size } },
    vertexShader: TERRAIN_VERT, fragmentShader: TERRAIN_FRAG, lights: true,
  });
  const waterOpts = (river) => ({
    uniforms: { ...shared, uNoise: { value: tex.noise }, uNoiseN: { value: tex.noiseN } }, defines: river ? { RIVER: 1 } : {},
    vertexShader: WATER_VERT, fragmentShader: WATER_FRAG, transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: river ? -2 : -1, polygonOffsetUnits: river ? -2 : -1,
  });
  const water = new THREE.ShaderMaterial(waterOpts(false));
  const river = new THREE.ShaderMaterial(waterOpts(true));
  const sky = new THREE.ShaderMaterial({ uniforms: { ...shared, uNoise: { value: tex.noise } }, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, depthTest: true });
  return { makeTerrain, water, river, sky, base };
}
