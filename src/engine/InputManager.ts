import type { Scene } from "@babylonjs/core/scene";

export type InputAction =
  | "moveForward"
  | "moveBack"
  | "moveLeft"
  | "moveRight"
  | "jump"
  | "sprint"
  | "interact"
  | "attack"
  | "throw"
  | "resetFacing"
  | "build"
  | "craft"
  | "inventory"
  | "cancel"
  | "slot1"
  | "slot2"
  | "slot3"
  | "slot4"
  | "slot5"
  | "slot6"
  | "slot7"
  | "slot8"
  | "slot9";

const KEY_MAP: Record<string, InputAction> = {
  w: "moveForward",
  arrowup: "moveForward",
  s: "moveBack",
  arrowdown: "moveBack",
  a: "moveLeft",
  arrowleft: "moveLeft",
  d: "moveRight",
  arrowright: "moveRight",
  " ": "jump",
  shift: "sprint",
  e: "interact",
  f: "attack",
  q: "throw",
  r: "resetFacing",
  b: "build",
  c: "craft",
  i: "inventory",
  tab: "inventory",
  escape: "cancel",
  "1": "slot1",
  "2": "slot2",
  "3": "slot3",
  "4": "slot4",
  "5": "slot5",
  "6": "slot6",
  "7": "slot7",
  "8": "slot8",
  "9": "slot9",
};

/**
 * Window-level keyboard listener. Hooking the document directly (rather
 * than scene.onKeyboardObservable, which Babylon attaches to the canvas)
 * means menus / buttons / dev-tools can take focus without breaking input.
 */
export class InputManager {
  private readonly held = new Set<InputAction>();
  private readonly justPressed = new Set<InputAction>();

  constructor(scene: Scene) {
    const onKeyDown = (e: KeyboardEvent) => {
      const action = KEY_MAP[e.key.toLowerCase()];
      if (!action) return;
      if (!this.held.has(action)) this.justPressed.add(action);
      this.held.add(action);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const action = KEY_MAP[e.key.toLowerCase()];
      if (!action) return;
      this.held.delete(action);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    // Clear "justPressed" right after each render frame finishes.
    scene.onAfterRenderObservable.add(() => {
      this.justPressed.clear();
    });
  }

  isHeld(a: InputAction): boolean {
    return this.held.has(a);
  }

  wasJustPressed(a: InputAction): boolean {
    return this.justPressed.has(a);
  }
}
