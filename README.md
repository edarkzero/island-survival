# Island Survival

3D survival/crafting game built in HTML (Babylon.js + TypeScript), designed
to be ported to Unity or Unreal once the design is proven.

## Stack

- **Babylon.js 9** — engine. PBR + post-FX + water + Havok physics.
- **TypeScript + Vite** — build/dev.
- **bitecs** — ECS for gameplay systems (used from Phase 2 onward).
- **CC0 assets** — Quaternius / Kenney / Poly Haven (see [`ATTRIBUTIONS.md`](./ATTRIBUTIONS.md)).

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

## Layout

```
src/
  engine/    Babylon-specific renderer code (throwaway when porting)
  game/      Engine-agnostic gameplay (data, components, systems, world)
  ui/        HTML/CSS HUD overlay
  bridge/    The ONE seam between engine and game
public/assets/   .glb models, textures, hdri, audio
```

`src/game/` may NOT import from `@babylonjs/*`. That decoupling is what
makes the eventual Unity/Unreal port less painful. See [`GAME_DESIGN.md`](./GAME_DESIGN.md)
for the design that survives the port.

## Status

- [x] Phase 0 — scaffolding + boot
- [x] Phase 1 — walkable island
- [x] Phase 2 — survival loop
- [x] Phase 3 — crafting + building
- [x] Phase 4 — aliens + combat
- [x] Phase 5 — beauty pass (sunrise/sunset, grass sway, shore foam)
- [x] Phase 6 — weather, compass + base waypoint, stamina
- [x] Phase 7 — audio (Kenney RPG Audio assets wired; ambient + rain still procedural)

## Audio

`src/engine/Audio.ts` is the only audio entry point. Game systems call by id —
`audio.playSwing("blunt")`, `audio.playFootstep("grass")`,
`audio.setAmbientSynth("forest")`. Internally:

- **Bus mixer** — `master` × `ambient | sfx | music | ui`. Values persist to
  `localStorage` (`island-audio-mixer` key). The mixer UI (top-left "🔊 Audio")
  exposes the sliders.
- **Two-tier playback.** Each `playFoo()` method first tries `playRandom("foo/...")`
  to play a real OGG from the Kenney RPG Audio pack (registered via
  `src/engine/AudioRegistry.ts`); if no def matches, it falls back to a
  Web Audio synth (oscillators / filtered noise). Swap-able per event — drop a
  new file, add a registry entry, the next call picks it up.
- **What's live vs. synth today.** UI clicks, footsteps (10 surface-agnostic
  variants), combat swings/hits, sleep dart, pickups (resource/metal/consumable),
  build place, craft success — all real OGGs. Biome ambient stems and the rain
  bed remain procedural (Kenney RPG Audio pack is SFX-only).
- **Babylon `AudioEngine`** is enabled in `SceneManager` (`audioEngine: true`)
  and the `@babylonjs/core/Audio/audioEngine` side-effect import registers the
  factory before `new Engine()` runs.
