import "@babylonjs/core/Particles/webgl2ParticleSystem";
import type { Scene } from "@babylonjs/core/scene";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { GPUParticleSystem } from "@babylonjs/core/Particles/gpuParticleSystem";
import { ParticleSystem } from "@babylonjs/core/Particles/particleSystem";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Color3, Color4, Vector3 } from "@babylonjs/core/Maths/math";
import type { SurvivalState } from "../game/systems/SurvivalState";
import type { Inventory } from "../game/systems/Inventory";
import type { Audio } from "./Audio";

const FLARE_TEX_URL = "https://playground.babylonjs.com/textures/flare.png";

const RAIN_AREA = 28; // half-width of the rain box around the player
const DROP_COUNT = 3000;
const CYCLE_DRY_S = 90;
const CYCLE_WET_S = 60;

/**
 * Rain weather: GPU particles falling in a moving box around the player.
 * Cycles dry/wet automatically. While raining and the player carries a
 * water flask, thirst regenerates. Also tints the scene fog grey-blue.
 */
export class WeatherSystem {
  private readonly scene: Scene;
  private readonly playerRoot: TransformNode;
  private readonly survival: SurvivalState;
  private readonly inv: Inventory;
  private readonly audio: Audio;
  private rain: GPUParticleSystem | ParticleSystem | null = null;
  private isRaining = false;
  private cycleSeconds = 0;
  /** Saved fog values so we can restore them when rain stops. */
  private savedFogColor: Color3 | null = null;
  private savedFogDensity = 0;

  constructor(
    scene: Scene,
    playerRoot: TransformNode,
    survival: SurvivalState,
    inv: Inventory,
    audio: Audio,
  ) {
    this.scene = scene;
    this.playerRoot = playerRoot;
    this.survival = survival;
    this.inv = inv;
    this.audio = audio;
  }

  tick(dt: number) {
    this.cycleSeconds += dt;
    const target = this.isRaining ? CYCLE_WET_S : CYCLE_DRY_S;
    if (this.cycleSeconds >= target) {
      this.cycleSeconds = 0;
      this.setRaining(!this.isRaining);
    }

    if (this.isRaining && this.rain) {
      // Move the rain box with the player.
      const px = this.playerRoot.position.x;
      const py = this.playerRoot.position.y;
      const pz = this.playerRoot.position.z;
      this.rain.minEmitBox = new Vector3(-RAIN_AREA, 16, -RAIN_AREA);
      this.rain.maxEmitBox = new Vector3(RAIN_AREA, 22, RAIN_AREA);
      // emitter is a Vector3 reference; updating its components moves the system
      const e = this.rain.emitter as Vector3;
      e.set(px, py, pz);

      // Thirst regen if you're carrying a flask
      if (this.inv.has("water_flask", 1)) {
        this.survival.consume({ thirst: 1.5 * dt });
      }
    }
  }

  private setRaining(on: boolean) {
    this.isRaining = on;
    if (on) {
      if (!this.rain) this.rain = this.createRainSystem();
      this.rain.start();
      // Tint fog grey-blue while raining
      this.savedFogColor = this.scene.fogColor.clone();
      this.savedFogDensity = this.scene.fogDensity;
      this.scene.fogColor = new Color3(0.55, 0.6, 0.65);
      this.scene.fogDensity = 0.012;
    } else {
      this.rain?.stop();
      if (this.savedFogColor) {
        this.scene.fogColor = this.savedFogColor;
        this.scene.fogDensity = this.savedFogDensity;
      }
    }
    this.audio.setRain(on);
  }

  private createRainSystem(): GPUParticleSystem | ParticleSystem {
    // Prefer GPU particles for the volume; fall back to CPU if unsupported.
    const Capable = GPUParticleSystem.IsSupported;
    const sys: GPUParticleSystem | ParticleSystem = Capable
      ? new GPUParticleSystem("rain", { capacity: DROP_COUNT }, this.scene)
      : new ParticleSystem("rain", DROP_COUNT, this.scene);
    sys.particleTexture = new Texture(FLARE_TEX_URL, this.scene);
    sys.emitter = this.playerRoot.position.clone();
    sys.minEmitBox = new Vector3(-RAIN_AREA, 16, -RAIN_AREA);
    sys.maxEmitBox = new Vector3(RAIN_AREA, 22, RAIN_AREA);
    sys.color1 = new Color4(0.7, 0.78, 0.95, 0.7);
    sys.color2 = new Color4(0.55, 0.65, 0.85, 0.55);
    sys.colorDead = new Color4(0.4, 0.5, 0.7, 0);
    sys.minSize = 0.06;
    sys.maxSize = 0.18;
    sys.minLifeTime = 0.9;
    sys.maxLifeTime = 1.5;
    sys.emitRate = 1800;
    sys.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    sys.gravity = new Vector3(0, -38, 0);
    sys.direction1 = new Vector3(-0.4, -1, -0.4);
    sys.direction2 = new Vector3(0.4, -1, 0.4);
    sys.minEmitPower = 0.5;
    sys.maxEmitPower = 1.5;
    return sys;
  }
}
