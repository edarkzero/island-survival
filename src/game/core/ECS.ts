/**
 * Thin wrapper around bitecs 0.4.x. Kept intentionally small so swapping ECS
 * implementations later is a contained change.
 *
 * NOTE: Phase 1 of the build does not yet require bitecs — the renderer is
 * driven directly. This file establishes the API for Phase 2+ (survival
 * tick, alien FSM, building placement) where ECS becomes useful.
 */
import {
  createWorld as bitecsCreate,
  addEntity,
  removeEntity,
  registerComponent,
  addComponent,
  removeComponent,
  hasComponent,
  query,
  type World,
  type ComponentRef,
} from "bitecs";

export {
  addEntity,
  removeEntity,
  registerComponent,
  addComponent,
  removeComponent,
  hasComponent,
  query,
};
export type { World, ComponentRef };

export function createWorld(): World {
  return bitecsCreate();
}
