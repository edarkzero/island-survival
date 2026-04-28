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

## In-tree placeholders (temporary)

| Asset | Source | Status |
|---|---|---|
| `waterbump.png` (CDN-loaded from playground.babylonjs.com) | Babylon.js Playground | **TODO**: replace with locally-hosted CC0 normal map before shipping |
| `environmentSpecular.env` (CDN-loaded from assets.babylonjs.com) | Babylon.js asset CDN — used as IBL + skybox | **TODO**: replace with a locally-hosted CC0 HDRI from Poly Haven (e.g. `kloofendal_43d_clear` or `qwantani`) |
| `HVGirl.glb` (CDN-loaded from assets.babylonjs.com) | Babylon.js asset CDN — placeholder rigged character | **TODO**: replace with Quaternius modular human + Mixamo retargeted animations before shipping |

## Audit checklist before any commercial release

- [ ] Replace all CDN-loaded assets with locally-hosted CC0 equivalents.
- [ ] Verify every file under `/public/assets/` traces back to a CC0 row above.
- [ ] If a non-CC0 asset is needed, add it here with the license terms before importing.
