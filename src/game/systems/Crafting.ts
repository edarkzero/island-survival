/**
 * Engine-agnostic crafting logic. Knows recipes, what's available right now
 * (given inventory + nearby stations), and how to consume inputs / produce
 * outputs. The actual menu UI lives in src/ui/menus/CraftingMenu.ts.
 */
import { RECIPES, Station, type RecipeDef, type StationId } from "../data/recipes";
import type { Inventory } from "./Inventory";

export interface CraftingContext {
  /** Station IDs of placed structures within range of the player. */
  nearbyStations: StationId[];
}

export interface RecipeAvailability {
  recipe: RecipeDef;
  hasInputs: boolean;
  hasStation: boolean;
  /** True if recipe can be crafted right now. */
  craftable: boolean;
}

export function evaluateRecipes(
  inv: Inventory,
  ctx: CraftingContext,
): RecipeAvailability[] {
  return RECIPES.map((r) => {
    const hasStation =
      r.station === Station.Hand || ctx.nearbyStations.includes(r.station);
    const hasInputs = inv.hasAll(r.inputs);
    return { recipe: r, hasInputs, hasStation, craftable: hasInputs && hasStation };
  });
}

export interface CraftResult {
  ok: boolean;
  reason?: "missing_inputs" | "missing_station";
}

/** Synchronous craft (skips the time delay for v1). */
export function craft(
  recipeId: string,
  inv: Inventory,
  ctx: CraftingContext,
): CraftResult {
  const r = RECIPES.find((x) => x.id === recipeId);
  if (!r) return { ok: false, reason: "missing_inputs" };
  if (
    r.station !== Station.Hand &&
    !ctx.nearbyStations.includes(r.station)
  ) {
    return { ok: false, reason: "missing_station" };
  }
  if (!inv.removeAll(r.inputs)) return { ok: false, reason: "missing_inputs" };
  inv.add(r.output.itemId, r.output.qty);
  return { ok: true };
}
