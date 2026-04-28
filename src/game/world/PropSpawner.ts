/**
 * Engine-agnostic prop placement: trees, rocks, and one-off landmarks.
 * Engine layer (PropRenderer) consumes the result and emits GPU-instanced
 * meshes.
 */
import { mulberry32 } from "../core/RNG";
import type { IslandData } from "./IslandGenerator";
import { Biome } from "./Biome";

export type PropKind = "tree_pine" | "rock_small" | "rock_large" | "alien_ship";

export interface Prop {
  kind: PropKind;
  x: number;
  y: number;
  z: number;
  yaw: number;
  /** Per-instance scale multiplier for variety (1.0 = base size). */
  scale: number;
}

interface PropRule {
  biome: number;
  kind: PropKind;
  density: number;
  scaleMin: number;
  scaleMax: number;
}

const RULES: PropRule[] = [
  // Forest — dense pine cover, sparse rocks
  { biome: Biome.Forest, kind: "tree_pine", density: 0.04, scaleMin: 0.85, scaleMax: 1.4 },
  { biome: Biome.Forest, kind: "rock_small", density: 0.005, scaleMin: 0.6, scaleMax: 1.0 },
  // Sparse grassland trees
  { biome: Biome.Grassland, kind: "tree_pine", density: 0.005, scaleMin: 0.7, scaleMax: 1.1 },
  // Highlands strewn with rocks (rare biome — only on peaks)
  { biome: Biome.Highlands, kind: "rock_large", density: 0.05, scaleMin: 0.9, scaleMax: 1.6 },
  { biome: Biome.Highlands, kind: "rock_small", density: 0.04, scaleMin: 0.8, scaleMax: 1.3 },
  // A few rocks on the beach for character
  { biome: Biome.Beach, kind: "rock_small", density: 0.003, scaleMin: 0.6, scaleMax: 1.0 },
];

/** Hand-placed POI offset from origin. Anchored on a flat-ish spot. */
const ALIEN_SHIP_OFFSET = { x: 28, z: -34 };

const SHIP_CLEARING_RADIUS = 14;

export function spawnProps(data: IslandData, seed = data.seed + 91): Prop[] {
  const rand = mulberry32(seed);
  const N = data.size;
  const half = (N - 1) / 2;
  const cellSize = data.worldScale / N;
  const props: Prop[] = [];

  const sx = ALIEN_SHIP_OFFSET.x;
  const sz = ALIEN_SHIP_OFFSET.z;

  for (let z = 0; z < N; z++) {
    for (let x = 0; x < N; x++) {
      const i = z * N + x;
      const biome = data.biomeMap[i];
      const wx = (x - half) * cellSize + (rand() - 0.5) * cellSize * 0.8;
      const wz = (z - half) * cellSize + (rand() - 0.5) * cellSize * 0.8;
      // Skip cells inside the ship clearing
      const dxs = wx - sx;
      const dzs = wz - sz;
      if (dxs * dxs + dzs * dzs < SHIP_CLEARING_RADIUS * SHIP_CLEARING_RADIUS) continue;
      // Each cell can hold at most one prop.
      for (const rule of RULES) {
        if (rule.biome !== biome) continue;
        if (rand() > rule.density) continue;
        const wy = data.heightmap[i];
        const yaw = rand() * Math.PI * 2;
        const scale = rule.scaleMin + rand() * (rule.scaleMax - rule.scaleMin);
        props.push({ kind: rule.kind, x: wx, y: wy, z: wz, yaw, scale });
        break;
      }
    }
  }

  // Hand-placed alien ship POI (the AlienCrashSite on the world map).
  const sy = sampleHeight(data, sx, sz);
  props.push({ kind: "alien_ship", x: sx, y: sy, z: sz, yaw: 0.4, scale: 1 });

  return props;
}

export function getAlienShipPosition(data: IslandData): { x: number; y: number; z: number } {
  const sx = ALIEN_SHIP_OFFSET.x;
  const sz = ALIEN_SHIP_OFFSET.z;
  return { x: sx, y: sampleHeight(data, sx, sz), z: sz };
}

function sampleHeight(data: IslandData, wx: number, wz: number): number {
  const N = data.size;
  const half = (N - 1) / 2;
  const cellSize = data.worldScale / N;
  const fx = wx / cellSize + half;
  const fz = wz / cellSize + half;
  if (fx < 0 || fz < 0 || fx >= N - 1 || fz >= N - 1) return 0;
  const x0 = Math.floor(fx);
  const z0 = Math.floor(fz);
  const tx = fx - x0;
  const tz = fz - z0;
  const h00 = data.heightmap[z0 * N + x0];
  const h10 = data.heightmap[z0 * N + (x0 + 1)];
  const h01 = data.heightmap[(z0 + 1) * N + x0];
  const h11 = data.heightmap[(z0 + 1) * N + (x0 + 1)];
  const h0 = h00 * (1 - tx) + h10 * tx;
  const h1 = h01 * (1 - tx) + h11 * tx;
  return h0 * (1 - tz) + h1 * tz;
}
