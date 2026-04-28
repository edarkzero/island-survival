import type { Scene } from "@babylonjs/core/scene";
import { ParticleSystem } from "@babylonjs/core/Particles/particleSystem";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Color4, Vector3 } from "@babylonjs/core/Maths/math";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";

const FLARE_TEX_URL = "https://playground.babylonjs.com/textures/flare.png";

/**
 * Purple sparkle/embers radiating from the alien ship rim.
 */
export function createAlienShipSparkles(scene: Scene, ship: AbstractMesh): ParticleSystem {
  const ps = new ParticleSystem("alienSparkles", 200, scene);
  ps.particleTexture = new Texture(FLARE_TEX_URL, scene);
  ps.emitter = ship;
  ps.minEmitBox = new Vector3(-3.5, 0.5, -3.5);
  ps.maxEmitBox = new Vector3(3.5, 1.0, 3.5);
  ps.color1 = new Color4(0.7, 0.4, 1.0, 1.0);
  ps.color2 = new Color4(0.45, 0.2, 0.95, 0.85);
  ps.colorDead = new Color4(0.2, 0.05, 0.4, 0.0);
  ps.minSize = 0.06;
  ps.maxSize = 0.18;
  ps.minLifeTime = 0.8;
  ps.maxLifeTime = 1.8;
  ps.emitRate = 80;
  ps.blendMode = ParticleSystem.BLENDMODE_ADD;
  ps.gravity = new Vector3(0, 1.5, 0);
  ps.direction1 = new Vector3(-0.4, 1.5, -0.4);
  ps.direction2 = new Vector3(0.4, 2.4, 0.4);
  ps.minAngularSpeed = 0;
  ps.maxAngularSpeed = Math.PI;
  ps.minEmitPower = 0.4;
  ps.maxEmitPower = 1.0;
  ps.updateSpeed = 0.012;
  ps.start();
  return ps;
}

/**
 * Fire + smoke emitting from a placed campfire.
 */
export function createCampfireParticles(scene: Scene, anchor: AbstractMesh): ParticleSystem[] {
  const flame = new ParticleSystem("campfire_flame", 60, scene);
  flame.particleTexture = new Texture(FLARE_TEX_URL, scene);
  flame.emitter = anchor;
  flame.minEmitBox = new Vector3(-0.25, 0.2, -0.25);
  flame.maxEmitBox = new Vector3(0.25, 0.4, 0.25);
  flame.color1 = new Color4(1.0, 0.55, 0.1, 1.0);
  flame.color2 = new Color4(1.0, 0.3, 0.05, 1.0);
  flame.colorDead = new Color4(0.3, 0.1, 0.0, 0.0);
  flame.minSize = 0.18;
  flame.maxSize = 0.35;
  flame.minLifeTime = 0.4;
  flame.maxLifeTime = 0.9;
  flame.emitRate = 80;
  flame.blendMode = ParticleSystem.BLENDMODE_ADD;
  flame.gravity = new Vector3(0, 0.8, 0);
  flame.direction1 = new Vector3(-0.1, 1.5, -0.1);
  flame.direction2 = new Vector3(0.1, 2.2, 0.1);
  flame.minEmitPower = 0.5;
  flame.maxEmitPower = 1.0;
  flame.updateSpeed = 0.012;
  flame.start();

  const smoke = new ParticleSystem("campfire_smoke", 80, scene);
  smoke.particleTexture = new Texture(FLARE_TEX_URL, scene);
  smoke.emitter = anchor;
  smoke.minEmitBox = new Vector3(-0.15, 0.6, -0.15);
  smoke.maxEmitBox = new Vector3(0.15, 0.9, 0.15);
  smoke.color1 = new Color4(0.55, 0.55, 0.55, 0.6);
  smoke.color2 = new Color4(0.35, 0.35, 0.35, 0.5);
  smoke.colorDead = new Color4(0.15, 0.15, 0.15, 0.0);
  smoke.minSize = 0.4;
  smoke.maxSize = 0.95;
  smoke.minLifeTime = 1.6;
  smoke.maxLifeTime = 2.8;
  smoke.emitRate = 25;
  smoke.gravity = new Vector3(0.4, 1.6, 0.0); // wind-drift up + sideways
  smoke.direction1 = new Vector3(-0.2, 1.0, -0.2);
  smoke.direction2 = new Vector3(0.2, 1.5, 0.2);
  smoke.minEmitPower = 0.3;
  smoke.maxEmitPower = 0.6;
  smoke.updateSpeed = 0.012;
  smoke.start();

  return [flame, smoke];
}
