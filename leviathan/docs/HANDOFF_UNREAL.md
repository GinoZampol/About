# Handoff: bring a Leviathan world into the Unreal Engine 5.9 game

Paste everything below this line into the other Claude Code session.

---

## Goal

Import one generated world from the Leviathan project into my Unreal Engine 5.9 game as playable terrain:
a Landscape (Nanite enabled) with the right scale, the terrain layers painted from the world's own maps, the
sea and rivers as water, and optional Nanite static-mesh tiles for hero areas. Do not redesign the world;
reproduce it as faithfully as the engine allows.

## Where the world comes from

- Repository: `GinoZampol/About`, branch `claude/lucid-dirac-y89k6o`, folder `leviathan/`.
  Read `leviathan/README.md` first: it documents the whole pipeline, data format and runtime.
- Each world is a folder `leviathan/data_s<seed>[-<variant>]/`. The one to start with:
  `leviathan/data_s843870-80x40/` (80 km east-west by 40 km north-south). The live preview of every world is at
  https://ginozampol.github.io/About/world-s/ — use it to compare your import against the original.
- Node 20+ is needed for the exporter (`npm install` in `leviathan/`).

## The data (all little-endian, gzip-compressed)

- `world.json`: `sizeM` (side of the square generated area in metres, e.g. 86000), `heightRes` (4096),
  `mapRes` (1024), `play` (the playable rectangle in metres: `x0`, `size` east-west, `z0`, `sizeZ`
  north-south), `mapChannels` (names, in order), `landmarks`, `maxElevation`, `seaLevel` (0).
- `height.bin`: `heightRes`² heights as uint16, stored as byte planes of zig-zag residuals of a
  left+up−upleft predictor (decoder: `decodeU16` in `leviathan/shared/codec.mjs`). Metres = `u16 / 8 - 300`.
  Row 0 is the north edge; x increases east. Sea level is 0 m.
- `maps.bin`: `mapRes`² bytes per channel, channels in `mapChannels` order: rock id, strata, precipitation,
  forest cover, dark forest, wetness, sand, ambient occlusion, badlands mask, flow, ice, warm (savanna),
  cold (winter). Rock ids are in `leviathan/shared/geology.mjs`.
- `rivers.bin`, `rivermask.bin`, `lakes.bin`: river polylines (position, water level, width, depth,
  discharge), a river coverage mask, lake levels.
- The exact ground used by the game (base heights + fine relief + carved river channels) is
  `World.ground(x, z, cell)` in `leviathan/shared/world.mjs`. Prefer it over raw `height.bin` for anything
  sampled finer than 13 m.

## The exporter that already exists

`leviathan/tools/export_unreal.mjs` writes `leviathan/export/unreal/`:

- `node tools/export_unreal.mjs` — 16-bit Landscape heightmap (4033² by default), `landscape.json` with the
  exact Landscape X/Y/Z scale and location, eight layer weightmaps (grass, dry grass, forest floor, rock, scree,
  sand, snow, wetland), `rivers.json` (splines with width, depth, water level), lakes and landmarks.
- `--size 8129` — a finer Landscape (6.15 m per quad) that includes the sub-grid relief and river channels.
- `--mesh x,z,size,spacing` — an OBJ tile sampled from the ground function at any density, for Nanite
  static meshes (units cm; origin = tile north-west corner).

Known gaps you must fix first:
1. It reads the hard-coded folder `data/`. Add a `--data <folder>` argument (e.g. `--data data_s843870-80x40`).
2. It assumes a square playable area. Use `world.json` `play` (`x0`, `size`, `z0`, `sizeZ`) to crop to the
   playable rectangle, and pick Landscape dimensions that are valid UE sizes for each axis
   (e.g. 8129 × 4033 for 80 × 40 km at about 9.9 m per quad, or the nearest valid section/component layout).
3. The newer channels `warm` and `cold` are not exported yet: add a savanna weightmap from `warm` and fold
   `cold` into the snow weightmap (snow where `cold` is high, letting in gradually).
4. It has only been checked for file format, never imported into Unreal. Treat the axis mapping
   (world x east → UE X, world z south → UE Y, up → UE Z, cm) as something to verify in the editor.

## Steps

1. Extend the exporter as above and run it for `data_s843870-80x40`. Check the PNGs and `landscape.json` look
   right (north at the top, sea in the middle, badlands on the east side, the great mountain south-centre).
2. In UE 5.9: create a Landscape from the heightmap with the scale and location from `landscape.json`;
   enable Nanite on the Landscape. Confirm the highest summit matches `world.json` `maxElevation` (±1%) and
   that the coast sits at Z = 0.
3. Build one Landscape material with layers matching the weightmaps (grass, dry grass, forest floor, rock,
   scree, sand, snow, wetland, savanna) and import the weightmaps into them.
4. Water: a Water Body Ocean (or a plane at Z = 0) for the sea; Water Body Rivers from `rivers.json`
   (spline points with width and depth); lakes from the lake list.
5. Vegetation: drive Procedural Foliage or PCG from the `forest` channel (tree density is continuous: about
   20% open grass, then every level up to closed forest), conifers where `cold` is high, flat-topped savanna
   trees where `warm` is high, none on the badlands mask.
6. Optional: export a few `--mesh` tiles of hero areas (the badlands canyons, the great mountain) at 1–2 m
   spacing and import them as Nanite static meshes aligned to the Landscape.
7. Report back: screenshots from the same viewpoints as the web preview, the import settings used, and
   anything that did not line up.

## Rules

- Do not change the world generator or the world data in `leviathan/` beyond the exporter; the worlds are
  shared with the web version.
- Work on your own branch, commit the exporter changes with a short README note, and keep the Unreal project
  files in the game's repository, not in this one.
