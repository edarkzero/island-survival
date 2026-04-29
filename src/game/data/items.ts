/**
 * Engine-agnostic item registry. JSON-shaped on purpose so it ports 1:1
 * to Unity ScriptableObjects (or Unreal DataTables) when the time comes.
 */

export const ItemType = {
  Resource: "resource",
  Tool: "tool",
  Weapon: "weapon",
  Armor: "armor",
  Consumable: "consumable",
  AlienGift: "alien_gift",
} as const;
export type ItemTypeId = (typeof ItemType)[keyof typeof ItemType];

export const DamageKind = {
  Bladed: "bladed", // kills aliens
  Blunt: "blunt",   // knocks out aliens
  Sleep: "sleep",   // knocks out aliens
} as const;
export type DamageKindId = (typeof DamageKind)[keyof typeof DamageKind];

export const EquipSlot = {
  MainHand: "mainHand",
  OffHand: "offHand",
  Head: "head",
  Chest: "chest",
  Legs: "legs",
} as const;
export type EquipSlotId = (typeof EquipSlot)[keyof typeof EquipSlot];

export interface ItemDef {
  id: string;
  name: string;
  type: ItemTypeId;
  stackSize: number;
  /**
   * Paths under /public/assets/models — one per visual variant. PickupRenderer
   * picks a variant per pickup via `pickupId % variants.length`. A single-entry
   * array is fine for items with no variation.
   */
  modelPath?: string[];
  iconPath?: string;
  equipSlot?: EquipSlotId;
  damage?: number;
  damageKind?: DamageKindId;
  defense?: number;
  /** Restored stat when consumed (e.g. hunger +30, thirst +25, hp +10). */
  consume?: { hp?: number; hunger?: number; thirst?: number; stamina?: number };
}

export const ITEMS: Record<string, ItemDef> = {
  wood: {
    id: "wood",
    name: "Wood",
    type: ItemType.Resource,
    stackSize: 64,
    modelPath: ["/assets/models/props/WoodLog.obj"],
  },
  stone: { id: "stone", name: "Stone", type: ItemType.Resource, stackSize: 64 },
  fiber: { id: "fiber", name: "Fiber", type: ItemType.Resource, stackSize: 64 },
  iron_ore: { id: "iron_ore", name: "Iron Ore", type: ItemType.Resource, stackSize: 32 },
  iron_ingot: { id: "iron_ingot", name: "Iron Ingot", type: ItemType.Resource, stackSize: 32 },
  alien_crystal: {
    id: "alien_crystal",
    name: "Alien Crystal",
    type: ItemType.Resource,
    stackSize: 16,
  },

  berry: {
    id: "berry",
    name: "Berry",
    type: ItemType.Consumable,
    stackSize: 32,
    consume: { hunger: 12 },
  },
  cooked_meat: {
    id: "cooked_meat",
    name: "Cooked Meat",
    type: ItemType.Consumable,
    stackSize: 16,
    consume: { hunger: 35, hp: 5 },
  },
  water_flask: {
    id: "water_flask",
    name: "Water Flask",
    type: ItemType.Consumable,
    stackSize: 4,
    consume: { thirst: 40 },
    modelPath: [
      "/assets/models/props/WaterBottle_1.obj",
      "/assets/models/props/WaterBottle_2.obj",
      "/assets/models/props/WaterBottle_3.obj",
    ],
  },

  stone_axe: {
    id: "stone_axe",
    name: "Stone Axe",
    type: ItemType.Tool,
    stackSize: 1,
    equipSlot: EquipSlot.MainHand,
    damage: 6,
    damageKind: DamageKind.Blunt,
    modelPath: ["/assets/models/props/Axe.obj"],
  },
  iron_sword: {
    id: "iron_sword",
    name: "Iron Sword",
    type: ItemType.Weapon,
    stackSize: 1,
    equipSlot: EquipSlot.MainHand,
    damage: 18,
    damageKind: DamageKind.Bladed,
  },
  iron_pike: {
    id: "iron_pike",
    name: "Iron Pike",
    type: ItemType.Weapon,
    stackSize: 1,
    equipSlot: EquipSlot.MainHand,
    damage: 22,
    damageKind: DamageKind.Bladed,
  },
  wooden_club: {
    id: "wooden_club",
    name: "Wooden Club",
    type: ItemType.Weapon,
    stackSize: 1,
    equipSlot: EquipSlot.MainHand,
    damage: 9,
    damageKind: DamageKind.Blunt,
  },
  sleep_dart: {
    id: "sleep_dart",
    name: "Sleep Dart",
    type: ItemType.Weapon,
    stackSize: 12,
    // Melee fallback (poke). Ranged throw applies a stronger dose; see
    // ProjectileSystem.RANGED_SLEEP_DAMAGE.
    damage: 8,
    damageKind: DamageKind.Sleep,
  },

  leather_chest: {
    id: "leather_chest",
    name: "Leather Chest",
    type: ItemType.Armor,
    stackSize: 1,
    equipSlot: EquipSlot.Chest,
    defense: 4,
  },
  iron_helm: {
    id: "iron_helm",
    name: "Iron Helm",
    type: ItemType.Armor,
    stackSize: 1,
    equipSlot: EquipSlot.Head,
    defense: 5,
  },

  shiny_trinket: {
    id: "shiny_trinket",
    name: "Shiny Trinket",
    type: ItemType.AlienGift,
    stackSize: 8,
  },
  bioluminescent_moss: {
    id: "bioluminescent_moss",
    name: "Bioluminescent Moss",
    type: ItemType.AlienGift,
    stackSize: 16,
  },
};
