/**
 * Compact controls legend. Always visible in bottom-left collapsed; click
 * to expand the full legend. No special key needed — discoverable.
 */

const ROWS: { keys: string; label: string }[] = [
  { keys: "WASD", label: "Move" },
  { keys: "Shift", label: "Sprint" },
  { keys: "Space", label: "Jump" },
  { keys: "Mouse drag", label: "Orbit camera" },
  { keys: "Wheel", label: "Zoom" },
  { keys: "E", label: "Pick up item" },
  { keys: "1–9", label: "Equip hotbar slot" },
  { keys: "F", label: "Use / attack / give" },
  { keys: "Q", label: "Throw sleep dart" },
  { keys: "R", label: "Reset facing to camera" },
  { keys: "B", label: "Build mode" },
  { keys: "C", label: "Crafting" },
  { keys: "I", label: "Inventory" },
  { keys: "Esc", label: "Close menu / exit build" },
];

export class ControlsHelp {
  private readonly root: HTMLElement;
  private expanded = false;

  constructor() {
    this.root = document.createElement("div");
    this.root.id = "controls-help";
    this.root.innerHTML = `<button data-act="toggle">? Controls</button>`;
    document.body.appendChild(this.root);
    this.root.addEventListener("click", () => this.toggle());
  }

  toggle() {
    this.expanded = !this.expanded;
    if (this.expanded) {
      this.root.classList.add("expanded");
      this.root.innerHTML = `
        <button data-act="toggle">×</button>
        <h4>Controls</h4>
        <table>${ROWS.map((r) => `<tr><th>${r.keys}</th><td>${r.label}</td></tr>`).join("")}</table>`;
    } else {
      this.root.classList.remove("expanded");
      this.root.innerHTML = `<button data-act="toggle">? Controls</button>`;
    }
  }
}
