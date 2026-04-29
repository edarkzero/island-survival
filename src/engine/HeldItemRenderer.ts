import type { Scene } from "@babylonjs/core/scene";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Vector3, Color3 } from "@babylonjs/core/Maths/math";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import type { Material } from "@babylonjs/core/Materials/material";
import type { ShadowSystem } from "./ShadowSystem";
import type { PickupModels } from "./PickupRenderer";
import type { PlayerController } from "./PlayerController";
import type { CombatController } from "./CombatController";
import type { Equipment } from "../game/systems/Equipment";

// Local-space offset of the held item relative to the yaw-wrapper.
// The wrapper rotates with `facing + π`, so the character's "forward"
// is local -Z. A right-hand grip lives at +X, head height ~1.1m, with
// the item nudged forward of the body so it isn't clipped by the torso.
const HAND_OFFSET = new Vector3(0.45, 1.05, -0.2);

// Per-item local tweaks layered on top of HAND_OFFSET. Position is added,
// rotation replaces the held-item base rotation (then the swing arc is
// added on top of rotX), scale uniformly multiplies. HVGirl exposes no
// skeleton so all values are dialed in by eye against screenshots.
const ITEM_TWEAKS: Record<
  string,
  { pos?: [number, number, number]; rot?: [number, number, number]; scale?: number }
> = {
  stone_axe: { pos: [0, 0, 0], rot: [0, 0, 0], scale: 0.4 },
  water_flask: { pos: [0, 0, 0], rot: [0, 0, 0], scale: 0.6 },
  wood: { pos: [0, 0.05, 0], rot: [0, 0, Math.PI / 2], scale: 0.35 },
};

const SWING_PEAK_RAD = -Math.PI * 0.55;
const SWING_FLASH_DURATION = 0.18;

/**
 * Renders the player's currently equipped item as a held mesh parented to
 * `player.holdAnchor`. Polls `equipment.activeItem()` each tick — a change
 * disposes the old instance and spawns a fresh one from the same `PickupModels`
 * map the ground pickups use (no duplicate loads). Reads `combat.swingFlash`
 * to drive a one-shot chop arc on the X-axis: just-swung → item extended
 * forward; flash decays → returns to rest.
 *
 * Items without a registered model render nothing (the rest of the body is
 * handled by `PlayerController`).
 */
export class HeldItemRenderer {
  private readonly scene: Scene;
  private readonly equipment: Equipment;
  private readonly combat: CombatController;
  private readonly player: PlayerController;
  private readonly shadows: ShadowSystem;
  private readonly models: PickupModels;

  private currentItemId: string | null = null;
  private root: TransformNode | null = null;
  private handles: AbstractMesh[] = [];

  constructor(
    scene: Scene,
    equipment: Equipment,
    combat: CombatController,
    player: PlayerController,
    shadows: ShadowSystem,
    models: PickupModels,
  ) {
    this.scene = scene;
    this.equipment = equipment;
    this.combat = combat;
    this.player = player;
    this.shadows = shadows;
    this.models = models;
  }

  tick(_dt: number) {
    const wantId = this.equipment.activeItem();
    if (wantId !== this.currentItemId) {
      this.disposeCurrent();
      this.currentItemId = wantId;
      if (wantId) this.spawnItem(wantId);
    }
    if (!this.root) return;

    // The yaw wrapper isn't created until the character GLB resolves —
    // re-parent each frame in case the anchor flipped from root → wrapper.
    const anchor = this.player.holdAnchor;
    if (this.root.parent !== anchor) this.root.parent = anchor;

    const tweak = this.currentItemId ? ITEM_TWEAKS[this.currentItemId] : undefined;
    this.root.position.copyFrom(HAND_OFFSET);
    if (tweak?.pos) {
      this.root.position.addInPlaceFromFloats(tweak.pos[0], tweak.pos[1], tweak.pos[2]);
    }
    const baseRotX = tweak?.rot?.[0] ?? 0;
    const baseRotY = tweak?.rot?.[1] ?? 0;
    const baseRotZ = tweak?.rot?.[2] ?? 0;
    // swingFlash decays SWING_FLASH_DURATION → 0. t = 1 just-swung, 0 at rest.
    const t = Math.min(1, this.combat.swingFlash / SWING_FLASH_DURATION);
    const arc = SWING_PEAK_RAD * t;
    this.root.rotation.set(baseRotX + arc, baseRotY, baseRotZ);

    const scale = tweak?.scale ?? 1.0;
    this.root.scaling.setAll(scale);
  }

  private spawnItem(itemId: string) {
    const variants = this.models.get(itemId);
    if (!variants || variants.length === 0) return;
    const variant = variants[0]!;
    const root = new TransformNode(`held-${itemId}-root`, this.scene);
    root.parent = this.player.holdAnchor;
    // Held items can't reuse the OBJ-loaded material when the source mesh
    // is hidden — clones/instances of those sources render invisible inside
    // a deep parent chain (player root → yaw wrapper → held root). Cloning
    // the mesh AND swapping in a fresh StandardMaterial seeded from the
    // source's color renders reliably. Slightly heavier than createInstance
    // but there's only ever one held item.
    const created: AbstractMesh[] = [];
    for (let i = 0; i < variant.meshes.length; i++) {
      const src = variant.meshes[i]!;
      const cloned = src.clone(`held-${itemId}-c${i}`, root);
      if (!cloned) continue;
      cloned.position.set(0, 0, 0);
      cloned.rotation.set(0, 0, 0);
      cloned.scaling.setAll(1);
      cloned.isVisible = true;
      cloned.setEnabled(true);
      cloned.material = freshMaterialFrom(src.material, this.scene, `held-${itemId}-mat${i}`);
      cloned.alwaysSelectAsActiveMesh = true;
      this.shadows.addCaster(cloned);
      created.push(cloned);
    }
    this.root = root;
    this.handles = created;
  }

  private disposeCurrent() {
    for (const h of this.handles) h.dispose();
    if (this.root) this.root.dispose();
    this.handles = [];
    this.root = null;
  }
}

/**
 * Build a fresh StandardMaterial that approximates the look of an OBJ-loaded
 * material. Copies the diffuse/albedo color when available so the held item
 * keeps the asset's intended palette; falls back to a neutral grey.
 *
 * Re-creating the material (rather than reusing or cloning the source) lets
 * Babylon compile a fresh shader effect tied to the held mesh — the OBJ
 * pipeline's effects don't survive the source being hidden + the held
 * clone living deep in a TransformNode chain.
 */
function freshMaterialFrom(srcMat: Material | null, scene: Scene, name: string): StandardMaterial {
  const out = new StandardMaterial(name, scene);
  let color: Color3 | null = null;
  if (srcMat instanceof StandardMaterial) {
    color = srcMat.diffuseColor.clone();
  } else if (srcMat instanceof PBRMaterial) {
    color = srcMat.albedoColor.clone();
  }
  out.diffuseColor = color ?? new Color3(0.7, 0.7, 0.7);
  out.specularColor = new Color3(0.1, 0.1, 0.1);
  return out;
}
