/**
 * Engine-agnostic alien spawn + AI. Owns a list of AlienAgents, each
 * running the FSM described in GAME_DESIGN.md §7:
 *   Idle → Curious → Hostile → KnockedOut → Friendly → Following.
 *
 * Movement is logical only (x/z) — the engine layer (AlienRenderer) snaps
 * mesh.y to terrain height each frame.
 */
import { mulberry32 } from "../core/RNG";
import { ALIENS, AlienState, type AlienStateId } from "../data/aliens";

export interface AlienAgent {
  id: number;
  defId: string;
  state: AlienStateId;
  hp: number;
  sleepHp: number;
  x: number;
  z: number;
  yaw: number;
  wantedItemId: string;
  /** Counts up in KnockedOut state; reset on KO. */
  knockoutSeconds: number;
  /** Cooldown timer for melee attacks (s). */
  attackCooldown: number;
  /** Ticks since the player last hit them (for aggro reset). */
  timeSinceHit: number;
}

export interface AlienTickContext {
  playerX: number;
  playerZ: number;
  /** dt seconds since last tick. */
  dt: number;
  /** Damage to apply to the player (in HP) this frame, if hostile alien hits. */
  applyPlayerDamage: (hp: number) => void;
}

const KO_TIMEOUT = 35;
const CURIOUS_RANGE = 28;
const HOSTILE_RANGE = 18;
const ATTACK_RANGE = 1.6;
const ATTACK_PERIOD = 1.4; // seconds between alien attacks
const ATTACK_DMG = 8;
const HOSTILE_SPEED = 3.2;
const CURIOUS_SPEED = 1.5;
const FRIENDLY_SPEED = 2.4;
const FRIENDLY_FOLLOW_DIST = 4.0;

export class AlienManager {
  readonly agents: AlienAgent[] = [];
  private nextId = 1;
  private rand: () => number;

  constructor(seed: number) {
    this.rand = mulberry32(seed);
  }

  spawn(defId: string, x: number, z: number): AlienAgent | null {
    const def = ALIENS[defId];
    if (!def) return null;
    const wantedItemId = pickWeighted(def.wantedItems, this.rand);
    const agent: AlienAgent = {
      id: this.nextId++,
      defId,
      state: AlienState.Idle,
      hp: def.hp,
      sleepHp: def.sleepHp,
      x,
      z,
      yaw: this.rand() * Math.PI * 2,
      wantedItemId,
      knockoutSeconds: 0,
      attackCooldown: 0,
      timeSinceHit: 999,
    };
    this.agents.push(agent);
    return agent;
  }

  /**
   * Apply damage. damageKind decides whether HP or sleepHP is hit.
   * Returns "killed" if HP just hit 0, "knocked_out" if sleepHP just hit 0.
   */
  applyDamage(
    agent: AlienAgent,
    amount: number,
    kind: "bladed" | "blunt" | "sleep",
  ): "killed" | "knocked_out" | "hit" {
    agent.timeSinceHit = 0;
    if (kind === "bladed") {
      agent.hp = Math.max(0, agent.hp - amount);
      if (agent.hp <= 0) return "killed";
      // Bladed damage also makes peaceful aliens hostile.
      const def = ALIENS[agent.defId];
      if (agent.state !== AlienState.Hostile && def && !def.aggressive) {
        agent.state = AlienState.Hostile;
      }
      return "hit";
    } else {
      agent.sleepHp = Math.max(0, agent.sleepHp - amount);
      if (agent.sleepHp <= 0 && agent.state !== AlienState.KnockedOut) {
        agent.state = AlienState.KnockedOut;
        agent.knockoutSeconds = 0;
        return "knocked_out";
      }
      return "hit";
    }
  }

  /** Try to befriend the alien using `itemId` from the player. */
  tryGiveItem(agent: AlienAgent, itemId: string): boolean {
    if (agent.state !== AlienState.Curious && agent.state !== AlienState.KnockedOut) {
      return false;
    }
    if (agent.wantedItemId !== itemId) return false;
    agent.state = AlienState.Friendly;
    // Restore some sleepHp on friendship so they're standing again.
    const def = ALIENS[agent.defId];
    if (def) agent.sleepHp = Math.max(agent.sleepHp, Math.floor(def.sleepHp * 0.6));
    return true;
  }

  /** Remove a dead alien. */
  despawn(agent: AlienAgent) {
    const idx = this.agents.indexOf(agent);
    if (idx >= 0) this.agents.splice(idx, 1);
  }

  tick(ctx: AlienTickContext) {
    for (const a of this.agents) {
      a.attackCooldown = Math.max(0, a.attackCooldown - ctx.dt);
      a.timeSinceHit += ctx.dt;
      const dx = ctx.playerX - a.x;
      const dz = ctx.playerZ - a.z;
      const distSq = dx * dx + dz * dz;
      const dist = Math.sqrt(distSq);
      const def = ALIENS[a.defId];
      if (!def) continue;

      // Face player when aware
      if (a.state !== AlienState.Idle && a.state !== AlienState.KnockedOut) {
        if (dist > 0.01) a.yaw = Math.atan2(dx, dz);
      }

      switch (a.state) {
        case AlienState.Idle:
          if (dist < CURIOUS_RANGE) {
            a.state = def.aggressive ? AlienState.Hostile : AlienState.Curious;
          }
          break;

        case AlienState.Curious:
          // Peaceful aliens approach to a polite distance.
          if (dist > 8 && dist < CURIOUS_RANGE) {
            const step = CURIOUS_SPEED * ctx.dt;
            a.x += (dx / dist) * step;
            a.z += (dz / dist) * step;
          }
          if (dist > CURIOUS_RANGE * 1.2) a.state = AlienState.Idle;
          break;

        case AlienState.Hostile: {
          if (dist > HOSTILE_RANGE * 1.5) {
            a.state = AlienState.Idle;
            break;
          }
          if (dist > ATTACK_RANGE) {
            const step = HOSTILE_SPEED * ctx.dt;
            a.x += (dx / dist) * step;
            a.z += (dz / dist) * step;
          } else if (a.attackCooldown <= 0) {
            ctx.applyPlayerDamage(ATTACK_DMG);
            a.attackCooldown = ATTACK_PERIOD;
          }
          break;
        }

        case AlienState.KnockedOut:
          a.knockoutSeconds += ctx.dt;
          if (a.knockoutSeconds >= KO_TIMEOUT) {
            // Wake up — peaceful go back to curious, hostile go back to hostile.
            a.state = def.aggressive ? AlienState.Hostile : AlienState.Curious;
            a.sleepHp = def.sleepHp;
          }
          break;

        case AlienState.Friendly:
        case AlienState.Following:
          if (dist > FRIENDLY_FOLLOW_DIST) {
            const step = FRIENDLY_SPEED * ctx.dt;
            a.x += (dx / dist) * step;
            a.z += (dz / dist) * step;
          }
          break;
      }
    }
  }
}

function pickWeighted(
  items: { itemId: string; weight: number }[],
  rand: () => number,
): string {
  const total = items.reduce((s, w) => s + w.weight, 0);
  let pick = rand() * total;
  for (const it of items) {
    pick -= it.weight;
    if (pick <= 0) return it.itemId;
  }
  return items[0]!.itemId;
}
