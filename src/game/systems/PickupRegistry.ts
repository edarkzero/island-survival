/**
 * Engine-agnostic registry of forageable pickups in the world.
 * The engine layer renders these and detects player proximity; this module
 * is the source of truth for "what's still on the ground".
 */

export interface Pickup {
  id: number;
  itemId: string;
  x: number;
  y: number;
  z: number;
  consumed: boolean;
}

export class PickupRegistry {
  private nextId = 1;
  readonly pickups: Pickup[] = [];

  add(itemId: string, x: number, y: number, z: number): Pickup {
    const p: Pickup = { id: this.nextId++, itemId, x, y, z, consumed: false };
    this.pickups.push(p);
    return p;
  }

  consume(id: number): Pickup | null {
    const p = this.pickups.find((q) => q.id === id);
    if (!p || p.consumed) return null;
    p.consumed = true;
    return p;
  }

  /** Return id of the closest non-consumed pickup within `maxDist` of (x,z). */
  nearest(x: number, z: number, maxDist: number): Pickup | null {
    let best: { p: Pickup; d2: number } | null = null;
    const max2 = maxDist * maxDist;
    for (const p of this.pickups) {
      if (p.consumed) continue;
      const dx = p.x - x;
      const dz = p.z - z;
      const d2 = dx * dx + dz * dz;
      if (d2 < max2 && (!best || d2 < best.d2)) best = { p, d2 };
    }
    return best?.p ?? null;
  }
}
