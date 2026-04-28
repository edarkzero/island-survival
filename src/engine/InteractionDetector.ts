import type { Scene } from "@babylonjs/core/scene";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { InputManager } from "./InputManager";
import type { PickupRegistry } from "../game/systems/PickupRegistry";
import type { PickupRenderer } from "./PickupRenderer";
import type { Inventory } from "../game/systems/Inventory";
import type { HudManager } from "../ui/hud/HudManager";
import { ITEMS, ItemType } from "../game/data/items";
import type { Audio } from "./Audio";

const PICKUP_RADIUS = 2.5;
// Items that should sound metallic on pickup. Mirrors the metallic set in
// PickupRenderer so audio + visual stay aligned.
const METAL_ITEMS = new Set(["iron_ore", "iron_ingot", "shiny_trinket"]);

/**
 * Each frame:
 *  - find nearest pickup within PICKUP_RADIUS of the player root
 *  - show "E — Pick up X" prompt if one is in range
 *  - on E press: remove from world → add to inventory (never auto-consume)
 */
export class InteractionDetector {
  private readonly registry: PickupRegistry;
  private readonly renderer: PickupRenderer;
  private readonly inv: Inventory;
  private readonly hud: HudManager;
  private readonly playerRoot: TransformNode;
  private readonly input: InputManager;
  private readonly audio: Audio;

  constructor(
    _scene: Scene,
    playerRoot: TransformNode,
    input: InputManager,
    registry: PickupRegistry,
    renderer: PickupRenderer,
    inv: Inventory,
    hud: HudManager,
    audio: Audio,
  ) {
    this.playerRoot = playerRoot;
    this.input = input;
    this.registry = registry;
    this.renderer = renderer;
    this.inv = inv;
    this.hud = hud;
    this.audio = audio;
  }

  tick(suppressed = false) {
    if (suppressed) {
      this.hud.hidePrompt();
      return;
    }
    const px = this.playerRoot.position.x;
    const pz = this.playerRoot.position.z;
    const nearest = this.registry.nearest(px, pz, PICKUP_RADIUS);

    if (!nearest) {
      this.hud.hidePrompt();
      return;
    }

    const def = ITEMS[nearest.itemId];
    const label = `Pick up ${def?.name ?? nearest.itemId}`;
    this.hud.showPrompt("E", label);

    if (this.input.wasJustPressed("interact")) {
      const consumed = this.registry.consume(nearest.id);
      if (!consumed) return;
      this.renderer.consume(nearest.id);
      // Pickups always go to inventory — never auto-consumed. Eating /
      // drinking is a separate action: equip the item on the hotbar then
      // press F to use it.
      this.inv.add(nearest.itemId, 1);
      const material = METAL_ITEMS.has(nearest.itemId)
        ? "metal"
        : ITEMS[nearest.itemId]?.type === ItemType.Consumable
          ? "consumable"
          : "resource";
      this.audio.playPickup(material);
      this.hud.hidePrompt();
    }
  }
}
