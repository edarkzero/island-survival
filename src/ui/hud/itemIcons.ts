/**
 * Procedural hotbar icons. Each item gets a 64×64 SVG with a colored
 * backdrop and a one-letter glyph (typically the item's leading initials).
 * Cheap, scales crisply, and ships before any PNG icon pack is sourced —
 * once a real CC0 icon set lands, swap the implementation to return paths
 * under `/public/assets/icons/` keyed by `itemId`. Cached per id so HUD
 * re-renders don't rebuild the same string.
 */

import { ITEMS } from "../../game/data/items";

interface IconStyle {
  /** Tailwind-ish srgb in [0,1] — matches the engine-side palette. */
  color: [number, number, number];
  /** Up to 2 chars. Defaults to first letter of the item name. */
  glyph?: string;
}

const STYLES: Record<string, IconStyle> = {
  // Resources
  wood: { color: [0.45, 0.28, 0.14], glyph: "Wd" },
  stone: { color: [0.55, 0.55, 0.55], glyph: "St" },
  fiber: { color: [0.85, 0.78, 0.45], glyph: "Fb" },
  iron_ore: { color: [0.50, 0.42, 0.36], glyph: "Or" },
  iron_ingot: { color: [0.78, 0.78, 0.82], glyph: "Ig" },
  alien_crystal: { color: [0.45, 0.85, 0.95], glyph: "Cr" },

  // Consumables
  berry: { color: [0.55, 0.20, 0.75], glyph: "Br" },
  cooked_meat: { color: [0.65, 0.30, 0.20], glyph: "Mt" },
  water_flask: { color: [0.35, 0.70, 0.92], glyph: "Wt" },

  // Tools / weapons
  stone_axe: { color: [0.62, 0.48, 0.32], glyph: "Ax" },
  iron_sword: { color: [0.80, 0.82, 0.88], glyph: "Sw" },
  iron_pike: { color: [0.75, 0.78, 0.85], glyph: "Pk" },
  wooden_club: { color: [0.55, 0.38, 0.20], glyph: "Cl" },
  sleep_dart: { color: [0.30, 0.55, 0.40], glyph: "Dt" },

  // Armor
  leather_chest: { color: [0.55, 0.36, 0.22], glyph: "Lc" },
  iron_helm: { color: [0.72, 0.74, 0.80], glyph: "Hm" },

  // Alien gifts
  shiny_trinket: { color: [0.95, 0.85, 0.30], glyph: "Tr" },
  bioluminescent_moss: { color: [0.30, 0.95, 0.55], glyph: "Ms" },
};

const cache = new Map<string, string>();

/** RGB(0-1) → CSS rgb() string. */
function rgb([r, g, b]: [number, number, number]): string {
  return `rgb(${(r * 255) | 0},${(g * 255) | 0},${(b * 255) | 0})`;
}

/** Linearized luminance — used to pick black/white text for legibility. */
function fgFor([r, g, b]: [number, number, number]): string {
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  return lum > 0.55 ? "#1a1a1a" : "#fafafa";
}

/**
 * Returns a `data:image/svg+xml,...` URL for the given itemId, or null if
 * no style is registered (HUD will fall back to a text label).
 */
export function iconUrlFor(itemId: string): string | null {
  const cached = cache.get(itemId);
  if (cached !== undefined) return cached || null;

  const style = STYLES[itemId];
  if (!style) {
    cache.set(itemId, "");
    return null;
  }
  const glyph = style.glyph ?? (ITEMS[itemId]?.name.slice(0, 2) ?? "?");
  const fill = rgb(style.color);
  const fg = fgFor(style.color);
  // 64×64 with an inset gradient stroke for a tactile button feel.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="white" stop-opacity="0.18"/>
<stop offset="1" stop-color="black" stop-opacity="0.18"/>
</linearGradient></defs>
<rect x="2" y="2" width="60" height="60" rx="8" fill="${fill}" stroke="rgba(0,0,0,0.35)" stroke-width="2"/>
<rect x="2" y="2" width="60" height="60" rx="8" fill="url(#g)"/>
<text x="32" y="42" font-family="system-ui,sans-serif" font-size="26" font-weight="700" text-anchor="middle" fill="${fg}">${glyph}</text>
</svg>`;
  const url = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  cache.set(itemId, url);
  return url;
}
