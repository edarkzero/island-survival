# Aliens — drop zone (Arc 5)

This folder is the staging area for **rigged alien GLB files** that the
game's `AlienRenderer` will swap in for the current procedural capsules.

The integration code is not yet written; it ships as Arc 5 once the files
land. See `.claude/plans/i-think-that-the-quiet-flute.md` → "Arc 5 — Alien
models" for the full spec.

## Required files (one rigged GLB per alien id)

| Filename | Used for | Size hint |
|---|---|---|
| `scrunkler.glb` | peaceful small alien (HP 30) | ~1.6 m tall |
| `glarn.glb` | hostile mid-tier (HP 80) | ~2.0 m tall |
| `vex.glb` | hostile elite/tank (HP 130) | ~2.4 m tall |

Heights are hints — final per-id scale lives in `AlienRenderer.MODEL_SCALES`
(map will be added when the renderer slice is implemented), so anything
reasonable is fine.

## Required animation clips

Names are matched case-insensitively as a substring (`pickAnim()` helper —
see `src/engine/PlayerController.ts:237-243` for the existing example).

| Clip | When played | Required? |
|---|---|---|
| `Idle` | standing / curious | ✅ |
| `Walk` *or* `Walking` | FSM `Curious` (1.5 m/s) | ✅ |
| `Run` *or* `Running` | FSM `Hostile`/`Friendly` (3.2 / 2.4 m/s) | ✅ |
| `Attack` | one-shot per attack tick (1.4 s) | ✅ |
| `Hit` | short one-shot on damage taken | optional |
| `KnockedOut` *or* `Sleep` | looped while sleeping | optional |

Missing optional clips fall back to the previous adjacent state — the
renderer will be defensive.

## Format

- **`.glb`** (binary glTF, single file with embedded skeleton +
  animations + textures). The loader is already wired in `main.ts` via
  `@babylonjs/loaders/glTF`.
- `.gltf` (text + separate `.bin` and texture files) also works — same
  loader — but messier on disk.
- **`.fbx` is NOT supported by Babylon.js.** If a pack only ships FBX,
  open it in Blender and use **File → Export → glTF 2.0** with format
  `GLB` and "Include: Animations" checked.
- `.obj` is no good here — it has no skeleton or animations.
- Origin at the model's **feet**, facing **+Z** (Babylon convention).
- One file per alien (no LODs needed yet).

## License

Every imported file must be **CC0** (or Mixamo royalty-free if you've
retargeted clips). Add a row to `ATTRIBUTIONS.md` before committing —
see the table in that file for the format.

## Recommended source packs

- **Quaternius — Ultimate Sci-Fi Pack + Ultimate Alien Pack** (CC0) — original plan reference, cleanest sci-fi fit.
- **Quaternius — Ultimate Platformer Pack** (CC0) — has rigged humanoid + creature variants with clips already named correctly. Fine as a stand-in.
- **Mixamo** (royalty-free for indie/commercial) — for retargeting an animation clip a source pack is missing.
