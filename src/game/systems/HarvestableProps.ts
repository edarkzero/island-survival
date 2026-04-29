/**
 * Engine-agnostic harvest state machine. Tracks per-prop hp + respawn state,
 * fires drop / visibility callbacks, ticks respawn timers. The engine layer
 * (CombatController) calls `applyDamage`; the engine layer (PropRenderer)
 * receives `onVisibilityChange` to hide/show the corresponding mesh.
 *
 * Holds parallel state to the immutable Prop[] from PropSpawner — never
 * mutates the source array, just indexes into it.
 */
import type { Prop, PropKind } from "../world/PropSpawner";
import { HARVESTABLES, type HarvestableConfig, type ToolKind } from "../data/harvestables";

type State = "alive" | "depleted";

export interface HarvestNode {
  propIndex: number;
  kind: PropKind;
  x: number;
  y: number;
  z: number;
  hp: number;
  state: State;
  /** Wall-clock seconds at which the node respawns. Only valid while depleted. */
  respawnAt: number;
}

export type DropCallback = (
  itemId: string,
  count: number,
  x: number,
  y: number,
  z: number,
) => void;

export type VisibilityCallback = (propIndex: number, visible: boolean) => void;

export class HarvestableProps {
  readonly nodes: HarvestNode[] = [];
  private readonly config: Partial<Record<PropKind, HarvestableConfig>>;
  private readonly onDrop: DropCallback;
  private readonly onVisibility: VisibilityCallback;

  constructor(
    props: Prop[],
    onDrop: DropCallback,
    onVisibility: VisibilityCallback,
    config: Partial<Record<PropKind, HarvestableConfig>> = HARVESTABLES,
  ) {
    this.config = config;
    this.onDrop = onDrop;
    this.onVisibility = onVisibility;
    for (let i = 0; i < props.length; i++) {
      const p = props[i]!;
      const cfg = config[p.kind];
      if (!cfg) continue;
      this.nodes.push({
        propIndex: i,
        kind: p.kind,
        x: p.x,
        y: p.y,
        z: p.z,
        hp: cfg.maxHp,
        state: "alive",
        respawnAt: 0,
      });
    }
  }

  configFor(kind: PropKind): HarvestableConfig | undefined {
    return this.config[kind];
  }

  /** Closest alive harvestable within `maxDist` of (px,pz). */
  nearest(px: number, pz: number, maxDist: number): HarvestNode | null {
    const max2 = maxDist * maxDist;
    let best: { n: HarvestNode; d2: number } | null = null;
    for (const n of this.nodes) {
      if (n.state !== "alive") continue;
      const dx = n.x - px;
      const dz = n.z - pz;
      const d2 = dx * dx + dz * dz;
      if (d2 < max2 && (!best || d2 < best.d2)) best = { n, d2 };
    }
    return best?.n ?? null;
  }

  /** Closest alive harvestable inside the forward half-plane + range cone. */
  nearestInFront(
    px: number,
    pz: number,
    fx: number,
    fz: number,
    maxDist: number,
  ): HarvestNode | null {
    const max2 = maxDist * maxDist;
    let best: { n: HarvestNode; d2: number } | null = null;
    for (const n of this.nodes) {
      if (n.state !== "alive") continue;
      const dx = n.x - px;
      const dz = n.z - pz;
      const d2 = dx * dx + dz * dz;
      if (d2 > max2) continue;
      // Require target be roughly in front: dot(forward, toTarget) > 0.
      if (dx * fx + dz * fz <= 0) continue;
      if (!best || d2 < best.d2) best = { n, d2 };
    }
    return best?.n ?? null;
  }

  /**
   * Apply damage to a node. Returns "miss" if the tool is wrong and no
   * progress is made, "hit" on partial damage, or "felled" on depletion.
   * On felled: emits drop count via `onDrop` and hides the prop.
   */
  applyDamage(node: HarvestNode, tool: ToolKind, nowSec: number): "miss" | "hit" | "felled" {
    if (node.state !== "alive") return "miss";
    const cfg = this.config[node.kind];
    if (!cfg) return "miss";
    const dmg =
      tool === cfg.tool ? 1
      : tool === "bareHands" ? cfg.bareHandsMultiplier
      : 0;
    if (dmg <= 0) return "miss";
    node.hp -= dmg;
    if (node.hp > 0) return "hit";
    node.state = "depleted";
    node.respawnAt = nowSec + cfg.respawnSec;
    const range = cfg.drop.max - cfg.drop.min;
    const count = cfg.drop.min + ((Math.random() * (range + 1)) | 0);
    this.onDrop(cfg.drop.itemId, count, node.x, node.y, node.z);
    this.onVisibility(node.propIndex, false);
    return "felled";
  }

  /** Advance respawn timers; revive nodes whose timer has elapsed. */
  tick(nowSec: number) {
    for (const n of this.nodes) {
      if (n.state !== "depleted") continue;
      if (nowSec < n.respawnAt) continue;
      const cfg = this.config[n.kind];
      if (!cfg) continue;
      n.state = "alive";
      n.hp = cfg.maxHp;
      this.onVisibility(n.propIndex, true);
    }
  }
}
