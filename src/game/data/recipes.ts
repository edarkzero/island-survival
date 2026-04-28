/** Engine-agnostic crafting recipes. */

export const Station = {
  Hand: "hand",
  Workbench: "workbench",
  Forge: "forge",
  AlienBench: "alien_bench",
} as const;
export type StationId = (typeof Station)[keyof typeof Station];

export interface RecipeDef {
  id: string;
  output: { itemId: string; qty: number };
  inputs: { itemId: string; qty: number }[];
  station: StationId;
  /** Time to craft, in seconds. */
  time: number;
}

export const RECIPES: RecipeDef[] = [
  {
    id: "stone_axe",
    output: { itemId: "stone_axe", qty: 1 },
    inputs: [
      { itemId: "wood", qty: 2 },
      { itemId: "stone", qty: 3 },
      { itemId: "fiber", qty: 1 },
    ],
    station: Station.Hand,
    time: 3,
  },
  {
    id: "wooden_club",
    output: { itemId: "wooden_club", qty: 1 },
    inputs: [{ itemId: "wood", qty: 4 }],
    station: Station.Workbench,
    time: 4,
  },
  {
    id: "iron_sword",
    output: { itemId: "iron_sword", qty: 1 },
    inputs: [
      { itemId: "iron_ingot", qty: 3 },
      { itemId: "wood", qty: 1 },
    ],
    station: Station.Forge,
    time: 8,
  },
  {
    id: "iron_pike",
    output: { itemId: "iron_pike", qty: 1 },
    inputs: [
      { itemId: "iron_ingot", qty: 2 },
      { itemId: "wood", qty: 3 },
    ],
    station: Station.Forge,
    time: 8,
  },
  {
    id: "sleep_dart_x4",
    output: { itemId: "sleep_dart", qty: 4 },
    inputs: [
      { itemId: "wood", qty: 1 },
      { itemId: "fiber", qty: 1 },
      { itemId: "bioluminescent_moss", qty: 1 },
    ],
    station: Station.Workbench,
    time: 4,
  },
  {
    id: "iron_ingot",
    output: { itemId: "iron_ingot", qty: 1 },
    inputs: [{ itemId: "iron_ore", qty: 2 }],
    station: Station.Forge,
    time: 6,
  },
  {
    id: "leather_chest",
    output: { itemId: "leather_chest", qty: 1 },
    inputs: [{ itemId: "fiber", qty: 6 }],
    station: Station.Workbench,
    time: 6,
  },
  {
    id: "iron_helm",
    output: { itemId: "iron_helm", qty: 1 },
    inputs: [
      { itemId: "iron_ingot", qty: 2 },
      { itemId: "fiber", qty: 1 },
    ],
    station: Station.Forge,
    time: 7,
  },
];
