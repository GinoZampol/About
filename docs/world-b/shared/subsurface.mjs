// Subsurface material model: the interface between the surface world and mining.
// The world is NOT stored as voxels. Any 1 m^3 cell (x, y, z) can be classified on demand from
// the same deterministic fields that built the surface; only player changes are stored.
import { vnoise3 } from './noise.mjs';
import { ROCK, ROCK_NAMES } from './geology.mjs';
import { MAP } from './world.mjs';

export const MATERIALS = ['air', 'water', 'topsoil', 'subsoil', 'sand', 'gravel', 'clay', 'peat', 'snow',
  'greywacke', 'granite', 'limestone', 'schist', 'basalt', 'sandstone', 'shale',
  'coal', 'iron ore', 'copper ore', 'gold-bearing quartz', 'salt'];
const ROCK_MAT = { [ROCK.ALLUVIUM]: 'gravel', [ROCK.GREYWACKE]: 'greywacke', [ROCK.GRANITE]: 'granite', [ROCK.LIMESTONE]: 'limestone', [ROCK.SCHIST]: 'schist', [ROCK.BASALT]: 'basalt', [ROCK.SANDSTONE]: 'sandstone', [ROCK.SHALE]: 'shale' };

// thickness of the unconsolidated cover (m)
export function regolithDepth(world, x, z, surf) {
  const s = world.slope(x, z), wet = world.map(MAP.WET, x, z), base = world.mapNearest(MAP.ROCK, x, z);
  let d = 2.2 * Math.max(0, 1 - s / 0.8) + 3.5 * wet;
  if (base === ROCK.ALLUVIUM) d += 6 + 10 * wet;
  if (surf > 2000) d *= 0.3;
  return d;
}

// Material of the 1 m cell whose centre is (x, y, z). `surf` (ground elevation) may be passed if known.
export function materialAt(world, x, y, z, surf) {
  if (surf === undefined) surf = world.ground(x, z);
  if (y > surf) return y < world.waterSurface(x, z, surf) ? 'water' : 'air';
  const depth = surf - y, reg = regolithDepth(world, x, z, surf);
  const seed = world.seed;
  if (depth < reg) {
    const sand = world.map(MAP.SAND, x, z), wet = world.map(MAP.WET, x, z);
    if (surf > 2600 && depth < 1.5) return 'snow';
    if (sand > 0.45) return 'sand';
    if (wet > 0.6) return depth < 1.2 ? 'peat' : 'clay';
    if (depth < 0.6) return 'topsoil';
    if (world.mapNearest(MAP.ROCK, x, z) === ROCK.ALLUVIUM) return vnoise3(x / 40, y / 6, z / 40, seed + 301) > 0.55 ? 'clay' : depth > reg * 0.5 ? 'gravel' : 'subsoil';
    return 'subsoil';
  }
  const rk = world.rockAt(x, z, y);
  // ore bodies: anisotropic 3D noise, host-rock specific
  if (rk === ROCK.SHALE && vnoise3(x / 260, y / 5, z / 260, seed + 310) > 0.78) return 'coal';
  if ((rk === ROCK.SCHIST || rk === ROCK.BASALT || rk === ROCK.GREYWACKE) && vnoise3(x / 90, y / 40, z / 90, seed + 311) > 0.80) return 'iron ore';
  if ((rk === ROCK.GRANITE || rk === ROCK.SCHIST) && vnoise3(x / 60, y / 60, z / 60, seed + 312) > 0.86) return 'copper ore';
  if (rk === ROCK.GRANITE && vnoise3(x / 7, y / 30, z / 25, seed + 313) > 0.93) return 'gold-bearing quartz';
  if (rk === ROCK.SHALE && world.map(MAP.PRECIP, x, z) * 3 < 0.3 && vnoise3(x / 300, y / 8, z / 300, seed + 314) > 0.8) return 'salt';
  return ROCK_MAT[rk] || ROCK_NAMES[rk];
}
