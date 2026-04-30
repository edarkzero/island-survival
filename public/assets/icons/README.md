# Hotbar icons — drop zone (Arc 7)

This folder is the staging area for **PNG hotbar icons** that replace
the current procedural SVG tiles in `src/ui/hud/itemIcons.ts`.

The integration code is not yet written; it ships as Arc 7 once any
PNG lands here (the loader will fall back to the SVG for any item id
that does not have a matching PNG, so partial coverage is fine and the
swap can be incremental).

See `.claude/plans/i-think-that-the-quiet-flute.md` → "Arc 7 — Hotbar
icons" for the full spec.

## Required files (one PNG per itemId)

The filename must match the item's `id` exactly so `iconUrlFor()` can
look it up by name.

```
wood.png                 stone.png              fiber.png
iron_ore.png             iron_ingot.png         alien_crystal.png
berry.png                cooked_meat.png        water_flask.png
stone_axe.png            iron_sword.png         iron_pike.png
wooden_club.png          sleep_dart.png
leather_chest.png        iron_helm.png
shiny_trinket.png        bioluminescent_moss.png
```

(18 files — the union of `ITEMS` keys in
`src/game/data/items.ts:52-175` and `STYLES` keys in
`src/ui/hud/itemIcons.ts:19-47`. Verified — no orphans on either side.)

## Format

- **64×64 PNG**, transparent background, square aspect.
- The HUD slot is 52×52 with the image clamped to **40×40** by
  `src/ui/styles/hud.css:223-229`. 64×64 is the sweet spot — anything
  larger gets downscaled at render time, smaller stretches.
- Visually distinct silhouettes preferred (consumer / tool / weapon
  should read at a glance).

## License

- **CC0 preferred.** Pure CC0 only needs a single row in
  `ATTRIBUTIONS.md` per pack.
- **CC-BY 3.0/4.0 acceptable** (e.g. Game-Icons.net) but every
  individual icon used needs an attribution row — only worth it if a
  CC0 pack doesn't cover the item.

## Recommended source packs

- **Kenney — UI Pack: Sci-fi** (CC0) — already in the project's planned-asset table.
- **Kenney — Survival Kit / Generic Items** (CC0) — better silhouette match for resources/tools.
- **Game-Icons.net** (CC-BY 3.0/4.0) — large coverage, attribution per icon required.
- **Quaternius — Ultimate Survival Kit** (CC0) — if the version you have ships icons.
