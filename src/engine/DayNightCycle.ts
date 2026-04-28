import "@babylonjs/core/Helpers/sceneHelpers";
import type { Scene } from "@babylonjs/core/scene";
import type { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { Vector3, Color3, Quaternion } from "@babylonjs/core/Maths/math";
import { CubeTexture } from "@babylonjs/core/Materials/Textures/cubeTexture";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";

const DAY_LENGTH_SECONDS = 600; // 10 real-time minutes per in-game day

const ENV_URL = "https://assets.babylonjs.com/environments/environmentSpecular.env";

/**
 * HDRI-based environment + sun animation.
 *
 * Instead of the procedural Preetham SkyMaterial (which produces washed-out
 * colors), this uses an HDR environment cube as both the visible skybox AND
 * the IBL source. The whole scene's PBR materials get image-based lighting
 * for free — a massive visual upgrade for very little code.
 *
 * The sky is rotated as a function of time-of-day so dawn/dusk rim-light
 * directions align with the sun. (For v1 we use one HDRI and tint exposure;
 * a day↔dusk HDRI lerp is a Phase 5 polish item.)
 */
export class DayNightCycle {
  private t = 0.5;
  private readonly scene: Scene;
  private readonly sun: DirectionalLight;
  readonly skyMesh: Mesh | null = null;
  private readonly environment: CubeTexture;

  constructor(scene: Scene, sun: DirectionalLight) {
    this.scene = scene;
    this.sun = sun;

    this.environment = CubeTexture.CreateFromPrefilteredData(ENV_URL, scene);
    this.environment.gammaSpace = false;
    scene.environmentTexture = this.environment;
    scene.environmentIntensity = 1.0;

    const skybox = scene.createDefaultSkybox(this.environment, true, 1500, 0.05);
    if (skybox) this.skyMesh = skybox as Mesh;
  }

  setTime(t: number) {
    this.t = ((t % 1) + 1) % 1;
    this.applyTime();
  }

  tick(dtSeconds: number) {
    this.t = (this.t + dtSeconds / DAY_LENGTH_SECONDS) % 1;
    this.applyTime();
  }

  private applyTime() {
    // 0=midnight, 0.25=sunrise, 0.5=noon, 0.75=sunset.
    const dayPhase = (this.t - 0.25) * Math.PI * 2; // 0 at sunrise, π at sunset
    const sunY = Math.sin(dayPhase);
    const sunX = Math.cos(dayPhase);
    const sunDir = new Vector3(sunX, sunY, 0.25).normalize();
    this.sun.direction = sunDir.scale(-1);

    const dayFactor = Math.max(0, sunY); // 1 at noon, 0 at horizon

    this.sun.intensity = 0.2 + dayFactor * 2.4;

    // Warm sunrise/sunset
    const warmth = Math.max(0, 1 - Math.abs(sunY) * 2.5);
    this.sun.diffuse = new Color3(1.0, 0.96 - warmth * 0.25, 0.86 - warmth * 0.5);

    // Tint fog with horizon color (warm at sunrise/sunset, cool at noon)
    const fogR = 0.55 + warmth * 0.25 + dayFactor * 0.15;
    const fogG = 0.62 + dayFactor * 0.22;
    const fogB = 0.72 + dayFactor * 0.18 - warmth * 0.1;
    this.scene.fogColor = new Color3(fogR, fogG, fogB);

    this.scene.ambientColor = new Color3(
      0.10 + dayFactor * 0.20,
      0.12 + dayFactor * 0.22,
      0.18 + dayFactor * 0.20,
    );

    // Dim the environment at night, brighten at noon.
    this.scene.environmentIntensity = 0.15 + dayFactor * 1.0;

    // Rotate the skybox so the brightest part of the HDRI aligns roughly
    // with our sun direction. The default env HDRI has its sun on +X.
    const skyAngle = Math.atan2(sunDir.z, sunDir.x);
    if (this.scene.environmentTexture && "rotationY" in this.scene.environmentTexture) {
      (this.scene.environmentTexture as CubeTexture).rotationY = skyAngle;
    }
    if (this.skyMesh) {
      if (!this.skyMesh.rotationQuaternion) this.skyMesh.rotationQuaternion = Quaternion.Identity();
      Quaternion.RotationAxisToRef(Vector3.Up(), skyAngle, this.skyMesh.rotationQuaternion);
    }
  }
}
