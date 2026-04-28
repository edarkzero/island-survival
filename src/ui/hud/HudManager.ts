/**
 * HUD overlay manager. The HUD is plain HTML/CSS over the canvas — easier
 * to style and decoupled from Babylon GUI. This class is the only place
 * that pokes the DOM for HUD updates.
 */
import type { Inventory } from "../../game/systems/Inventory";
import { ITEMS } from "../../game/data/items";
import { BUILDINGS } from "../../game/data/buildings";

export interface HotbarSlotDef {
  num: number;
  label: string;
  iconUrl?: string;
}

const COMPASS_LABELS: { angle: number; label: string }[] = [
  { angle: 0, label: "N" },
  { angle: 45, label: "NE" },
  { angle: 90, label: "E" },
  { angle: 135, label: "SE" },
  { angle: 180, label: "S" },
  { angle: 225, label: "SW" },
  { angle: 270, label: "W" },
  { angle: 315, label: "NW" },
];

export class HudManager {
  private readonly compassStrip: HTMLElement;
  private readonly hotbar: HTMLElement;
  private readonly prompt: HTMLElement;
  private readonly bars: Record<string, HTMLElement>;
  private readonly loading: HTMLElement | null;
  private readonly inventoryStrip: HTMLElement;
  private readonly buildModeBar: HTMLElement;
  private readonly buildModeStatus: HTMLElement;
  private readonly giftPrompt: HTMLElement;

  constructor() {
    this.compassStrip = mustEl("compass-strip");
    this.hotbar = mustEl("hotbar");
    this.prompt = mustEl("interaction-prompt");
    this.loading = document.getElementById("loading-overlay");
    this.inventoryStrip = ensureEl("inventory-strip", "hud-bottom-right");
    this.buildModeBar = ensureEl("build-mode-bar", "hud-top");
    this.buildModeStatus = ensureEl("build-mode-status", "hud-bottom-center");
    this.giftPrompt = ensureEl("gift-prompt", "hud-bottom-center");
    this.bars = {
      hp: mustQ(".bar-hp .bar-fill"),
      hunger: mustQ(".bar-hunger .bar-fill"),
      thirst: mustQ(".bar-thirst .bar-fill"),
      stamina: mustQ(".bar-stamina .bar-fill"),
    };
  }

  private lastInvKey = "";
  /** Render the inventory strip above the hotbar — counts of resources only. */
  setInventoryStrip(inv: Inventory) {
    const entries = inv.entries().filter(([id]) => {
      const t = ITEMS[id]?.type;
      return t === "resource" || t === "consumable";
    });
    const key = entries.map(([id, q]) => `${id}=${q}`).join(",");
    if (key === this.lastInvKey) return;
    this.lastInvKey = key;
    if (entries.length === 0) {
      this.inventoryStrip.innerHTML = "";
      return;
    }
    this.inventoryStrip.innerHTML = entries
      .map(
        ([id, q]) =>
          `<span class="inv-pill"><b>${q}</b> ${escapeHtml(ITEMS[id]?.name ?? id)}</span>`,
      )
      .join("");
  }

  /** Show / hide the build-mode bar across the top. Pass null to hide. */
  setBuildModeBar(items: string[] | null, activeIdx = 0) {
    if (!items) {
      this.buildModeBar.innerHTML = "";
      this.buildModeBar.hidden = true;
      this.buildModeStatus.innerHTML = "";
      this.buildModeStatus.hidden = true;
      return;
    }
    this.buildModeBar.hidden = false;
    this.buildModeBar.innerHTML = items
      .map((id, i) => {
        const def = BUILDINGS[id];
        return `<span class="bm-slot ${i === activeIdx ? "active" : ""}">
          <kbd>${i + 1}</kbd>${escapeHtml(def?.name ?? id)}
        </span>`;
      })
      .join("");
  }

  setBuildModeStatus(text: string) {
    this.buildModeStatus.hidden = false;
    this.buildModeStatus.textContent = text;
  }

  showGiftPrompt(key: string, label: string, missing: boolean) {
    this.giftPrompt.hidden = false;
    this.giftPrompt.classList.toggle("missing", missing);
    this.giftPrompt.innerHTML = missing
      ? `<span class="gift-icon">!</span>${escapeHtml(label)}`
      : `<span class="key">${escapeHtml(key)}</span>${escapeHtml(label)}`;
  }

  hideGiftPrompt() {
    this.giftPrompt.hidden = true;
  }

  setBar(name: "hp" | "hunger" | "thirst" | "stamina", pct: number) {
    const clamped = Math.max(0, Math.min(1, pct));
    this.bars[name].style.setProperty("--pct", String(clamped));
  }

  showPrompt(key: string, label: string) {
    this.prompt.innerHTML = `<span class="key">${escapeHtml(key)}</span>${escapeHtml(label)}`;
    this.prompt.hidden = false;
  }

  hidePrompt() {
    this.prompt.hidden = true;
  }

  setHotbarSlots(slots: HotbarSlotDef[]) {
    this.hotbar.innerHTML = slots
      .map(
        (s) =>
          `<div class="hotbar-slot" data-slot="${s.num}"><span class="slot-num">${s.num}</span>${
            s.iconUrl
              ? `<img src="${escapeHtml(s.iconUrl)}" alt="">`
              : `<span class="slot-label">${escapeHtml(s.label)}</span>`
          }</div>`,
      )
      .join("");
  }

  private lastHotbarKey = "";
  /** Render hotbar from an Equipment-style array of itemIds (or null). */
  setHotbarFromEquipment(slots: (string | null)[], activeIndex: number) {
    const key = slots.map((s) => s ?? "_").join("|") + ":" + activeIndex;
    if (key === this.lastHotbarKey) return;
    this.lastHotbarKey = key;
    const defs: HotbarSlotDef[] = slots.map((id, i) => ({
      num: i + 1,
      label: id ? shortItemName(id) : "",
    }));
    this.setHotbarSlots(defs);
    this.setActiveHotbar(activeIndex);
  }

  setActiveHotbar(index: number) {
    this.hotbar.querySelectorAll(".hotbar-slot").forEach((el, i) => {
      el.classList.toggle("active", i === index);
    });
  }

  private waypoints: { id: string; label: string; x: number; z: number }[] = [];

  /**
   * Register or update a named compass waypoint. Pass null worldX/worldZ to
   * remove a previously-registered waypoint.
   */
  setWaypoint(id: string, label: string, worldX: number, worldZ: number) {
    const existing = this.waypoints.find((w) => w.id === id);
    if (existing) {
      existing.label = label;
      existing.x = worldX;
      existing.z = worldZ;
    } else {
      this.waypoints.push({ id, label, x: worldX, z: worldZ });
    }
  }

  removeWaypoint(id: string) {
    this.waypoints = this.waypoints.filter((w) => w.id !== id);
  }

  /**
   * Update the compass strip. cameraYawRadians is the camera's azimuthal
   * angle (Babylon ArcRotateCamera.alpha). 0 ≈ looking along +X. Player
   * position is needed to compute waypoint bearings.
   */
  updateCompass(cameraYawRadians: number, playerX: number, playerZ: number) {
    // Convert camera alpha → world heading where N is +Z.
    const headingDeg = (((-cameraYawRadians * 180) / Math.PI) - 90 + 720) % 360;
    const stripWidth = 1080; // virtual full circle width in px

    const ticks = COMPASS_LABELS.map((c) => {
      const x = ((((c.angle - headingDeg + 540) % 360) - 180) / 360) * stripWidth + 190;
      return `<span style="position:absolute;left:${x}px;top:50%;transform:translate(-50%,-50%);">${c.label}</span>`;
    }).join("");

    // Strip shows a window onto the full compass; clamp waypoint markers so
    // off-screen ones still show as edge arrows pointing toward the bearing.
    const visibleHalfDeg = 60; // compass shows ±60° of arc on screen
    const baseStyle =
      "position:absolute;top:72%;color:#ffb347;font-size:11px;font-weight:600;white-space:nowrap;text-shadow:0 1px 2px rgba(0,0,0,0.7);";
    const waypointMarkers = this.waypoints
      .map((w) => {
        const dx = w.x - playerX;
        const dz = w.z - playerZ;
        const bearingDeg = ((Math.atan2(dx, dz) * 180) / Math.PI + 360) % 360;
        const rawDelta = ((bearingDeg - headingDeg + 540) % 360) - 180;
        const dist = Math.round(Math.hypot(dx, dz));
        const labelHtml = `${escapeHtml(w.label)} ${dist}m`;
        if (rawDelta > visibleHalfDeg) {
          return `<span class="compass-waypoint" style="${baseStyle}right:4px;transform:translateY(-50%);">${labelHtml} ▶</span>`;
        }
        if (rawDelta < -visibleHalfDeg) {
          return `<span class="compass-waypoint" style="${baseStyle}left:4px;transform:translateY(-50%);">◀ ${labelHtml}</span>`;
        }
        const x = (rawDelta / 360) * stripWidth + 190;
        return `<span class="compass-waypoint" style="${baseStyle}left:${x}px;transform:translate(-50%,-50%);">▼ ${labelHtml}</span>`;
      })
      .join("");

    this.compassStrip.innerHTML = ticks + waypointMarkers;
  }

  hideLoading() {
    if (!this.loading) return;
    this.loading.classList.add("hidden");
    setTimeout(() => this.loading?.remove(), 700);
  }
}

function mustEl(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`HUD element #${id} missing`);
  return el;
}

function ensureEl(id: string, parentId: string): HTMLElement {
  const existing = document.getElementById(id);
  if (existing) return existing;
  const parent = document.getElementById(parentId);
  if (!parent) throw new Error(`Parent #${parentId} missing`);
  const el = document.createElement("div");
  el.id = id;
  el.hidden = true;
  parent.appendChild(el);
  return el;
}

function mustQ(sel: string): HTMLElement {
  const el = document.querySelector(sel);
  if (!el) throw new Error(`HUD element ${sel} missing`);
  return el as HTMLElement;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}

function shortItemName(id: string): string {
  const name = ITEMS[id]?.name ?? id;
  // Trim long item names to fit the hotbar slot
  return name.length > 9 ? name.slice(0, 9) : name;
}
