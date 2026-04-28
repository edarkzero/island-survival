/**
 * Engine-agnostic pickup placement. Walks the biome map, drops resources +
 * forageables. Uses the same seeded RNG so spawns are deterministic.
 */
import { mulberry32 } from "../core/RNG";
import type { IslandData } from "./IslandGenerator";
import { Biome } from "./Biome";
import type { PickupRegistry } from "../systems/PickupRegistry";

interface SpawnRule {
  biome: number;
  itemId: string;
  /** Probability per cell. */
  density: number;
}

const RULES: SpawnRule[] = [
  // Beach
  { biome: Biome.Beach, itemId: "water_flask", density: 0.003 },
  { biome: Biome.Beach, itemId: "fiber", density: 0.004 },
  { biome: Biome.Beach, itemId: "stone", density: 0.004 },

  // Grassland — abundant berries (the survival starter zone)
  { biome: Biome.Grassland, itemId: "berry", density: 0.012 },
  { biome: Biome.Grassland, itemId: "fiber", density: 0.012 },
  { biome: Biome.Grassland, itemId: "wood", density: 0.005 },

  // Forest
  { biome: Biome.Forest, itemId: "berry", density: 0.008 },
  { biome: Biome.Forest, itemId: "wood", density: 0.018 },
  { biome: Biome.Forest, itemId: "fiber", density: 0.006 },

  // Highlands
  { biome: Biome.Highlands, itemId: "stone", density: 0.012 },
  { biome: Biome.Highlands, itemId: "iron_ore", density: 0.005 },

  // Swamp — bog plants + extra fiber + occasional water collected in pools
  { biome: Biome.Swamp, itemId: "fiber", density: 0.020 },
  { biome: Biome.Swamp, itemId: "bioluminescent_moss", density: 0.012 },
  { biome: Biome.Swamp, itemId: "water_flask", density: 0.012 },

  // Alien crash site — alien-themed loot, including bioluminescent moss + crystals
  { biome: Biome.AlienCrashSite, itemId: "bioluminescent_moss", density: 0.025 },
  { biome: Biome.AlienCrashSite, itemId: "alien_crystal", density: 0.020 },
  { biome: Biome.AlienCrashSite, itemId: "shiny_trinket", density: 0.010 },
];

export function spawnPickups(data: IslandData, registry: PickupRegistry, seed = data.seed + 7): number {
  const rand = mulberry32(seed);
  const N = data.size;
  const half = (N - 1) / 2;
  const cellSize = data.worldScale / N;
  let count = 0;

  for (let z = 0; z < N; z++) {
    for (let x = 0; x < N; x++) {
      const i = z * N + x;
      const biome = data.biomeMap[i];
      // A cell can host at most one pickup; pick the first matching rule that rolls.
      for (const rule of RULES) {
        if (rule.biome !== biome) continue;
        if (rand() > rule.density) continue;
        const wx = (x - half) * cellSize + (rand() - 0.5) * cellSize;
        const wz = (z - half) * cellSize + (rand() - 0.5) * cellSize;
        const wy = data.heightmap[i];
        registry.add(rule.itemId, wx, wy, wz);
        count++;
        break;
      }
    }
  }
  return count;
}
