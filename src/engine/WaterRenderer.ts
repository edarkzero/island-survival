import type { Scene } from "@babylonjs/core/scene";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Vector2, Vector3, Color3, Color4 } from "@babylonjs/core/Maths/math";
import { ParticleSystem } from "@babylonjs/core/Particles/particleSystem";
import { WaterMaterial } from "@babylonjs/materials/water/waterMaterial";
import type { IslandData } from "../game/world/IslandGenerator";

const WATER_TEXTURE_URL =
  "https://playground.babylonjs.com/textures/waterbump.png";
const FOAM_TEX_URL = "https://playground.babylonjs.com/textures/flare.png";

const WATER_Y = -2.5;
const FOAM_Y = -2.05; // sits just above the water plane so wisps read above the surface

/**
 * Border ocean ringing the island. Sits well below land so the cliff stands
 * proud above the waterline; calm waves and saturated blue read as a real
 * ocean rather than a flooded valley.
 *
 * Shore foam: a particle ring driven from the actual coastline (heightmap
 * cells where land meets water), so the wisps follow the noisy shoreline
 * instead of a perfect circle.
 */
export class WaterRenderer {
  readonly mesh;
  private readonly material: WaterMaterial;

  constructor(scene: Scene, data: IslandData) {
    this.mesh = MeshBuilder.CreateGround(
      "water",
      { width: 800, height: 800, subdivisions: 24 },
      scene,
    );
    // Sit at the underwater shelf depth so the cliff face above (land base
    // at y=1.2) is a tall, clearly visible bank — never confuses with land.
    this.mesh.position.y = WATER_Y;
    this.mesh.isPickable = false;

    const water = new WaterMaterial("waterMat", scene, new Vector2(512, 512));
    water.bumpTexture = new Texture(WATER_TEXTURE_URL, scene);
    water.windForce = -3;
    water.waveHeight = 0.05;
    water.bumpHeight = 0.15;
    water.waveLength = 0.3;
    water.waveSpeed = 18;
    // Saturated true ocean blue, opaque enough to never read as transparent.
    water.colorBlendFactor = 0.1;
    water.waterColor = new Color3(0.06, 0.30, 0.62);
    water.windDirection = new Vector2(1, 0.6);
    // Intentionally NOT adding the terrain to the water reflection list.
    // Reflecting land into the water surface created visual confusion at
    // the shoreline; a sky-only reflection reads as a cleaner ocean.

    this.material = water;
    this.mesh.material = water;

    this.buildShoreFoam(scene, data);
  }

  /** Add other meshes (e.g. props near the shore) to be reflected. */
  addReflection(mesh: AbstractMesh) {
    this.material.addToRenderList(mesh);
  }

  tick(_dt: number) {
    // WaterMaterial and the foam ParticleSystem advance their own time.
  }

  /**
   * Walk the heightmap, collect outer-rim land cells that border water
   * (4-neighbor), and drive a particle system that emits white foam wisps
   * just above the water surface at those positions. The radial filter
   * excludes interior noise-puddles (which are also technically land/water
   * borders) so foam only appears on the actual coastline.
   */
  private buildShoreFoam(scene: Scene, data: IslandData): ParticleSystem {
    const N = data.size;
    const half = (N - 1) / 2;
    const cellSize = data.worldScale / N;

    // Flood-fill from a corner to mark which water cells are part of the
    // outer ocean. Inland puddles share the SHELF_FLOOR height but are NOT
    // connected to the ocean — without this, they emit "shore" foam too.
    const isOcean = new Uint8Array(N * N);
    const stack: number[] = [];
    if (data.heightmap[0] <= 0) {
      stack.push(0);
      isOcean[0] = 1;
    }
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % N;
      const z = (i / N) | 0;
      const tryPush = (j: number) => {
        if (isOcean[j]) return;
        if (data.heightmap[j] > 0) return;
        isOcean[j] = 1;
        stack.push(j);
      };
      if (x > 0) tryPush(i - 1);
      if (x < N - 1) tryPush(i + 1);
      if (z > 0) tryPush(i - N);
      if (z < N - 1) tryPush(i + N);
    }

    const cellsX: number[] = [];
    const cellsZ: number[] = [];
    for (let z = 1; z < N - 1; z++) {
      for (let x = 1; x < N - 1; x++) {
        const h = data.heightmap[z * N + x];
        if (h <= 0) continue; // not land
        const oN = isOcean[(z - 1) * N + x];
        const oS = isOcean[(z + 1) * N + x];
        const oE = isOcean[z * N + (x + 1)];
        const oW = isOcean[z * N + (x - 1)];
        let dirX = 0;
        let dirZ = 0;
        if (oE) dirX += 1;
        if (oW) dirX -= 1;
        if (oS) dirZ += 1;
        if (oN) dirZ -= 1;
        if (dirX === 0 && dirZ === 0) continue;
        // Push the emission point slightly into the water so foam sits on
        // the surf, not buried in the cliff face.
        const len = Math.hypot(dirX, dirZ) || 1;
        const offset = cellSize * 0.6;
        cellsX.push((x - half) * cellSize + (dirX / len) * offset);
        cellsZ.push((z - half) * cellSize + (dirZ / len) * offset);
      }
    }

    const ps = new ParticleSystem("shoreFoam", 900, scene);
    ps.particleTexture = new Texture(FOAM_TEX_URL, scene);
    ps.emitter = this.mesh;
    ps.color1 = new Color4(1.0, 1.0, 1.0, 0.9);
    ps.color2 = new Color4(0.92, 0.96, 1.0, 0.75);
    ps.colorDead = new Color4(0.85, 0.95, 1.0, 0.0);
    ps.minSize = 0.9;
    ps.maxSize = 1.8;
    ps.minLifeTime = 1.4;
    ps.maxLifeTime = 2.4;
    ps.emitRate = 380;
    ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    ps.gravity = new Vector3(0, -0.05, 0);
    ps.minEmitPower = 0.05;
    ps.maxEmitPower = 0.2;
    ps.minAngularSpeed = -0.6;
    ps.maxAngularSpeed = 0.6;
    ps.updateSpeed = 0.012;

    if (cellsX.length === 0) {
      return ps;
    }

    ps.startPositionFunction = (_wm, position) => {
      const k = (Math.random() * cellsX.length) | 0;
      position.x = cellsX[k]! + (Math.random() - 0.5) * cellSize * 1.4;
      position.y = FOAM_Y;
      position.z = cellsZ[k]! + (Math.random() - 0.5) * cellSize * 1.4;
    };
    ps.startDirectionFunction = (_wm, direction) => {
      direction.x = (Math.random() - 0.5) * 0.4;
      direction.y = 0.12 + Math.random() * 0.18;
      direction.z = (Math.random() - 0.5) * 0.4;
    };

    ps.start();
    return ps;
  }
}
