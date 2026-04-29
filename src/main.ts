import "@babylonjs/loaders/glTF";
import "@babylonjs/loaders/OBJ";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { SceneManager } from "./engine/SceneManager";
import { configureRenderingPipeline } from "./engine/RenderingPipeline";
import { InputManager } from "./engine/InputManager";
import { buildIslandData } from "./game/world/IslandGenerator";
import { TerrainRenderer } from "./engine/TerrainRenderer";
import { WaterRenderer } from "./engine/WaterRenderer";
import { ShadowSystem } from "./engine/ShadowSystem";
import { DayNightCycle } from "./engine/DayNightCycle";
import { PlayerController } from "./engine/PlayerController";
import { PickupRegistry } from "./game/systems/PickupRegistry";
import { spawnPickups } from "./game/world/PickupSpawner";
import { PickupRenderer, type PickupModels } from "./engine/PickupRenderer";
import { ITEMS } from "./game/data/items";
import { spawnProps, getAlienShipPosition } from "./game/world/PropSpawner";
import { PropRenderer } from "./engine/PropRenderer";
import { loadGlb } from "./engine/AssetLoader";
import { HarvestableProps } from "./game/systems/HarvestableProps";
import { GrassRenderer } from "./engine/GrassRenderer";
import { AlienManager } from "./game/systems/AlienManager";
import { AlienRenderer } from "./engine/AlienRenderer";
import { CombatController } from "./engine/CombatController";
import { ProjectileSystem } from "./engine/ProjectileSystem";
import { WeatherSystem } from "./engine/WeatherSystem";
import { SurvivalState } from "./game/systems/SurvivalState";
import { InteractionDetector } from "./engine/InteractionDetector";
import { Inventory } from "./game/systems/Inventory";
import { Equipment } from "./game/systems/Equipment";
import { BuildingRegistry } from "./game/systems/Building";
import { BuildingRenderer } from "./engine/BuildingRenderer";
import { BuildModeController } from "./engine/BuildModeController";
import { CraftingMenu } from "./ui/menus/CraftingMenu";
import { InventoryMenu } from "./ui/menus/InventoryMenu";
import { ControlsHelp } from "./ui/menus/ControlsHelp";
import { AudioMixer } from "./ui/menus/AudioMixer";
import { HudManager } from "./ui/hud/HudManager";
import { Audio } from "./engine/Audio";
import { SOUND_DEFS } from "./engine/AudioRegistry";

const ISLAND_SEED = 1337;
const ISLAND_SIZE = 256;

async function bootstrap() {
  const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement | null;
  if (!canvas) throw new Error("renderCanvas not found in DOM");

  const sceneMgr = new SceneManager(canvas);
  const { scene, camera, sun } = sceneMgr;

  const dayNight = new DayNightCycle(scene, sun);
  dayNight.setTime(0.5);

  const shadows = new ShadowSystem(sun);

  const islandData = buildIslandData({ seed: ISLAND_SEED, size: ISLAND_SIZE });
  const terrain = new TerrainRenderer(scene, islandData, shadows);
  const water = new WaterRenderer(scene, islandData);

  const props = spawnProps(islandData);
  console.info(`Spawned ${props.length} props`);

  // Load all Quaternius prop variants in parallel. PropRenderer buckets
  // each instance to a variant deterministically so the forest looks
  // heterogeneous. Per-file failure is non-fatal — the renderer either uses
  // the survivors or falls back to its procedural primitive.
  const tryLoad = async (url: string) => {
    try { return await loadGlb(url, scene); } catch (e) {
      console.warn(`prop model load failed: ${url}`, e);
      return null;
    }
  };
  const treeUrls = [1, 2, 3, 4, 5].map((n) => `/assets/models/flora/PineTree_${n}.obj`);
  // Rocks 1–3 are smaller-mesh variants; 4–7 are larger. Adjust if a
  // particular Rock_N looks the wrong scale at small/large prop sites.
  const rockSmallUrls = [1, 2, 3].map((n) => `/assets/models/flora/Rock_${n}.obj`);
  const rockLargeUrls = [4, 5, 6, 7].map((n) => `/assets/models/flora/Rock_${n}.obj`);
  const [treeVariants, rockSmallVariants, rockLargeVariants] = await Promise.all([
    Promise.all(treeUrls.map(tryLoad)),
    Promise.all(rockSmallUrls.map(tryLoad)),
    Promise.all(rockLargeUrls.map(tryLoad)),
  ]);
  const propRenderer = new PropRenderer(scene, props, shadows, {
    treeVariants,
    rockSmallVariants,
    rockLargeVariants,
  });

  const grass = new GrassRenderer(scene, islandData);
  console.info(`Spawned ${grass.count} grass clumps`);

  const input = new InputManager(scene);

  const player = new PlayerController(scene, camera, input, terrain, shadows);
  const spawn = terrain.findSpawnPoint();
  player.spawnAt(spawn);
  void player.loadCharacter();

  const survival = new SurvivalState();
  const inv = new Inventory();
  const equipment = new Equipment();
  const pickups = new PickupRegistry();
  const spawned = spawnPickups(islandData, pickups);
  console.info(`Spawned ${spawned} pickups`);

  // Pre-load every item model declared in items.ts. Each entry is an array
  // of variant URLs; the resulting Map<itemId, variant[]> is consumed by
  // PickupRenderer. Items without modelPath keep their colored sphere.
  const pickupModels: PickupModels = new Map();
  for (const [itemId, def] of Object.entries(ITEMS)) {
    if (!def.modelPath || def.modelPath.length === 0) continue;
    const loaded = await Promise.all(def.modelPath.map(tryLoad));
    const variants = loaded
      .map((meshes) => {
        if (!meshes) return null;
        const geo = meshes.filter(
          (m): m is Mesh => m instanceof Mesh && m.getTotalVertices() > 0,
        );
        // Hide the source meshes so they don't render at the origin —
        // pickups use createInstance() to reference the geometry.
        for (const m of geo) {
          m.parent = null;
          m.position.set(0, 0, 0);
          m.rotation.set(0, 0, 0);
          m.scaling.set(1, 1, 1);
          m.setEnabled(false);
        }
        return geo.length > 0 ? { meshes: geo } : null;
      })
      .filter((v): v is { meshes: Mesh[] } => v !== null);
    if (variants.length > 0) pickupModels.set(itemId, variants);
  }
  const pickupRenderer = new PickupRenderer(scene, pickups, shadows, pickupModels);

  const buildings = new BuildingRegistry();
  const buildingRenderer = new BuildingRenderer(scene, buildings, shadows);

  // Harvestable props: trees → wood, rocks → stone. Drops spawn as ground
  // pickups at the prop's location; visibility is mirrored on PropRenderer.
  const harvestables = new HarvestableProps(
    props,
    (itemId, count, x, y, z) => {
      for (let i = 0; i < count; i++) {
        const jx = (Math.random() - 0.5) * 1.4;
        const jz = (Math.random() - 0.5) * 1.4;
        const drop = pickups.add(itemId, x + jx, y, z + jz);
        pickupRenderer.spawn(drop);
      }
    },
    (propIndex, visible) => propRenderer.setVisible(propIndex, visible),
  );

  // Aliens — peaceful Scrunklers scattered, Glarn cluster around the ship,
  // Vex elite at the ship itself.
  const aliens = new AlienManager(ISLAND_SEED + 13);
  const ship = getAlienShipPosition(islandData);
  aliens.spawn("vex", ship.x + 2, ship.z - 1);
  aliens.spawn("glarn", ship.x + 6, ship.z + 4);
  aliens.spawn("glarn", ship.x - 5, ship.z + 3);
  aliens.spawn("glarn", ship.x + 1, ship.z + 7);
  aliens.spawn("scrunkler", spawn.x + 9, spawn.z + 4);
  aliens.spawn("scrunkler", spawn.x - 12, spawn.z - 3);
  aliens.spawn("scrunkler", spawn.x + 4, spawn.z - 11);
  const alienRenderer = new AlienRenderer(scene, aliens, terrain, shadows);

  const hud = new HudManager();
  hud.setHotbarFromEquipment(equipment.hotbar, equipment.activeIndex);
  // Spawn point doubles as the base waypoint until a campfire is placed.
  hud.setWaypoint("base", "Base", spawn.x, spawn.z);

  const audio = new Audio(scene);
  audio.defineAll(SOUND_DEFS);
  // Browsers block audio until the first user gesture; force-resume on
  // pointer or key input so spatial sounds and ambient stems can start.
  const resume = () => audio.resume();
  window.addEventListener("pointerdown", resume, { once: true });
  window.addEventListener("keydown", resume, { once: true });

  const interactions = new InteractionDetector(
    scene,
    player.root,
    input,
    pickups,
    pickupRenderer,
    inv,
    hud,
    audio,
  );

  const buildMode = new BuildModeController(
    scene,
    camera,
    input,
    terrain,
    buildings,
    buildingRenderer,
    inv,
    hud,
    player.root,
    audio,
  );

  // Biome ambient — sample where the player stands; on change, crossfade
  // the procedural ambient bed. Sampled at 1Hz rather than per-frame
  // because biome transitions are slow and ambient changes should be too.
  const BIOME_NAMES = ["ocean", "beach", "grassland", "forest", "highlands", "aliencrashsite", "swamp"];
  // Maps biome name → footstep material. Walking through Forest sounds the
  // same as Grassland since both are loamy underfoot.
  const FOOTSTEP_BY_BIOME: Record<string, "grass" | "sand" | "stone" | "wet" | "metal"> = {
    beach: "sand",
    grassland: "grass",
    forest: "grass",
    highlands: "stone",
    swamp: "wet",
    aliencrashsite: "metal",
    ocean: "wet",
    default: "grass",
  };
  let biomeAccum = 0;
  let lastBiomeName: string | null = null;
  let currentBiomeName = "default";
  const sampleBiome = () => {
    const id = terrain.biomeAt(player.root.position.x, player.root.position.z);
    const name = BIOME_NAMES[id] ?? "default";
    currentBiomeName = name;
    if (name !== lastBiomeName) {
      audio.setAmbientSynth(name);
      lastBiomeName = name;
    }
  };

  // Footsteps — fire on a stride cadence while the player is moving. Faster
  // cadence while sprinting; material picked from current biome.
  const STEP_INTERVAL_WALK = 0.45;
  const STEP_INTERVAL_SPRINT = 0.30;
  let stepAccum = 0;

  const combat = new CombatController(
    input, aliens, alienRenderer, inv, equipment, survival, player.root, camera, hud, audio,
    harvestables,
  );
  const projectiles = new ProjectileSystem(
    scene, camera, input, inv, equipment, aliens, player.root, terrain, audio,
  );
  const weather = new WeatherSystem(scene, player.root, survival, inv, audio);

  const crafting = new CraftingMenu(
    inv,
    () => ({
      nearbyStations: buildings.nearbyStations(player.root.position.x, player.root.position.z),
    }),
    { onCraftSuccess: () => audio.playCraftSuccess() },
  );
  const inventoryMenu = new InventoryMenu(inv);
  new ControlsHelp();
  new AudioMixer(audio);

  configureRenderingPipeline(scene, camera);

  scene.onBeforeRenderObservable.add(() => {
    const dt = scene.getEngine().getDeltaTime() / 1000;

    if (input.wasJustPressed("craft")) {
      crafting.toggle();
      audio.playClick(crafting.open ? "open" : "close");
    }
    if (input.wasJustPressed("inventory")) {
      inventoryMenu.toggle();
      audio.playClick(inventoryMenu.open ? "open" : "close");
    }
    if (input.wasJustPressed("cancel")) {
      const wasOpen = crafting.open || inventoryMenu.open;
      if (crafting.open) crafting.toggle(false);
      if (inventoryMenu.open) inventoryMenu.toggle(false);
      if (wasOpen) audio.playClick("cancel");
    }
    if (inventoryMenu.open) inventoryMenu.refresh();

    // Hotbar slot select (1-9). Skip when build mode is using number keys.
    if (!buildMode.active) {
      for (let i = 0; i < 9; i++) {
        const action = `slot${i + 1}` as
          | "slot1" | "slot2" | "slot3" | "slot4" | "slot5"
          | "slot6" | "slot7" | "slot8" | "slot9";
        if (input.wasJustPressed(action)) {
          equipment.setActive(i);
          audio.playClick("select");
        }
      }
    }

    dayNight.tick(dt);
    water.tick(dt);
    grass.tick(dt);
    player.tick(dt);
    survival.tick(dt, { isMoving: player.isMoving(), isSprinting: player.isSprinting() });
    pickupRenderer.tick(dt);
    interactions.tick(buildMode.active || crafting.open || inventoryMenu.open);
    buildMode.tick();
    harvestables.tick(performance.now() / 1000);
    combat.tick(dt, buildMode.active || crafting.open || inventoryMenu.open);
    projectiles.tick(dt, buildMode.active || crafting.open || inventoryMenu.open);
    weather.tick(dt);

    biomeAccum += dt;
    if (biomeAccum >= 1.0) {
      biomeAccum = 0;
      sampleBiome();
    }

    if (player.isMoving()) {
      stepAccum += dt;
      const interval = player.isSprinting() ? STEP_INTERVAL_SPRINT : STEP_INTERVAL_WALK;
      if (stepAccum >= interval) {
        stepAccum = 0;
        audio.playFootstep(FOOTSTEP_BY_BIOME[currentBiomeName] ?? "grass");
      }
    } else {
      // Reset cadence so the first step after standing fires near-immediately.
      stepAccum = STEP_INTERVAL_WALK * 0.7;
    }

    // Tiny camera-shake while a swing flash is active — reads combat.swingFlash
    if (combat.swingFlash > 0) {
      const k = combat.swingFlash * 0.10;
      camera.target.x += (Math.random() - 0.5) * k;
      camera.target.y += (Math.random() - 0.5) * k * 0.6;
      camera.target.z += (Math.random() - 0.5) * k;
    }

    aliens.tick({
      playerX: player.root.position.x,
      playerZ: player.root.position.z,
      dt,
      applyPlayerDamage: (hp) => survival.consume({ hp: -hp }),
    });
    alienRenderer.tick();

    const s = survival.snapshot();
    hud.setBar("hp", s.hp);
    hud.setBar("hunger", s.hunger);
    hud.setBar("thirst", s.thirst);
    hud.setBar("stamina", s.stamina);
    hud.setInventoryStrip(inv);

    // Sync hotbar from inventory + active slot
    equipment.sync(inv);
    hud.setHotbarFromEquipment(equipment.hotbar, equipment.activeIndex);

    hud.updateCompass(camera.alpha, player.root.position.x, player.root.position.z);
  });

  scene.onAfterRenderObservable.addOnce(() => hud.hideLoading());

  if (import.meta.env.DEV) {
    (window as unknown as { __game: unknown }).__game = {
      engine: sceneMgr.engine,
      scene,
      camera,
      sun,
      dayNight,
      terrain,
      water,
      player,
      survival,
      inv,
      pickups,
      pickupRenderer,
      propRenderer,
      harvestables,
      buildings,
      buildMode,
      crafting,
      aliens,
      alienRenderer,
      combat,
      equipment,
      projectiles,
      weather,
      audio,
    };
  }

  window.addEventListener("resize", () => sceneMgr.engine.resize());
  sceneMgr.engine.runRenderLoop(() => scene.render());
}

bootstrap().catch((err) => {
  console.error("Failed to start game:", err);
  const overlay = document.getElementById("loading-overlay");
  if (overlay) overlay.querySelector(".loader-text")!.textContent = "Failed to load — check console";
});
