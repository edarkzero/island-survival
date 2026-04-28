/** Engine-agnostic biome catalogue. */

export const Biome = {
  Ocean: 0,
  Beach: 1,
  Grassland: 2,
  Forest: 3,
  Highlands: 4,
  AlienCrashSite: 5,
  Swamp: 6,
} as const;
export type BiomeId = (typeof Biome)[keyof typeof Biome];

/** Colors per biome — kept for HUD/legend use; terrain itself blends continuously. */
export const BIOME_COLORS: Record<number, readonly [number, number, number]> = {
  [Biome.Ocean]: [0.06, 0.30, 0.62],
  [Biome.Beach]: [0.94, 0.86, 0.62],
  [Biome.Grassland]: [0.30, 0.68, 0.22],
  [Biome.Forest]: [0.16, 0.44, 0.18],
  [Biome.Highlands]: [0.58, 0.58, 0.58],
  [Biome.AlienCrashSite]: [0.45, 0.30, 0.60],
  [Biome.Swamp]: [0.24, 0.36, 0.22],
};

export function pickBiomeForHeight(h: number): BiomeId {
  if (h <= 0.001) return Biome.Ocean;
  if (h < 1.6) return Biome.Beach;
  if (h < 3.2) return Biome.Grassland;
  if (h < 5.6) return Biome.Forest;
  return Biome.Highlands;
}

/**
 * Color for a terrain cell, biome-aware. Falls back to a smooth height
 * gradient for the default biomes, but uses distinct stylized tints for
 * Swamp and AlienCrashSite so those zones read as their own places.
 */
export function colorForCell(h: number, biome: number): [number, number, number] {
  // Underwater shelf — dark seabed mud (mostly hidden by opaque water above)
  if (h <= 0.0) return [0.10, 0.09, 0.07];
  if (biome === Biome.Swamp) {
    return mix([0.32, 0.38, 0.22], [0.20, 0.28, 0.18], smooth01(Math.min(1, h / 1.5)));
  }
  if (biome === Biome.AlienCrashSite) {
    return mix([0.42, 0.30, 0.58], [0.62, 0.42, 0.72], smooth01(Math.min(1, h / 2.0)));
  }
  // Default sand → grass → forest → rock-gray gradient. Cliff base is at
  // y≈1.2, so the sand band is the thin shoreline; everything above is
  // vibrant green field, then darker forest, then clean gray rock.
  if (h < 1.6) return mix([0.94, 0.86, 0.62], [0.34, 0.66, 0.22], smooth01((h - 1.2) / 0.4));
  if (h < 3.2) return mix([0.34, 0.66, 0.22], [0.20, 0.48, 0.18], smooth01((h - 1.6) / 1.6));
  if (h < 5.6) return mix([0.20, 0.48, 0.18], [0.40, 0.52, 0.32], smooth01((h - 3.2) / 2.4));
  return mix([0.50, 0.52, 0.50], [0.66, 0.66, 0.66], smooth01(Math.min(1, (h - 5.6) / 3.0)));
}

/** Back-compat alias — old call sites just pass height. */
export function colorForHeight(h: number): [number, number, number] {
  return colorForCell(h, pickBiomeForHeight(h));
}

function mix(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  t: number,
): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function smooth01(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}
