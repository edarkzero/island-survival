import type { Scene } from "@babylonjs/core/scene";
import type { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Vector3, Color3 } from "@babylonjs/core/Maths/math";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { AnimationGroup } from "@babylonjs/core/Animations/animationGroup";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import type { InputManager } from "./InputManager";
import type { TerrainRenderer } from "./TerrainRenderer";
import type { ShadowSystem } from "./ShadowSystem";

const WALK_SPEED = 4.5;
const SPRINT_SPEED = 8.5;
const JUMP_VELOCITY = 6.5;
const GRAVITY = -18;
const PLAYER_HEIGHT = 1.8;
const PLAYER_RADIUS = 0.4;
const TURN_LERP = 60; // essentially instant — character locks to camera-forward
const CHARACTER_URL_ROOT = "/assets/models/characters/";
const CHARACTER_URL_FILE = "player.gltf";
// Quaternius-style rig authored at ~1.8m native height — no down-scaling.
// If the rig is swapped for one at a different native height, retune here
// (HVGirl was 22u → 0.08; pure unit rigs are 1.0).
const CHARACTER_SCALE = 1.0;

export class PlayerController {
  readonly root: TransformNode;
  /**
   * Yaw-only wrapper: HVGirl's animations animate her own root's
   * rotation, which would clobber our facing math. By parenting the
   * character INSIDE this wrapper and rotating the wrapper instead,
   * the animation is free to do what it wants without affecting yaw.
   */
  private yawWrapper: TransformNode | null = null;

  /**
   * Public anchor for held-item / accessory rendering. Returns the
   * yaw-wrapper once the rigged character has loaded, falling back to the
   * player root before then so callers don't need to wait. Held items
   * parented here track player position + facing without picking up the
   * character's animation-driven rotations.
   */
  get holdAnchor(): TransformNode {
    return this.yawWrapper ?? this.root;
  }
  private placeholderMesh: AbstractMesh | null;
  private characterRoot: AbstractMesh | null = null;
  private idleAnim: AnimationGroup | null = null;
  private walkAnim: AnimationGroup | null = null;
  private runAnim: AnimationGroup | null = null;
  private currentAnim: AnimationGroup | null = null;

  private velocityY = 0;
  private grounded = false;
  private facing = 0;
  private moving = false;
  private sprinting = false;

  private readonly scene: Scene;
  private readonly camera: ArcRotateCamera;
  private readonly input: InputManager;
  private readonly terrain: TerrainRenderer;
  private readonly shadows: ShadowSystem;

  constructor(
    scene: Scene,
    camera: ArcRotateCamera,
    input: InputManager,
    terrain: TerrainRenderer,
    shadows: ShadowSystem,
  ) {
    this.scene = scene;
    this.camera = camera;
    this.input = input;
    this.terrain = terrain;
    this.shadows = shadows;
    this.root = new TransformNode("playerRoot", scene);

    // Capsule placeholder shown until the rigged character finishes loading.
    const capsule = MeshBuilder.CreateCapsule(
      "playerVisualPlaceholder",
      { radius: PLAYER_RADIUS, height: PLAYER_HEIGHT, tessellation: 12 },
      scene,
    );
    capsule.parent = this.root;
    capsule.position.y = PLAYER_HEIGHT / 2;
    const mat = new PBRMaterial("playerMatPlaceholder", scene);
    mat.metallic = 0.05;
    mat.roughness = 0.6;
    mat.albedoColor = new Color3(0.78, 0.62, 0.45);
    capsule.material = mat;
    shadows.addCaster(capsule);
    this.placeholderMesh = capsule;
  }

  /**
   * Load the rigged character and its animations. Disposes the placeholder
   * capsule once loaded. Safe to fail — placeholder stays visible.
   */
  async loadCharacter(): Promise<void> {
    try {
      const result = await SceneLoader.ImportMeshAsync(
        "",
        CHARACTER_URL_ROOT,
        CHARACTER_URL_FILE,
        this.scene,
      );
      const character = result.meshes[0];
      character.name = "playerCharacter";

      // Build the wrapper now that we know we have a character to attach.
      const wrapper = new TransformNode("playerYawWrapper", this.scene);
      wrapper.parent = this.root;
      character.parent = wrapper;
      character.position.set(0, 0, 0);
      character.scaling.setAll(CHARACTER_SCALE);
      character.rotation.set(0, 0, 0);
      this.yawWrapper = wrapper;
      this.characterRoot = character;

      for (const m of result.meshes) {
        if (m.getTotalVertices() > 0) this.shadows.addCaster(m);
      }

      const groups = result.animationGroups;
      this.idleAnim = pickAnim(groups, ["Idle"]);
      this.walkAnim = pickAnim(groups, ["Walking", "Walk"]);
      this.runAnim = pickAnim(groups, ["Running", "Run"]);
      groups.forEach((g) => g.stop());

      this.currentAnim = this.idleAnim;
      this.idleAnim?.start(true);

      if (this.placeholderMesh) {
        this.placeholderMesh.dispose();
        this.placeholderMesh = null;
      }

    } catch (err) {
      console.warn("Character glb load failed; staying with placeholder.", err);
    }
  }

  spawnAt(pos: Vector3) {
    this.root.position.copyFrom(pos);
    this.camera.target = new Vector3(pos.x, pos.y + 1.4, pos.z);
  }

  /** True if WASD is producing motion this frame. */
  isMoving(): boolean {
    return this.moving;
  }

  /** True if Shift is held and the player is moving. */
  isSprinting(): boolean {
    return this.sprinting && this.moving;
  }

  tick(dt: number) {
    const i = this.input;

    const camForward = this.camera.getDirection(Vector3.Forward());
    camForward.y = 0;
    if (camForward.lengthSquared() < 1e-4) camForward.set(0, 0, 1);
    camForward.normalize();
    const camRight = new Vector3(camForward.z, 0, -camForward.x);

    let mx = 0;
    let mz = 0;
    if (i.isHeld("moveForward")) mz += 1;
    if (i.isHeld("moveBack")) mz -= 1;
    if (i.isHeld("moveRight")) mx += 1;
    if (i.isHeld("moveLeft")) mx -= 1;

    let move = camForward.scale(mz).add(camRight.scale(mx));
    this.moving = move.lengthSquared() > 1e-4;
    if (this.moving) move = move.normalize();
    this.sprinting = i.isHeld("sprint");

    const speed = this.sprinting ? SPRINT_SPEED : WALK_SPEED;
    const horiz = move.scale(speed * dt);

    if (this.grounded && i.wasJustPressed("jump")) {
      this.velocityY = JUMP_VELOCITY;
      this.grounded = false;
    }
    this.velocityY += GRAVITY * dt;

    const next = this.root.position.add(new Vector3(horiz.x, this.velocityY * dt, horiz.z));
    const groundY = this.terrain.heightAt(next.x, next.z);
    const minY = Math.max(groundY, 0.05);
    if (next.y <= minY) {
      next.y = minY;
      this.velocityY = 0;
      this.grounded = true;
    } else {
      this.grounded = false;
    }

    this.root.position.copyFrom(next);

    // Character ALWAYS faces camera-forward, snapping instantly so orbiting
    // the camera never leaves the character pointing the wrong way.
    const targetYaw = Math.atan2(camForward.x, camForward.z);
    if (this.input.wasJustPressed("resetFacing")) {
      this.facing = targetYaw;
    } else {
      const delta = wrapAngle(targetYaw - this.facing);
      this.facing += delta * Math.min(1, TURN_LERP * dt);
    }
    // Rotate the WRAPPER, not the character — animations on the character
    // would otherwise overwrite rotation.y every frame.
    if (this.yawWrapper) this.yawWrapper.rotation.y = this.facing + Math.PI;
    else if (this.placeholderMesh) this.placeholderMesh.rotation.y = this.facing;

    this.camera.target.copyFrom(
      new Vector3(this.root.position.x, this.root.position.y + 1.4, this.root.position.z),
    );

    this.updateAnimation();
  }

  private updateAnimation() {
    if (!this.characterRoot) return;
    const desired = !this.moving
      ? this.idleAnim
      : this.sprinting
        ? this.runAnim ?? this.walkAnim
        : this.walkAnim;
    if (desired && desired !== this.currentAnim) {
      this.currentAnim?.stop();
      desired.start(true);
      this.currentAnim = desired;
    }
  }
}

function pickAnim(groups: AnimationGroup[], names: string[]): AnimationGroup | null {
  for (const n of names) {
    const found = groups.find((g) => g.name.toLowerCase().includes(n.toLowerCase()));
    if (found) return found;
  }
  return null;
}

function wrapAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
