/**
 * Engine-agnostic biome definitions used for prop spawning, ambient audio,
 * and survival modifiers. The lower-level Biome ID enum lives in
 * src/game/world/Biome.ts so the renderer can color the terrain.
 */
import { Biome, type BiomeId } from "../world/Biome";

export interface BiomeDef {
  id: BiomeId;
  name: string;
  /** Items the player can forage by walking through this biome. */
  forage: { itemId: string; chancePerSecond: number }[];
  /** Ambient sound stem (placeholder until audio is dropped in). */
  ambient: string;
}

export const BIOMES: Record<BiomeId, BiomeDef> = {
  [Biome.Ocean]: {
    id: Biome.Ocean,
    name: "Ocean",
    forage: [],
    ambient: "ambient/ocean.ogg",
  },
  [Biome.Beach]: {
    id: Biome.Beach,
    name: "Beach",
    forage: [{ itemId: "fiber", chancePerSecond: 0.05 }],
    ambient: "ambient/beach.ogg",
  },
  [Biome.Grassland]: {
    id: Biome.Grassland,
    name: "Grassland",
    forage: [
      { itemId: "fiber", chancePerSecond: 0.1 },
      { itemId: "berry", chancePerSecond: 0.04 },
    ],
    ambient: "ambient/grassland.ogg",
  },
  [Biome.Forest]: {
    id: Biome.Forest,
    name: "Forest",
    forage: [
      { itemId: "wood", chancePerSecond: 0.08 },
      { itemId: "berry", chancePerSecond: 0.06 },
    ],
    ambient: "ambient/forest.ogg",
  },
  [Biome.Highlands]: {
    id: Biome.Highlands,
    name: "Highlands",
    forage: [
      { itemId: "stone", chancePerSecond: 0.08 },
      { itemId: "iron_ore", chancePerSecond: 0.02 },
    ],
    ambient: "ambient/wind.ogg",
  },
  [Biome.AlienCrashSite]: {
    id: Biome.AlienCrashSite,
    name: "Alien Crash Site",
    forage: [{ itemId: "alien_crystal", chancePerSecond: 0.02 }],
    ambient: "ambient/alien_hum.ogg",
  },
  [Biome.Swamp]: {
    id: Biome.Swamp,
    name: "Swamp",
    forage: [
      { itemId: "fiber", chancePerSecond: 0.06 },
      { itemId: "bioluminescent_moss", chancePerSecond: 0.02 },
    ],
    ambient: "ambient/swamp.ogg",
  },
};
