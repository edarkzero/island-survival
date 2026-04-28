/**
 * Engine-agnostic survival stat machine. Drives HP / Hunger / Thirst /
 * Stamina ticks. Wired directly into the HUD bars by reading these values
 * each frame.
 */

export interface SurvivalContext {
  /** Whether the player is producing motion input this frame. */
  isMoving: boolean;
  /** Whether the player is currently sprinting. */
  isSprinting: boolean;
}

export interface SurvivalSnapshot {
  hp: number;
  hunger: number;
  thirst: number;
  stamina: number;
}

const MAX = 100;

export class SurvivalState {
  hp = MAX;
  hunger = MAX;
  thirst = MAX;
  stamina = MAX;

  // Per-second decay rates from GAME_DESIGN.md §9.
  hungerDecayWalk = 0.6;
  hungerDecaySprint = 1.4;
  thirstDecayWalk = 0.8;
  thirstDecaySprint = 1.8;
  staminaDecaySprint = 18;
  staminaRegenIdle = 12;
  staminaRegenWalk = 6;
  hpDrainStarve = 1;
  hpRegenWell = 0.5;

  tick(dt: number, ctx: SurvivalContext) {
    const moving = ctx.isMoving;
    const sprinting = ctx.isSprinting && this.stamina > 0;

    // Hunger / thirst always decay
    const hungerRate = sprinting ? this.hungerDecaySprint : this.hungerDecayWalk;
    const thirstRate = sprinting ? this.thirstDecaySprint : this.thirstDecayWalk;
    this.hunger = clamp(this.hunger - hungerRate * dt, 0, MAX);
    this.thirst = clamp(this.thirst - thirstRate * dt, 0, MAX);

    // Stamina drains while sprinting, regen otherwise
    if (sprinting) {
      this.stamina = clamp(this.stamina - this.staminaDecaySprint * dt, 0, MAX);
    } else {
      const regen = moving ? this.staminaRegenWalk : this.staminaRegenIdle;
      this.stamina = clamp(this.stamina + regen * dt, 0, MAX);
    }

    // HP drains if starving/thirsty, regenerates when well
    if (this.hunger <= 0 || this.thirst <= 0) {
      this.hp = clamp(this.hp - this.hpDrainStarve * dt, 0, MAX);
    } else if (this.hunger > 50 && this.thirst > 50 && !moving) {
      this.hp = clamp(this.hp + this.hpRegenWell * dt, 0, MAX);
    }
  }

  consume(stats: { hp?: number; hunger?: number; thirst?: number; stamina?: number }) {
    if (stats.hp) this.hp = clamp(this.hp + stats.hp, 0, MAX);
    if (stats.hunger) this.hunger = clamp(this.hunger + stats.hunger, 0, MAX);
    if (stats.thirst) this.thirst = clamp(this.thirst + stats.thirst, 0, MAX);
    if (stats.stamina) this.stamina = clamp(this.stamina + stats.stamina, 0, MAX);
  }

  snapshot(): SurvivalSnapshot {
    return {
      hp: this.hp / MAX,
      hunger: this.hunger / MAX,
      thirst: this.thirst / MAX,
      stamina: this.stamina / MAX,
    };
  }
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}
