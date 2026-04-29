import type { Scene } from "@babylonjs/core/scene";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { ShadowSystem } from "./ShadowSystem";
import type { BuildingRegistry, PlacedBuilding } from "../game/systems/Building";
import { BUILDINGS } from "../game/data/buildings";
import { createCampfireParticles } from "./Particles";

const COLORS: Record<string, [number, number, number]> = {
  foundation: [0.55, 0.45, 0.3],
  wall: [0.6, 0.5, 0.35],
  roof: [0.45, 0.32, 0.22],
  campfire: [0.32, 0.18, 0.1],
  workbench: [0.7, 0.55, 0.35],
  forge: [0.4, 0.4, 0.42],
};

// Per-building uniform scale for model-backed renders. Quaternius packs ship
// at varied real-world scales — adjust here when a placed structure reads
// the wrong size relative to the player. Default = 1.0.
const MODEL_SCALES: Record<string, number> = {};

/**
 * One loaded building model — the geometry-bearing meshes ready to be
 * sources for `createInstance`. Single-variant for now (one Bonfire), but
 * structured the same as `PickupModelVariant` so future per-tier variants
 * (e.g. tier-2 forge) drop in cleanly.
 */
export interface BuildingModelVariant {
  meshes: Mesh[];
}
export type BuildingModels = Map<string, BuildingModelVariant>;

/**
 * Renders placed buildings — real models when a `buildingId` has a variant
 * registered, colored prism fallback otherwise. The build-mode ghost stays
 * a colored box (green/red emissive) regardless: the AABB is the actual
 * placement footprint and the color feedback matters more than mesh shape.
 */
export class BuildingRenderer {
  private readonly scene: Scene;
  private readonly registry: BuildingRegistry;
  private readonly shadows: ShadowSystem;
  private readonly models: BuildingModels;
  /** All disposable nodes per placed building. Root TransformNode is last. */
  private readonly handles = new Map<number, AbstractMesh[]>();
  private ghostMesh: Mesh | null = null;
  private ghostMat: StandardMaterial | null = null;

  constructor(
    scene: Scene,
    registry: BuildingRegistry,
    shadows: ShadowSystem,
    models: BuildingModels = new Map(),
  ) {
    this.scene = scene;
    this.registry = registry;
    this.shadows = shadows;
    this.models = models;
  }

  spawn(b: PlacedBuilding) {
    const def = BUILDINGS[b.buildingId];
    if (!def) return;
    const variant = this.models.get(b.buildingId);
    if (variant) {
      this.spawnModelInstance(b, variant);
    } else {
      this.spawnBox(b);
    }
  }

  /** Procedural-box fallback (legacy look). */
  private spawnBox(b: PlacedBuilding) {
    const def = BUILDINGS[b.buildingId]!;
    const mesh = MeshBuilder.CreateBox(
      `building-${b.id}-${b.buildingId}`,
      { width: def.size.x, height: def.size.y, depth: def.size.z },
      this.scene,
    );
    mesh.position.set(b.x, b.y + def.size.y / 2, b.z);
    mesh.rotation.y = b.yaw;
    const mat = new PBRMaterial(`buildingMat-${b.id}`, this.scene);
    const c = COLORS[b.buildingId] ?? [0.7, 0.7, 0.7];
    mat.albedoColor = new Color3(c[0], c[1], c[2]);
    mat.metallic = 0.0;
    mat.roughness = 0.85;
    mesh.material = mat;
    this.shadows.addCaster(mesh);
    mesh.receiveShadows = true;
    this.handles.set(b.id, [mesh]);

    if (b.buildingId === "campfire") createCampfireParticles(this.scene, mesh);
  }

  /**
   * Instance the registered model under a parent TransformNode placed at the
   * building's footprint. For campfires, attach a child anchor at the box-
   * center height so the existing flame/smoke particle emit boxes (authored
   * around the box anchor) keep the same absolute world heights — flame near
   * ground, smoke a meter up.
   */
  private spawnModelInstance(b: PlacedBuilding, variant: BuildingModelVariant) {
    const def = BUILDINGS[b.buildingId]!;
    const root = new TransformNode(`building-${b.id}-${b.buildingId}-root`, this.scene);
    root.position.set(b.x, b.y, b.z);
    root.rotation.y = b.yaw;
    const scale = MODEL_SCALES[b.buildingId] ?? 1.0;
    if (scale !== 1.0) root.scaling.set(scale, scale, scale);

    const created: AbstractMesh[] = [];
    for (let i = 0; i < variant.meshes.length; i++) {
      const inst = variant.meshes[i]!.createInstance(`building-${b.id}-i${i}`);
      inst.parent = root;
      inst.position.set(0, 0, 0);
      this.shadows.addCaster(inst);
      inst.receiveShadows = true;
      created.push(inst);
    }

    if (b.buildingId === "campfire") {
      // Particle emit boxes were authored relative to the legacy box anchor
      // (box center = b.y + size.y/2). Match that by anchoring particles at
      // the same absolute height under the model root.
      const flameAnchor = MeshBuilder.CreateBox(
        `building-${b.id}-flameAnchor`,
        { size: 0.001 },
        this.scene,
      );
      flameAnchor.parent = root;
      flameAnchor.position.set(0, def.size.y / 2, 0);
      flameAnchor.isVisible = false;
      flameAnchor.isPickable = false;
      createCampfireParticles(this.scene, flameAnchor);
      created.push(flameAnchor);
    }

    // Stash the root last so despawn iterates instances → root cleanly.
    created.push(root as unknown as AbstractMesh);
    this.handles.set(b.id, created);
  }

  despawn(id: number) {
    const handles = this.handles.get(id);
    if (!handles) return;
    for (const h of handles) h.dispose();
    this.handles.delete(id);
  }

  /** Show / update the build-mode ghost mesh. */
  showGhost(buildingId: string, x: number, y: number, z: number, yaw: number, valid: boolean) {
    const def = BUILDINGS[buildingId];
    if (!def) return;
    if (this.ghostMesh && this.ghostMesh.metadata?.kind !== buildingId) {
      this.ghostMesh.dispose();
      this.ghostMesh = null;
    }
    if (!this.ghostMesh) {
      this.ghostMesh = MeshBuilder.CreateBox(
        "buildGhost",
        { width: def.size.x, height: def.size.y, depth: def.size.z },
        this.scene,
      );
      this.ghostMesh.metadata = { kind: buildingId };
      this.ghostMesh.isPickable = false;
      const m = new StandardMaterial("ghostMat", this.scene);
      m.alpha = 0.45;
      m.disableLighting = true;
      this.ghostMat = m;
      this.ghostMesh.material = m;
    }
    if (this.ghostMat) {
      this.ghostMat.emissiveColor = valid ? new Color3(0.4, 0.95, 0.4) : new Color3(1, 0.3, 0.3);
    }
    this.ghostMesh.position.set(x, y + def.size.y / 2, z);
    this.ghostMesh.rotation.y = yaw;
    this.ghostMesh.setEnabled(true);
  }

  hideGhost() {
    if (this.ghostMesh) this.ghostMesh.setEnabled(false);
  }

  /** Spawn meshes for any registry entries that don't have one yet. */
  syncFromRegistry() {
    for (const b of this.registry.placed) {
      if (!this.handles.has(b.id)) this.spawn(b);
    }
  }
}
