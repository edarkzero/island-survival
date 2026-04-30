# Characters — drop zone (Arc 6)

This folder is the staging area for the **rigged player GLB** that
replaces the current Babylon-CDN HVGirl placeholder.

The integration code is not yet written; it ships as Arc 6 once the file
lands. See `.claude/plans/i-think-that-the-quiet-flute.md` → "Arc 6 —
Player character" for the full spec.

## Required file

| Filename | Purpose |
|---|---|
| `player.glb` | Sole rigged human used for the third-person player |

(Variants/skins can come later; the current code only loads one URL —
`src/engine/PlayerController.ts:21-23`.)

## Required animation clips

Names matched case-insensitively as a substring via `pickAnim()`.

| Clip | When played | Required? |
|---|---|---|
| `Idle` | standing | ✅ |
| `Walk` *or* `Walking` | walking (4-5 m/s feel) | ✅ |
| `Run` *or* `Running` | sprinting | ✅ |
| `Attack` | replaces the current arm-only swing tween | optional |
| `Hit` | replaces flash tween | optional |
| `Pickup` | reach-down for the E-prompt | optional |
| `Jump` | future jump action | optional |
| `Sleep` *or* `LayDown` | future tent-rest | optional |

Missing optional clips silently fall back to existing tween/no-op
behavior.

## Format

- **`.glb`** (binary glTF, single file with embedded skeleton +
  animations + textures). The loader is already wired via
  `@babylonjs/loaders/glTF`.
- `.gltf` (text + separate `.bin` + textures) also works.
- **`.fbx` is NOT supported by Babylon.js.** Convert to GLB in Blender:
  **File → Export → glTF 2.0**, format `GLB`, "Include: Animations".
- For Mixamo: pick **"glTF Binary (.glb)"** in the download dialog,
  with "Skin" included + the animation clip baked in.
- Origin at the **feet**, facing **+Z** (Babylon convention).
- Target ~1.8 m tall in world units. The current `CHARACTER_SCALE = 0.08`
  was tuned for HVGirl (22 u native height); a Quaternius rig at native
  scale will likely need a different constant — easy to retune in
  `src/engine/PlayerController.ts:23`.
- The existing yaw-wrapper pattern (`PlayerController.ts:28-32`) absorbs
  animations that animate the root's Y rotation, so a rig where
  animations spin the root is fine — no rebake needed.
- Multi-submesh rigs are fine; shadow caster wiring already iterates
  every submesh with vertices ≥ 1 (`PlayerController.ts:120-122`).
- Held-item parenting (`HeldItemRenderer.HAND_OFFSET`) will need
  re-tuning once the new rig lands — the new skeleton's hand sits at a
  different local offset. Budget one screenshot iteration.

## License

CC0 only (or Mixamo royalty-free for retargeted clips). Add a row to
`ATTRIBUTIONS.md` before commit and **remove** the `HVGirl.glb` row
from the "In-tree placeholders" table in the same file.

## Recommended source packs

- **Quaternius — Ultimate Modular Character + Animation Pack** (CC0) — listed in the project's planned-asset table; ships with all the required clips.
- **Quaternius — Ultimate Platformer Pack** (CC0) — alternative; default rig has Idle/Walk/Run/Jump/Attack named correctly.
- **Mixamo** (royalty-free for indie/commercial) — fall-back for any single missing clip.
