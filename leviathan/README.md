# The Leviathan — world

A deterministic 50 × 50 km natural world for The Leviathan, with the generator that builds it
and a browser client that streams and renders it as real geometry.

This repository held no existing Leviathan engine, so the world is built as a standalone,
engine-independent pipeline: a data set plus one shared "ground function" that any runtime
(this WebGL client, a game server, a future native engine) evaluates identically.

```
npm install
npm start            # http://localhost:8080  (the generated world in data/ is committed)
npm run generate     # rebuild the world from seed (about 7 minutes, one core, ~3 GB RAM)
npm run validate     # hydrology / terrain / traversability / determinism checks
npm run shots        # in-engine screenshots of the views in tools/views.json
npm run perf         # streaming, memory and frame-time measurements
```

Controls: click to capture the mouse, WASD, Shift (fast), F walk/fly, H mount, wheel = fly speed,
`[` `]` time of day, M map and place list (click the map to travel), G / B dig or fill 1 m³.
URL options: `?quality=low|medium|high`, `?pos=x,heightAboveGround,z&look=heading,pitch&time=13.5`.

## The geography

One coherent convergent-margin transect, west to east, drained by a single river system:

| Region | Character |
| --- | --- |
| Ocean and west coast | open sea, headlands, small islands |
| Coast Range | folded greywacke ridges striking N–S, 500–700 m, rain forest; the wettest lowlands hold the ancient dark forest |
| The Sound | a glacially scoured sea inlet with islands and three fjords cutting into the Northern Highlands; the Great River delta lies at its head |
| Central Valley | prairie and oak-pine parkland in the Coast Range rain shadow; the Tor, a granite monadnock, stands in the middle |
| The Spine | alpine arc, granite core to ~2,900 m with a limestone band on its west flank; Mount Leviathan, a 3,100 m stratovolcano, on its western shoulder |
| Longwater | an 11.8 km², 118 m deep ribbon lake in the glacial trough north-east of the Sound |
| The Gorge | the antecedent water gap where the Great River crosses the Spine: the one low-level route east |
| The Trench and High Desert | a dry longitudinal valley, then a tilted, layered plateau (basalt, sandstone, shale, limestone over granite) cut by the upper Great River's canyon system; badlands in the south-east |

Land 2,129 km², water 370 km²; 1,019 km of rivers in 532 reaches; highest point 3,147 m.
Maps: `docs/map_relief.png`, `docs/map_ecology.png`. Screenshots: `docs/screenshots/`.

## How the world is made (`worldgen/`)

1. **Design** (`design.mjs`): analytic tectonic template — uplift rate, initial surface, shoreline,
   lithology and stratigraphy — as smooth, domain-warped fields. No heightmap is painted and no
   noise is used as terrain.
2. **Landscape evolution** (`erosion.mjs`): multigrid (256² → 4096², 12.2 m cells) simulation of
   about 3 million years: priority-flood drainage, stochastic-D8 routing, implicit stream-power
   incision with rock-dependent erodibility, critical-slope limits with spatially varying rock
   strength, hillslope creep, and discharge weighted by an orographic rainfall model that is
   recomputed as the mountains grow. Valleys, ridges, the canyon and the gorge are outcomes.
   The plateau is deliberately left in a transient state, so flat uplands survive between canyons.
3. **Finishing** (`finish.mjs`): ice-flux mass balance carves U-shaped troughs; rivers get
   discharge-scaled floodplains; three glacial basins are over-deepened into lakes and all other
   closed basins are silted flat; a lowest-first solver settles every slope to its rock's limit;
   final drainage is traced into smooth, monotone river polylines with hydraulic width, depth and
   meanders; climate, forest cover, dark-forest, wetness, sand and occlusion maps are derived.
4. **Export** (`data/`, 14 MB): 16-bit height raster, 8 environmental map channels, lake levels,
   river polylines, river mask, `world.json` (seed, config, lakes, landmarks).

Same seed and config give a bit-identical erosion result (checked by `validate.mjs`).

## Runtime (`shared/`, `client/`)

- `shared/world.mjs` — `World.ground(x, z)`: bicubic base + geology-driven sub-grid detail
  (crags and bedding on exposed rock, swales on soil, dunes on sand) + analytically carved river
  channels + the sparse edit layer. Meshes, collision, vegetation placement and validation all
  call this one function, so they cannot disagree.
- `client/terrain.js`, `terrainWorker.js` — quadtree of 65×65-vertex chunks meshed in workers,
  from 780 m cells at the horizon down to 0.38 m cells underfoot (level 11). Children replace a
  parent only when all four are built; vertices geomorph toward the parent level; skirts cover
  the rest. Chunk edges are bit-exact across neighbours. Unused chunks are evicted.
- Water — sea and lakes are meshed per chunk at their own level with per-vertex depth; rivers are
  ribbons on the channel polylines.
- `client/vegetation.js`, `vegPlacement.js` — procedurally modelled 3D assets (5 tree types, snag,
  shrubs, fern, grass, boulders, slabs, logs), GPU-instanced in three LOD rings, placed in workers
  from the ecology maps with clumping, groves, treeline stunting and talus/erratic rules. Beyond
  the tree ring the terrain shader carries the canopy.
- `client/materials.js` — one lighting and atmosphere model for everything: sun with 3 shadow
  cascades, sky ambient with baked occlusion, height-attenuated haze; terrain materials are chosen
  per pixel from slope, altitude, climate, rock type and stratigraphy.
- `client/player.js` — walking with gravity, slope limits, sliding, swimming, tree and boulder
  collision; mounted speed; free flight.

## Mining and construction path

- The generated world is immutable. Player changes live in a separate sparse layer
  (`World.edits`, 1 m columns), applied inside `ground()` and re-meshed locally; the G and B keys
  exercise this end to end. Persisting or replicating a change is one `(ix, iz, dh)` record.
- `shared/subsurface.mjs` — `materialAt(world, x, y, z)` classifies any 1 m³ cell on demand
  (soil horizons, the real bedrock and plateau stratigraphy, host-rock-specific ore bodies), so
  nothing is stored until it is dug.
- Not built yet: true volumes (tunnels, overhangs, caves). The intended step is local voxel
  volumes around edits, seeded from `materialAt` and meshed alongside the heightfield chunks.

## Measurements

`docs/validation.txt` (hydrology, terrain, seams, traversability, ecology, mining, determinism)
and `docs/performance_medium.json`.

Measured at medium quality, 1280×720, 4 vCPUs (3 terrain workers), no GPU:

| View | Visible chunks | Triangles drawn (incl. 3 shadow cascades) | Draw calls | Vegetation instances | Chunks built on arrival | Avg chunk build | Time to fully streamed |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Valley floor, on foot | 621 | 2.35 M | 353 | 57 k | 817 | 12.0 ms | 3.5 s |
| 1,800 m above the valley | 333 | 1.31 M | 161 | 36 k | 44 | 11.8 ms | 0.5 s |
| Spine valley, forested | 603 | 3.73 M | 507 | 120 k | 556 | 14.9 ms | 56.6 s |
| Dark forest, on foot | 525 | 4.59 M | 607 | 89 k | 504 | 14.4 ms | 41.0 s |

Streaming times in forest are dominated by vegetation placement sharing the worker pool with
terrain, and were measured while the software renderer was also using the CPUs. Software frame
times in the two forest views were 6–11 s per frame; the other two readings were not credible and
are not reported. The JS heap reading (212 MB) is Chrome's bucketed figure and excludes worker
copies of the world data (about 50 MB each) and GPU buffers. So: no frame rate on real hardware
has been measured yet.

The development environment has no GPU: frame times there come from a software rasteriser on
4 vCPUs and say nothing about real hardware. Triangle counts, draw calls, chunk build times,
streaming latency and memory are hardware-independent. Run `node tools/perf.mjs --gpu` on a
target machine for real frame times.

## Known limitations

- **Steep world.** 24% of land is under 15% slope and 314 km² under 8%; mountain belts sit near
  their rock's critical angle. 68% of land is reachable on foot from the Central Valley on slopes
  under 35°, but Longwater and the Northern Highlands are not, and only 16.5% is connected at cart
  grade. More graded valley floors and passes are the first geography task.
- **Heightfield only.** No overhangs, caves, arches or sea stacks; cliffs are steep heightfield
  faces with instanced blocks.
- **Vegetation art** is procedural and modest up close; distant forest is shaded terrain, not
  geometry. Frame rate on real GPUs is unmeasured.
- **Edges.** Beyond the 50 km square the terrain is extruded from the border; the player is kept
  inside.
- Lakes use a 24 m level raster, so a few metres of lake surface can extend past an outlet.
- No networking: the client is single-player; determinism and the edit layer are the hooks.

## Next priorities

1. Graded corridors: valley-floor aggradation and designed passes, then re-validate traversability.
2. Measure and tune on target GPUs; impostor ring for far trees.
3. Local voxel volumes for mining, plus authored rock formations (arches, stacks, caves).
4. Server-side `World` for authoritative collision, edit persistence and replication.
