/**
 * Maps logical event ids to actual asset paths under /assets/audio/.
 * Source: Kenney RPG Audio pack (CC0). Keys with a trailing `/N` are
 * variants of the same event — `audio.playRandom("swing/bladed")` picks
 * one at random for natural variety.
 *
 * Events not present here (ambient stems, rain bed) intentionally fall
 * back to the procedural synthesis in `Audio.ts` — Kenney RPG Audio is
 * SFX-only.
 */
import type { SoundDef } from "./Audio";

export const SOUND_DEFS: Record<string, SoundDef> = {
  // ---- UI ----
  "ui/menu_open":   { url: "bookOpen.ogg",  bus: "ui",  volume: 0.6 },
  "ui/menu_close":  { url: "bookClose.ogg", bus: "ui",  volume: 0.6 },
  "ui/cancel":      { url: "bookClose.ogg", bus: "ui",  volume: 0.5 },
  "ui/select/0":    { url: "bookFlip1.ogg", bus: "ui",  volume: 0.4 },
  "ui/select/1":    { url: "bookFlip2.ogg", bus: "ui",  volume: 0.4 },
  "ui/select/2":    { url: "bookFlip3.ogg", bus: "ui",  volume: 0.4 },

  // ---- Footsteps (10 variants, surface-agnostic in this pack) ----
  "footstep/0": { url: "footstep00.ogg", bus: "sfx", volume: 0.35 },
  "footstep/1": { url: "footstep01.ogg", bus: "sfx", volume: 0.35 },
  "footstep/2": { url: "footstep02.ogg", bus: "sfx", volume: 0.35 },
  "footstep/3": { url: "footstep03.ogg", bus: "sfx", volume: 0.35 },
  "footstep/4": { url: "footstep04.ogg", bus: "sfx", volume: 0.35 },
  "footstep/5": { url: "footstep05.ogg", bus: "sfx", volume: 0.35 },
  "footstep/6": { url: "footstep06.ogg", bus: "sfx", volume: 0.35 },
  "footstep/7": { url: "footstep07.ogg", bus: "sfx", volume: 0.35 },
  "footstep/8": { url: "footstep08.ogg", bus: "sfx", volume: 0.35 },
  "footstep/9": { url: "footstep09.ogg", bus: "sfx", volume: 0.35 },

  // ---- Combat swings ----
  "swing/bladed/0": { url: "knifeSlice.ogg",  bus: "sfx", volume: 0.55 },
  "swing/bladed/1": { url: "knifeSlice2.ogg", bus: "sfx", volume: 0.55 },
  "swing/blunt/0":  { url: "chop.ogg",        bus: "sfx", volume: 0.55 },
  "swing/sleep/0":  { url: "cloth1.ogg",      bus: "sfx", volume: 0.65 },
  "swing/sleep/1":  { url: "cloth2.ogg",      bus: "sfx", volume: 0.65 },
  "swing/sleep/2":  { url: "cloth3.ogg",      bus: "sfx", volume: 0.65 },

  // ---- Combat hits ----
  "hit/flesh/0": { url: "dropLeather.ogg", bus: "sfx", volume: 0.6 },
  "hit/flesh/1": { url: "metalPot1.ogg",   bus: "sfx", volume: 0.4 },

  // ---- Sleep dart ----
  "dart/fire": { url: "cloth4.ogg",      bus: "sfx", volume: 0.5 },
  "dart/hit":  { url: "dropLeather.ogg", bus: "sfx", volume: 0.5 },

  // ---- Pickups ----
  "pickup/resource/0":   { url: "handleSmallLeather.ogg",  bus: "sfx", volume: 0.5 },
  "pickup/resource/1":   { url: "handleSmallLeather2.ogg", bus: "sfx", volume: 0.5 },
  "pickup/metal/0":      { url: "metalClick.ogg",          bus: "sfx", volume: 0.5 },
  "pickup/metal/1":      { url: "handleCoins.ogg",         bus: "sfx", volume: 0.45 },
  "pickup/metal/2":      { url: "handleCoins2.ogg",        bus: "sfx", volume: 0.45 },
  "pickup/consumable/0": { url: "bookFlip1.ogg",           bus: "sfx", volume: 0.5 },
  "pickup/consumable/1": { url: "bookFlip2.ogg",           bus: "sfx", volume: 0.5 },

  // ---- Building ----
  "build/place/0": { url: "doorClose_1.ogg", bus: "sfx", volume: 0.6 },
  "build/place/1": { url: "doorClose_2.ogg", bus: "sfx", volume: 0.6 },
  "build/place/2": { url: "doorClose_3.ogg", bus: "sfx", volume: 0.6 },
  "build/place/3": { url: "creak1.ogg",      bus: "sfx", volume: 0.5 },

  // ---- Crafting ----
  "craft/success": { url: "metalLatch.ogg", bus: "sfx", volume: 0.6 },
};
