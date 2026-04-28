/**
 * Engine-agnostic island generation. Produces a heightmap + biome map that
 * the engine layer (TerrainRenderer) consumes to build a Babylon mesh.
 *
 * Algorithm:
 *  - Multi-octave value noise gives rolling terrain.
 *  - Radial falloff (1 at center, 0 at edges) shapes the island silhouette.
 *  - Nonlinear remap gives sharp coastlines.
 *  - Biome is picked from height bands.
 */
import { fbm2D } from "../core/RNG";
import { pickBiomeForHeight, Biome } from "./Biome";

export interface IslandGenOptions {
  seed: number;
  size: number; // grid resolution (NxN)
}

export interface IslandData {
  seed: number;
  size: number;
  /** World units spanned by the full grid (so cell size = worldScale / size). */
  worldScale: number;
  heightmap: Float32Array;
  biomeMap: Uint8Array;
}

const WORLD_SCALE = 220;
const HEIGHT_SCALE = 8; // gentler than the 14-peak version, still visibly hilly
const NOISE_FREQ = 0.028;
const RADIAL_POWER = 1.8;

// Distinct biome zones layered on top of height-based biomes.
// Coords are world-space (same axes as buildIslandData output).
const ALIEN_ZONE = { x: 28, z: -34, radius: 22 };
const SWAMP_ZONE = { x: -36, z: 28, radius: 26 };

export function buildIslandData(opts: IslandGenOptions): IslandData {
  const { seed, size } = opts;
  const heightmap = new Float32Array(size * size);
  const biomeMap = new Uint8Array(size * size);
  const half = (size - 1) / 2;

  const cellSize = WORLD_SCALE / size;

  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) {
      const i = z * size + x;
      const nx = (x - half) / half;
      const nz = (z - half) / half;
      const r = Math.min(1, Math.sqrt(nx * nx + nz * nz));
      const falloff = smoothFalloff(r);

      const n = fbm2D(seed, x * NOISE_FREQ, z * NOISE_FREQ, 6);
      // Subtract a sea-level bias before scaling so low-noise + low-falloff
      // areas drop *below* zero — they become the underwater shelf.
      let h = (n - 0.18) * falloff * HEIGHT_SCALE - (1 - falloff) * 1.5;
      // Central plateau guarantees a viable spawn area on land
      if (r < 0.30) h = Math.max(h, 1.4);
      // Lift very-near-shore land slightly so beaches stay above water
      if (h > 0 && h < 0.35) h = 0.35;

      // World-space coords for biome zone overrides
      const wx = (x - half) * cellSize;
      const wz = (z - half) * cellSize;
      let biome = pickBiomeForHeight(h);

      // Swamp zone: low-elevation override; flatten the noise floor a bit.
      const swampD2 = (wx - SWAMP_ZONE.x) ** 2 + (wz - SWAMP_ZONE.z) ** 2;
      if (h > 0 && swampD2 < SWAMP_ZONE.radius * SWAMP_ZONE.radius) {
        h = Math.min(h, 0.9 + n * 0.6);
        biome = Biome.Swamp;
      }
      // Alien crash zone: override to AlienCrashSite biome
      const alienD2 = (wx - ALIEN_ZONE.x) ** 2 + (wz - ALIEN_ZONE.z) ** 2;
      if (h > 0 && alienD2 < ALIEN_ZONE.radius * ALIEN_ZONE.radius) {
        biome = Biome.AlienCrashSite;
      }

      heightmap[i] = h;
      biomeMap[i] = biome;
    }
  }

  return { seed, size, worldScale: WORLD_SCALE, heightmap, biomeMap };
}

function smoothFalloff(r: number): number {
  // Stays near 1 across most of the island, drops sharply only near the edge.
  const edge = 1 - Math.pow(Math.min(1, r), RADIAL_POWER * 1.5);
  return Math.max(0, edge);
}
