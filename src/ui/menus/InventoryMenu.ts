import type { Inventory } from "../../game/systems/Inventory";
import { ITEMS, ItemType } from "../../game/data/items";

const TYPE_LABEL: Record<string, string> = {
  resource: "Resources",
  consumable: "Food / Drink",
  tool: "Tools",
  weapon: "Weapons",
  armor: "Armor",
  alien_gift: "Alien Gifts",
};
const TYPE_ORDER = [
  ItemType.Resource,
  ItemType.Consumable,
  ItemType.Tool,
  ItemType.Weapon,
  ItemType.Armor,
  ItemType.AlienGift,
];

/**
 * Full-screen inventory grid. Open with I, close with I or Esc.
 */
export class InventoryMenu {
  private readonly root: HTMLElement;
  private readonly inv: Inventory;
  open = false;

  constructor(inv: Inventory) {
    this.inv = inv;
    this.root = document.createElement("div");
    this.root.id = "inventory-menu";
    this.root.hidden = true;
    document.body.appendChild(this.root);
    this.root.addEventListener("click", (ev) => {
      const t = ev.target as HTMLElement;
      if (t.closest('[data-act="close"]') || t === this.root) this.toggle(false);
    });
  }

  toggle(force?: boolean) {
    this.open = force ?? !this.open;
    this.root.hidden = !this.open;
    if (this.open) {
      this.render();
      (document.getElementById("renderCanvas") as HTMLElement | null)?.blur();
    } else {
      (document.getElementById("renderCanvas") as HTMLElement | null)?.focus();
    }
  }

  refresh() {
    if (this.open) this.render();
  }

  private render() {
    const buckets: Record<string, [string, number][]> = {};
    for (const [id, q] of this.inv.entries()) {
      const t = ITEMS[id]?.type ?? "resource";
      (buckets[t] ??= []).push([id, q]);
    }
    const groups = TYPE_ORDER.filter((t) => buckets[t]).map(
      (t) => `
        <section>
          <h3>${escapeHtml(TYPE_LABEL[t] ?? t)}</h3>
          <div class="inv-grid">
            ${buckets[t]!
              .map(
                ([id, q]) =>
                  `<div class="inv-item"><b>${q}</b><span>${escapeHtml(ITEMS[id]?.name ?? id)}</span></div>`,
              )
              .join("")}
          </div>
        </section>`,
    );

    this.root.innerHTML = `
      <div class="inv-panel">
        <header>
          <h2>Inventory</h2>
          <button data-act="close" aria-label="Close">×</button>
        </header>
        <div class="inv-body">${groups.join("") || '<p class="inv-empty">Inventory is empty.</p>'}</div>
        <footer><kbd>I</kbd> close · equip from the hotbar (1–9)</footer>
      </div>
    `;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}
