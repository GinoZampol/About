// Lithology model shared by generator, renderer and the mining interface.
// A base rock province is stored per map cell; the eastern plateau province is layered,
// so the actual rock there depends on elevation (stratigraphy with a gentle dip).

export const ROCK = {
  ALLUVIUM: 0,   // valley fill, loess, river sediment
  GREYWACKE: 1,  // Coast Range: folded marine sandstone with basalt slices
  GRANITE: 2,    // crystalline core of the Spine
  LIMESTONE: 3,  // pale cliff-forming carbonate band (and a plateau layer)
  SCHIST: 4,     // metamorphic flanks and the Northern Highlands
  BASALT: 5,     // volcano, lava flows, plateau caprock
  SANDSTONE: 6,  // red plateau cliff-former (as base id: the layered plateau province)
  SHALE: 7,      // soft slope-former, badlands
};

export const ROCK_NAMES = ['alluvium', 'greywacke', 'granite', 'limestone', 'schist', 'basalt', 'sandstone', 'shale'];

// Relative erodibility (multiplies the stream-power K).
export const ROCK_K = [2.2, 1.3, 0.32, 0.55, 0.8, 0.6, 0.8, 2.3];
// Tangent of the steepest slope the rock holds at ~10 m scale.
export const ROCK_TALUS = [0.45, 0.5, 0.98, 1.4, 0.62, 0.72, 1.6, 0.5];
// Hillslope diffusion strength (soil creep), 0..0.2.
export const ROCK_DIFF = [0.16, 0.15, 0.03, 0.03, 0.09, 0.04, 0.015, 0.06];
// Linear albedo-ish colours used by the renderer (sRGB 0..255).
export const ROCK_COLOR = [
  [128, 116, 96], [98, 96, 92], [150, 148, 146], [198, 190, 172],
  [112, 110, 108], [62, 60, 62], [176, 104, 72], [168, 150, 128],
];

// Rock actually exposed at elevation z for a cell with base province `base`.
// `off` is the local stratigraphic offset (metres) for layered provinces.
export function rockAt(base, z, off) {
  if (base !== ROCK.SANDSTONE) return base;
  const zs = z - off;
  if (zs >= 1215) return ROCK.BASALT;
  if (zs >= 1090) return ROCK.SANDSTONE;
  if (zs >= 990) return ROCK.SHALE;
  if (zs >= 905) return ROCK.SANDSTONE;
  if (zs >= 770) return ROCK.SHALE;
  if (zs >= 650) return ROCK.LIMESTONE;
  if (zs >= 520) return ROCK.SHALE;
  return ROCK.GRANITE;
}
