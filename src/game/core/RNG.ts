/**
 * Engine-agnostic RNG and noise utilities. Seeded so worlds are reproducible.
 * Pure TypeScript — no Babylon imports allowed in src/game/.
 */

/** mulberry32: small, fast, deterministic 32-bit PRNG. */
export function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2i(seed: number, ix: number, iy: number): number {
  let h = seed | 0;
  h = (Math.imul(h ^ ix, 374761393) | 0);
  h = (Math.imul(h ^ iy, 668265263) | 0);
  h = h ^ (h >>> 13);
  h = (Math.imul(h, 1274126177) | 0);
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/** 2D value noise in [0,1]. */
export function valueNoise2D(seed: number, x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const a = hash2i(seed, ix, iy);
  const b = hash2i(seed, ix + 1, iy);
  const c = hash2i(seed, ix, iy + 1);
  const d = hash2i(seed, ix + 1, iy + 1);
  const ux = smoothstep(fx);
  const uy = smoothstep(fy);
  const i1 = a * (1 - ux) + b * ux;
  const i2 = c * (1 - ux) + d * ux;
  return i1 * (1 - uy) + i2 * uy;
}

/** Fractional Brownian motion — sum of octaves of value noise. Result in [0,1]. */
export function fbm2D(
  seed: number,
  x: number,
  y: number,
  octaves = 5,
  lacunarity = 2.0,
  gain = 0.5,
): number {
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise2D(seed + i * 17, x * freq, y * freq);
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}
