import type { Scene } from "@babylonjs/core/scene";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
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

/**
 * Renders placed buildings as colored prisms (one per piece) until real
 * .glb assets land. Also exposes a "ghost" mesh for build-mode preview.
 */
export class BuildingRenderer {
  private readonly scene: Scene;
  private readonly registry: BuildingRegistry;
  private readonly shadows: ShadowSystem;
  private readonly meshes = new Map<number, Mesh>();
  private ghostMesh: Mesh | null = null;
  private ghostMat: StandardMaterial | null = null;

  constructor(scene: Scene, registry: BuildingRegistry, shadows: ShadowSystem) {
    this.scene = scene;
    this.registry = registry;
    this.shadows = shadows;
  }

  spawn(b: PlacedBuilding) {
    const def = BUILDINGS[b.buildingId];
    if (!def) return;
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
    this.meshes.set(b.id, mesh);

    if (b.buildingId === "campfire") createCampfireParticles(this.scene, mesh);
  }

  despawn(id: number) {
    const m = this.meshes.get(id);
    if (m) {
      m.dispose();
      this.meshes.delete(id);
    }
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
      if (!this.meshes.has(b.id)) this.spawn(b);
    }
  }
}
