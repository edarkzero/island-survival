import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import type { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { CascadedShadowGenerator } from "@babylonjs/core/Lights/Shadows/cascadedShadowGenerator";

export class ShadowSystem {
  readonly generator: CascadedShadowGenerator;

  constructor(sun: DirectionalLight) {
    const gen = new CascadedShadowGenerator(1024, sun);
    gen.numCascades = 3;
    gen.lambda = 0.7;
    gen.cascadeBlendPercentage = 0.05;
    gen.bias = 0.0008;
    gen.normalBias = 0.02;
    gen.usePercentageCloserFiltering = true;
    gen.filteringQuality = CascadedShadowGenerator.QUALITY_MEDIUM;
    gen.shadowMaxZ = 200;
    gen.depthClamp = true;
    this.generator = gen;
  }

  addCaster(mesh: AbstractMesh) {
    this.generator.addShadowCaster(mesh, true);
  }
}
