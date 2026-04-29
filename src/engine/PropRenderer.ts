import type { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3, Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math";
import type { ShadowSystem } from "./ShadowSystem";
import type { Prop } from "../game/world/PropSpawner";
import { createAlienShipSparkles } from "./Particles";

interface InstanceGroup {
  meshes: Mesh[]; // every mesh that shares the matrix buffer (e.g. trunk + canopy)
  matrices: Float32Array;
  original: Float32Array; // snapshot for restoring after a hide
  /** Map global propIndex → slot in the per-kind matrices buffer. */
  slotByProp: Map<number, number>;
}

/**
 * Pre-loaded source meshes for prop kinds. Each entry is an array of
 * *variants* — pass multiple loaded assets and PropRenderer will bucket
 * each instance to one variant deterministically (so the forest looks
 * heterogeneous instead of every tree being identical). Pass an empty
 * array (or all-null entries) to fall back to the procedural primitive.
 */
export interface PropModels {
  treeVariants?: (AbstractMesh[] | null)[];
  rockSmallVariants?: (AbstractMesh[] | null)[];
  rockLargeVariants?: (AbstractMesh[] | null)[];
}

/**
 * Renders thousands of trees + rocks via thin instances (one draw call each).
 * The crashed alien ship is a one-off detail mesh.
 *
 * Each instanced prop kind owns an `InstanceGroup` so the harvest system can
 * call `setVisible(propIndex, false)` to hide a single chopped tree by writing
 * a zero-scale matrix into its slot, then restore the original matrix on
 * respawn. Mesh creation is isolated to `buildTreeMeshes` / `buildRockMesh`
 * so swapping primitives for GLB models is a one-function change.
 */
export class PropRenderer {
  // Keys are `${PropKind}_v${variantIndex}` so a single kind can have
  // multiple variant groups; setVisible scans them all.
  private readonly groups = new Map<string, InstanceGroup>();

  constructor(scene: Scene, props: Prop[], shadows: ShadowSystem, models: PropModels = {}) {
    const trees: { prop: Prop; index: number }[] = [];
    const rocksSmall: { prop: Prop; index: number }[] = [];
    const rocksLarge: { prop: Prop; index: number }[] = [];
    let ship: Prop | null = null;
    for (let i = 0; i < props.length; i++) {
      const p = props[i]!;
      if (p.kind === "tree_pine") trees.push({ prop: p, index: i });
      else if (p.kind === "rock_small") rocksSmall.push({ prop: p, index: i });
      else if (p.kind === "rock_large") rocksLarge.push({ prop: p, index: i });
      else if (p.kind === "alien_ship") ship = p;
    }

    if (trees.length) this.spawnTrees(scene, trees, shadows, models.treeVariants);
    if (rocksSmall.length) this.spawnRocks(scene, rocksSmall, "small", shadows, models.rockSmallVariants);
    if (rocksLarge.length) this.spawnRocks(scene, rocksLarge, "large", shadows, models.rockLargeVariants);
    if (ship) this.spawnAlienShip(scene, ship, shadows);
  }

  /**
   * Hide or show a single thin-instance prop. Hiding writes a zero-scale
   * matrix; showing restores the original. Cheap enough at human-paced harvest
   * rates (one buffer upload per state change). No-op for props without an
   * instance group (alien ship).
   */
  setVisible(propIndex: number, visible: boolean) {
    for (const group of this.groups.values()) {
      const slot = group.slotByProp.get(propIndex);
      if (slot === undefined) continue;
      const off = slot * 16;
      if (visible) {
        for (let i = 0; i < 16; i++) group.matrices[off + i] = group.original[off + i]!;
      } else {
        // Zero-scale matrix collapses the instance to a point — invisible
        // and shadow-free.
        for (let i = 0; i < 16; i++) group.matrices[off + i] = 0;
      }
      for (const mesh of group.meshes) {
        mesh.thinInstanceSetBuffer("matrix", group.matrices, 16, false);
      }
      return;
    }
  }

  /**
   * Procedural-primitive trunk + canopy. Used as a fallback when no GLB/OBJ
   * model is supplied. Replace by passing `models.tree` to the constructor.
   */
  private buildTreeMeshes(scene: Scene): Mesh[] {
    const trunk = MeshBuilder.CreateCylinder(
      "tree_trunk",
      { height: 3.0, diameterTop: 0.34, diameterBottom: 0.5, tessellation: 8 },
      scene,
    );
    trunk.position.y = 1.5;
    trunk.bakeCurrentTransformIntoVertices();
    const trunkMat = new PBRMaterial("trunkMat", scene);
    trunkMat.albedoColor = new Color3(0.38, 0.24, 0.12);
    trunkMat.metallic = 0.0;
    trunkMat.roughness = 0.95;
    trunk.material = trunkMat;

    const canopyMat = new PBRMaterial("canopyMat", scene);
    canopyMat.albedoColor = new Color3(0.16, 0.50, 0.20);
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

    return [trunk, canopy];
  }

  /**
   * Procedural-primitive boulder. Fallback when no model is supplied.
   */
  private buildRockMesh(scene: Scene, size: "small" | "large"): Mesh {
    const radius = size === "small" ? 0.45 : 0.95;
    const base = MeshBuilder.CreateIcoSphere(
      `rock_${size}`,
      { radius, subdivisions: 1, flat: true },
      scene,
    );
    const mat = new PBRMaterial(`rockMat_${size}`, scene);
    mat.albedoColor = size === "small" ? new Color3(0.48, 0.48, 0.50) : new Color3(0.58, 0.58, 0.60);
    mat.metallic = 0.0;
    mat.roughness = 0.92;
    base.material = mat;
    return base;
  }

  /**
   * Pluck the geometry-bearing meshes out of an imported asset (the `__root__`
   * TransformNode stays as parent; the actual geometry is in its children).
   * Hides the source root so the model isn't drawn at the origin.
   */
  private extractInstanceMeshes(loaded: AbstractMesh[], shadows: ShadowSystem, idTag: string): Mesh[] {
    const out: Mesh[] = [];
    for (const m of loaded) {
      if (!(m instanceof Mesh)) continue;
      if (m.getTotalVertices() === 0) continue;
      // Detach from parent so its world matrix doesn't carry over to instances.
      m.parent = null;
      m.position.set(0, 0, 0);
      m.rotation.set(0, 0, 0);
      m.scaling.set(1, 1, 1);
      m.name = `${idTag}_${out.length}`;
      m.receiveShadows = true;
      shadows.addCaster(m);
      out.push(m);
    }
    return out;
  }

  /**
   * Filter a variants list to the ones that loaded successfully. Returns
   * null if no variants are available (caller falls back to procedural).
   */
  private validVariants(variants: (AbstractMesh[] | null)[] | undefined): AbstractMesh[][] | null {
    if (!variants || variants.length === 0) return null;
    const v = variants.filter((m): m is AbstractMesh[] => Array.isArray(m) && m.length > 0);
    return v.length > 0 ? v : null;
  }

  /**
   * Build one InstanceGroup per variant, deterministically bucketing each
   * prop instance to a variant via `propIndex % variants.length`. This keeps
   * the assignment stable across reloads (same seed = same forest layout)
   * while giving the world variety.
   */
  private spawnInstancedVariants(
    items: { prop: Prop; index: number }[],
    variantMeshSets: Mesh[][],
    keyPrefix: string,
    composeMatrix: (p: Prop) => Matrix,
  ) {
    const numVariants = variantMeshSets.length;
    // Bucket items by variant
    const buckets: { prop: Prop; index: number }[][] = Array.from({ length: numVariants }, () => []);
    for (const it of items) {
      buckets[it.index % numVariants]!.push(it);
    }
    for (let v = 0; v < numVariants; v++) {
      const bucket = buckets[v]!;
      if (bucket.length === 0) continue;
      const meshes = variantMeshSets[v]!;
      const matrices = new Float32Array(bucket.length * 16);
      const slotByProp = new Map<number, number>();
      for (let i = 0; i < bucket.length; i++) {
        const m = composeMatrix(bucket[i]!.prop);
        m.copyToArray(matrices, i * 16);
        slotByProp.set(bucket[i]!.index, i);
      }
      for (const mesh of meshes) {
        mesh.thinInstanceSetBuffer("matrix", matrices, 16, false);
      }
      this.groups.set(`${keyPrefix}_v${v}`, {
        meshes,
        matrices,
        original: new Float32Array(matrices),
        slotByProp,
      });
    }
  }

  private spawnTrees(
    scene: Scene,
    trees: { prop: Prop; index: number }[],
    shadows: ShadowSystem,
    variants: (AbstractMesh[] | null)[] | undefined,
  ) {
    const valid = this.validVariants(variants);
    const tmpQuat = new Quaternion();
    const composeMatrix = (t: Prop): Matrix => {
      Quaternion.RotationAxisToRef(Vector3.Up(), t.yaw, tmpQuat);
      return Matrix.Compose(
        new Vector3(t.scale, t.scale, t.scale),
        tmpQuat,
        new Vector3(t.x, t.y, t.z),
      );
    };

    if (valid) {
      const variantMeshSets = valid.map((loaded, v) =>
        this.extractInstanceMeshes(loaded, shadows, `tree_pine_v${v}`),
      ).filter((s) => s.length > 0);
      if (variantMeshSets.length > 0) {
        this.spawnInstancedVariants(trees, variantMeshSets, "tree_pine", composeMatrix);
        return;
      }
    }
    // Fallback: procedural primitives, single variant.
    const meshes = this.buildTreeMeshes(scene);
    for (const m of meshes) {
      m.receiveShadows = true;
      shadows.addCaster(m);
    }
    this.spawnInstancedVariants(trees, [meshes], "tree_pine", composeMatrix);
  }

  private spawnRocks(
    scene: Scene,
    rocks: { prop: Prop; index: number }[],
    size: "small" | "large",
    shadows: ShadowSystem,
    variants: (AbstractMesh[] | null)[] | undefined,
  ) {
    const valid = this.validVariants(variants);
    const radius = size === "small" ? 0.45 : 0.95;
    const tmpQuat = new Quaternion();
    const usingLoaded = !!valid;
    const composeMatrix = (r: Prop): Matrix => {
      Quaternion.RotationAxisToRef(Vector3.Up(), r.yaw, tmpQuat);
      const yScale = usingLoaded ? r.scale : r.scale * 0.65;
      const yOffset = usingLoaded ? 0 : radius * r.scale * 0.25;
      return Matrix.Compose(
        new Vector3(r.scale, yScale, r.scale),
        tmpQuat,
        new Vector3(r.x, r.y + yOffset, r.z),
      );
    };

    const keyPrefix = `rock_${size}`;
    if (valid) {
      const variantMeshSets = valid.map((loaded, v) =>
        this.extractInstanceMeshes(loaded, shadows, `${keyPrefix}_v${v}`),
      ).filter((s) => s.length > 0);
      if (variantMeshSets.length > 0) {
        this.spawnInstancedVariants(rocks, variantMeshSets, keyPrefix, composeMatrix);
        return;
      }
    }
    const meshes = [this.buildRockMesh(scene, size)];
    for (const m of meshes) {
      m.receiveShadows = true;
      shadows.addCaster(m);
    }
    this.spawnInstancedVariants(rocks, [meshes], keyPrefix, composeMatrix);
  }

  private spawnAlienShip(scene: Scene, ship: Prop, shadows: ShadowSystem) {
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

    createAlienShipSparkles(scene, hull);
  }
}
