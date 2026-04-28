import type { Scene } from "@babylonjs/core/scene";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3, Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math";
import type { ShadowSystem } from "./ShadowSystem";
import type { Prop } from "../game/world/PropSpawner";
import { createAlienShipSparkles } from "./Particles";

/**
 * Renders thousands of trees + rocks via thin instances (one draw call each).
 * The crashed alien ship is a one-off detail mesh.
 */
export class PropRenderer {
  constructor(scene: Scene, props: Prop[], shadows: ShadowSystem) {
    const trees = props.filter((p) => p.kind === "tree_pine");
    const rocksSmall = props.filter((p) => p.kind === "rock_small");
    const rocksLarge = props.filter((p) => p.kind === "rock_large");
    const ship = props.find((p) => p.kind === "alien_ship");

    if (trees.length) this.spawnTrees(scene, trees, shadows);
    if (rocksSmall.length) this.spawnRocks(scene, rocksSmall, "small", shadows);
    if (rocksLarge.length) this.spawnRocks(scene, rocksLarge, "large", shadows);
    if (ship) this.spawnAlienShip(scene, ship, shadows);
  }

  private spawnTrees(scene: Scene, trees: Prop[], shadows: ShadowSystem) {
    // Trunk: cylinder
    const trunk = MeshBuilder.CreateCylinder(
      "tree_trunk",
      { height: 3.0, diameterTop: 0.34, diameterBottom: 0.5, tessellation: 8 },
      scene,
    );
    trunk.position.y = 1.5;
    trunk.bakeCurrentTransformIntoVertices();
    const trunkMat = new PBRMaterial("trunkMat", scene);
    trunkMat.albedoColor = new Color3(0.38, 0.24, 0.12); // warm brown bark
    trunkMat.metallic = 0.0;
    trunkMat.roughness = 0.95;
    trunk.material = trunkMat;

    // Canopy: single tall cone for stylized pine
    const canopyMat = new PBRMaterial("canopyMat", scene);
    canopyMat.albedoColor = new Color3(0.16, 0.50, 0.20); // rich pine green
    canopyMat.metallic = 0.0;
    canopyMat.roughness = 0.9;

    const canopy = MeshBuilder.CreateCylinder(
      "tree_canopy",
      { height: 4.2, diameterTop: 0, diameterBottom: 2.8, tessellation: 10 },
      scene,
    );
    canopy.position.y = 4.1;
    canopy.bakeCurrentTransformIntoVertices();
    canopy.material = canopyMat;

    const matrices = new Float32Array(trees.length * 16);
    const tmpQuat = new Quaternion();
    for (let i = 0; i < trees.length; i++) {
      const t = trees[i]!;
      Quaternion.RotationAxisToRef(Vector3.Up(), t.yaw, tmpQuat);
      const m = Matrix.Compose(
        new Vector3(t.scale, t.scale, t.scale),
        tmpQuat,
        new Vector3(t.x, t.y, t.z),
      );
      m.copyToArray(matrices, i * 16);
    }
    trunk.thinInstanceSetBuffer("matrix", matrices, 16, true);
    canopy.thinInstanceSetBuffer("matrix", matrices, 16, true);
    trunk.receiveShadows = true;
    canopy.receiveShadows = true;
    shadows.addCaster(trunk);
    shadows.addCaster(canopy);
  }

  private spawnRocks(scene: Scene, rocks: Prop[], size: "small" | "large", shadows: ShadowSystem) {
    const radius = size === "small" ? 0.45 : 0.95;
    // Low-poly icosphere reads as a stylized boulder. Slightly squashed on Y.
    const base = MeshBuilder.CreateIcoSphere(
      `rock_${size}`,
      { radius, subdivisions: 1, flat: true },
      scene,
    );
    const mat = new PBRMaterial(`rockMat_${size}`, scene);
    // Clean neutral granite gray — large boulders slightly lighter for depth read.
    mat.albedoColor = size === "small" ? new Color3(0.48, 0.48, 0.50) : new Color3(0.58, 0.58, 0.60);
    mat.metallic = 0.0;
    mat.roughness = 0.92;
    base.material = mat;

    const matrices = new Float32Array(rocks.length * 16);
    const tmpQuat = new Quaternion();
    for (let i = 0; i < rocks.length; i++) {
      const r = rocks[i]!;
      Quaternion.RotationAxisToRef(Vector3.Up(), r.yaw, tmpQuat);
      const m = Matrix.Compose(
        // Squash Y so they read as boulders, not floating spheres
        new Vector3(r.scale, r.scale * 0.65, r.scale),
        tmpQuat,
        // Bury 40% into the ground for natural-looking embedding
        new Vector3(r.x, r.y + radius * r.scale * 0.25, r.z),
      );
      m.copyToArray(matrices, i * 16);
    }
    base.thinInstanceSetBuffer("matrix", matrices, 16, true);
    base.receiveShadows = true;
    shadows.addCaster(base);
  }

  private spawnAlienShip(scene: Scene, ship: Prop, shadows: ShadowSystem) {
    // Half-buried oblate disc — one-off landmark.
    const hull = MeshBuilder.CreateSphere(
      "alien_ship",
      { diameter: 8, segments: 24 },
      scene,
    );
    hull.scaling.set(1.6, 0.55, 1.6);
    hull.position.set(ship.x, ship.y + 1.2, ship.z);
    hull.rotation.set(0.18, ship.yaw, 0.12);
    const hullMat = new PBRMaterial("alienHullMat", scene);
    hullMat.albedoColor = new Color3(0.32, 0.34, 0.42);
    hullMat.metallic = 0.65;
    hullMat.roughness = 0.35;
    hullMat.emissiveColor = new Color3(0.05, 0.02, 0.18);
    hull.material = hullMat;
    shadows.addCaster(hull);

    // Glowing rim ring
    const rim = MeshBuilder.CreateTorus(
      "alien_ship_rim",
      { diameter: 11.5, thickness: 0.32, tessellation: 36 },
      scene,
    );
    rim.parent = hull;
    rim.position.y = 0.2;
    const rimMat = new StandardMaterial("alienRimMat", scene);
    rimMat.emissiveColor = new Color3(0.6, 0.25, 1.0);
    rimMat.disableLighting = true;
    rim.material = rimMat;

    // Top antenna spire
    const spire = MeshBuilder.CreateCylinder(
      "alien_ship_spire",
      { height: 4, diameterBottom: 0.3, diameterTop: 0.05, tessellation: 8 },
      scene,
    );
    spire.parent = hull;
    spire.position.y = 1.8;
    const spireMat = new PBRMaterial("alienSpireMat", scene);
    spireMat.albedoColor = new Color3(0.5, 0.5, 0.55);
    spireMat.metallic = 0.8;
    spireMat.roughness = 0.3;
    spire.material = spireMat;
    shadows.addCaster(spire);

    // Atmospheric purple sparkles drifting up out of the ship
    createAlienShipSparkles(scene, hull);
  }
}
