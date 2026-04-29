import type { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Vector3 } from "@babylonjs/core/Maths/math";
import type { InputManager } from "./InputManager";
import type { AlienManager, AlienAgent } from "../game/systems/AlienManager";
import { AlienState } from "../game/data/aliens";
import type { AlienRenderer } from "./AlienRenderer";
import type { Inventory } from "../game/systems/Inventory";
import type { Equipment } from "../game/systems/Equipment";
import { resolveAttack, classifyEquippedTool } from "../game/systems/Combat";
import type { HarvestableProps } from "../game/systems/HarvestableProps";
import { ITEMS, ItemType } from "../game/data/items";
import type { SurvivalState } from "../game/systems/SurvivalState";
import type { HudManager } from "../ui/hud/HudManager";
import type { Audio } from "./Audio";

const ATTACK_RANGE = 2.6;
const HARVEST_RANGE = 3.2;
const GIVE_RANGE = 4.0;

/**
 * Wires the player's "attack" action (F) to either:
 *   - giving an item to a nearby curious / knocked-out alien, OR
 *   - swinging the equipped weapon at the nearest hostile / curious alien
 *     in front of the player.
 */
export class CombatController {
  private readonly input: InputManager;
  private readonly aliens: AlienManager;
  private readonly alienRenderer: AlienRenderer;
  private readonly inv: Inventory;
  private readonly equipment: Equipment;
  private readonly survival: SurvivalState;
  private readonly playerRoot: TransformNode;
  private readonly camera: ArcRotateCamera;
  private readonly hud: HudManager;
  private readonly audio: Audio;
  private readonly harvestables: HarvestableProps;
  /** Counts up; >0 means a swing visual is currently active (consumed by feedback layer). */
  swingFlash = 0;

  constructor(
    input: InputManager,
    aliens: AlienManager,
    alienRenderer: AlienRenderer,
    inv: Inventory,
    equipment: Equipment,
    survival: SurvivalState,
    playerRoot: TransformNode,
    camera: ArcRotateCamera,
    hud: HudManager,
    audio: Audio,
    harvestables: HarvestableProps,
  ) {
    this.input = input;
    this.aliens = aliens;
    this.alienRenderer = alienRenderer;
    this.inv = inv;
    this.equipment = equipment;
    this.survival = survival;
    this.playerRoot = playerRoot;
    this.camera = camera;
    this.hud = hud;
    this.audio = audio;
    this.harvestables = harvestables;
  }

  tick(dt: number, suppressed = false) {
    this.swingFlash = Math.max(0, this.swingFlash - dt);
    if (suppressed) {
      this.hud.hideGiftPrompt();
      return;
    }
    const fwd = this.camera.getDirection(Vector3.Forward());
    fwd.y = 0;
    if (fwd.lengthSquared() < 1e-4) fwd.set(0, 0, 1);
    fwd.normalize();
    const px = this.playerRoot.position.x;
    const pz = this.playerRoot.position.z;

    // Look for a give-target (curious / knocked-out alien within range)
    const giveTarget = this.findGiveTarget(px, pz);
    const equippedId = this.equipment.activeItem();
    const equippedDef = equippedId ? ITEMS[equippedId] : null;
    const equippedConsumable =
      equippedDef && equippedDef.type === ItemType.Consumable && equippedDef.consume;

    if (giveTarget) {
      const def = ITEMS[giveTarget.wantedItemId];
      const have = this.inv.has(giveTarget.wantedItemId, 1);
      const label = have
        ? `Give ${def?.name ?? giveTarget.wantedItemId}`
        : `Wants ${def?.name ?? giveTarget.wantedItemId}`;
      this.hud.showGiftPrompt("F", label, !have);
    } else if (equippedConsumable && this.inv.has(equippedId!, 1)) {
      this.hud.showGiftPrompt("F", `Eat ${equippedDef!.name}`, false);
    } else {
      this.hud.hideGiftPrompt();
    }

    if (!this.input.wasJustPressed("attack")) return;

    if (giveTarget && this.inv.has(giveTarget.wantedItemId, 1)) {
      if (this.aliens.tryGiveItem(giveTarget, giveTarget.wantedItemId)) {
        this.inv.remove(giveTarget.wantedItemId, 1);
      }
      return;
    }

    // Equipped consumable → eat one
    if (equippedConsumable && this.inv.has(equippedId!, 1)) {
      this.inv.remove(equippedId!, 1);
      this.survival.consume(equippedDef!.consume!);
      this.swingFlash = 0.18;
      return;
    }

    // Otherwise: swing — first try alien target, then a harvestable target.
    this.swingFlash = 0.18;
    const target = this.alienRenderer.pickNearestInFront(px, pz, fwd.x, fwd.z, ATTACK_RANGE);
    const atk = resolveAttack(equippedId, this.inv);
    this.audio.playSwing(atk.kind);
    if (target) {
      const result = this.aliens.applyDamage(target, atk.damage, atk.kind);
      this.audio.playHit("flesh");
      if (result === "killed") this.aliens.despawn(target);
      return;
    }

    // No alien in front — try chopping/mining a harvestable prop.
    const hNode = this.harvestables.nearestInFront(px, pz, fwd.x, fwd.z, HARVEST_RANGE);
    if (!hNode) return;
    const tool = classifyEquippedTool(equippedDef ?? null);
    const cfg = this.harvestables.configFor(hNode.kind);
    if (!cfg) return;
    const result = this.harvestables.applyDamage(hNode, tool, performance.now() / 1000);
    if (result === "miss") {
      this.audio.playClick("cancel");
      return;
    }
    if (cfg.sfxHit === "chop") this.audio.playChop();
    else this.audio.playMining();
  }

  private findGiveTarget(px: number, pz: number): AlienAgent | null {
    let best: { agent: AlienAgent; d2: number } | null = null;
    const max2 = GIVE_RANGE * GIVE_RANGE;
    for (const a of this.aliens.agents) {
      if (a.state !== AlienState.KnockedOut && a.state !== AlienState.Curious) continue;
      const dx = a.x - px;
      const dz = a.z - pz;
      const d2 = dx * dx + dz * dz;
      if (d2 > max2) continue;
      if (!best || d2 < best.d2) best = { agent: a, d2 };
    }
    return best?.agent ?? null;
  }
}
