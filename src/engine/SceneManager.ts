// Side-effect: registers AbstractEngine.AudioEngineFactory so the legacy
// AudioEngine is constructed below when `audioEngine: true` is passed to
// the Engine constructor. Import must run before `new Engine(...)`.
import "@babylonjs/core/Audio/audioEngine";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Vector3, Color3, Color4 } from "@babylonjs/core/Maths/math";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";

export class SceneManager {
  readonly engine: Engine;
  readonly scene: Scene;
  readonly camera: ArcRotateCamera;
  readonly sun: DirectionalLight;
  readonly hemi: HemisphericLight;

  constructor(canvas: HTMLCanvasElement) {
    this.engine = new Engine(canvas, true, {
      preserveDrawingBuffer: false,
      stencil: true,
      antialias: true,
      adaptToDeviceRatio: true,
      audioEngine: true,
    });

    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.55, 0.78, 0.92, 1);
    this.scene.ambientColor = new Color3(0.25, 0.28, 0.32);
    this.scene.fogMode = Scene.FOGMODE_EXP2;
    this.scene.fogDensity = 0.004;
    this.scene.fogColor = new Color3(0.62, 0.78, 0.88);

    this.camera = new ArcRotateCamera(
      "playerCam",
      -Math.PI / 2,
      Math.PI / 2.6,
      11,
      new Vector3(0, 1.6, 0),
      this.scene,
    );
    this.camera.lowerRadiusLimit = 4;
    this.camera.upperRadiusLimit = 22;
    this.camera.lowerBetaLimit = 0.25;
    this.camera.upperBetaLimit = Math.PI / 2 - 0.05;
    this.camera.wheelPrecision = 12;
    this.camera.minZ = 0.1;
    this.camera.maxZ = 2000;
    this.camera.fov = 0.95;
    this.camera.attachControl(canvas, true);

    this.hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), this.scene);
    this.hemi.intensity = 0.35;
    this.hemi.diffuse = new Color3(0.85, 0.92, 1);
    this.hemi.groundColor = new Color3(0.32, 0.30, 0.26);

    this.sun = new DirectionalLight("sun", new Vector3(-0.5, -1, -0.5).normalize(), this.scene);
    this.sun.intensity = 2.2;
    this.sun.diffuse = new Color3(1, 0.96, 0.86);
    this.sun.specular = new Color3(1, 0.95, 0.82);
    this.sun.position = new Vector3(120, 200, 120);
    this.sun.shadowMinZ = 1;
    this.sun.shadowMaxZ = 220;
  }
}
