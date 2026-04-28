/**
 * Engine-agnostic damage resolution. Given the player's inventory + the item
 * currently equipped on their active hotbar slot, return the swing's damage
 * and damage-kind.
 */
import { ITEMS } from "../data/items";
import type { Inventory } from "./Inventory";

export interface AttackResolution {
  itemId: string;
  damage: number;
  kind: "bladed" | "blunt" | "sleep";
}

const FISTS: AttackResolution = { itemId: "fists", damage: 3, kind: "blunt" };

export function resolveAttack(equipped: string | null, inv: Inventory): AttackResolution {
  if (!equipped) return FISTS;
  if (!inv.has(equipped, 1)) return FISTS;
  const def = ITEMS[equipped];
  if (!def || (def.damage == null && def.damageKind == null)) return FISTS;
  return {
    itemId: equipped,
    damage: def.damage ?? 1,
    kind: (def.damageKind as "bladed" | "blunt" | "sleep") ?? "blunt",
  };
}
