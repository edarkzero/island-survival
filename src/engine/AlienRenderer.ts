import type { Scene } from "@babylonjs/core/scene";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { Color3 } from "@babylonjs/core/Maths/math";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { ShadowSystem } from "./ShadowSystem";
import type { AlienAgent, AlienManager } from "../game/systems/AlienManager";
import { AlienState } from "../game/data/aliens";
import type { TerrainRenderer } from "./TerrainRenderer";

const COLORS: Record<string, [number, number, number]> = {
  scrunkler: [0.35, 0.78, 0.72], // teal — peaceful
  glarn: [0.85, 0.42, 0.22],     // orange-red — hostile
  vex: [0.55, 0.32, 0.78],       // purple — elite
};

interface AlienVisual {
  agent: AlienAgent;
  root: TransformNode;
  body: Mesh;
  head: Mesh;
  bodyMat: PBRMaterial;
}

/**
 * Renders each alien as a stylized capsule + smaller head sphere so
 * subspecies are visually distinct. Reads AlienAgent state each frame to
 * tint hostile/knocked-out states and snap to terrain height.
 */
export class AlienRenderer {
  private readonly scene: Scene;
  private readonly manager: AlienManager;
  private readonly terrain: TerrainRenderer;
  private readonly shadows: ShadowSystem;
  private readonly visuals = new Map<number, AlienVisual>();

  constructor(scene: Scene, manager: AlienManager, terrain: TerrainRenderer, shadows: ShadowSystem) {
    this.scene = scene;
    this.manager = manager;
    this.terrain = terrain;
    this.shadows = shadows;
  }

  syncFromManager() {
    // Add visuals for new agents
    for (const a of this.manager.agents) {
      if (!this.visuals.has(a.id)) this.spawnVisual(a);
    }
    // Remove visuals for despawned agents
    for (const [id, v] of this.visuals) {
      if (!this.manager.agents.includes(v.agent)) {
        v.root.dispose();
        this.visuals.delete(id);
      }
    }
  }

  private spawnVisual(agent: AlienAgent) {
    const root = new TransformNode(`alien-${agent.id}-root`, this.scene);
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

    this.visuals.set(agent.id, { agent, root, body, head, bodyMat });
  }

  tick() {
    this.syncFromManager();
    for (const v of this.visuals.values()) {
      const ground = this.terrain.heightAt(v.agent.x, v.agent.z);
      v.root.position.set(v.agent.x, ground, v.agent.z);
      v.root.rotation.y = v.agent.yaw;

      if (v.agent.state === AlienState.KnockedOut) {
        v.root.rotation.x = -Math.PI / 2;
        v.root.position.y = ground + 0.4;
        v.bodyMat.emissiveColor.set(0.05, 0.05, 0.05);
      } else {
        v.root.rotation.x = 0;
        if (v.agent.state === AlienState.Hostile) {
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
      // Dot product of (dx,dz) normalized vs facing
      const len = Math.sqrt(d2) || 1;
      const dot = (dx / len) * facingX + (dz / len) * facingZ;
      if (dot < 0.35) continue; // ~90° forward cone (cos 70°)
      if (!best || d2 < best.d2) best = { a, d2 };
    }
    return best?.a ?? null;
  }
}
