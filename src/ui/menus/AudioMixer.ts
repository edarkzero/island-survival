/**
 * Audio mixer panel. Small speaker icon at bottom-left; clicking expands a
 * vertical slider stack for master + per-bus volumes. Values write back
 * through Audio.setVolume(), which persists to localStorage.
 */
import type { Audio, AudioBus } from "../../engine/Audio";

const ROWS: { id: AudioBus | "master"; label: string }[] = [
  { id: "master",  label: "Master" },
  { id: "ambient", label: "Ambient" },
  { id: "sfx",     label: "SFX" },
  { id: "music",   label: "Music" },
  { id: "ui",      label: "UI" },
];

export class AudioMixer {
  private readonly audio: Audio;
  private readonly root: HTMLElement;
  private expanded = false;

  constructor(audio: Audio) {
    this.audio = audio;
    this.root = document.createElement("div");
    this.root.id = "audio-mixer";
    document.body.appendChild(this.root);
    this.renderCollapsed();
    this.root.addEventListener("click", this.onClick);
    this.root.addEventListener("input", this.onInput);
  }

  private renderCollapsed() {
    this.expanded = false;
    this.root.classList.remove("expanded");
    const muted = this.audio.getVolume("master") === 0;
    this.root.innerHTML = `<button data-act="toggle" aria-label="Audio">${muted ? "🔇" : "🔊"} Audio</button>`;
  }

  private renderExpanded() {
    this.expanded = true;
    this.root.classList.add("expanded");
    const rows = ROWS.map((r) => {
      const v = Math.round(this.audio.getVolume(r.id) * 100);
      return `<tr>
        <th>${r.label}</th>
        <td><input type="range" min="0" max="100" value="${v}" data-bus="${r.id}"></td>
        <td class="mixer-value" data-display-bus="${r.id}">${v}</td>
      </tr>`;
    }).join("");
    this.root.innerHTML = `
      <button data-act="toggle" aria-label="Close">×</button>
      <h4>Audio</h4>
      <table>${rows}</table>`;
  }

  private onClick = (ev: MouseEvent) => {
    const t = ev.target as HTMLElement | null;
    if (!t) return;
    if (t.closest('[data-act="toggle"]')) {
      if (this.expanded) this.renderCollapsed();
      else this.renderExpanded();
    }
  };

  private onInput = (ev: Event) => {
    const t = ev.target as HTMLInputElement | null;
    if (!t || !t.dataset.bus) return;
    const bus = t.dataset.bus as AudioBus | "master";
    const value = Number(t.value) / 100;
    this.audio.setVolume(bus, value);
    const display = this.root.querySelector<HTMLElement>(`[data-display-bus="${bus}"]`);
    if (display) display.textContent = String(Math.round(value * 100));
  };
}
