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
  [Biome.Ocean]: [0.10, 0.32, 0.42],
  [Biome.Beach]: [0.92, 0.86, 0.66],
  [Biome.Grassland]: [0.48, 0.66, 0.32],
  [Biome.Forest]: [0.22, 0.42, 0.20],
  [Biome.Highlands]: [0.45, 0.42, 0.38],
  [Biome.AlienCrashSite]: [0.42, 0.32, 0.55],
  [Biome.Swamp]: [0.22, 0.30, 0.20],
};

export function pickBiomeForHeight(h: number): BiomeId {
  if (h <= 0.001) return Biome.Ocean;
  if (h < 0.7) return Biome.Beach;
  if (h < 2.4) return Biome.Grassland;
  if (h < 4.5) return Biome.Forest;
  return Biome.Highlands;
}

/**
 * Color for a terrain cell, biome-aware. Falls back to a smooth height
 * gradient for the default biomes, but uses distinct stylized tints for
 * Swamp and AlienCrashSite so those zones read as their own places.
 */
export function colorForCell(h: number, biome: number): [number, number, number] {
  if (h <= 0.0) return [0.10, 0.32, 0.42];
  if (biome === Biome.Swamp) {
    // Murky green-brown wash regardless of height
    return mix([0.30, 0.34, 0.20], [0.18, 0.26, 0.18], smooth01(Math.min(1, h / 1.5)));
  }
  if (biome === Biome.AlienCrashSite) {
    // Bruised purple — alien residue tint
    return mix([0.36, 0.28, 0.50], [0.55, 0.40, 0.65], smooth01(Math.min(1, h / 2.0)));
  }
  // Default sand → grass → forest → highlands gradient
  if (h < 0.7) return mix([0.94, 0.88, 0.66], [0.55, 0.70, 0.36], smooth01(h / 0.7));
  if (h < 2.4) return mix([0.55, 0.70, 0.36], [0.28, 0.48, 0.22], smooth01((h - 0.7) / 1.7));
  return mix([0.28, 0.48, 0.22], [0.50, 0.45, 0.40], smooth01(Math.min(1, (h - 2.4) / 2.5)));
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
