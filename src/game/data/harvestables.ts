/**
 * Engine-agnostic config: which props are harvestable, how many hits to fell,
 * what they drop, how long until they respawn. Maps 1:1 onto a Unity
 * ScriptableObject / Unreal DataTable when the time comes.
 *
 * Tool families ("axe", "pickaxe") are abstract — `classifyEquippedTool` in
 * the engine layer decides which equipped item maps to which family.
 */
import type { PropKind } from "../world/PropSpawner";

export type ToolKind = "axe" | "pickaxe" | "bareHands";

export interface HarvestableConfig {
  /** Hits with the right tool to deplete (`bareHandsMultiplier` scales this). */
  maxHp: number;
  /** Required tool family for full damage. Mismatched tool deals 0. */
  tool: "axe" | "pickaxe";
  /** 0..1 — bare-hand hits count for this fraction (0.5 ≈ 2× the swings). */
  bareHandsMultiplier: number;
  drop: { itemId: string; min: number; max: number };
  /** Seconds until the depleted node returns. 30 is a testing value. */
  respawnSec: number;
  /** Audio cue played per damaging hit. */
  sfxHit: "chop" | "mining";
}

export const HARVESTABLES: Partial<Record<PropKind, HarvestableConfig>> = {
  tree_pine: {
    maxHp: 3,
    tool: "axe",
    bareHandsMultiplier: 0.5,
    drop: { itemId: "wood", min: 2, max: 4 },
    respawnSec: 30,
    sfxHit: "chop",
  },
  // Rocks declare "pickaxe" — no pickaxe item exists yet, so right now only
  // bare-hand mining works (slow). When stone_pickaxe is added, the data
  // here doesn't change; the engine-side `classifyEquippedTool` gains a case.
  rock_small: {
    maxHp: 2,
    tool: "pickaxe",
    bareHandsMultiplier: 0.3,
    drop: { itemId: "stone", min: 1, max: 2 },
    respawnSec: 30,
    sfxHit: "mining",
  },
  rock_large: {
    maxHp: 4,
    tool: "pickaxe",
    bareHandsMultiplier: 0.3,
    drop: { itemId: "stone", min: 2, max: 4 },
    respawnSec: 30,
    sfxHit: "mining",
  },
  // alien_ship intentionally absent → never harvestable.
};
