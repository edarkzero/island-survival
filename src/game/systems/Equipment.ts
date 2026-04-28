/**
 * Engine-agnostic equipment + hotbar. Holds the 9 hotbar assignments
 * (itemId or null) plus the active slot index. Combat reads the active
 * item from here instead of guessing from inventory contents.
 */
import { ITEMS, ItemType } from "../data/items";
import type { Inventory } from "./Inventory";

const HOTBAR_SLOTS = 9;

function isHotbarable(id: string): boolean {
  const t = ITEMS[id]?.type;
  return t === ItemType.Tool || t === ItemType.Weapon || t === ItemType.Consumable;
}

export class Equipment {
  activeIndex = 0;
  readonly hotbar: (string | null)[] = Array(HOTBAR_SLOTS).fill(null);

  /**
   * Auto-fill empty hotbar slots with new tools/weapons in inventory.
   * Also clear slots whose item is no longer in inventory.
   */
  sync(inv: Inventory) {
    // Drop hotbar entries that don't exist anymore
    for (let i = 0; i < this.hotbar.length; i++) {
      const id = this.hotbar[i];
      if (id && !inv.has(id, 1)) this.hotbar[i] = null;
    }
    // Auto-add new weapons/tools that aren't on the bar yet
    for (const [id] of inv.entries()) {
      if (!isHotbarable(id)) continue;
      if (this.hotbar.includes(id)) continue;
      const empty = this.hotbar.findIndex((s) => s === null);
      if (empty < 0) break;
      this.hotbar[empty] = id;
    }
  }

  setActive(index: number) {
    if (index < 0 || index >= HOTBAR_SLOTS) return;
    this.activeIndex = index;
  }

  activeItem(): string | null {
    return this.hotbar[this.activeIndex] ?? null;
  }
}
