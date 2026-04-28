import type { Scene } from "@babylonjs/core/scene";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Vector2, Color3 } from "@babylonjs/core/Maths/math";
import { WaterMaterial } from "@babylonjs/materials/water/waterMaterial";

const WATER_TEXTURE_URL =
  "https://playground.babylonjs.com/textures/waterbump.png";

/**
 * Stylized water plane sitting at y=0. Half the screen is water on an island
 * map, so polish here matters disproportionately. Reflects the terrain and
 * skybox; foam comes from the bumpHeight + colorBlendFactor.
 */
export class WaterRenderer {
  readonly mesh;
  private readonly material: WaterMaterial;

  constructor(scene: Scene, terrainMesh: AbstractMesh) {
    this.mesh = MeshBuilder.CreateGround(
      "water",
      { width: 1200, height: 1200, subdivisions: 32 },
      scene,
    );
    this.mesh.position.y = 0.0;
    this.mesh.isPickable = false;

    const water = new WaterMaterial("waterMat", scene, new Vector2(512, 512));
    water.bumpTexture = new Texture(WATER_TEXTURE_URL, scene);
    water.windForce = -10;
    water.waveHeight = 0.32; // bigger swell
    water.bumpHeight = 1.1; // sharper specular highlights = more sparkle
    water.waveLength = 0.22;
    water.waveSpeed = 60;
    water.colorBlendFactor = 0.18; // less reflection blend → more saturated water color
    water.waterColor = new Color3(0.05, 0.42, 0.55); // turquoise lean
    water.windDirection = new Vector2(1, 0.6);
    water.addToRenderList(terrainMesh);

    this.material = water;
    this.mesh.material = water;
  }

  /** Add other meshes (e.g. props near the shore) to be reflected. */
  addReflection(mesh: AbstractMesh) {
    this.material.addToRenderList(mesh);
  }

  tick(_dt: number) {
    // WaterMaterial advances its own time internally; hook reserved for
    // future shore-foam updates that depend on player position.
  }
}
