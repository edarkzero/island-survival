/** Engine-agnostic alien definitions + state machine vocabulary. */

export const AlienState = {
  Idle: "idle",
  Curious: "curious",
  Hostile: "hostile",
  KnockedOut: "knocked_out",
  Friendly: "friendly",
  Following: "following",
} as const;
export type AlienStateId = (typeof AlienState)[keyof typeof AlienState];

export interface AlienDef {
  id: string;
  name: string;
  /** Whether this subspecies starts hostile on detection. */
  aggressive: boolean;
  hp: number;
  /** Knockout threshold: blunt/sleep damage required to drop them. */
  sleepHp: number;
  /** Items they're willing to accept as a gift, weighted. */
  wantedItems: { itemId: string; weight: number }[];
  modelPath?: string;
}

export const ALIENS: Record<string, AlienDef> = {
  scrunkler: {
    id: "scrunkler",
    name: "Scrunkler",
    aggressive: false,
    hp: 30,
    sleepHp: 20,
    wantedItems: [
      { itemId: "berry", weight: 5 },
      { itemId: "shiny_trinket", weight: 2 },
      { itemId: "bioluminescent_moss", weight: 1 },
    ],
    modelPath: "/assets/models/aliens/scrunkler.glb",
  },
  glarn: {
    id: "glarn",
    name: "Glarn",
    aggressive: true,
    hp: 80,
    sleepHp: 50,
    wantedItems: [
      { itemId: "iron_ingot", weight: 3 },
      { itemId: "alien_crystal", weight: 2 },
      { itemId: "shiny_trinket", weight: 1 },
    ],
    modelPath: "/assets/models/aliens/glarn.glb",
  },
  vex: {
    id: "vex",
    name: "Vex",
    aggressive: true,
    hp: 130,
    sleepHp: 90,
    wantedItems: [
      { itemId: "alien_crystal", weight: 4 },
      { itemId: "iron_pike", weight: 1 },
    ],
    modelPath: "/assets/models/aliens/vex.glb",
  },
};
