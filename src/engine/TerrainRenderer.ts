import type { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { Vector3, Color3 } from "@babylonjs/core/Maths/math";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import type { ShadowSystem } from "./ShadowSystem";
import type { IslandData } from "../game/world/IslandGenerator";
import { colorForCell } from "../game/world/Biome";

/**
 * Builds a Babylon mesh from the engine-agnostic IslandData heightmap.
 * Vertex colors are sampled from the biome map so the terrain shows beach /
 * grass / forest / rocks / snow without needing a splat shader.
 */
export class TerrainRenderer {
  readonly mesh: Mesh;
  private readonly heightmap: Float32Array;
  private readonly size: number;
  private readonly worldScale: number;

  constructor(scene: Scene, data: IslandData, shadows: ShadowSystem) {
    this.heightmap = data.heightmap;
    this.size = data.size;
    this.worldScale = data.worldScale;

    const mesh = new Mesh("terrain", scene);
    const N = data.size;
    const positions = new Float32Array(N * N * 3);
    const colors = new Float32Array(N * N * 4);
    const indices = new Uint32Array((N - 1) * (N - 1) * 6);

    const half = (N - 1) / 2;
    let pi = 0;
    let ci = 0;
    for (let z = 0; z < N; z++) {
      for (let x = 0; x < N; x++) {
        const i = z * N + x;
        const wx = (x - half) * (data.worldScale / N);
        const wz = (z - half) * (data.worldScale / N);
        const h = data.heightmap[i];
        positions[pi++] = wx;
        positions[pi++] = h;
        positions[pi++] = wz;

        const c = colorForCell(h, data.biomeMap[i]);
        colors[ci++] = c[0];
        colors[ci++] = c[1];
        colors[ci++] = c[2];
        colors[ci++] = 1.0;
      }
    }

    let ii = 0;
    for (let z = 0; z < N - 1; z++) {
      for (let x = 0; x < N - 1; x++) {
        const a = z * N + x;
        const b = a + 1;
        const c = a + N;
        const d = c + 1;
        indices[ii++] = a;
        indices[ii++] = c;
        indices[ii++] = b;
        indices[ii++] = b;
        indices[ii++] = c;
        indices[ii++] = d;
      }
    }

    const normals = new Float32Array(N * N * 3);
    VertexData.ComputeNormals(positions, indices, normals);

    const vd = new VertexData();
    vd.positions = positions;
    vd.indices = indices;
    vd.normals = normals;
    vd.colors = colors;
    vd.applyToMesh(mesh, false);
    mesh.updateVerticesData(VertexBuffer.ColorKind, colors, false, false);

    const mat = new PBRMaterial("terrainMat", scene);
    mat.metallic = 0.0;
    mat.roughness = 0.95;
    mat.albedoColor = new Color3(1, 1, 1); // tinted by vertex colors automatically when present
    mat.specularIntensity = 0.4;
    mat.directIntensity = 1.1;
    mat.environmentIntensity = 0.6;
    mesh.material = mat;
    mesh.receiveShadows = true;
    mesh.checkCollisions = false;
    mesh.isPickable = true;

    shadows.addCaster(mesh);
    this.mesh = mesh;
  }

  /** Sample terrain height at world coordinates. Returns sea-level (0) when off-map. */
  heightAt(worldX: number, worldZ: number): number {
    const N = this.size;
    const half = (N - 1) / 2;
    const cellSize = this.worldScale / N;
    const fx = worldX / cellSize + half;
    const fz = worldZ / cellSize + half;
    if (fx < 0 || fz < 0 || fx >= N - 1 || fz >= N - 1) return 0;
    const x0 = Math.floor(fx);
    const z0 = Math.floor(fz);
    const tx = fx - x0;
    const tz = fz - z0;
    const h00 = this.heightmap[z0 * N + x0];
    const h10 = this.heightmap[z0 * N + (x0 + 1)];
    const h01 = this.heightmap[(z0 + 1) * N + x0];
    const h11 = this.heightmap[(z0 + 1) * N + (x0 + 1)];
    const h0 = h00 * (1 - tx) + h10 * tx;
    const h1 = h01 * (1 - tx) + h11 * tx;
    return h0 * (1 - tz) + h1 * tz;
  }

  /** Find a flat-ish, above-water spawn near the island center. */
  findSpawnPoint(): Vector3 {
    const N = this.size;
    const half = (N - 1) / 2;
    const cellSize = this.worldScale / N;
    let best = { x: 0, z: 0, h: -1 };
    for (let radius = 4; radius < 24; radius += 2) {
      for (let a = 0; a < 16; a++) {
        const ang = (a / 16) * Math.PI * 2;
        const sx = Math.round(half + Math.cos(ang) * radius);
        const sz = Math.round(half + Math.sin(ang) * radius);
        const h = this.heightmap[sz * N + sx];
        if (h > 0.6 && h > best.h) {
          best = { x: (sx - half) * cellSize, z: (sz - half) * cellSize, h };
        }
      }
      if (best.h > 0) break;
    }
    return new Vector3(best.x, best.h, best.z);
  }
}
