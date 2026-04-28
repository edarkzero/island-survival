/** Engine-agnostic buildable definitions. */

export interface BuildingDef {
  id: string;
  name: string;
  cost: { itemId: string; qty: number }[];
  /** Snap points expressed in local space, units = meters. */
  snapPoints: { x: number; y: number; z: number }[];
  /** AABB used for collision/validity checks. */
  size: { x: number; y: number; z: number };
  modelPath?: string;
}

export const BUILDINGS: Record<string, BuildingDef> = {
  foundation: {
    id: "foundation",
    name: "Foundation",
    cost: [{ itemId: "wood", qty: 6 }],
    size: { x: 2, y: 0.4, z: 2 },
    snapPoints: [
      { x: -1, y: 0.4, z: 0 },
      { x: 1, y: 0.4, z: 0 },
      { x: 0, y: 0.4, z: -1 },
      { x: 0, y: 0.4, z: 1 },
      { x: 0, y: 0.4, z: 0 },
    ],
  },
  wall: {
    id: "wall",
    name: "Wall",
    cost: [{ itemId: "wood", qty: 4 }],
    size: { x: 2, y: 2.4, z: 0.2 },
    snapPoints: [
      { x: 0, y: 2.4, z: 0 },
      { x: -1, y: 1.2, z: 0 },
      { x: 1, y: 1.2, z: 0 },
    ],
  },
  roof: {
    id: "roof",
    name: "Roof",
    cost: [{ itemId: "wood", qty: 5 }],
    size: { x: 2, y: 0.4, z: 2 },
    snapPoints: [{ x: 0, y: 0.4, z: 0 }],
  },
  campfire: {
    id: "campfire",
    name: "Campfire",
    cost: [
      { itemId: "wood", qty: 4 },
      { itemId: "stone", qty: 6 },
    ],
    size: { x: 1.2, y: 0.6, z: 1.2 },
    snapPoints: [],
  },
  workbench: {
    id: "workbench",
    name: "Workbench",
    cost: [
      { itemId: "wood", qty: 12 },
      { itemId: "fiber", qty: 4 },
    ],
    size: { x: 1.6, y: 1, z: 0.8 },
    snapPoints: [],
  },
  forge: {
    id: "forge",
    name: "Forge",
    cost: [
      { itemId: "stone", qty: 16 },
      { itemId: "iron_ore", qty: 2 },
    ],
    size: { x: 1.4, y: 1.6, z: 1.4 },
    snapPoints: [],
  },
};
