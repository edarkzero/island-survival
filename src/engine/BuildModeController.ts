import type { Scene } from "@babylonjs/core/scene";
import type { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Vector3 } from "@babylonjs/core/Maths/math";
import { PointerEventTypes } from "@babylonjs/core/Events/pointerEvents";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { InputManager } from "./InputManager";
import type { TerrainRenderer } from "./TerrainRenderer";
import type { BuildingRegistry } from "../game/systems/Building";
import type { BuildingRenderer } from "./BuildingRenderer";
import type { Inventory } from "../game/systems/Inventory";
import type { HudManager } from "../ui/hud/HudManager";
import type { Audio } from "./Audio";
import { BUILDINGS } from "../game/data/buildings";

const PLACEABLES = ["foundation", "wall", "roof", "campfire", "workbench", "forge"];
const REACH = 7.5;

/**
 * Build mode logic. Toggles on/off with the "build" action. While active:
 *   - 1..9 cycle the placeable
 *   - mouse-look raycast determines target position; snaps to grid or to
 *     existing building snap points
 *   - left click → place if valid + resources available
 *   - right click → exit
 */
export class BuildModeController {
  active = false;
  private currentIdx = 0;

  private readonly camera: ArcRotateCamera;
  private readonly input: InputManager;
  private readonly terrain: TerrainRenderer;
  private readonly registry: BuildingRegistry;
  private readonly renderer: BuildingRenderer;
  private readonly inv: Inventory;
  private readonly hud: HudManager;
  private readonly playerRoot: TransformNode;
  private readonly audio: Audio;

  constructor(
    scene: Scene,
    camera: ArcRotateCamera,
    input: InputManager,
    terrain: TerrainRenderer,
    registry: BuildingRegistry,
    renderer: BuildingRenderer,
    inv: Inventory,
    hud: HudManager,
    playerRoot: TransformNode,
    audio: Audio,
  ) {
    this.camera = camera;
    this.input = input;
    this.terrain = terrain;
    this.registry = registry;
    this.renderer = renderer;
    this.inv = inv;
    this.hud = hud;
    this.playerRoot = playerRoot;
    this.audio = audio;

    // POINTERTAP fires only on a click that didn't drag, so the camera can
    // still orbit on left-mouse drag without accidentally placing a piece.
    scene.onPointerObservable.add((info) => {
      if (!this.active) return;
      if (info.type === PointerEventTypes.POINTERTAP) {
        if (info.event.button === 0) this.tryPlace();
        else if (info.event.button === 2) this.toggle(false);
      }
    });
  }

  toggle(force?: boolean) {
    this.active = force ?? !this.active;
    if (!this.active) {
      this.renderer.hideGhost();
      this.hud.setBuildModeBar(null);
    } else {
      this.hud.setBuildModeBar(PLACEABLES, this.currentIdx);
    }
  }

  tick() {
    if (this.input.wasJustPressed("build")) this.toggle();
    if (!this.active) return;

    // Number keys 1..6 to swap placeable
    for (let i = 0; i < PLACEABLES.length; i++) {
      const action = (`slot${i + 1}`) as
        | "slot1" | "slot2" | "slot3" | "slot4" | "slot5" | "slot6";
      if (this.input.wasJustPressed(action)) {
        this.currentIdx = i;
        this.hud.setBuildModeBar(PLACEABLES, this.currentIdx);
      }
    }
    if (this.input.wasJustPressed("cancel")) this.toggle(false);

    const target = this.computeTarget();
    if (!target) {
      this.renderer.hideGhost();
      return;
    }

    const buildingId = PLACEABLES[this.currentIdx]!;
    const def = BUILDINGS[buildingId];
    const snap = this.registry.snap(target.x, target.y, target.z);
    const overlapOk = this.registry.isValid(buildingId, snap.x, snap.y, snap.z);
    const haveResources = def ? this.inv.hasAll(def.cost) : false;
    const valid = overlapOk && haveResources;
    this.renderer.showGhost(buildingId, snap.x, snap.y, snap.z, 0, valid);
    this.hud.setBuildModeStatus(buildingDescription(buildingId, valid, overlapOk, haveResources));
  }

  private tryPlace() {
    const target = this.computeTarget();
    if (!target) return;
    const buildingId = PLACEABLES[this.currentIdx]!;
    const def = BUILDINGS[buildingId];
    if (!def) return;
    const snap = this.registry.snap(target.x, target.y, target.z);
    if (!this.registry.isValid(buildingId, snap.x, snap.y, snap.z)) return;
    if (!this.inv.removeAll(def.cost)) return;
    const placed = this.registry.add(buildingId, snap.x, snap.y, snap.z, 0);
    this.renderer.spawn(placed);
    this.audio.playBuildPlace();
  }

  private computeTarget(): Vector3 | null {
    // Project a point REACH meters in front of the player (in the camera's
    // horizontal forward direction), then drop it onto the terrain.
    // More reliable than camera-raycast for shallow viewing angles.
    const fwd = this.camera.getDirection(Vector3.Forward());
    fwd.y = 0;
    if (fwd.lengthSquared() < 1e-4) return null;
    fwd.normalize();

    const ppos = this.playerRoot.position;
    const tx = ppos.x + fwd.x * REACH;
    const tz = ppos.z + fwd.z * REACH;
    const ty = this.terrain.heightAt(tx, tz);
    return new Vector3(tx, ty, tz);
  }
}

function buildingDescription(
  id: string,
  valid: boolean,
  overlapOk: boolean,
  haveResources: boolean,
): string {
  const def = BUILDINGS[id];
  const cost = def?.cost.map((c) => `${c.qty} ${c.itemId}`).join(", ") ?? "";
  const label = def?.name ?? id;
  if (valid) return `${label} — ${cost}`;
  if (!overlapOk) return `${label} — blocked`;
  if (!haveResources) return `${label} — need ${cost}`;
  return label;
}
