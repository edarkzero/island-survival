import type { Scene } from "@babylonjs/core/scene";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { Color3, Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math";
import { PBRCustomMaterial } from "@babylonjs/materials/custom/pbrCustomMaterial";
import { mulberry32 } from "../game/core/RNG";
import { Biome } from "../game/world/Biome";
import type { IslandData } from "../game/world/IslandGenerator";

const CLUMPS_PER_GRASSLAND_CELL = 0.45;
const BLADE_HEIGHT = 0.6;
const BLADE_WIDTH = 0.18;

/**
 * Stamps thousands of grass clumps across the grassland biome via thin
 * instances — all rendered in a single draw call. Vertex shader applies
 * a wind sway whose amplitude scales with vertex Y, so blade tips move
 * while the base stays planted.
 */
export class GrassRenderer {
  readonly mesh: Mesh;
  readonly count: number;
  private readonly material: PBRCustomMaterial;
  private timer = 0;

  constructor(scene: Scene, data: IslandData, seed = data.seed + 555) {
    const blades: Mesh[] = [];
    for (let a = 0; a < 3; a++) {
      const q = MeshBuilder.CreatePlane(
        `grass_blade_${a}`,
        { width: BLADE_WIDTH, height: BLADE_HEIGHT },
        scene,
      );
      q.position.y = BLADE_HEIGHT / 2;
      q.rotation.y = (a * Math.PI) / 3;
      q.bakeCurrentTransformIntoVertices();
      blades.push(q);
    }
    const merged = Mesh.MergeMeshes(blades, true, true, undefined, false, false)!;
    merged.name = "grass_clump";

    const mat = new PBRCustomMaterial("grassMat", scene);
    mat.albedoColor = new Color3(0.34, 0.66, 0.22);
    mat.metallic = 0.0;
    mat.roughness = 0.9;
    mat.backFaceCulling = false;
    mat.AddUniform("time", "float", null);
    // Vertex-shader wind sway. Phase is taken from local position so the
    // three quads in a clump wave slightly out of step with each other
    // (the world position isn't available at this injection point in PBR
    // shader order, so all clumps share the same gust phase — that's
    // visually fine for a single-direction wind).
    mat.Vertex_Before_PositionUpdated(`
      float bladeT = max(0.0, positionUpdated.y);
      float phase = positionUpdated.x * 0.5 + positionUpdated.z * 0.6;
      float wave = sin(time * 1.6 + phase);
      float gust = sin(time * 0.42) * 0.5 + 0.7;
      positionUpdated.x += wave * bladeT * 0.18 * gust;
      positionUpdated.z += cos(time * 1.05 + phase * 0.7) * bladeT * 0.10;
    `);
    mat.onBindObservable.add(() => {
      mat.getEffect()?.setFloat("time", this.timer);
    });
    merged.material = mat;
    merged.isPickable = false;

    const rand = mulberry32(seed);
    const N = data.size;
    const half = (N - 1) / 2;
    const cellSize = data.worldScale / N;
    const positions: { x: number; y: number; z: number; yaw: number; scale: number }[] = [];

    for (let z = 0; z < N; z++) {
      for (let x = 0; x < N; x++) {
        const i = z * N + x;
        if (data.biomeMap[i] !== Biome.Grassland) continue;
        if (rand() > CLUMPS_PER_GRASSLAND_CELL) continue;
        const wx = (x - half) * cellSize + (rand() - 0.5) * cellSize * 0.9;
        const wz = (z - half) * cellSize + (rand() - 0.5) * cellSize * 0.9;
        const wy = data.heightmap[i];
        const yaw = rand() * Math.PI * 2;
        const scale = 0.7 + rand() * 0.7;
        positions.push({ x: wx, y: wy, z: wz, yaw, scale });
      }
    }

    const matrices = new Float32Array(positions.length * 16);
    const tmpQuat = new Quaternion();
    for (let i = 0; i < positions.length; i++) {
      const p = positions[i]!;
      Quaternion.RotationAxisToRef(Vector3.Up(), p.yaw, tmpQuat);
      const m = Matrix.Compose(
        new Vector3(p.scale, p.scale, p.scale),
        tmpQuat,
        new Vector3(p.x, p.y, p.z),
      );
      m.copyToArray(matrices, i * 16);
    }
    merged.thinInstanceSetBuffer("matrix", matrices, 16, true);

    this.mesh = merged;
    this.count = positions.length;
    this.material = mat;
  }

  tick(dtSeconds: number) {
    this.timer += dtSeconds;
    void this.material;
  }
}
