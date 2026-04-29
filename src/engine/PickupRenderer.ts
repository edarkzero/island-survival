import type { Scene } from "@babylonjs/core/scene";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { Color3 } from "@babylonjs/core/Maths/math";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { ShadowSystem } from "./ShadowSystem";
import type { Pickup, PickupRegistry } from "../game/systems/PickupRegistry";

const COLORS: Record<string, [number, number, number]> = {
  berry: [0.55, 0.20, 0.75],            // ripe purple
  water_flask: [0.35, 0.70, 0.92],      // clear blue
  fiber: [0.85, 0.78, 0.45],            // dry straw
  wood: [0.45, 0.28, 0.14],             // bark brown
  stone: [0.55, 0.55, 0.55],            // neutral gray
  iron_ore: [0.50, 0.42, 0.36],         // rusty raw ore
  iron_ingot: [0.78, 0.78, 0.82],       // bright metallic silver
  alien_crystal: [0.45, 0.85, 0.95],    // glowing cyan
  bioluminescent_moss: [0.30, 0.95, 0.55], // glowing green
  shiny_trinket: [0.95, 0.85, 0.30],    // gold
  cooked_meat: [0.65, 0.30, 0.20],      // cooked brown-red
};

// Items that should render as polished metal rather than matte resource.
const METALLIC = new Set(["iron_ore", "iron_ingot", "shiny_trinket"]);

// Per-item uniform scale for model pickups. Quaternius assets ship at varied
// real-world-ish proportions; adjust here so they read as hand-held items on
// the ground instead of dwarfing the player. Default = 1.0.
const MODEL_SCALES: Record<string, number> = {
  wood: 0.33, // WoodLog comes in roughly 3× the size we want for a ground pickup
};

/**
 * One variant of a pickup model — the geometry-bearing meshes extracted from
 * a loaded asset, ready to be sources for `createInstance`.
 */
interface PickupModelVariant {
  meshes: Mesh[];
}

/** itemId → ordered variant list. Pickups bucket via `id % variants.length`. */
export type PickupModels = Map<string, PickupModelVariant[]>;

/**
 * Renders pickup meshes — real models when an `itemId` has variants
 * registered, colored sphere fallback otherwise. Variant choice per pickup
 * is deterministic (`pickupId % numVariants`) so the same pickup keeps the
 * same look across frames. Each on-ground pickup is its own transform
 * (instances of a shared source mesh) so the gentle bob/rotation tween
 * works per-item.
 */
export class PickupRenderer {
  private readonly scene: Scene;
  /** Track each pickup's render handles so we can dispose on consume. */
  private readonly handles = new Map<number, AbstractMesh[]>();
  private readonly registry: PickupRegistry;
  private readonly shadows: ShadowSystem;
  private readonly models: PickupModels;
  private bobPhase = 0;

  constructor(
    scene: Scene,
    registry: PickupRegistry,
    shadows: ShadowSystem,
    models: PickupModels = new Map(),
  ) {
    this.scene = scene;
    this.registry = registry;
    this.shadows = shadows;
    this.models = models;
    this.spawnAll();
  }

  private spawnAll() {
    for (const p of this.registry.pickups) this.spawn(p);
  }

  spawn(p: Pickup) {
    const variants = this.models.get(p.itemId);
    if (variants && variants.length > 0) {
      this.spawnModelInstance(p, variants[p.id % variants.length]!);
      return;
    }
    this.spawnSphere(p);
  }

  /** Procedural-sphere fallback (legacy look). */
  private spawnSphere(p: Pickup) {
    const mesh = MeshBuilder.CreateSphere(
      `pickup-${p.id}-${p.itemId}`,
      { diameter: 0.32, segments: 8 },
      this.scene,
    );
    mesh.position.set(p.x, p.y + 0.4, p.z);
    const mat = new PBRMaterial(`pickupMat-${p.id}`, this.scene);
    const c = COLORS[p.itemId] ?? [1, 0, 1];
    mat.albedoColor = new Color3(c[0], c[1], c[2]);
    mat.emissiveColor = new Color3(c[0] * 0.15, c[1] * 0.15, c[2] * 0.15);
    if (METALLIC.has(p.itemId)) {
      mat.metallic = 0.9;
      mat.roughness = 0.25;
    } else {
      mat.metallic = 0.0;
      mat.roughness = 0.4;
    }
    mesh.material = mat;
    this.shadows.addCaster(mesh);
    this.handles.set(p.id, [mesh]);
  }

  /**
   * Spawn an instance of the variant's source mesh(es) at the pickup's
   * position. Each source mesh contributes one instance (handles
   * multi-mesh assets like trunk+canopy GLBs). All instances share a
   * parent TransformNode so bob/rotate per-tick is one matrix update.
   */
  private spawnModelInstance(p: Pickup, variant: PickupModelVariant) {
    const root = new TransformNode(`pickup-${p.id}-${p.itemId}-root`, this.scene);
    root.position.set(p.x, p.y + 0.4, p.z);
    const scale = MODEL_SCALES[p.itemId] ?? 1.0;
    if (scale !== 1.0) root.scaling.set(scale, scale, scale);
    const created: AbstractMesh[] = [];
    for (let i = 0; i < variant.meshes.length; i++) {
      const inst = variant.meshes[i]!.createInstance(`pickup-${p.id}-i${i}`);
      inst.parent = root;
      inst.position.set(0, 0, 0);
      this.shadows.addCaster(inst);
      created.push(inst);
    }
    // The root TransformNode itself is what we rotate/dispose. Stash it
    // alongside the instances so consume() and tick() handle both.
    created.push(root as unknown as AbstractMesh);
    this.handles.set(p.id, created);
  }

  consume(id: number) {
    const handles = this.handles.get(id);
    if (!handles) return;
    for (const h of handles) h.dispose();
    this.handles.delete(id);
  }

  tick(dt: number) {
    this.bobPhase = (this.bobPhase + dt * 2) % (Math.PI * 2);
    for (const [, handles] of this.handles) {
      // The root (last entry for model instances, the only entry for spheres)
      // owns the rotation. Sphere or root, both rotate via .rotation.y.
      const root = handles[handles.length - 1]!;
      root.rotation.y += dt * 1.2;
    }
  }
}
