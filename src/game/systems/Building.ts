/**
 * Engine-agnostic building registry: tracks placed structures, snap-point
 * lookup, and "is a station of this type nearby" queries.
 *
 * Engine layer wraps this and provides Babylon meshes / ghost rendering.
 */
import { BUILDINGS, type BuildingDef } from "../data/buildings";
import { Station, type StationId } from "../data/recipes";

export interface PlacedBuilding {
  id: number;
  buildingId: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
}

const STATION_BY_BUILDING: Record<string, StationId> = {
  workbench: Station.Workbench,
  forge: Station.Forge,
};

const STATION_RANGE = 5;

export class BuildingRegistry {
  private nextId = 1;
  readonly placed: PlacedBuilding[] = [];

  add(buildingId: string, x: number, y: number, z: number, yaw = 0): PlacedBuilding {
    const p: PlacedBuilding = { id: this.nextId++, buildingId, x, y, z, yaw };
    this.placed.push(p);
    return p;
  }

  remove(id: number): PlacedBuilding | null {
    const idx = this.placed.findIndex((p) => p.id === id);
    if (idx < 0) return null;
    return this.placed.splice(idx, 1)[0]!;
  }

  /** Station IDs available within STATION_RANGE meters of (x, z). */
  nearbyStations(x: number, z: number, range = STATION_RANGE): StationId[] {
    const out = new Set<StationId>();
    const r2 = range * range;
    for (const p of this.placed) {
      const station = STATION_BY_BUILDING[p.buildingId];
      if (!station) continue;
      const dx = p.x - x;
      const dz = p.z - z;
      if (dx * dx + dz * dz <= r2) out.add(station);
    }
    return Array.from(out);
  }

  /** Snap (x, z) to the nearest snap point of any placed building, or to a 2m grid. */
  snap(x: number, y: number, z: number, snapRadius = 1.5): { x: number; y: number; z: number; snapped: boolean } {
    let best: { p: PlacedBuilding; sx: number; sy: number; sz: number; d2: number } | null = null;
    const r2 = snapRadius * snapRadius;

    for (const p of this.placed) {
      const def = BUILDINGS[p.buildingId];
      if (!def) continue;
      const cosY = Math.cos(p.yaw);
      const sinY = Math.sin(p.yaw);
      for (const sp of def.snapPoints) {
        // rotate snap point by building yaw, then translate
        const rx = sp.x * cosY + sp.z * sinY;
        const rz = -sp.x * sinY + sp.z * cosY;
        const sx = p.x + rx;
        const sy = p.y + sp.y;
        const sz = p.z + rz;
        const d2 = (sx - x) ** 2 + (sz - z) ** 2 + (sy - y) ** 2;
        if (d2 < r2 && (!best || d2 < best.d2)) best = { p, sx, sy, sz, d2 };
      }
    }

    if (best) return { x: best.sx, y: best.sy, z: best.sz, snapped: true };

    // Fall back to a 2m world grid for foundations
    const gx = Math.round(x / 2) * 2;
    const gz = Math.round(z / 2) * 2;
    return { x: gx, y, z: gz, snapped: false };
  }

  /** Validate placement: not overlapping an existing building (cheap AABB check). */
  isValid(buildingId: string, x: number, y: number, z: number): boolean {
    const def = BUILDINGS[buildingId];
    if (!def) return false;
    for (const p of this.placed) {
      const pdef = BUILDINGS[p.buildingId];
      if (!pdef) continue;
      const dx = Math.abs(p.x - x);
      const dy = Math.abs(p.y - y);
      const dz = Math.abs(p.z - z);
      const sx = (def.size.x + pdef.size.x) / 2 - 0.05;
      const sy = (def.size.y + pdef.size.y) / 2 - 0.05;
      const sz = (def.size.z + pdef.size.z) / 2 - 0.05;
      if (dx < sx && dy < sy && dz < sz) return false;
    }
    return true;
  }

  defOf(buildingId: string): BuildingDef | undefined {
    return BUILDINGS[buildingId];
  }
}
