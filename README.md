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
- [ ] Phase 1 — walkable island (in progress)
- [ ] Phase 2 — survival loop
- [ ] Phase 3 — crafting + building
- [ ] Phase 4 — aliens + combat
- [ ] Phase 5 — beauty pass
- [ ] Phase 6 — weather, compass, stamina polish
