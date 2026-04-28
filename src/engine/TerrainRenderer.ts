import type { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { Vector3, Color3 } from "@babylonjs/core/Maths/math";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { ShadowSystem } from "./ShadowSystem";
import type { IslandData } from "../game/world/IslandGenerator";
import { colorForCell } from "../game/world/Biome";

const SKIRT_DEPTH = 30; // how far below the lowest terrain the skirt walls extend
const BEDROCK_Y = -28;  // dark plate that catches any "see through" sight lines

/**
 * Builds a Babylon mesh from the engine-agnostic IslandData heightmap.
 * Vertex colors are sampled from the biome map so the terrain shows beach /
 * grass / forest / rocks / snow without needing a splat shader.
 */
export class TerrainRenderer {
  readonly mesh: Mesh;
  private readonly heightmap: Float32Array;
  private readonly biomeMap: Uint8Array;
  private readonly size: number;
  private readonly worldScale: number;

  constructor(scene: Scene, data: IslandData, shadows: ShadowSystem) {
    this.heightmap = data.heightmap;
    this.biomeMap = data.biomeMap;
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
    mesh.useVertexColors = true;

    // Stylized shadeless terrain. Two settings here are load-bearing
    // for the "is the floor transparent?" failure mode that has burned
    // multiple iterations:
    //
    //   1. backFaceCulling = false. The heightmap's index winding (a, c, b)
    //      / (b, c, d) ends up back-facing the camera when viewed from
    //      above in Babylon's left-handed convention, so with culling on
    //      the top of the island disappears and you see straight through
    //      to the bedrock/water below. Disabling culling is the fix that
    //      actually addresses the cause; everything else (PBR tweaks,
    //      water depth, fog tuning) was just decoration over the hole.
    //
    //   2. disableLighting + emissive=(1,1,1). Bright sun + hemi + ACES
    //      tone mapping + exposure 1.30 was pushing the lit floor above
    //      1.0 and clamping it to near-white. With lighting disabled,
    //      vertex colors render at exactly the saturation colorForCell()
    //      authored. Faux directional shade is baked into vertex colors
    //      below so the terrain still reads as 3D.
    const mat = new StandardMaterial("terrainMat", scene);
    mat.diffuseColor = new Color3(0, 0, 0);
    mat.specularColor = new Color3(0, 0, 0);
    mat.emissiveColor = new Color3(1, 1, 1);
    mat.disableLighting = true;
    mat.backFaceCulling = false;
    mesh.material = mat;
    mesh.receiveShadows = false;
    mesh.checkCollisions = false;
    mesh.isPickable = true;

    // Bake a soft directional shade into the vertex colors so the terrain
    // still reads as dimensional 3D rather than a flat texture. Faces
    // pointing toward the sun stay full-bright; faces tilted away dim to
    // ~70%. Survives any post-processing because it's part of the geometry.
    const sunDir = new Vector3(0.5, 1, 0.5).normalize();
    for (let i = 0; i < N * N; i++) {
      const nx = normals[i * 3];
      const ny = normals[i * 3 + 1];
      const nz = normals[i * 3 + 2];
      const ndotl = Math.max(0, nx * sunDir.x + ny * sunDir.y + nz * sunDir.z);
      const shade = 0.7 + 0.3 * ndotl; // 0.7..1.0
      colors[i * 4] *= shade;
      colors[i * 4 + 1] *= shade;
      colors[i * 4 + 2] *= shade;
    }
    mesh.updateVerticesData(VertexBuffer.ColorKind, colors, false, false);

    shadows.addCaster(mesh);
    this.mesh = mesh;

    // Build the SKIRT — vertical walls along the terrain perimeter dropping
    // SKIRT_DEPTH meters down. Closes the mesh so you never see "through"
    // the island into the sky from any angle.
    this.buildSkirt(scene, data, mat);

    // Bedrock plate — a huge dark earth plane below everything. Final
    // safety net for any remaining sight lines past the terrain edge.
    const bedrock = MeshBuilder.CreateGround(
      "bedrock",
      { width: 2400, height: 2400, subdivisions: 1 },
      scene,
    );
    bedrock.position.y = BEDROCK_Y;
    const brockMat = new StandardMaterial("bedrockMat", scene);
    brockMat.diffuseColor = new Color3(0.10, 0.07, 0.05);
    brockMat.specularColor = new Color3(0, 0, 0);
    bedrock.material = brockMat;
    bedrock.isPickable = false;
    bedrock.checkCollisions = false;
  }

  /** Build vertical perimeter walls dropping down from the terrain edge. */
  private buildSkirt(scene: Scene, data: IslandData, sharedMat: StandardMaterial) {
    const N = data.size;
    const half = (N - 1) / 2;
    const cellSize = data.worldScale / N;
    // 4 strips: north (z=0), south (z=N-1), west (x=0), east (x=N-1)
    // Each strip has 2*N vertices and (N-1)*2 triangles.
    const stripCount = 4;
    const verts = new Float32Array(stripCount * N * 2 * 3);
    const cols = new Float32Array(stripCount * N * 2 * 4);
    const idx = new Uint32Array(stripCount * (N - 1) * 6);
    let vp = 0, cp = 0, ip = 0;

    const pushStrip = (cellsAlong: { x: number; z: number }[]) => {
      const baseV = vp / 3;
      for (let k = 0; k < cellsAlong.length; k++) {
        const { x, z } = cellsAlong[k]!;
        const wx = (x - half) * cellSize;
        const wz = (z - half) * cellSize;
        const h = data.heightmap[z * N + x];
        // top vertex at terrain height
        verts[vp++] = wx; verts[vp++] = h; verts[vp++] = wz;
        cols[cp++] = 0.10; cols[cp++] = 0.07; cols[cp++] = 0.05; cols[cp++] = 1;
        // bottom vertex
        verts[vp++] = wx; verts[vp++] = -SKIRT_DEPTH; verts[vp++] = wz;
        cols[cp++] = 0.07; cols[cp++] = 0.05; cols[cp++] = 0.04; cols[cp++] = 1;
      }
      // tris connecting (top_k, bottom_k, top_k+1, bottom_k+1)
      for (let k = 0; k < cellsAlong.length - 1; k++) {
        const t0 = baseV + k * 2;
        const b0 = t0 + 1;
        const t1 = baseV + (k + 1) * 2;
        const b1 = t1 + 1;
        idx[ip++] = t0; idx[ip++] = b0; idx[ip++] = t1;
        idx[ip++] = t1; idx[ip++] = b0; idx[ip++] = b1;
      }
    };

    // Each side strip — note winding order matters so faces point outward
    pushStrip(Array.from({ length: N }, (_, x) => ({ x, z: 0 })));        // top edge (z=0)
    pushStrip(Array.from({ length: N }, (_, x) => ({ x: N - 1 - x, z: N - 1 }))); // bottom edge reversed
    pushStrip(Array.from({ length: N }, (_, z) => ({ x: 0, z: N - 1 - z })));     // west edge reversed
    pushStrip(Array.from({ length: N }, (_, z) => ({ x: N - 1, z })));            // east edge

    const skirt = new Mesh("terrainSkirt", scene);
    const normals = new Float32Array(verts.length);
    VertexData.ComputeNormals(verts, idx, normals);
    const vd = new VertexData();
    vd.positions = verts;
    vd.indices = idx;
    vd.normals = normals;
    vd.colors = cols;
    vd.applyToMesh(skirt, false);
    skirt.useVertexColors = true;
    skirt.material = sharedMat;
    skirt.isPickable = false;
    skirt.checkCollisions = false;
  }

  /** Sample biome id at world coordinates. Returns Ocean (0) when off-map. */
  biomeAt(worldX: number, worldZ: number): number {
    const N = this.size;
    const half = (N - 1) / 2;
    const cellSize = this.worldScale / N;
    const fx = Math.round(worldX / cellSize + half);
    const fz = Math.round(worldZ / cellSize + half);
    if (fx < 0 || fz < 0 || fx >= N || fz >= N) return 0;
    return this.biomeMap[fz * N + fx];
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
        if (h > 1.2 && h > best.h) {
          best = { x: (sx - half) * cellSize, z: (sz - half) * cellSize, h };
        }
      }
      if (best.h > 0) break;
    }
    return new Vector3(best.x, best.h, best.z);
  }
}
