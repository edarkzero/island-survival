# Roadmap — Open Work, Pending Tasks, Recommended Polish

This is the durable inventory of everything that is **shipped but not
finished**, **planned but not yet started**, or **noted as a future
direction** at the time this document was written. The goal is that any
session — agent or human — can pick up cold, scan this file, and know
exactly what's on the table.

When something here ships, **delete the row** rather than ticking a box.
This file is meant to shrink, not grow.

Cross-reference docs:
- `CLAUDE.md` — architecture / engine quirks / decoupling rule
- `GAME_DESIGN.md` — engine-agnostic gameplay spec
- `ATTRIBUTIONS.md` — asset license audit
- `.claude/plans/i-think-that-the-quiet-flute.md` — full session log of the model-integration arc (slices 1-7 + polish passes)
- `public/assets/models/{aliens,characters}/README.md` and `public/assets/icons/README.md` — drop-zone specs co-located with each asset folder

---

## 1. Asset-side polish (user-driven — needs new files)

### 1a. Player character: source proper animation clips
- **What's wrong:** the staged `player.gltf` has a full skeleton but **0 animation groups**. The character renders in static T-pose. `pickAnim()` already null-handles, so this isn't a runtime error — it just looks lifeless.
- **Code site:** `src/engine/PlayerController.ts:88-145` (animation lookup), `src/engine/HeldItemRenderer.ts:14-32` (`HAND_OFFSET` is currently tuned for the T-pose; once Idle plays the hand will drift).
- **Fix path:** re-export the rig from the Quaternius pack with **animation tracks included**, or use **Mixamo** to retarget Idle / Walk / Walking / Run / Running / Attack / Hit / Jump / Pickup clips and bake them into a fresh `player.glb`. See `public/assets/models/characters/README.md` for the expected clip naming.
- **Knock-on:** once the rig animates, `HeldItemRenderer.HAND_OFFSET` will need a single screenshot pass to follow the animated hand position rather than the T-pose hand.

### 1b. Player character: correct PBR texture mapping
- **What's wrong:** the user dropped `player.png` + `T_Regular_Female_Roughness.png`. Best-guess channel mapping: `player.png → T_Peasant_BaseColor.png`, `T_Regular_Female_Roughness.png → T_Peasant_ORM.png`. The character renders with a slightly **purple lighting tint**, suggesting one of those mappings is inverted (e.g. the BaseColor file is actually a Normal map). Babylon also wanted a `T_Peasant_Normal.png` that the user didn't drop — there's a 1×1 flat-blue stub there now to keep the loader happy.
- **Code site:** N/A — pure asset work.
- **Fix path:** experiment by swapping `T_Peasant_BaseColor.png` ↔ `T_Peasant_Normal.png` and re-screenshot. If that doesn't help, re-download the original Quaternius Female Peasant pack and copy its texture set verbatim.

### 1c. Aliens: animated `vex.glb`
- **What's wrong:** `scrunkler.glb` (14 clips) and `glarn.glb` (28 clips) animate via the existing state-driven anim picker; **`vex.glb` ships with 0 animation groups** so vex stays in T-pose.
- **Code site:** `src/engine/AlienRenderer.ts:applyModelAnimation` (already defensively no-ops when `animations.length === 0`).
- **Fix path:** drop a re-exported `vex.glb` with at least Idle / Walk / Run / Punch (or SwordSlash) clips. Quaternius Platformer Pack's other monster rigs all have these.

### 1d. Building modular pack: replace procedural boxes
- **What's wrong:** `foundation`, `wall`, `roof`, and `forge` still render as colored prisms via `BuildingRenderer.spawnBox`. We have a full Kenney modular GLB set staged on disk (`public/assets/models/buildings/structure*.glb`, `floor*.glb`, `metal-panel*.glb`, etc.) — they just aren't wired.
- **Code site:** `src/game/data/buildings.ts` (add `modelPath`), `src/engine/BuildingRenderer.ts:MODEL_SCALES` (tune scale per building).
- **Fix path:** mirror the campfire/tent/bear_trap wiring (data-table modelPath → renderer reads it). One screenshot iteration per building to dial scale.

---

## 2. Items still without models (resource → procedural sphere fallback)

These items have no `modelPath` in `src/game/data/items.ts:52-175` and so render as colored spheres on the ground:

| `itemId` | Type | Possible source |
|---|---|---|
| `iron_pike` | weapon (bladed) | none on disk; needs new `.glb`/`.obj` (Quaternius weapons pack?) |
| `wooden_club` | weapon (blunt) | could repurpose `tool-hammer.glb` from the Kenney modular pack |
| `sleep_dart` | weapon (sleep) | needs new asset (small projectile / dart) |
| `leather_chest` | armor (chest) | could repurpose `Backpack.obj` from Survival Kit (cosmetic match) |
| `iron_helm` | armor (head) | needs new asset |
| `stone` | resource | could repurpose `resource-stone.glb` / `resource-stone-large.glb` from Kenney modular pack |
| `fiber` | resource | needs new asset (rope/grass bundle) |
| `iron_ore` / `iron_ingot` | resource | needs new asset |
| `alien_crystal` | resource | needs new asset (gem/crystal) |
| `cooked_meat` | consumable | could pair with `Pan.obj` (cooked-on-pan visual) |
| `shiny_trinket` | alien gift | needs new asset |
| `bioluminescent_moss` | alien gift | needs new asset (could be procedural glowing sphere refinement) |

**Wire path for each:** add `modelPath: ["/assets/models/.../foo.obj"]` in `items.ts`. PickupRenderer handles the rest. Held-item appearance also automatic via `HeldItemRenderer` once the item is hotbar-equipped — but each weapon/armor needs an `ITEM_TWEAKS` entry to dial position/rotation/scale (see existing `stone_axe`, `iron_sword` entries).

---

## 3. Staged-but-unused assets (drop-in opportunities)

These files are on disk and CC0-licensed but not yet wired into gameplay. Each is a small-to-medium feature that becomes "low-LOC" once someone decides to pull the trigger.

### 3a. Paired state-driven swaps (Survival Kit OBJ pairs)
- `Bonfire.obj` (current) ↔ `Bonfire_Fire.obj` (lit) — needs a "campfire is lit" state on the building plus a renderer swap. Particles already fire on placement; could gate them on the lit state.
- `BearTrap_Open.obj` (current) ↔ `BearTrap_Closed.obj` (sprung) — needs a trap-trigger gameplay system + visual swap on activation.
- `WoodenTorch.obj` (unused) ↔ `WoodenTorch_Fire.obj` (lit) — needs a torch building/item plus light placement on lit state.

### 3b. Survival Kit OBJ props that map to future items
- `Knife.obj` — already wired to `iron_sword`.
- `Axe_Small.obj` — staged for a possible "stone_pickaxe" or "small_axe" item.
- `Shovel.obj` — staged for a "shovel" tool item (digging mechanic).
- `Backpack.obj` — staged for a future inventory upgrade or `leather_chest` reuse.
- `Bandages.obj`, `FirstAidKit.obj`, `FirstAidKit_Hard.obj` — staged for healing consumables.
- `Compass_Closed.obj`, `Compass_Open.obj` — staged for a navigation tool item (open/closed state pair).
- `Match.obj`, `Match_Fire.obj`, `Match_Burnt.obj`, `Matchbox.obj` — staged for a fire-starting mechanic.
- `Pan.obj`, `Pan_Small.obj`, `Pot.obj`, `Pot_Small.obj` — staged for a cooking station building.
- `Raft.obj`, `Raft_Paddle.obj` — staged for the future raft-escape endgame.

### 3c. Kenney modular pack GLBs (in `public/assets/models/buildings/`, lowercase-hyphen filenames)
- `workbench.glb` — already wired.
- `tent.glb`, `tent-canvas.glb`, `tent-canvas-half.glb` — could replace the Survival Kit `Tent.obj` for a cleaner look.
- `barrel.glb`, `barrel-open.glb`, `box.glb`, `box-large.glb`, `box-open.glb`, `box-large-open.glb`, `chest.glb`, `bucket.glb` — staged for storage / container items.
- `bedroll.glb`, `bedroll-frame.glb`, `bedroll-packed.glb` — staged for a "rest" mechanic (separate from the `tent` building).
- `bottle.glb`, `bottle-large.glb` — could replace `WaterBottle_*.obj` for cleaner pickups.
- `signpost.glb`, `signpost-single.glb` — staged for player-placed waypoints.
- `fence.glb`, `fence-fortified.glb`, `fence-doorway.glb` — staged for perimeter / base-defense mechanic.
- `tool-axe.glb`, `tool-axe-upgraded.glb`, `tool-pickaxe.glb`, `tool-pickaxe-upgraded.glb`, `tool-hammer.glb`, `tool-hammer-upgraded.glb`, `tool-shovel.glb`, `tool-shovel-upgraded.glb`, `tool-hoe.glb`, `tool-hoe-upgraded.glb` — full tool-tier set staged for a future tool-upgrade mechanic.
- `resource-wood.glb`, `resource-planks.glb`, `resource-stone.glb`, `resource-stone-large.glb` — could be alternate pickup looks per-resource.
- `tree.glb`, `tree-tall.glb`, `tree-autumn.glb`, `tree-autumn-tall.glb`, `tree-log.glb`, `tree-log-small.glb`, `tree-trunk.glb`, `tree-autumn-trunk.glb` — staged for biome-specific tree variants (autumn biome doesn't exist yet).
- `rock-a/b/c.glb`, `rock-flat.glb`, `rock-flat-grass.glb`, `rock-sand-a/b/c.glb` — could replace Quaternius `Rock_*.obj` for a more low-poly stylized look.
- `grass.glb`, `grass-large.glb`, `patch-grass.glb`, `patch-grass-large.glb` — staged for foliage upgrade.
- `fish.glb`, `fish-large.glb` — staged for fishing mechanic (see §4a).
- `floor.glb`, `floor-old.glb`, `floor-hole.glb` — staged for floor variants in modular building.
- `structure.glb`, `structure-floor.glb`, `structure-roof.glb`, `structure-canvas.glb`, `structure-metal-doorway.glb`, `structure-metal-floor.glb`, `structure-metal-roof.glb`, `structure-metal-wall.glb`, `structure-metal.glb`, `metal-panel.glb`, `metal-panel-narrow.glb`, `metal-panel-screws*.glb` — staged for the modular building swap (see §1d).
- `campfire-pit.glb`, `campfire-stand.glb`, `campfire-fishing-stand.glb` — staged as alternate campfire variants.
- `workbench-anvil.glb`, `workbench-grind.glb` — staged for tier-2 / tier-3 workbench upgrades.

### 3d. Other unused staged assets
- `public/assets/models/aliens/` may still contain `Alien.fbx` / `Alien_Helmet.fbx` if the user kept them as source backups. Babylon can't load FBX, so these are dead weight in the build — delete or move outside `/public/` to avoid bundler bloat.

---

## 4. Future gameplay arcs (assets exist, system needs designing)

### 4a. Fishing mechanic
- Assets: `fish.glb`, `fish-large.glb`, `campfire-fishing-stand.glb`, `Raft_Paddle.obj`
- Spec to write: rod / lure item, water-edge interaction prompt, catch chance + cook flow.

### 4b. Raft escape (endgame)
- Assets: `Raft.obj`, `Raft_Paddle.obj`
- Spec to write: raft as a placeable that doubles as a vehicle once a "launch" condition (e.g. ferried alien crystal count) is met. Could be the win-state of the game.

### 4c. Cooking station
- Assets: `Pan*.obj`, `Pot*.obj`, `campfire-stand.glb`
- Spec to write: placeable that consumes raw food + fuel and produces cooked variants. Likely a child of the campfire (lit-state-gated).

### 4d. Modular base-building
- Assets: `structure-*.glb`, `floor*.glb`, `metal-panel-*.glb`, `fence*.glb`
- Spec to write: snap-grid replacement for the current procedural foundation/wall/roof. Pulls from the Kenney modular pack.

### 4e. Healing items
- Assets: `Bandages.obj`, `FirstAidKit.obj`, `FirstAidKit_Hard.obj`
- Spec to write: consumable items with HP restore (small / medium / large). Drops as random world loot. The data-table shape in `items.ts:78-84` (`cooked_meat`) is a 1-line precedent.

### 4f. Navigation / Compass
- Assets: `Compass_Closed.obj`, `Compass_Open.obj` (state pair)
- Spec to write: equippable that opens an HUD compass/map overlay.

### 4g. Fire-starting + lit-state torches
- Assets: `Match*.obj`, `Matchbox.obj`, `WoodenTorch*.obj`
- Spec to write: matches as consumable used to light campfire/torch buildings. State swap on the building model.

---

## 5. Code-side polish (no asset dependencies)

### 5a. Hoist `pickAnim()` to a shared util
- **Where it lives:** duplicated in `src/engine/PlayerController.ts:237-243` and `src/engine/AlienRenderer.ts` (bottom helper).
- **Recommendation:** move to `src/engine/AnimationUtils.ts` and re-import from both. Trivial refactor, ~10 LOC.

### 5b. Hoist `setEmissive` / `setAlbedoTint` material helpers
- **Where they live:** local helpers at the bottom of `src/engine/AlienRenderer.ts`.
- **Recommendation:** move to `src/engine/MaterialUtils.ts` so future renderers (HeldItemRenderer, BuildingRenderer) can drive materials with the same duck-typed pattern.

### 5c. Document the OBJ-material-clone footgun
- **Background:** `HeldItemRenderer` discovered that OBJ-loaded PBR materials silently fail to render on `Mesh.clone()` / `Mesh.createInstance()` once the source mesh is `setEnabled(false)` — the un-compiled effect is reused and produces invisible output. Worked around by either:
  1. `forceCompilationAsync(sourceMesh)` at load time before hiding (used in `src/main.ts` for pickups + buildings), OR
  2. Cloning the mesh + replacing the material with a fresh `StandardMaterial` (used in `HeldItemRenderer`).
- **Recommendation:** add a paragraph to `CLAUDE.md` under "Engine quirks worth knowing" so the next person doesn't relitigate it.

### 5d. Held-item swing animation polish
- **What's wrong:** the current `HeldItemRenderer.tick` rotation arc is X-axis only. For a sword (forward thrust) it reads OK; for a club / pike it would feel rotational. Once weapon variety lands the per-item `ITEM_TWEAKS` should also carry a `swingAxis` and `swingDirection`.

### 5e. Re-introduce the procedural-rock-tier idea
- **Background:** the original plan listed "procedural-rock model variants tied to harvest hp tiers (e.g., bigger boulder = more hp)" as out-of-scope. With the new Kenney rock-* GLBs in §3c, that becomes a small slice — pick a different rock model per `harvestable.maxHp` bucket.

---

## 6. Testing / dev-experience

### 6a. Add a CI-friendly visual diff
- Currently every screenshot script writes to `scripts/screenshots/` with a timestamped filename — there's no automated diff against a baseline. A future improvement is a `scripts/visual-diff.mjs` that compares a fresh render to a committed `golden.png` and flags pixel deltas.

### 6b. Track FPS / draw-call regressions
- The `__game` dev handle exposes `engine.getFps()` etc. A future smoke check could assert `fps > 30` and `draws < N` to catch perf regressions when wiring more models.

---

## 7. Memory items (already saved to `~/.claude/projects/.../memory/`)

These are persisted across sessions and don't need re-stating each time:
- Visual style: vibrant saturated colors, minimal PBR env reflection, ocean only at borders.
- Map is the headline feature — procedural generation drives the whole game.
- Procedural placeholders > waiting on assets — build a working synth/primitive when assets aren't ready.
- Terrain transparency = back-face culling — if the floor looks transparent, check `mat.backFaceCulling = false` first.

---

## When this file is empty

Delete it.
