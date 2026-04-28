/**
 * Engine-side audio wrapper around Babylon's `Sound`. Game code calls this
 * by id (`audio.playOneShot("ui/click")`) and never touches Babylon audio
 * primitives directly.
 *
 * Design:
 *  - Sounds are *defined* (id → url + bus + flags) up front, but loaded
 *    lazily on first play so a fresh boot doesn't hit every asset.
 *  - Buses (`ambient`, `sfx`, `music`, `ui`) carry independent volumes,
 *    multiplied by `master`. Mixer values persist to localStorage so the
 *    user's preference survives reloads.
 *  - Ambient stems crossfade — `setAmbient(id)` fades the previous stem
 *    out and the new one in over `fadeMs`.
 *  - Browser autoplay policy: an audio context starts suspended until the
 *    user interacts. Babylon's `AudioEngine` handles this natively, but
 *    we expose `resume()` so a `pointerdown`/`keydown` handler can force
 *    the context to start in case it stays stuck.
 */
import "@babylonjs/core/Audio/audioSceneComponent"; // registers the scene component
import type { Scene } from "@babylonjs/core/scene";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import { Sound } from "@babylonjs/core/Audio/sound";

export type AudioBus = "ambient" | "sfx" | "music" | "ui";

export interface SoundDef {
  /** Path under `public/assets/audio/` (e.g. "sfx/combat/swing_blade.ogg"). */
  url: string;
  /** Mixer bus this sound belongs to. */
  bus: AudioBus;
  /** Loop the sound (used for ambient stems and rain loops). */
  loop?: boolean;
  /** Per-sound volume multiplier (0–1). Useful for normalizing loud assets. */
  volume?: number;
  /** True for sounds that play attached to a world mesh. */
  spatial?: boolean;
  /** Max audible distance for spatial sounds. */
  maxDistance?: number;
}

const STORAGE_KEY = "island-audio-mixer";
const ASSET_PREFIX = "/assets/audio/";

const DEFAULT_VOLUMES: { master: number } & Record<AudioBus, number> = {
  master: 1.0,
  ambient: 0.6,
  sfx: 0.9,
  music: 0.5,
  ui: 0.7,
};

export class Audio {
  private readonly scene: Scene;
  private readonly defs = new Map<string, SoundDef>();
  private readonly library = new Map<string, Sound>();
  private readonly volumes: { master: number } & Record<AudioBus, number>;
  private currentAmbientId: string | null = null;
  private resumed = false;
  private synthCtx: AudioContext | null = null;
  private synthAmbient: { src: AudioBufferSourceNode; gain: GainNode; biomeId: string } | null = null;
  private synthRain: { src: AudioBufferSourceNode; gain: GainNode } | null = null;

  constructor(scene: Scene) {
    this.scene = scene;
    this.volumes = this.loadVolumes();
  }

  /** Register a sound definition. The asset is fetched on first play. */
  define(id: string, def: SoundDef) {
    this.defs.set(id, def);
  }

  defineAll(registry: Record<string, SoundDef>) {
    for (const [id, def] of Object.entries(registry)) this.define(id, def);
  }

  /**
   * Force the audio context to start. Safe to call multiple times. Call
   * this from a user-gesture handler (pointerdown / keydown) — the
   * browser will refuse to start a suspended context otherwise.
   */
  resume() {
    if (this.resumed) return;
    const ctx = AbstractEngine.audioEngine?.audioContext ?? null;
    if (ctx && ctx.state === "suspended") {
      void ctx.resume();
    }
    this.resumed = true;
  }

  setVolume(bus: AudioBus | "master", value: number) {
    this.volumes[bus] = clamp01(value);
    this.saveVolumes();
    this.refreshLiveSounds();
  }

  getVolume(bus: AudioBus | "master"): number {
    return this.volumes[bus];
  }

  /**
   * Fire-and-forget play. The first call for an id triggers the load.
   * Returns true if a def existed (asset will play once loaded), false if
   * the id is unknown — callers can use that to fall back to procedural.
   */
  playOneShot(id: string, opts?: { volume?: number }): boolean {
    const sound = this.getOrLoad(id);
    if (!sound) return false;
    sound.setVolume(this.busGain(id) * (opts?.volume ?? 1));
    sound.play();
    return true;
  }

  /**
   * Play a random variant. Looks for an exact def at `idOrPrefix` first;
   * if none, picks one of the direct children (`<prefix>/<x>` keys) at
   * random. Returns false if nothing matches — caller falls back.
   */
  playRandom(idOrPrefix: string): boolean {
    if (this.defs.has(idOrPrefix)) return this.playOneShot(idOrPrefix);
    const matchPrefix = idOrPrefix.endsWith("/") ? idOrPrefix : idOrPrefix + "/";
    const candidates: string[] = [];
    for (const key of this.defs.keys()) {
      if (!key.startsWith(matchPrefix)) continue;
      const rest = key.slice(matchPrefix.length);
      if (!rest.includes("/")) candidates.push(key);
    }
    if (candidates.length === 0) return false;
    const id = candidates[(Math.random() * candidates.length) | 0]!;
    return this.playOneShot(id);
  }

  /** Play a 3D-positional sound attached to a world transform. */
  playSpatial(id: string, target: TransformNode, opts?: { volume?: number }) {
    const sound = this.getOrLoad(id);
    if (!sound) return;
    sound.attachToMesh(target);
    sound.setVolume(this.busGain(id) * (opts?.volume ?? 1));
    sound.play();
  }

  /**
   * Crossfade the ambient bed. Pass null to fade out and stop. Sounds in
   * the ambient bus are expected to be loop=true.
   */
  setAmbient(id: string | null, fadeMs = 1500) {
    if (id === this.currentAmbientId) return;
    const fadeSec = fadeMs / 1000;
    const prevId = this.currentAmbientId;
    if (prevId) {
      const prev = this.library.get(prevId);
      if (prev) {
        prev.setVolume(0, fadeSec);
        window.setTimeout(() => {
          // Only stop if we haven't switched back to this stem in the meantime.
          if (this.currentAmbientId !== prevId) prev.stop();
        }, fadeMs + 30);
      }
    }
    this.currentAmbientId = id;
    if (id == null) return;
    const next = this.getOrLoad(id);
    if (!next) return;
    next.setVolume(0);
    next.play();
    next.setVolume(this.busGain(id), fadeSec);
  }

  /** Currently-playing ambient id (if any), exposed for HUD/dev display. */
  getAmbientId(): string | null {
    return this.currentAmbientId;
  }

  /**
   * UI click. `kind` chooses the right asset family (and the right
   * synthesized fallback frequency if no def is registered).
   */
  playClick(kind: "open" | "close" | "select" | "cancel" = "select") {
    const id =
      kind === "open"   ? "ui/menu_open"
      : kind === "close"  ? "ui/menu_close"
      : kind === "cancel" ? "ui/cancel"
      : "ui/select";
    if (this.playRandom(id)) return;
    const ctx = this.getSynthCtx();
    if (!ctx) return;
    const freq =
      kind === "open"   ? 880
      : kind === "close"  ? 660
      : kind === "cancel" ? 540
      : 1100;
    const dur = kind === "select" ? 0.035 : 0.060;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const peak = 0.18 * this.volumes.ui * this.volumes.master;
    osc.type = "square";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(peak, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  }

  /**
   * Weapon swing. Tries `swing/<kind>` asset first, falls back to
   * band-pass-filtered noise burst.
   */
  playSwing(kind: "bladed" | "blunt" | "sleep") {
    if (this.playRandom(`swing/${kind}`)) return;
    const ctx = this.getSynthCtx();
    if (!ctx) return;
    const dur = 0.14;
    const buf = this.makeNoiseBuffer(ctx, dur);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = kind === "bladed" ? 1900 : kind === "blunt" ? 650 : 1200;
    filter.Q.value = 0.9;
    const gain = ctx.createGain();
    const peak = 0.30 * this.volumes.sfx * this.volumes.master;
    gain.gain.setValueAtTime(peak, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0005, ctx.currentTime + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start();
  }

  /**
   * Hit thud. Tries `hit/<material>` asset first, falls back to a short
   * pitched-down sine burst.
   */
  playHit(material: "flesh" | "stone" | "metal") {
    if (this.playRandom(`hit/${material}`)) return;
    const ctx = this.getSynthCtx();
    if (!ctx) return;
    const dur = 0.10;
    const osc = ctx.createOscillator();
    osc.type = material === "metal" ? "triangle" : "sine";
    const start = material === "flesh" ? 130 : material === "stone" ? 210 : 360;
    osc.frequency.setValueAtTime(start, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(start * 0.5, ctx.currentTime + dur);
    const gain = ctx.createGain();
    const peak = 0.42 * this.volumes.sfx * this.volumes.master;
    gain.gain.setValueAtTime(peak, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0005, ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  }

  /**
   * Dart sound. Tries `dart/<phase>` asset first, falls back to procedural
   * (high-pass noise tick for fire, flesh thud + airy decay for hit).
   */
  playDart(phase: "fire" | "hit") {
    if (this.playRandom(`dart/${phase}`)) return;
    const ctx = this.getSynthCtx();
    if (!ctx) return;
    if (phase === "fire") {
      const dur = 0.08;
      const buf = this.makeNoiseBuffer(ctx, dur);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.value = 2400;
      const gain = ctx.createGain();
      const peak = 0.22 * this.volumes.sfx * this.volumes.master;
      gain.gain.setValueAtTime(peak, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0005, ctx.currentTime + dur);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      src.start();
    } else {
      this.playHit("flesh");
      const dur = 0.35;
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(420, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + dur);
      const gain = ctx.createGain();
      const peak = 0.18 * this.volumes.sfx * this.volumes.master;
      gain.gain.setValueAtTime(peak, ctx.currentTime + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0005, ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + 0.04);
      osc.stop(ctx.currentTime + dur);
    }
  }

  /**
   * Pickup tap. Tries `pickup/<material>` asset first, falls back to
   * pitched sine sweep (woody / metallic / soft per material).
   */
  playPickup(material: "resource" | "metal" | "consumable") {
    if (this.playRandom(`pickup/${material}`)) return;
    const ctx = this.getSynthCtx();
    if (!ctx) return;
    const dur = material === "metal" ? 0.16 : 0.10;
    const osc = ctx.createOscillator();
    osc.type = material === "metal" ? "triangle" : material === "consumable" ? "sine" : "sine";
    const startFreq = material === "metal" ? 880 : material === "consumable" ? 720 : 320;
    const endFreq = material === "metal" ? 1320 : material === "consumable" ? 880 : 220;
    osc.frequency.setValueAtTime(startFreq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(endFreq, ctx.currentTime + dur);
    const gain = ctx.createGain();
    const peak = 0.30 * this.volumes.sfx * this.volumes.master;
    gain.gain.setValueAtTime(peak, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0005, ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  }

  /** Craft success. Tries `craft/success` asset first, falls back to a two-note ascending chime. */
  playCraftSuccess() {
    if (this.playRandom("craft/success")) return;
    const ctx = this.getSynthCtx();
    if (!ctx) return;
    const peak = 0.22 * this.volumes.sfx * this.volumes.master;
    const noteAt = (freq: number, startSec: number, durSec: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      const t0 = ctx.currentTime + startSec;
      gain.gain.setValueAtTime(peak, t0);
      gain.gain.exponentialRampToValueAtTime(0.0005, t0 + durSec);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + durSec);
    };
    noteAt(660, 0.00, 0.18); // E5
    noteAt(990, 0.10, 0.24); // B5
  }

  /** Build-place. Tries `build/place` asset first, falls back to a low thud. */
  playBuildPlace() {
    if (this.playRandom("build/place")) return;
    const ctx = this.getSynthCtx();
    if (!ctx) return;
    const dur = 0.18;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(180, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(70, ctx.currentTime + dur);
    const gain = ctx.createGain();
    const peak = 0.50 * this.volumes.sfx * this.volumes.master;
    gain.gain.setValueAtTime(peak, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0005, ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  }

  /**
   * Procedural rain bed — a continuous low/mid filtered noise source.
   * Independent of the biome ambient (they layer). Crossfades on/off.
   */
  setRain(on: boolean, fadeMs = 1500) {
    const ctx = this.getSynthCtx();
    if (!ctx) return;
    const fadeSec = fadeMs / 1000;
    const now = ctx.currentTime;
    if (!on) {
      if (!this.synthRain) return;
      const prev = this.synthRain;
      prev.gain.gain.cancelScheduledValues(now);
      prev.gain.gain.setValueAtTime(prev.gain.gain.value, now);
      prev.gain.gain.exponentialRampToValueAtTime(0.0001, now + fadeSec);
      window.setTimeout(() => {
        try { prev.src.stop(); } catch { /* already stopped */ }
      }, fadeMs + 30);
      this.synthRain = null;
      return;
    }
    if (this.synthRain) return; // already raining
    const buf = this.makeNoiseBuffer(ctx, 2.0);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = 4200;
    lowpass.Q.value = 0.4;
    const highpass = ctx.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = 600;
    highpass.Q.value = 0.5;
    const gain = ctx.createGain();
    const peak = 0.18 * this.volumes.sfx * this.volumes.master;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), now + fadeSec);
    src.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(ctx.destination);
    src.start();
    this.synthRain = { src, gain };
  }

  /**
   * Footstep. Tries `footstep/<material>` (surface-specific) then
   * `footstep` (10 surface-agnostic Kenney variants), falls back to
   * material-shifted procedural noise. Caller drives the stride cadence.
   */
  playFootstep(material: "grass" | "sand" | "stone" | "wet" | "metal") {
    if (this.playRandom(`footstep/${material}`)) return;
    if (this.playRandom("footstep")) return;
    const ctx = this.getSynthCtx();
    if (!ctx) return;
    const dur = material === "stone" ? 0.07 : 0.10;
    const buf = this.makeNoiseBuffer(ctx, dur);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    const params = FOOTSTEP_PARAMS[material];
    filter.type = params.type;
    filter.frequency.value = params.freq;
    filter.Q.value = params.q;
    const gain = ctx.createGain();
    const peak = params.volume * this.volumes.sfx * this.volumes.master;
    gain.gain.setValueAtTime(peak, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0005, ctx.currentTime + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start();
  }

  /**
   * Procedural biome ambient — looped band-pass-filtered noise at a low
   * volume. Each biome gets a distinct band so the sonic palette changes
   * as the player crosses zones. Crossfades on biome change. Stand-in
   * until the real `ambient/<biome>.ogg` stems are dropped in.
   */
  setAmbientSynth(biomeId: string | null, fadeMs = 1500) {
    if (this.synthAmbient && this.synthAmbient.biomeId === biomeId) return;
    const ctx = this.getSynthCtx();
    if (!ctx) return;
    const fadeSec = fadeMs / 1000;
    const now = ctx.currentTime;

    // Fade out the previous bed.
    if (this.synthAmbient) {
      const prev = this.synthAmbient;
      prev.gain.gain.cancelScheduledValues(now);
      prev.gain.gain.setValueAtTime(prev.gain.gain.value, now);
      prev.gain.gain.exponentialRampToValueAtTime(0.0001, now + fadeSec);
      window.setTimeout(() => {
        try { prev.src.stop(); } catch { /* already stopped */ }
      }, fadeMs + 30);
      this.synthAmbient = null;
    }
    if (biomeId == null) return;

    const params = AMBIENT_PARAMS[biomeId] ?? AMBIENT_PARAMS.default;
    // 2-second noise loop is short enough to fit in memory yet long enough
    // to avoid a perceptible click on repeat at low band-pass settings.
    const buf = this.makeNoiseBuffer(ctx, 2.0);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = params.freq;
    filter.Q.value = params.q;

    const gain = ctx.createGain();
    const peak = params.volume * this.volumes.ambient * this.volumes.master;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), now + fadeSec);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start();

    this.synthAmbient = { src, gain, biomeId };
  }

  /** Currently-playing procedural-ambient biome id (if any), for HUD/dev. */
  getAmbientBiome(): string | null {
    return this.synthAmbient?.biomeId ?? null;
  }

  private getSynthCtx(): AudioContext | null {
    if (this.synthCtx) {
      if (this.synthCtx.state === "suspended") void this.synthCtx.resume();
      return this.synthCtx;
    }
    if (typeof AudioContext === "undefined") return null;
    this.synthCtx = new AudioContext();
    return this.synthCtx;
  }

  private makeNoiseBuffer(ctx: AudioContext, durSec: number): AudioBuffer {
    const n = Math.max(1, Math.floor(ctx.sampleRate * durSec));
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  private getOrLoad(id: string): Sound | null {
    const cached = this.library.get(id);
    if (cached) return cached;
    const def = this.defs.get(id);
    if (!def) {
      console.warn(`[Audio] no def for "${id}"`);
      return null;
    }
    const url = def.url.startsWith("http") || def.url.startsWith("/") ? def.url : ASSET_PREFIX + def.url;
    const sound = new Sound(id, url, this.scene, null, {
      loop: def.loop ?? false,
      autoplay: false,
      spatialSound: def.spatial ?? false,
      maxDistance: def.maxDistance ?? 80,
      volume: 1.0, // bus gain is applied at play time
    });
    this.library.set(id, sound);
    return sound;
  }

  private busGain(id: string): number {
    const def = this.defs.get(id);
    if (!def) return 0;
    return (def.volume ?? 1) * this.volumes[def.bus] * this.volumes.master;
  }

  private refreshLiveSounds() {
    if (this.currentAmbientId) {
      const sound = this.library.get(this.currentAmbientId);
      if (sound) sound.setVolume(this.busGain(this.currentAmbientId));
    }
  }

  private loadVolumes(): { master: number } & Record<AudioBus, number> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_VOLUMES };
      const parsed = JSON.parse(raw) as Partial<typeof DEFAULT_VOLUMES>;
      return { ...DEFAULT_VOLUMES, ...parsed };
    } catch {
      return { ...DEFAULT_VOLUMES };
    }
  }

  private saveVolumes() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.volumes));
    } catch {
      // localStorage unavailable (privacy mode / quota) — ignore
    }
  }
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * Per-biome filter parameters for the procedural ambient. Tuned by ear:
 * low/wide for water and forest, narrower bands for highlands wind, an
 * unsettling detuned pair for the alien zone. `volume` is the gain peak
 * at full mixer; the player won't notice unless their environment is
 * fully quiet.
 */
const FOOTSTEP_PARAMS: Record<string, { type: BiquadFilterType; freq: number; q: number; volume: number }> = {
  sand:  { type: "lowpass",  freq:  600, q: 0.5, volume: 0.25 },
  grass: { type: "bandpass", freq:  900, q: 0.7, volume: 0.20 },
  stone: { type: "highpass", freq: 1200, q: 0.9, volume: 0.30 },
  wet:   { type: "lowpass",  freq:  500, q: 1.4, volume: 0.28 }, // squelch
  metal: { type: "bandpass", freq: 2400, q: 1.5, volume: 0.22 },
};

const AMBIENT_PARAMS: Record<string, { freq: number; q: number; volume: number }> = {
  ocean:          { freq:  220, q: 0.7, volume: 0.10 },
  beach:          { freq:  340, q: 0.8, volume: 0.08 },
  grassland:      { freq:  600, q: 0.6, volume: 0.06 },
  forest:         { freq:  420, q: 0.9, volume: 0.07 },
  highlands:      { freq: 1200, q: 1.2, volume: 0.05 },
  swamp:          { freq:  280, q: 1.5, volume: 0.08 },
  aliencrashsite: { freq:  900, q: 2.5, volume: 0.09 },
  default:        { freq:  500, q: 0.8, volume: 0.05 },
};
