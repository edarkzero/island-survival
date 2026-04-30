# Asset Attributions

All assets in this project must be CC0 or otherwise commercially-permissive.
This file is the audit trail — every imported asset gets logged here so a
non-CC0 mistake is findable later.

## Planned asset packs (CC0)

| Pack | Source | License | Used For |
|---|---|---|---|
| Quaternius — Ultimate Nature Pack | https://quaternius.com | CC0 | Trees, rocks, foliage, cliffs |
| Quaternius — Ultimate Survival Kit | https://quaternius.com | CC0 | Tools, weapons, building props |
| Quaternius — Ultimate Modular Character + Animation pack | https://quaternius.com | CC0 | Player human, animations |
| Quaternius — Ultimate Sci-Fi + Alien Pack | https://quaternius.com | CC0 | Aliens, crash-site set dressing |
| Kenney — Survival Kit | https://kenney.nl | CC0 | Secondary props, UI icons |
| Kenney — UI Pack: Sci-fi | https://kenney.nl | CC0 | HUD icons |
| Kenney — RPG Audio | https://kenney.nl | CC0 | SFX |
| Poly Haven — HDRIs | https://polyhaven.com | CC0 | Day + dusk skies for IBL |
| Poly Haven — PBR textures | https://polyhaven.com | CC0 | Optional hero materials |
| ambientCG | https://ambientcg.com | CC0 | Extra PBR materials |
| Mixamo | https://mixamo.com | Royalty-free for indie/commercial | Character animations |

## Imported assets

| Path | Source | License | Used For |
|---|---|---|---|
| `public/assets/models/flora/PineTree_{1..5}.{obj,mtl}` | Quaternius — Ultimate Nature Pack | CC0 | `tree_pine` props (PineTree_3 active) |
| `public/assets/models/flora/Rock_{1..7}.{obj,mtl}` | Quaternius — Ultimate Nature Pack | CC0 | `rock_small` (1–3) and `rock_large` (4–7) variants |
| `public/assets/models/props/{Axe,Axe_Small,Knife,Shovel}.{obj,mtl}` | Quaternius — Ultimate Survival Kit | CC0 | Tools — staged for `stone_axe` and future tool items |
| `public/assets/models/props/{Backpack,Bandages,Compass_*,FirstAidKit*}.{obj,mtl}` | Quaternius — Ultimate Survival Kit | CC0 | Survival items — staged for future inventory upgrades / consumables |
| `public/assets/models/props/{Match*,Matchbox,Pan*,Pot*}.{obj,mtl}` | Quaternius — Ultimate Survival Kit | CC0 | Fire-starting + cooking — staged for future cooking station |
| `public/assets/models/props/{WaterBottle_*}.{obj,mtl}` | Quaternius — Ultimate Survival Kit | CC0 | `water_flask` model variants |
| `public/assets/models/props/{WoodLog}.{obj,mtl}` | Quaternius — Ultimate Survival Kit | CC0 | Resource pickup — staged for `wood` |
| `public/assets/models/props/{WoodenTorch,WoodenTorch_Fire,Raft,Raft_Paddle}.{obj,mtl}` | Quaternius — Ultimate Survival Kit | CC0 | Light source + future raft escape vehicle |
| `public/assets/models/buildings/{Bonfire,Bonfire_Fire,Tent,BearTrap_*}.{obj,mtl}` | Quaternius — Ultimate Survival Kit | CC0 | Placeable structures — campfire (`Bonfire` active), tent + bear trap (active) |
| `public/assets/models/buildings/{workbench,tent,tent-canvas*,bedroll*,barrel*,box*,chest,fence*,floor*,structure*,resource-*,rock-*,tree-*,grass*,patch-*,fish*,bottle*,signpost*,metal-panel*,tool-*,bucket,campfire-*}.glb` | Kenney — Survival Kit / Modular pack | CC0 | Modular building set — `workbench` active; rest staged for future polish |
| `public/assets/models/aliens/{scrunkler,glarn,vex}.glb` | Quaternius — Ultimate Platformer Pack (rigged stand-ins) | CC0 | Alien archetypes — rigged GLB with Idle/Walk/Run/Punch/SwordSlash/etc. animations |
| `public/assets/models/characters/player.{gltf,bin}` + `T_Peasant_{BaseColor,Normal,ORM}.png` | Quaternius — Female Peasant rig (CC0) | CC0 | Player character (no animations in current export — T-pose static; clips can be retargeted via Mixamo) |
| `public/assets/models/fauna/berries.glb` | Kenney — Survival pack | CC0 | `berry` pickup model |
| `public/assets/icons/{wood,stone,fiber,iron_*,alien_crystal,berry,cooked_meat,water_flask,stone_axe,iron_sword,iron_pike,wooden_club,sleep_dart,leather_chest,iron_helm,shiny_trinket,bioluminescent_moss}.png` | Kenney — Survival / UI icon packs | CC0 | Hotbar icons (one per equipped item id) |

## In-tree placeholders (temporary)

| Asset | Source | Status |
|---|---|---|
| `waterbump.png` (CDN-loaded from playground.babylonjs.com) | Babylon.js Playground | **TODO**: replace with locally-hosted CC0 normal map before shipping |
| `environmentSpecular.env` (CDN-loaded from assets.babylonjs.com) | Babylon.js asset CDN — used as IBL + skybox | **TODO**: replace with a locally-hosted CC0 HDRI from Poly Haven (e.g. `kloofendal_43d_clear` or `qwantani`) |
| `T_Peasant_Normal.png` (1×1 flat-blue placeholder generated at build time) | Internal stub | **TODO**: source a real Normal map for the Female Peasant rig from the original Quaternius release if better surface detail is wanted |

## Audit checklist before any commercial release

- [ ] Replace all CDN-loaded assets with locally-hosted CC0 equivalents.
- [ ] Verify every file under `/public/assets/` traces back to a CC0 row above.
- [ ] If a non-CC0 asset is needed, add it here with the license terms before importing.
