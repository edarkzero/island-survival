import type { Scene } from "@babylonjs/core/scene";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { Color3 } from "@babylonjs/core/Maths/math";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { Material } from "@babylonjs/core/Materials/material";
import type { AssetContainer } from "@babylonjs/core/assetContainer";
import type { AnimationGroup } from "@babylonjs/core/Animations/animationGroup";
import type { ShadowSystem } from "./ShadowSystem";
import type { AlienAgent, AlienManager } from "../game/systems/AlienManager";
import { AlienState } from "../game/data/aliens";
import type { TerrainRenderer } from "./TerrainRenderer";

const COLORS: Record<string, [number, number, number]> = {
  scrunkler: [0.35, 0.78, 0.72], // teal — peaceful
  glarn: [0.85, 0.42, 0.22],     // orange-red — hostile
  vex: [0.55, 0.32, 0.78],       // purple — elite
};

/** Per-defId uniform scale for model-backed renders. Quaternius Platformer
 *  Pack aliens ship at ~3m native height; scaling to player-relative size. */
const MODEL_SCALES: Record<string, number> = {
  scrunkler: 0.55, // peaceful → smaller (~1.6m)
  glarn: 0.65,     // mid-tier (~2.0m)
  vex: 0.78,       // elite tank (~2.4m)
};

/** Per-defId vertical offset, used when a rig's origin isn't at the feet. */
const MODEL_Y_OFFSETS: Record<string, number> = {};

/** Map<defId, AssetContainer> — one container per alien archetype. */
export type AlienModels = Map<string, AssetContainer>;

interface AlienVisual {
  agent: AlienAgent;
  root: TransformNode;
  /** Procedural fallback: capsule body + sphere head share this material. */
  bodyMat: PBRMaterial | null;
  /** Model-backed: instantiated mesh roots from the AssetContainer. */
  modelRoots: AbstractMesh[];
  /** Model-backed: cloned animation groups (one set per visual). */
  animations: AnimationGroup[];
  currentAnim: AnimationGroup | null;
  /** Model-backed: every cloned material on this visual (so state-driven
   *  emissive recolors hit them all in sync). */
  modelMats: Material[];
  /** The base-state emissive (defId tint) we restore to when leaving a
   *  state-specific glow like hostile/friendly. */
  baseEmissive: Color3;
}

/**
 * Renders aliens with rigged GLB models when an `AlienDef` has a
 * registered `AssetContainer`, falling back to the legacy capsule + head
 * primitives otherwise. Each agent gets its own instantiated copy of the
 * model so animations + per-agent rotations stay independent.
 *
 * Animation switching is state-driven: KnockedOut → first matching clip in
 * `[KnockedOut, Sleep, Idle]`; moving (state Curious/Hostile/Friendly with
 * non-zero displacement) → `[Walk, Walking, Idle]`; otherwise `[Idle]`.
 * Missing clips degrade gracefully — if the rig has no Walk clip, the
 * character just keeps idling, which is preferable to a hard error.
 */
export class AlienRenderer {
  private readonly scene: Scene;
  private readonly manager: AlienManager;
  private readonly terrain: TerrainRenderer;
  private readonly shadows: ShadowSystem;
  private readonly models: AlienModels;
  private readonly visuals = new Map<number, AlienVisual>();
  /** Per-agent previous (x,z) so we can detect motion → walk anim. */
  private readonly lastPos = new Map<number, { x: number; z: number }>();

  constructor(
    scene: Scene,
    manager: AlienManager,
    terrain: TerrainRenderer,
    shadows: ShadowSystem,
    models: AlienModels = new Map(),
  ) {
    this.scene = scene;
    this.manager = manager;
    this.terrain = terrain;
    this.shadows = shadows;
    this.models = models;
  }

  syncFromManager() {
    for (const a of this.manager.agents) {
      if (!this.visuals.has(a.id)) this.spawnVisual(a);
    }
    for (const [id, v] of this.visuals) {
      if (!this.manager.agents.includes(v.agent)) {
        for (const anim of v.animations) anim.dispose();
        v.root.dispose();
        this.visuals.delete(id);
        this.lastPos.delete(id);
      }
    }
  }

  private spawnVisual(agent: AlienAgent) {
    const root = new TransformNode(`alien-${agent.id}-root`, this.scene);
    const container = this.models.get(agent.defId);
    if (container) {
      this.spawnModel(agent, root, container);
    } else {
      this.spawnProcedural(agent, root);
    }
  }

  /** Capsule body + sphere head — original behavior, used when no model. */
  private spawnProcedural(agent: AlienAgent, root: TransformNode) {
    const body = MeshBuilder.CreateCapsule(
      `alien-${agent.id}-body`,
      { radius: 0.35, height: 1.5, tessellation: 10 },
      this.scene,
    );
    body.parent = root;
    body.position.y = 0.85;
    const head = MeshBuilder.CreateSphere(
      `alien-${agent.id}-head`,
      { diameter: 0.55, segments: 10 },
      this.scene,
    );
    head.parent = root;
    head.position.y = 1.85;

    const c = COLORS[agent.defId] ?? [0.6, 0.6, 0.6];
    const bodyMat = new PBRMaterial(`alienMat-${agent.id}`, this.scene);
    bodyMat.albedoColor = new Color3(c[0], c[1], c[2]);
    bodyMat.emissiveColor = new Color3(c[0] * 0.18, c[1] * 0.18, c[2] * 0.18);
    bodyMat.metallic = 0.0;
    bodyMat.roughness = 0.55;
    body.material = bodyMat;
    head.material = bodyMat;

    this.shadows.addCaster(body);
    this.shadows.addCaster(head);

    this.visuals.set(agent.id, {
      agent, root, bodyMat,
      modelRoots: [], animations: [], currentAnim: null,
      modelMats: [], baseEmissive: new Color3(c[0] * 0.18, c[1] * 0.18, c[2] * 0.18),
    });
  }

  /**
   * Spawn an instantiated copy of the registered AssetContainer. Uses
   * `instantiateModelsToScene` so each agent gets its own skeleton and
   * animation groups (independent from siblings).
   */
  private spawnModel(agent: AlienAgent, root: TransformNode, container: AssetContainer) {
    // cloneMaterials=true so each agent gets its own material instances —
    // required for per-defId emissive tinting + state-driven recolor below
    // without bleeding back into siblings or the source AssetContainer.
    const inst = container.instantiateModelsToScene(
      (sourceName) => `alien-${agent.id}-${sourceName}`,
      true,
    );

    const scale = MODEL_SCALES[agent.defId] ?? 1.0;
    const yOff = MODEL_Y_OFFSETS[agent.defId] ?? 0;

    for (const node of inst.rootNodes) {
      const tn = node as TransformNode;
      tn.parent = root;
      if (scale !== 1.0) tn.scaling.setAll(scale);
      if (yOff !== 0) tn.position.y += yOff;
    }

    // Cast shadows + collect this instance's materials so we can drive the
    // emissive (defId tint + state-driven hostile/friendly/KO glow).
    const matSet = new Set<Material>();
    for (const node of inst.rootNodes) {
      const tn = node as TransformNode;
      const meshes = tn.getChildMeshes ? tn.getChildMeshes(false) : [];
      for (const m of meshes) {
        const mesh = m as Mesh;
        if (mesh.getTotalVertices && mesh.getTotalVertices() > 0) {
          this.shadows.addCaster(mesh);
        }
        if (mesh.material) matSet.add(mesh.material);
      }
    }
    const modelMats = [...matSet];

    // Tint each material's albedo so the three subspecies visually
    // differentiate (the Quaternius alien rigs share a single peach-skin
    // texture, so without tinting they all look identical). albedoColor
    // multiplies the texture, so values <1 darken/colorize without
    // erasing the painted detail. Kept slightly desaturated and biased
    // toward the COLORS-table hue so the rigs still read as "alien skin"
    // rather than candy colors.
    const c = COLORS[agent.defId] ?? [0.6, 0.6, 0.6];
    const tint = new Color3(c[0], c[1], c[2]);
    for (const mat of modelMats) setAlbedoTint(mat, tint);
    // Faint emissive in the same hue gives a hint of glow without bloom blowout.
    const baseEmissive = new Color3(c[0] * 0.08, c[1] * 0.08, c[2] * 0.08);
    for (const mat of modelMats) setEmissive(mat, baseEmissive);

    // Stop everything by default and start an Idle clip if one exists.
    inst.animationGroups.forEach((g) => g.stop());
    const idle = pickAnim(inst.animationGroups, ["Idle"]);
    idle?.start(true);

    this.visuals.set(agent.id, {
      agent, root, bodyMat: null,
      modelRoots: inst.rootNodes as AbstractMesh[],
      animations: inst.animationGroups,
      currentAnim: idle ?? null,
      modelMats, baseEmissive,
    });
  }

  tick() {
    this.syncFromManager();
    for (const v of this.visuals.values()) {
      const ground = this.terrain.heightAt(v.agent.x, v.agent.z);
      v.root.position.set(v.agent.x, ground, v.agent.z);
      v.root.rotation.y = v.agent.yaw;

      const isModel = v.modelRoots.length > 0;
      const isKO = v.agent.state === AlienState.KnockedOut;

      if (isKO) {
        // Model rigs lay down via animation if available; procedural keeps
        // the original "rolled on ground" pose so the player still gets the
        // visual cue that the alien is unconscious.
        if (!isModel) {
          v.root.rotation.x = -Math.PI / 2;
          v.root.position.y = ground + 0.4;
        } else {
          v.root.rotation.x = 0;
        }
      } else {
        v.root.rotation.x = 0;
      }

      if (isModel) {
        this.applyModelAnimation(v);
        this.applyModelEmissive(v);
      } else if (v.bodyMat) {
        // Original procedural emissive recolor by state.
        if (isKO) {
          v.bodyMat.emissiveColor.set(0.05, 0.05, 0.05);
        } else if (v.agent.state === AlienState.Hostile) {
          v.bodyMat.emissiveColor.set(0.7, 0.15, 0.15);
        } else if (v.agent.state === AlienState.Friendly || v.agent.state === AlienState.Following) {
          v.bodyMat.emissiveColor.set(0.15, 0.55, 0.25);
        } else {
          const c = COLORS[v.agent.defId] ?? [0.6, 0.6, 0.6];
          v.bodyMat.emissiveColor.set(c[0] * 0.18, c[1] * 0.18, c[2] * 0.18);
        }
      }
    }
  }

  /**
   * Pick the right clip for the agent's state and (un)moving status, swap
   * if it differs from what's currently playing. Defensive: if the rig
   * doesn't have the requested clip, falls through to Idle, then to no-op.
   */
  private applyModelAnimation(v: AlienVisual) {
    if (v.animations.length === 0) return;
    const prev = this.lastPos.get(v.agent.id);
    const moving =
      prev !== undefined &&
      Math.hypot(v.agent.x - prev.x, v.agent.z - prev.z) > 0.01;
    this.lastPos.set(v.agent.id, { x: v.agent.x, z: v.agent.z });

    let want: AnimationGroup | null;
    if (v.agent.state === AlienState.KnockedOut) {
      // Quaternius Platformer Pack ships Sitting + Death; either reads as
      // unconscious. Prefer Sitting since Death loops oddly.
      want = pickAnim(v.animations, ["KnockedOut", "Sleep", "Sitting", "Death", "Idle"]);
    } else if (v.agent.state === AlienState.Hostile && moving) {
      want = pickAnim(v.animations, ["Run", "Running", "Walk", "Walking", "Idle"]);
    } else if (moving) {
      want = pickAnim(v.animations, ["Walk", "Walking", "Run", "Running", "Idle"]);
    } else {
      want = pickAnim(v.animations, ["Idle"]);
    }

    if (want && want !== v.currentAnim) {
      v.currentAnim?.stop();
      want.start(true);
      v.currentAnim = want;
    }
  }

  /**
   * Push the agent's state-relevant emissive onto every cloned material.
   * Hostile = strong red; Friendly/Following = green; KnockedOut =
   * near-black; otherwise the defId's resting tint (so scrunkler reads
   * teal, glarn orange-red, vex purple even when sharing a base texture).
   */
  private applyModelEmissive(v: AlienVisual) {
    // State emissives also kept low for the same bloom-amplification
    // reason as the resting tint in spawnModel.
    let target: Color3;
    if (v.agent.state === AlienState.KnockedOut) {
      target = new Color3(0.02, 0.02, 0.02);
    } else if (v.agent.state === AlienState.Hostile) {
      target = new Color3(0.22, 0.05, 0.05);
    } else if (
      v.agent.state === AlienState.Friendly ||
      v.agent.state === AlienState.Following
    ) {
      target = new Color3(0.05, 0.18, 0.08);
    } else {
      target = v.baseEmissive;
    }
    for (const mat of v.modelMats) setEmissive(mat, target);
  }

  /** Get nearest alien within range, in front of the player (within ~90° cone). */
  pickNearestInFront(
    px: number, pz: number, facingX: number, facingZ: number, maxDist: number,
  ): AlienAgent | null {
    let best: { a: AlienAgent; d2: number } | null = null;
    const max2 = maxDist * maxDist;
    for (const v of this.visuals.values()) {
      const a = v.agent;
      const dx = a.x - px;
      const dz = a.z - pz;
      const d2 = dx * dx + dz * dz;
      if (d2 > max2) continue;
      const len = Math.sqrt(d2) || 1;
      const dot = (dx / len) * facingX + (dz / len) * facingZ;
      if (dot < 0.35) continue;
      if (!best || d2 < best.d2) best = { a, d2 };
    }
    return best?.a ?? null;
  }
}

/**
 * Sets a material's emissive in a duck-typed way that works for both
 * StandardMaterial and PBRMaterial without importing the type. Both expose
 * an `emissiveColor: Color3` field with the same semantics.
 */
function setEmissive(mat: Material, color: Color3): void {
  const m = mat as unknown as { emissiveColor?: Color3 };
  if (m.emissiveColor) m.emissiveColor.copyFrom(color);
}

/**
 * Multiplies the material's albedo (PBR) or diffuse (Standard) by `color`.
 * When the material has an albedo/diffuse texture, this acts as a
 * per-instance hue tint without erasing the painted detail.
 */
function setAlbedoTint(mat: Material, color: Color3): void {
  const m = mat as unknown as { albedoColor?: Color3; diffuseColor?: Color3 };
  if (m.albedoColor) m.albedoColor.copyFrom(color);
  else if (m.diffuseColor) m.diffuseColor.copyFrom(color);
}

/** Case-insensitive substring match against animation group names. */
function pickAnim(groups: AnimationGroup[], aliases: string[]): AnimationGroup | null {
  for (const alias of aliases) {
    const lower = alias.toLowerCase();
    const match = groups.find((g) => g.name.toLowerCase().includes(lower));
    if (match) return match;
  }
  return null;
}
