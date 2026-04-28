# Island Survival — Game Design Document

> This document is the **portable artifact**. It survives any engine port
> (Babylon → Unity → Unreal). Code is throwaway scaffolding around the
> design described here.

## 1. Pillars

1. **Build / craft loop is the dopamine.** Resources → recipes → tools → better recipes → bigger builds.
2. **Survival pressure shapes choices.** Hunger, thirst, and stamina are always ticking — every decision balances "do I have time to fight this alien" against "I need to drink first."
3. **Aliens are a moral system, not just enemies.** The player can fight, kill, knock out, gift, befriend, or recruit. The same alien can become any of those depending on the player's actions.
4. **The island feels handmade.** Beautiful, varied, with discoverable points of interest — not a procedurally-generated wasteland.

## 2. World

- Single seeded island, surrounded by water.
- Biomes (radiating roughly outward from center): `Beach → Grassland → Forest → Highlands`. One special `AlienCrashSite` zone, hand-placed inside the forest.
- Generation: simplex/value-noise heightmap × radial falloff, biome-by-elevation. Seed persisted in `localStorage` so each player has their own stable world.
- Day/night cycle: ~10 real-time minutes per in-game day. Some aliens spawn at night, some hide.
- Weather: clear / cloudy / rain / storm. Rain fills containers. Fog drops visibility (and shadow render distance, as a perf bonus).

## 3. Player

- Human, 1.8 m tall.
- Starts with: nothing.
- Stats: HP, Hunger, Thirst, Stamina (each 0–100).
- Equipment slots: `mainHand`, `offHand`, `head`, `chest`, `legs`. Equipping changes derived stats (attack, defense, weight).
- Stamina drains during sprint, jump, weapon swing. Empty stamina → no sprint, halved swing damage.
- Hunger/thirst tick continuously; faster while sprinting. At zero, drain HP.

## 4. Items

Defined in `src/game/data/items.ts`. Categories: Resource, Tool, Weapon, Armor, Consumable, AlienGift.

**Critical taxonomy: damage kind decides the alien outcome.**
| Kind | Examples | Effect on aliens |
|---|---|---|
| **Bladed** | iron sword, iron pike | **Kills** — alien dies on HP=0 |
| **Blunt** | stone axe, wooden club | **Knocks out** — alien drops at sleepHp=0, can be befriended |
| **Sleep** | sleep dart | **Knocks out** — same as blunt, ranged |

This is the design hinge: if the player wants to befriend an aggressive alien, they MUST have a non-bladed option. The crafting tree gates this.

## 5. Crafting

Defined in `src/game/data/recipes.ts`. Stations:

- `hand` — basic tools (stone axe).
- `workbench` — tier 1 items (clubs, darts, leather armor).
- `forge` — tier 2 (iron sword/pike/helm). Requires iron ore + stone.
- `alien_bench` — tier 3, unlocked only after befriending the first alien (gameplay reward for the friend path).

## 6. Building (Valheim-style snap-grid)

Defined in `src/game/data/buildings.ts`. Pieces:

- Foundation, Wall, Roof — modular base building.
- Campfire — cook meat, give light at night.
- Workbench, Forge — crafting stations.

Each piece exposes `snapPoints[]` in local space. In build mode the camera raycasts to the nearest snap point, ghost-renders the piece (green=valid, red=invalid), validates resources + collision, then on click consumes resources and spawns the entity.

## 7. Aliens

Defined in `src/game/data/aliens.ts`.

### State machine

```
        ┌─ Hostile ──(blunt/sleep dmg → 0 sleepHp)─→ KnockedOut
        │                                                │
Idle ─→ Curious                                          │ (give wantedItem)
        │   ↓                                            ↓
        │   └──(give wantedItem, peaceful subspecies)→ Friendly ──(whistle)→ Following
        │
        └──(player runs away / out of range)─→ Idle
```

### Subspecies (v1)
- **Scrunkler** — peaceful. Easy to befriend with berries.
- **Glarn** — aggressive. Requires knockout first, wants iron/crystal.
- **Vex** — aggressive elite. Requires alien crystals or iron pikes.

### Gift roll

When an alien spawns, it draws one item from its `wantedItems[]` (weighted) as its `wantedItemId`. Show that item icon floating above its head when within 8m and non-hostile/knocked-out. Press F to give from inventory.

## 8. On-screen prompts

| Where | Element |
|---|---|
| Top-center | Compass strip with N/E/S/W ticks + waypoint pins (base, alien camps, crashed ship) |
| Bottom-left | HP / Hunger / Thirst / Stamina bars |
| Bottom-center | Contextual interaction prompt ("E — Pick up Stone", "F — Give Item", "B — Build mode") |
| Bottom-right | 9-slot hotbar with selected item highlighted |
| Floating world labels | Wanted-item icon over knocked-out / non-hostile aliens; resource highlight on tool hover; snap-point ghosts during build mode |

All HUD is plain HTML/CSS overlay — see `src/ui/styles/hud.css` and `src/ui/hud/HudManager.ts`. No Babylon GUI; this keeps the HUD trivial to restyle (and trivial to leave behind when porting — the engine ports get a fresh native UI anyway).

## 9. Survival tick rules

`SurvivalTickSystem` runs at 1 Hz.
- Hunger: −0.6 / s walking, −1.4 / s sprinting.
- Thirst: −0.8 / s walking, −1.8 / s sprinting; +1.0 / s while standing in rain (if a container is held).
- Stamina: regen +12 / s while idle, +6 / s while walking; −18 / s sprinting; −12 per swing.
- HP: −1 / s if Hunger or Thirst is at zero. +0.5 / s while Hunger and Thirst both above 50, idle.
- Death at HP=0 → respawn at last campfire (or spawn point if none).

## 10. Cool features included in v1

- Day/night cycle with HDRI/SkyMaterial lerp.
- Weather (rain, fog).
- Stamina mechanic.
- Compass + waypoint markers.

Deferred to v2: photo mode, mini-map (full screen), fast travel, multiplayer, branching alien dialogue.

## 11. Verification per phase

- **Phase 1:** Walkable island, water reflects sky, sun moves, HUD bars render. ✓ when first runnable build is up.
- **Phase 2:** Hunger/thirst drain over time, eat berry → bar fills, interaction prompt appears at correct distance.
- **Phase 3:** Craft sword → place campfire → snap 4 walls into a square.
- **Phase 4:** Approach Scrunkler → "wants berry" icon → give → friendly + follows. Approach Glarn → it attacks → sleep-dart KO → give iron ingot → friendly.
- **Phase 5:** Subjective beauty pass — sunrise/sunset visible, shore foam, grass sways.
- **Phase 6:** Rain triggers, fills containers, compass shows base waypoint.

## 12. Port notes (when moving to Unity / Unreal)

Code in `src/engine/` is throwaway. The artifacts that **do** port:

- `GAME_DESIGN.md` (this file) — direct spec.
- `src/game/data/*.ts` — JSON-shaped registries → ScriptableObjects (Unity) / DataTables (Unreal). The shape is identical.
- `public/assets/models/**.glb` — drag straight into either engine.
- `src/game/systems/*.ts` algorithmic logic — translates to C# / C++ following the same pseudocode (the FSMs, snap-grid math, recipe resolution, etc.).
- `src/game/world/IslandGenerator.ts` — pure noise math, ports trivially.
