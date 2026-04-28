import type { Scene } from "@babylonjs/core/scene";
import type { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Vector3, Color3, Quaternion } from "@babylonjs/core/Maths/math";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { ParticleSystem } from "@babylonjs/core/Particles/particleSystem";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Color4 } from "@babylonjs/core/Maths/math";
import type { InputManager } from "./InputManager";
import type { Inventory } from "../game/systems/Inventory";
import type { Equipment } from "../game/systems/Equipment";
import type { AlienManager } from "../game/systems/AlienManager";
import type { TerrainRenderer } from "./TerrainRenderer";

const FLARE_TEX_URL = "https://playground.babylonjs.com/textures/flare.png";

const PROJECTILE_SPEED = 36;
const PROJECTILE_LIFETIME = 4.5;
const RANGED_SLEEP_DAMAGE = 28;
const HIT_RADIUS = 1.8;

interface Projectile {
  mesh: Mesh;
  trail: ParticleSystem;
  velocity: Vector3;
  life: number;
}

/**
 * Q throws an equipped sleep dart. Projectile travels in camera-forward,
 * KOs aliens on contact (sleep damage), expires after PROJECTILE_LIFETIME.
 */
export class ProjectileSystem {
  private readonly scene: Scene;
  private readonly camera: ArcRotateCamera;
  private readonly input: InputManager;
  private readonly inv: Inventory;
  private readonly equipment: Equipment;
  private readonly aliens: AlienManager;
  private readonly playerRoot: TransformNode;
  private readonly terrain: TerrainRenderer;
  private readonly active: Projectile[] = [];

  constructor(
    scene: Scene,
    camera: ArcRotateCamera,
    input: InputManager,
    inv: Inventory,
    equipment: Equipment,
    aliens: AlienManager,
    playerRoot: TransformNode,
    terrain: TerrainRenderer,
  ) {
    this.scene = scene;
    this.camera = camera;
    this.input = input;
    this.inv = inv;
    this.equipment = equipment;
    this.aliens = aliens;
    this.playerRoot = playerRoot;
    this.terrain = terrain;
  }

  tick(dt: number, suppressed = false) {
    if (!suppressed && this.input.wasJustPressed("throw")) {
      this.tryThrow();
    }

    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i]!;
      p.life -= dt;
      p.mesh.position.addInPlace(p.velocity.scale(dt));
      // Light drop so darts arc visibly without falling like a stone
      p.velocity.y -= 2.0 * dt;

      // Hit-check vs aliens (sphere overlap)
      let hit = false;
      for (const a of this.aliens.agents) {
        const dx = a.x - p.mesh.position.x;
        const dz = a.z - p.mesh.position.z;
        const dy = (a as { y?: number }).y ?? 0;
        const ay = this.terrain.heightAt(a.x, a.z) + 1.0; // approximate body center
        const dyDelta = ay - p.mesh.position.y;
        const d2 = dx * dx + dz * dz + dyDelta * dyDelta;
        if (d2 < HIT_RADIUS * HIT_RADIUS) {
          this.aliens.applyDamage(a, RANGED_SLEEP_DAMAGE, "sleep");
          hit = true;
          break;
        }
        void dy;
      }

      // Hit ground or expired
      const groundY = this.terrain.heightAt(p.mesh.position.x, p.mesh.position.z);
      if (hit || p.life <= 0 || p.mesh.position.y <= groundY) {
        p.trail.stop();
        // Let the trail particles fade out before disposing the emitter mesh
        setTimeout(() => {
          p.mesh.dispose();
          p.trail.dispose();
        }, 1500);
        this.active.splice(i, 1);
      }
    }
  }

  private tryThrow() {
    const equipped = this.equipment.activeItem();
    if (equipped !== "sleep_dart") return;
    if (!this.inv.has("sleep_dart", 1)) return;
    this.inv.remove("sleep_dart", 1);

    const fwd = this.camera.getDirection(Vector3.Forward());
    fwd.normalize();
    // Tiny upward bias so darts don't immediately scrape ground
    fwd.y += 0.05;
    fwd.normalize();

    const origin = new Vector3(
      this.playerRoot.position.x,
      this.playerRoot.position.y + 1.5,
      this.playerRoot.position.z,
    );

    // Bigger glowing dart so the player can clearly see it fly.
    const mesh = MeshBuilder.CreateCapsule(
      "sleepDart",
      { radius: 0.18, height: 0.7, tessellation: 10 },
      this.scene,
    );
    mesh.position.copyFrom(origin);
    if (!mesh.rotationQuaternion) mesh.rotationQuaternion = Quaternion.Identity();
    Quaternion.FromUnitVectorsToRef(Vector3.Up(), fwd, mesh.rotationQuaternion);
    const mat = new StandardMaterial("dartMat", this.scene);
    mat.emissiveColor = new Color3(0.45, 0.85, 1.0);
    mat.diffuseColor = new Color3(0, 0, 0);
    mat.disableLighting = true;
    mesh.material = mat;

    // Long, bright additive trail so the dart's path is easy to follow.
    const trail = new ParticleSystem("dartTrail", 220, this.scene);
    trail.particleTexture = new Texture(FLARE_TEX_URL, this.scene);
    trail.emitter = mesh;
    trail.minEmitBox = new Vector3(-0.08, -0.08, -0.08);
    trail.maxEmitBox = new Vector3(0.08, 0.08, 0.08);
    trail.color1 = new Color4(0.55, 0.95, 1.0, 1.0);
    trail.color2 = new Color4(0.25, 0.55, 1.0, 0.85);
    trail.colorDead = new Color4(0.05, 0.1, 0.4, 0.0);
    trail.minSize = 0.18;
    trail.maxSize = 0.42;
    trail.minLifeTime = 0.45;
    trail.maxLifeTime = 0.85;
    trail.emitRate = 220;
    trail.blendMode = ParticleSystem.BLENDMODE_ADD;
    trail.minEmitPower = 0;
    trail.maxEmitPower = 0;
    trail.gravity = Vector3.Zero();
    trail.start();

    this.active.push({
      mesh,
      trail,
      velocity: fwd.scale(PROJECTILE_SPEED),
      life: PROJECTILE_LIFETIME,
    });
  }
}
