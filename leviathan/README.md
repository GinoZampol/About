# The Leviathan — world

A 50 × 50 km natural world for The Leviathan, the generator that builds it, and a browser client that
streams and renders it as real geometry. Everything here is procedural: no heightmap is painted, no
texture is a photograph, no tree is a downloaded model.

Play it: **https://ginozampol.github.io/About/** (landing page with every world).

```
npm install
npm start                                   # http://localhost:8080
node worldgen/generate.mjs --variant S --seed random --out data_b4    # a new seeded world (about 11 minutes)
node tools/layout_preview.mjs out.png 123 456 789                      # top-down previews of seeds in seconds
npm run validate                            # hydrology / terrain / traversability / determinism checks (world A)
npm run shots                               # in-engine screenshots of the views in tools/views.json
npm run perf                                # streaming, memory and frame-time measurements
```

Controls: click to capture the mouse, WASD, Shift (fast), F walk/fly, H mount, wheel = fly speed, `[` `]`
time of day, T day cycle, N sound, M map and place list (click the map to travel), G / B dig or fill 1 m³.
On a phone: left half of the screen is a movement stick, right half looks around.
URL options: `?quality=low|medium|high`, `?data=/data_b4/`, `?pos=x,heightAboveGround,z&look=heading,pitch&time=13.5`.

---

## Contents

1. [The worlds](#1-the-worlds)
2. [Pipeline at a glance](#2-pipeline-at-a-glance)
3. [Large-scale forcing](#3-large-scale-forcing)
4. [Landscape evolution](#4-landscape-evolution-the-erosion-simulation)
5. [Rock and strata](#5-rock-and-strata)
6. [Finishing](#6-finishing-glaciers-rivers-climate-ecology)
7. [Data set](#7-the-data-set)
8. [The ground function](#8-the-ground-function-sharedworldmjs)
9. [Terrain streaming](#9-terrain-streaming-and-meshing)
10. [Surface shading and textures](#10-surface-shading-and-textures)
11. [Vegetation](#11-vegetation)
12. [Water](#12-water)
13. [Sky, sun and atmosphere](#13-sky-sun-and-atmosphere)
14. [Life and sound](#14-life-and-sound)
15. [Player and border](#15-player-and-the-world-border)
16. [Digging and building](#16-digging-and-building)
17. [Unreal Engine export](#17-unreal-engine-export)
18. [Tools and publishing](#18-tools-and-publishing)
19. [What was tried and dropped](#19-what-was-tried-and-dropped)
20. [Known limitations](#20-known-limitations)

---

## 1. The worlds

| Folder | Site | How it was made |
| --- | --- | --- |
| `data/` | `world/` | **Variant A**, the original: a west-to-east convergent-margin transect (ocean, Coast Range, Central Valley, the Spine, the Crown, the High Desert plateau). Hand-designed tectonic template, seed 7. |
| `data_b/` | `world-b/` | **Variant 1B**: central sea with a strait to the west, one 5,361 m massif, a short alpine range, prairie, the mesa plateau with a sand sea, a cold north. Hand-designed template, seed 7. |
| `data_b2/` | `world-b2/` | Variant 1B with seed 21 and a south-westerly rain wind. |
| `data_b4/` | `world-s/` | **Seeded world (variant S)**: no template. The seed sets only physical causes and the erosion simulation makes the land (section 3.2). Current seed 397119. |
| commit `eda0fff` | `v5/` | Frozen version 5, kept for comparison (`git checkout eda0fff` restores code and data exactly). |

All worlds share every line of code after the large-scale forcing.

## 2. Pipeline at a glance

```
seed ──► large-scale forcing ──► landscape evolution ──► finishing ──► data set ──► ground function ──► client
         (design.mjs |            (erosion.mjs,           (finish.mjs)    (data*/)     (shared/world.mjs)   (client/)
          layout.mjs)              generate.mjs)
          uplift rate,             ~3 Myr of uplift,       glaciers,       16-bit       bicubic base +       streamed meshes,
          starting surface,        river incision,         rivers,         heights,     sub-grid relief +    shading, trees,
          rock, strata             landslides, creep,      climate,        11 map       river channels +     water, sky, life
                                   rain from relief        ecology maps    channels     player edits
```

The generator is deterministic: the same seed and settings give a bit-identical world. Geometry, collision,
vegetation placement, validation and the Unreal export all call the same ground function, so they can never
disagree about where the ground is.

**Size.** The playable world is 50 × 50 km. The generator simulates 56 × 56 km — 3 km of equally detailed
land on every side — so edge effects of the simulation (rivers running along its boundary, ranges sagging to
nothing) stay outside what anyone sees. At full resolution the grid is 4096² cells of 13.7 m. The client draws
only the playable square plus 10 m, behind a border wall.

## 3. Large-scale forcing

The erosion model needs three things for every point: how fast the crust rises (uplift rate), the starting
surface, and the rock. There are two ways of producing them.

### 3.1 Hand-designed templates (`worldgen/design.mjs`, variants A, B, C)

Smooth, domain-warped analytic fields: a coast line, a mountain spine as a wandering polyline, a massif, a
plateau province, a gorge where the main river crosses the range, islands as drowned hills. These worlds read
well but their layout is fixed; only the detail changes with the seed.

### 3.2 Seeded physical forcing (`worldgen/layout.mjs`, variant S)

Nothing draws a coast, a range or a plateau outline. The seed sets slow causes, and the land comes out of the
simulation:

- **A sinking basin.** An elongated basin somewhere near the middle of the world subsides at up to 0.5 mm/yr
  (a rift or back-arc basin). Its outline is itself irregular. The crust around it rises unevenly, more on
  average further out. This is what puts a sea in the middle and makes the land climb away from it — without a
  ring, because every rate varies from place to place.
- **Crustal thickening.** A broad noise field of thickening, scaled to the world so that its strongest point is
  the great massif (up to 3.5 mm/yr of extra uplift). Weaker highs become lesser mountains, foothills and hill
  country. Nothing forces them into lines; whatever lines appear come from the field and from erosion.
- **Volcanic centres.** One to three rise from the basin floor and become islands. One of them may instead be a
  tilted limestone block, which stands as a flat-topped island with cliffed shores.
- **Rain.** One wind from a random side, veering by a random amount. The rain is computed from the relief as it
  forms (section 4), so windward slopes are wet and lee slopes dry.
- **Sedimentary cover (the badlands).** Flat-lying sandstone and shale survive only where three things hold, as
  in nature: the crust there was never thickened (where it was, the basement has been pushed up and the cover
  stripped, so canyon country never mixes with alpine mountains); the country is far from the sea; and it is
  dry. Those conditions are scored on a coarse grid, and the cover grows outward as one compact country from the
  centre of the best region until it covers 7.5–10.5% of the land. Its outline is then roughened by noise. The
  covered block is lifted 820–1,200 m, higher toward its interior, made of layered hard and soft rock, and given a
  quarter of the rain during erosion, so it erodes into canyons, mesas and badlands.
- **Sea level** is not drawn either: see section 4.

The only numbers chosen by taste are the rates and the share of the world under water (30–36%).

`node tools/layout_preview.mjs out.png <seeds…>` renders the forcing of any seeds in seconds (blue = below sea
level at the start, light green = plains, dark green = hills, grey = mountains, white = high mountains, tan =
sedimentary cover). It is a preview of the causes, not of the eroded world.

## 4. Landscape evolution (the erosion simulation)

`worldgen/erosion.mjs` and `worldgen/generate.mjs`. A multigrid simulation of roughly three million years:

| Grid | Iterations | Time step | Cell |
| --- | --- | --- | --- |
| 256² | 110 | 20,000 yr | 219 m |
| 512² | 60 | 10,000 yr | 109 m |
| 1024² | 40 | 6,000 yr | 55 m |
| 2048² | 30 | 8,000 yr | 27 m |
| 4096² | 18 | 7,000 yr | 13.7 m |

Each level starts from the previous one, upsampled with a little noise. Each iteration:

1. **Depression filling and drainage order.** Priority-flood with an epsilon gradient (Barnes et al. 2014) gives
   every cell a downhill path to an outlet and a downstream-first processing order.
2. **Flow routing.** Stochastic D8 on the filled surface: each cell drains to one of its lower neighbours with
   probability rising with slope, using a fixed random number per cell. This removes the 8-direction grid bias
   of plain D8 while keeping channels stable between iterations.
3. **Discharge.** Rain-weighted drainage area accumulated downstream.
4. **Stream-power incision**, solved implicitly (stable at any time step):
   `h_new = (h + U·dt + F·h_receiver) / (1 + F)`, with `F = K0 · K_rock · √Q · dt / L`. Hard rock erodes slowly,
   soft rock fast.
5. **Landslide limit.** No cell may stand above its receiver by more than the rock's critical slope. That
   strength varies smoothly from place to place, so faces do not all settle at one angle and look faceted.
6. **Soil creep.** Hillslope diffusion, strong on soil and weak on bare hard rock.

**Rain** (`computePrecip`): moist air is marched across the terrain along the wind. It rains more where the air
is lifted (windward slopes) and less beyond a crest, the air loses moisture as it rains, and it recharges over
open water. The rain is recomputed every 15 iterations as the mountains grow, so valleys deepen fastest where it
is wet. `computePrecipDir` turns the grids so the wind can come from any side. In the seeded world a rain
shadow ends at the far shore of a sea, because air that has crossed open water has taken up moisture again.

**The sea in the seeded world is dynamic.** At every step it is simply the cells below sea level. The sea floor
keeps moving with the crust (the basin keeps sinking). A two-cell ring at the edge of the 56 km domain stands for
the land continuing beyond it: it acts as an outlet at its own height, so rivers on the outer flanks leave the
world instead of ponding against its edge. After the simulation:

- **The sea rises** to its present level, as it did after the last ice age, by whatever brings it to its share
  of the world (20–150 m). That drowns the lower ends of the valleys the rivers cut while it stood lower, which is
  what gives the coast its bays, inlets and headlands (rias).
- **A sediment shelf** forms off every shore: the floor deepens gradually away from land instead of dropping off
  the old shoreline.
- Ponds below sea level that are cut off from the sea and smaller than 3 km² silt up; specks of land under
  0.6 km² go under.

## 5. Rock and strata

`shared/geology.mjs` holds eight rock types with their erodibility, critical slope, soil creep and colour:

| Rock | Erodibility | Critical slope | Where |
| --- | --- | --- | --- |
| alluvium | 2.2 | 0.45 | valley fill, plains |
| greywacke | 1.3 | 0.50 | rolling hill country |
| granite | 0.32 | 1.10 | cores of high mountains |
| limestone | 0.55 | 1.45 | pale cliff bands, the limestone island |
| schist | 0.8 | 0.78 | mountain flanks, uplands |
| basalt | 0.6 | 0.72 | volcanic islands |
| sandstone | 0.8 | 1.60 | the layered plateau (badlands) |
| shale | 2.3 | 0.50 | soft slope-formers, badlands |

The plateau province is **layered**: the rock exposed at a point depends on its height (`rockAt`). Going up:
granite basement, shale, limestone, shale, sandstone, shale, then a repeating sequence of red sandstone, pale
cliff-forming cap, shale and sandstone, every 380 m. Hard beds stand as cliffs and soft beds as slopes, which is
what makes stepped canyon walls and mesas. A smooth stratigraphic offset field warps the beds, so they never form
an even staircase.

## 6. Finishing (glaciers, rivers, climate, ecology)

`worldgen/finish.mjs` runs once on the final 4096² surface:

- **Glaciers.** An ice mass balance (accumulation above the ice-age snowline at 1,700 m, melt below it) is routed
  down the drainage network. Where enough ice flowed, valleys are reshaped into U-shaped troughs, with cirques at
  their heads.
- **Floodplains** of discharge-scaled, noise-varied width along the larger rivers.
- **Lakes.** In the hand-designed worlds three glacial basins are over-deepened into lakes. In the seeded world no
  lakes are kept; every closed basin silts up flat.
- **Slope settling.** A lowest-first (Dijkstra) pass settles every slope to its rock's critical angle.
- **Gullies.** Steep slopes are dissected along their own flow lines.
- **Rivers** are traced from the final drainage into smooth, monotone polylines with hydraulic width, depth and
  meanders; they are carved into the terrain at runtime (section 8).
- **Climate and ecology maps** at 1024²: rock, strata, rain, forest cover, ancient dark forest, wetness, sand,
  ambient occlusion, plateau mask, flow and ice. Forest follows rain, temperature (a treeline that climbs in
  sheltered hollows and drops on exposed spurs, a ragged zone rather than a line), slope and wetness; no trees
  grow on plateau walls; sand forms beaches and, on the hand-designed plateau, dune fields. In the seeded world
  the badlands are dry and the green inside them follows water: where a canyon floor gathers enough drainage,
  its flat floor turns green, widening downstream.
- **Landmarks** found from the finished terrain (highest summit, a low shore near the sea, the badlands), and
  `world.json`.

## 7. The data set

Each world is about 14 MB:

- `height.bin` — 4096² heights, 16 bit (1/8 m steps from −300 m), predictive-coded and gzipped
- `maps.bin` — 11 environmental channels at 1024², 8 bit
- `rivers.bin`, `rivermask.bin` — river polylines (position, water level, width, depth, discharge) and a coverage mask
- `lakes.bin` — lake levels (24 m raster)
- `world.json` — seed, settings, map channel names, landmarks, playable area, statistics

## 8. The ground function (`shared/world.mjs`)

`World.ground(x, z, cell)` returns the ground height anywhere, to any precision:

1. **Base:** bicubic interpolation of the 13.7 m eroded grid.
2. **Sub-grid relief**, chosen by geology and faded out below the caller's sampling interval:
   - erosion-style fractal relief whose octaves are damped where the accumulated gradient is already steep,
     which gives branching, water-worn spurs and rills instead of uniform bumps;
   - rock ribs, couloirs and sharper teeth along crests on mountains;
   - gentle swales and hummocks on soil, nearly absent on floodplains, with amplitude and grain varying so no
     pattern of bumps repeats;
   - ledges and risers on bedded rock (plateau and lava only), following a warped stratigraphic coordinate;
   - dunes on sand: crests that bend, split and die out, a smaller cross train, and kilometre-scale draa in the
     heart of a sand sea; never on rock walls.
3. **River channels**, carved analytically from the river polylines with their real width and depth.
4. **Player edits** from a sparse 1 m layer (section 16).

It also answers ecology questions (rain, temperature, forest, rock, wetness at a point) and the water level
(sea, lake or river) used for swimming and placement.

## 9. Terrain streaming and meshing

`client/terrain.js`, `client/terrainWorker.js`. A CDLOD-style quadtree of fixed-topology 65 × 65-vertex chunks,
from 780 m cells at the horizon down to 0.38 m underfoot (level 11 at high quality, 10 medium, 9 low). A node
splits when the camera is closer than twice its size. Chunks are meshed in web workers by sampling the ground
function; a parent is replaced only when all four children are ready; vertices geomorph toward the parent level
with distance; skirts hide any residual crack; chunk edges are bit-exact across neighbours. Unused chunks are
evicted. Workers also produce a refined height grid from the full ground function, from which a global normal
and curvature map is derived, so distant mountains are lit with their spurs and gullies rather than just the
13.7 m base.

## 10. Surface shading and textures

`client/materials.js`, `client/textures.js`. There are no image textures: every surface is computed per pixel
from the data set, the slope, the altitude and procedural noise.

- **Soil moisture** from climate, then from where water collects on the landform (hollows and valley floors).
- **Herb layer.** Broad, overlapping ramps from steppe to cured grass, green sward and lush growth, driven by
  moisture, so grassland and steppe grade into each other instead of meeting at a line. Brown leaf litter is
  seen only from among the trees; from any distance the forest floor reads green. Marsh is a mosaic of reed,
  sedge and dark pools. Watercourses are green ribbons in humid country and pale gravel washes in dry country,
  tinting their surroundings faintly and unevenly.
- **Bedrock.** Rock shows through gradually — thin soils on spurs and on steep, high ground, in ragged patches.
  Rock provinces meet along irregular, blended contacts. On the plateau the colour bands follow the real beds;
  elsewhere rock is grey, with water stains and joints running down faces. Scree and debris aprons gather in
  hollows below rock; shingle on shores.
- **Sand** thins out over a broad, ragged margin and lingers in hollows.
- **Snow** lingers in shaded hollows and strips from spurs and steep faces; summits are almost fully covered.
  Glaciers are snow-covered above the snowline and bare blue-grey ice with moraine stripes below it.
- **Distant forest** is drawn by the terrain shader as canopy, thinning into scattered trees toward its limits.
- **Anti-tiling.** Every repeating noise lookup is blended with a rotated, rescaled, offset copy of itself, with
  the blend weight varying over kilometres, so no pattern repeats in step.
- **Curvature** (concave hollows, convex spurs) at two scales drives where soil, scree, snow and moisture go.

## 11. Vegetation

`client/vegetation.js`, `client/vegPlacement.js`.

- **Assets** are modelled in code: broadleaf, conifer, giant, pine, birch, snag, bush, sage, two kinds of
  boulder, log, fern and grass. Real trunks and branches, needle fronds, leaf clusters filling a crown shell,
  faceted or smooth rocks. Bark and leaf textures are generated procedurally. Trees are deliberately simple
  placeholders.
- **Placement** runs in the terrain workers and is a pure function of position and seed, so every client (and a
  server) agrees on where each tree stands. Positions come from global jittered lattices (4.6 m for trees), so
  instances stay put when a tile changes detail. Stand structure: closed forest, or groves and lone trees in open
  country; many young trees and a few veterans; stunting toward the treeline. Loose boulders are switched off.
- **Rings of detail:** near ring everything (grass, ferns, shrubs, logs), middle ring trees, bushes and big rocks,
  outer ring trees only, thinned; beyond that a far ring of 3–4-triangle trees out to `farDist`; beyond that the
  terrain shader's canopy.
- **Wind:** slow whole-crown sway plus faster leaf flutter, weighted by distance from the trunk.

| Quality | Finest terrain level | Shadow map | Tree ring | Far trees | Grass |
| --- | --- | --- | --- | --- | --- |
| low (phones) | 9 | none | 500 m | 1.6 km | none |
| medium | 10 | 1024 | 900 m | 2.8 km | 45 m |
| high | 11 | 2048 | 1.5 km | 4.5 km | 70 m |

## 12. Water

The sea and lakes are meshed per terrain chunk at their own level, with per-vertex depth for colour and shore
foam. Rivers are ribbons along the generated polylines, sitting in channels that the ground function carves.

## 13. Sky, sun and atmosphere

- **Sun** on a European spring arc (latitude 47°, declination 9.5°). The day turns slowly (one hour per 75 s with
  T on); the night is skipped.
- **Shadows:** three cascaded shadow maps near the camera, plus a world-scale terrain shadow recomputed from the
  height grid by one sweep along the sun direction whenever the sun moves, so whole mountains cast shadows across
  valleys.
- **Haze:** height-attenuated, integrated analytically along the view ray; tuned for a clear day.
- **Clouds:** one deck that drifts with the wind; the sky draws it and the ground beneath is shaded by it.

## 14. Life and sound

`client/life.js`. Bird flocks wheel over the country near the player; the air carries pollen, snow or sand
depending on where you stand; wind, running water and birdsong are synthesised with WebAudio from the
surroundings (N mutes).

## 15. Player and the world border

`client/player.js`: walking with gravity, slope limits (slow uphill, refuse cliffs), sliding and swimming;
a mounted speed; free flight, where speed grows with height above the ground. Collision uses the same ground
function as the meshes, so feet always match what is drawn.

The border is a translucent wall with drifting 45° bands, broad from afar and fine close up, visible from about
14 km and strongest within 1.5 km. The world is drawn only 10 m beyond it.

## 16. Digging and building

The generated world is immutable. Player changes live in a sparse layer of 1 m columns (`World.edits`), applied
inside `ground()` and re-meshed locally; G and B exercise this. `shared/subsurface.mjs` classifies any 1 m³ cell
on demand (soil horizons, the real bedrock and plateau strata, ore bodies tied to host rock), so nothing is
stored until it is dug. Caves, tunnels and overhangs are not built; the intended route is local voxel volumes
around edits, seeded from the same classification.

## 17. Unreal Engine export

`node tools/export_unreal.mjs` writes `export/unreal/`: a 16-bit Landscape heightmap with its exact scale and
location, eight layer weightmaps (grass, dry grass, forest floor, rock, scree, sand, snow, wetland), river splines
with width, depth and water level, lakes and landmarks, and optional OBJ tiles sampled from the ground function at
any density for hero terrain as Nanite static meshes. Checked for format only; it has not yet been imported into
an Unreal project.

## 18. Tools and publishing

| Tool | Purpose |
| --- | --- |
| `tools/layout_preview.mjs` | top-down previews of the seeded forcing for many seeds |
| `tools/screenshot.mjs` | in-engine screenshots of named views (`--data=/data_b4/`) |
| `tools/build_pages.sh` | builds the public site into the repository's top-level `docs/` |
| `tools/build_web.mjs` | single-file web bundle (data wrapped losslessly in PNG) |
| `tools/perf.mjs`, `tools/scout.mjs` | performance measurement, scouting views |
| `worldgen/validate.mjs` | hydrology, terrain, seams, traversability, ecology, mining and determinism checks |

The site is served by GitHub Pages from the `gh-pages` branch, which holds the contents of `docs/`:
`bash tools/build_pages.sh; git branch -D gh-pages; git subtree split --prefix docs -b gh-pages && git push -f origin gh-pages`.

## 19. What was tried and dropped

Kept here because each one looked reasonable and turned out wrong:

- **Elevation-banded rock strength** on mountains drew horizontal stripes of ledges and vegetation across faces.
  Only the plateau, which really is layered, keeps bands.
- **Isolated cone mountains** (a volcano, a tor) read as single points; mountains now come from broad uplift.
- **Parallel double ranges** from two nearby template lines read as artificial.
- **Coarse scenery beyond the border** looked worse than the world itself; the world now ends 10 m past the border.
- **Hand-placed layouts** (a template of sea, massif, mesa and hills rotated per seed) produced worlds that
  looked like the same layout repeated, and badlands scattered in pieces. This is why variant S sets causes
  rather than features.
- **Long canals dug between water bodies** and random green patches in the desert looked placed rather than
  natural; channels and oases now come only from drainage.

## 20. Known limitations

- Heightfield only: no overhangs, caves, arches or sea stacks.
- Trees are placeholders by request.
- No frame rate on a real GPU has been measured; the development machine has none. Triangle counts, draw calls,
  chunk build times and memory are in `docs/performance_medium.json` and `docs/validation.txt` (variant A).
- The validation suite has only been run on variant A.
- Seeded worlds vary: the forcing is physical, but the share of each kind of country is not guaranteed for every
  seed, so it is worth previewing a few seeds before baking one.
