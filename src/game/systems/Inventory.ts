/**
 * Engine-agnostic inventory. itemId → quantity, no slot model yet (we'll
 * introduce slots when the visual inventory grid lands).
 */
import { ITEMS } from "../data/items";

export class Inventory {
  private readonly counts = new Map<string, number>();

  add(itemId: string, qty = 1): number {
    if (qty <= 0) return this.get(itemId);
    if (!ITEMS[itemId]) {
      console.warn(`Inventory.add: unknown itemId "${itemId}"`);
      return 0;
    }
    const next = this.get(itemId) + qty;
    this.counts.set(itemId, next);
    return next;
  }

  /** Try to remove `qty`. Returns false (and does nothing) if insufficient. */
  remove(itemId: string, qty: number): boolean {
    const have = this.get(itemId);
    if (have < qty) return false;
    const next = have - qty;
    if (next <= 0) this.counts.delete(itemId);
    else this.counts.set(itemId, next);
    return true;
  }

  get(itemId: string): number {
    return this.counts.get(itemId) ?? 0;
  }

  has(itemId: string, qty: number): boolean {
    return this.get(itemId) >= qty;
  }

  /** Iterate (itemId, qty) pairs. Used by HUD/crafting UI. */
  entries(): [string, number][] {
    return Array.from(this.counts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }

  /** Test all required inputs. */
  hasAll(reqs: { itemId: string; qty: number }[]): boolean {
    return reqs.every((r) => this.has(r.itemId, r.qty));
  }

  /** Atomically remove all required inputs. Returns false if any missing. */
  removeAll(reqs: { itemId: string; qty: number }[]): boolean {
    if (!this.hasAll(reqs)) return false;
    for (const r of reqs) this.remove(r.itemId, r.qty);
    return true;
  }
}
