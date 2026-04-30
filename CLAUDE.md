# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Open work:** before starting anything substantial, scan `ROADMAP.md` —
> it's the canonical inventory of pending tasks, recommended polish, and
> staged-but-unwired CC0 assets. Many "small wins" are one-line wires
> against assets that already live under `public/assets/`.

## Commands

```bash
npm run dev        # Vite dev server at http://localhost:5173
npm run build      # tsc --noEmit type-check, then vite build → dist/
npm run preview    # serve the production build
```

There is no test runner. Verification is done with **Playwright headless smoke scripts** under `scripts/` — they boot the dev server URL, settle ~8s, screenshot to `scripts/screenshots/`, and exit non-zero on console errors. Examples:

```bash
node scripts/smoke-test.mjs       # canvas + loading-overlay sanity
node scripts/phase4-test.mjs      # alien spawn + combat
node scripts/island-vista.mjs     # wide pull-back showing terrain/water
```

The dev server **must already be running** (`npm run dev` in another shell) before running any script — they do not start Vite themselves. Override the URL with `GAME_URL=...`.

The scripts use the in-window dev handle `window.__game = { scene, camera, terrain, player, inv, equipment, aliens, ... }` (set in `src/main.ts` only when `import.meta.env.DEV`) to drive/inspect the game without a real user.

## Architecture

### The decoupling rule (load-bearing)

Code is split into three trees with a strict import direction:

```
src/engine/   Babylon-specific. May import @babylonjs/*. Throwaway on Unity/Unreal port.
src/game/     Engine-agnostic. MUST NOT import @babylonjs/*. Survives the port as a spec.
src/ui/       HTML/CSS HUD overlay. May read game state; does not touch Babylon.
src/main.ts   The bootstrap — the ONE place engine + game + ui get wired together.
```

`src/game/data/*.ts` (items, recipes, buildings, aliens, biomes) are JSON-shaped registries that map 1:1 onto Unity ScriptableObjects / Unreal DataTables. `GAME_DESIGN.md` is the design spec that survives any engine swap. `src/game/bridge/` is reserved for the future ECS↔renderer seam but currently empty — Phase 1–4 wire systems directly in `main.ts`.

When adding a new gameplay rule, ask: does it depend on a Babylon type? If no, it belongs in `src/game/`. If yes, it's a renderer concern in `src/engine/`.

### Frame loop

`src/main.ts` registers a single `scene.onBeforeRenderObservable` handler that orchestrates everything per frame in this order:

1. Read input edge events (`craft`, `inventory`, `cancel`, hotbar slot keys 1–9). Each menu/hotbar press also fires `audio.playClick(...)`.
2. Tick world systems: `dayNight → water → grass → player → survival → pickupRenderer → interactions → buildMode → combat → projectiles → weather`.
3. Audio polls — biome ambient sampled at 1 Hz (crossfades on biome change); footstep stride accumulator fires `audio.playFootstep(material)` while `player.isMoving()`.
4. Tick aliens (FSM + AI), then `alienRenderer` syncs renderer state.
5. Push survival snapshot + inventory + hotbar + compass (with player position for waypoints) into `hud`.

Modal UI gating: `combat`, `projectiles`, `interactions`, and `buildMode.tick()` all receive a `disabled` flag computed as `buildMode.active || crafting.open || inventoryMenu.open` so menus suppress world input.

### Engine quirks worth knowing

- **Babylon submodule imports.** Only import the specific class needed (`@babylonjs/core/Meshes/meshBuilder`, not the umbrella). Some features need a side-effect import to register a scene component — e.g. `@babylonjs/core/Particles/webgl2ParticleSystem`, `@babylonjs/core/Rendering/prePassRendererSceneComponent`, `@babylonjs/loaders/glTF` (in `main.ts`). Missing one fails silently or with a runtime "X not registered" error.
- **InputManager listens on `window`, not `scene.onKeyboardObservable`.** Babylon's keyboard observable requires canvas focus; menus and dev tools steal focus and would break input. Don't switch back. Edge events (`wasJustPressed`) are cleared in `scene.onAfterRenderObservable`.
- **Character yaw-wrapper pattern.** `HVGirl.glb`'s Walking/Running animations animate the model root's `rotation.y`, which would clobber facing. `PlayerController` puts a `TransformNode` (`yawWrapper`) between `root` and the character mesh and rotates the wrapper; the character itself is free for animations. Don't add new transforms to the character node — put them on `yawWrapper` or `root`.
- **TypeScript config is strict in unusual ways.** `erasableSyntaxOnly` forbids constructor parameter properties (`constructor(private x)`) — declare fields explicitly. `verbatimModuleSyntax` forces `import type` for type-only imports. `noUnusedLocals/Parameters` is on; prefix with `_` to silence intentionally unused.
- **Vite is pinned to 5.x.** Vite 8 + Node 20.18 hits a rolldown native-binding crash. Don't bump.
- **Active item resolution.** Combat reads from `Equipment.activeItem()` (the hotbar slot the player chose) — NOT a damage-priority scan. Number keys 1–9 set the active slot.
- **Babylon `AudioEngine` requires explicit setup.** `SceneManager` imports `@babylonjs/core/Audio/audioEngine` (registers the factory) AND passes `audioEngine: true` in engine options. Both are required — without the import the factory is missing; without the option the engine never instantiates. Sound class playback won't work until both are present.
- **OBJ-loaded materials silently fail to render on hidden source meshes.** When you load an OBJ with `@babylonjs/loaders/OBJ`, the materials' shader effects don't compile until first render. If you then `setEnabled(false)` on the source mesh and call `Mesh.createInstance()` or `Mesh.clone()` on it, the instance/clone reuses the never-compiled effect and renders **invisible** (no error, no warning — just nothing on screen). Two known fixes: (a) call `material.forceCompilationAsync(sourceMesh)` BEFORE hiding the source — used in `src/main.ts` for pickups + buildings; (b) clone the mesh AND replace its material with a fresh `StandardMaterial` — used in `src/engine/HeldItemRenderer.ts:freshMaterialFrom`. If a new renderer ever needs to instance an OBJ source and items don't show up, this is the first thing to check.

### Terrain / water layering

The "is the floor transparent?" failure mode burned six iterations before the actual cause was identified. The bug was **back-face culling**: `TerrainRenderer.ts` builds the heightmap with index winding `(a, c, b) / (b, c, d)`, which ends up back-facing the camera when viewed from above in Babylon's left-handed convention. With culling on, the top of the island disappears and you see straight through to whatever is below. The fix lives on the terrain material as `mat.backFaceCulling = false` — that line and its comment in `TerrainRenderer.ts` are load-bearing, do not remove. Earlier "fixes" tuned PBR exposure, water depth, fog, etc., but those were decoration over the hole; the terrain top genuinely was not rendering.

The current setup, with the back-face fix in place:

- `IslandGenerator.ts` produces a hard cliff at the shoreline via `LAND_FLOOR = 1.2` and `SHELF_FLOOR = -3.5`: every cell is either `>= 1.2m` (land) or `<= -3.5m` (underwater shelf), nothing in between. No vertex-blend across the waterline.
- `TerrainRenderer.ts` builds (a) the heightmap mesh with vertex colors from `colorForCell()` plus a baked-in directional shade so the terrain reads as 3D without lighting, (b) a 4-strip vertical **skirt** dropping from the perimeter to `y=-30`, and (c) a huge dark `bedrock` plate at `y=-28`. The skirt + bedrock close the mesh so no viewing angle sees through into the sky. The terrain material is `StandardMaterial` with `disableLighting = true` and `emissive = (1,1,1)` — vertex colors render at the saturation `colorForCell()` authored. (PBR + ACES + exposure was pushing the lit floor above 1.0 and clamping to near-white.)
- `WaterRenderer.ts` puts the WaterMaterial plane at `y=-2.5` (cleanly above the `-3.5m` shelf, well below land's `1.2m` cliff base = ~3.7m visible bank), uses a saturated true ocean blue (`Color3(0.06, 0.30, 0.62)`) with `colorBlendFactor = 0.1` (minimal sky reflection), and **does not add the terrain to the reflection list** — reflecting land into the water created visual confusion at the shoreline.
- Shore foam: a procedural particle ring driven from the actual coastline. Flood-fills the heightmap from a corner to identify ocean-connected water cells (vs interior puddles), then emits white wisps from land cells bordering ocean. See `WaterRenderer.buildShoreFoam`.

If the terrain again starts looking "transparent / floating," **first** verify `mat.backFaceCulling = false` is still on the terrain material before touching anything else.

### Audio system

`src/engine/Audio.ts` is the only audio entry point. Game systems call by id (`audio.playSwing("blunt")`, `audio.playFootstep("grass")`, `audio.setAmbientSynth("forest")`). Internally:

- **Two-tier playback per event.** Each `play<Foo>()` method first tries `playRandom("foo/...")` against the Babylon `Sound` registry (defined in `src/engine/AudioRegistry.ts`, registered with `audio.defineAll(SOUND_DEFS)` in `main.ts`). If no def matches, it falls back to a procedural Web Audio synth (oscillators + filtered noise) using its own `AudioContext`. Both paths honor the bus mixer. Adding a new asset = drop OGG + add registry entry; the next call picks it up.
- **Random variants.** Registry keys with a trailing `/N` (e.g. `footstep/0`–`footstep/9`, `swing/bladed/0`, `swing/bladed/1`) are variants of the same event. `playRandom("footstep")` matches the prefix and picks one at random. Exact-match keys (no trailing variant) play directly.
- **Bus mixer.** `master` × `ambient | sfx | music | ui`. Values persist to `localStorage` (`island-audio-mixer`). The `AudioMixer` UI (top-left "🔊 Audio" button) reads/writes via `audio.setVolume(bus, value)`.
- **Hook points.** Most game systems take `audio` as a constructor parameter and call inline (e.g. `CombatController` calls `audio.playSwing(atk.kind)` and `audio.playHit("flesh")`). `CraftingMenu` uses a hook callback (`hooks.onCraftSuccess`) instead so `src/ui/` doesn't import from `src/engine/`. The biome poll + footstep stride accumulator live in `main.ts` because they read `terrain.biomeAt()` + `player.isMoving()`.
- **Synth-only events today.** `setAmbientSynth(biome)` and `setRain(on)` have no asset path — Kenney RPG Audio is SFX-only. They stay procedural until ambient stems are sourced separately.

### Harvestable props

`tree_pine` and `rock_*` props can be chopped/mined for resources via `src/game/systems/HarvestableProps.ts` (engine-agnostic state machine). Per-kind config lives in `src/game/data/harvestables.ts` (hp, required tool, drop spec, respawn seconds). The `CombatController` attack input falls through to a harvest target if no alien is in front. On depletion, drops spawn as ground pickups via the existing `PickupRegistry`, and `PropRenderer.setVisible(propIndex, false)` zero-scales that prop's thin-instance matrix. After `respawnSec` (30s in tests; tune per-kind), state flips back to `alive` and the original matrix is restored. The state machine is independent of any rendering — the engine layer only sees `onDrop` and `onVisibilityChange` callbacks.

`scripts/harvest-test.mjs` is the e2e regression: equip an axe, chop the nearest tree, assert depletion + drops, wait, assert respawn.

### Asset story

All gameplay assets are intended to be CC0 (Quaternius / Kenney / Poly Haven / ambientCG / Mixamo). Assets live under `public/assets/{models,textures,hdri,audio,lut}` with `models/` further split by category. Track every drop-in in `ATTRIBUTIONS.md` even though everything is CC0 — that's how a non-CC0 file slipping in becomes findable. The character model and the water bump texture are currently loaded from Babylon's CDN (`assets.babylonjs.com`, `playground.babylonjs.com`) as a temporary convenience.

### Model loading pattern

`AssetLoader.loadGlb(url, scene)` is the single cached entry point — works for both `.glb` and `.obj` once `@babylonjs/loaders/OBJ` is side-effect-imported (done in `main.ts`). Pre-load at boot, pass loaded meshes into the renderer, never await mid-render. The `PropRenderer` shows the canonical pattern: accept a `PropModels` object with arrays of variants per kind, deterministically bucket each instance via `propIndex % numVariants`, build one thin-instance buffer per variant, and fall back to a procedural primitive if the load fails. Pickup, building, and held-item renderers should mirror this shape (see `.claude/plans/i-think-that-the-quiet-flute.md` for the slice roadmap).
