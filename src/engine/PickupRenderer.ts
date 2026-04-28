import type { Scene } from "@babylonjs/core/scene";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { Color3 } from "@babylonjs/core/Maths/math";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
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

/**
 * Renders pickup meshes (small spheres tinted by item type) and animates
 * gentle bobbing. Pickup meshes are bookkept by Pickup id so the engine can
 * dispose of them when consumed.
 */
export class PickupRenderer {
  private readonly scene: Scene;
  private readonly meshes = new Map<number, Mesh>();
  private readonly registry: PickupRegistry;
  private readonly shadows: ShadowSystem;
  private bobPhase = 0;

  constructor(scene: Scene, registry: PickupRegistry, shadows: ShadowSystem) {
    this.scene = scene;
    this.registry = registry;
    this.shadows = shadows;
    this.spawnAll();
  }

  private spawnAll() {
    for (const p of this.registry.pickups) this.spawn(p);
  }

  private spawn(p: Pickup) {
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
    this.meshes.set(p.id, mesh);
  }

  consume(id: number) {
    const mesh = this.meshes.get(id);
    if (mesh) {
      mesh.dispose();
      this.meshes.delete(id);
    }
  }

  tick(dt: number) {
    this.bobPhase = (this.bobPhase + dt * 2) % (Math.PI * 2);
    for (const [id, mesh] of this.meshes) {
      const wave = Math.sin(this.bobPhase + id * 1.7) * 0.08;
      mesh.position.y += (wave - (mesh.metadata?.lastBob ?? 0)) * 0;
      mesh.metadata = { lastBob: wave };
      mesh.rotation.y += dt * 1.2;
      mesh.position.y = mesh.position.y; // no-op to keep simple
    }
  }
}
