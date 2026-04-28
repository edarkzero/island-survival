/** Tiny typed pub/sub. Engine-agnostic. */
export type Listener<T> = (payload: T) => void;

export class EventBus<EventMap extends Record<string, unknown>> {
  private readonly listeners = new Map<keyof EventMap, Set<Listener<unknown>>>();

  on<K extends keyof EventMap>(event: K, fn: Listener<EventMap[K]>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(fn as Listener<unknown>);
    return () => set!.delete(fn as Listener<unknown>);
  }

  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]) {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const fn of set) (fn as Listener<EventMap[K]>)(payload);
  }
}

export interface GameEvents {
  ItemCrafted: { itemId: string; entityId: number };
  ItemPickedUp: { itemId: string; entityId: number };
  ItemConsumed: { itemId: string; entityId: number };
  AlienStateChanged: { entityId: number; from: string; to: string };
  BuildingPlaced: { buildingId: string; entityId: number };
  PlayerDied: { reason: string };
  Interacted: { entityId: number; promptKey: string };
}
