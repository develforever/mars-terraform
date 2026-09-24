import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { PlacedBuilding } from "../../domain/entities/Building";
import type { Resources, ResourceCapacity, ResourceDelta, ResourceKey } from "../../domain/entities/Resources";
import { INITIAL_COLONY_STATE } from "../../domain/entities/Colony";
import { BUILDING_DEFINITIONS } from "../../domain/config/buildings";
import { BuildingService } from "../../domain/services/BuildingService";
import { EconomyService, EMERGENCY_LIFE_SUPPORT_DEFAULT_SECONDS, type EmergencyLifeSupportState } from "../../domain/services/EconomyService";
import { WeatherService } from "../../domain/services/WeatherService";
import type { WeatherState } from "../../domain/services/WeatherService";
import { TerraformingService } from "../../domain/services/TerraformingService";
import { MeteorService } from "../../domain/services/MeteorService";
import type { DifficultyLevel } from "../../domain/services/TerraformingService";
import { useDebugStore } from "./useDebugStore";
import { useUIStore } from "./useUIStore";
import type { GameMode } from "../../domain/services/GameModeService";
import { GAME_MODE_CONFIGS } from "../../domain/services/GameModeService";
import { AlienService, INITIAL_ALIEN_STATE } from "../../domain/services/AlienService";
import type { AlienState, AlienShip, AlienGroundUnit } from "../../domain/entities/Alien";
import { authClient } from "../service/authService";
import { apiUrl } from "../config/apiConfig";
import { HexGrid } from "../../presentation/generator/hex/HexGrid";
import { applyProceduralTerrain } from "../../presentation/generator/terrain/ProceduralTerrain";
import { generateResources, generateDecor, generateSpawns } from "../../presentation/generator/terrain/ProceduralPlacement";
import { hexToWorld } from "../../presentation/generator/hex/HexMath";
import type { MapExportJSON, ResourceNode, DecorItem } from "../../domain/mapEditorTypes";
import { ResearchService } from "../../domain/services/ResearchService";
import { TECH_IDS } from "../../domain/config/technologies";
import type { QuestState } from "../../domain/entities/Quest";
import { QuestService } from "../../domain/services/QuestService";
import type { Scenario } from "../../domain/entities/Scenario";
import { ScenarioService } from "../../domain/services/ScenarioService";
import type { GameAnalyticsSnapshot } from "../../domain/entities/GameStats";
import { GameAnalyticsService } from "../../domain/services/GameAnalyticsService";
import type { ColonistRole, ColonyPopulation, MoraleState } from "../../domain/entities/Colonist";
import { INITIAL_POPULATION, INITIAL_MORALE } from "../../domain/entities/Colonist";
import { ColonistService } from "../../domain/services/ColonistService";
import type { PlacedUnit } from "../../domain/entities/Unit";
import { UNIT_IDS } from "../../domain/config/units";
import { RTSCommandService, type RTSOrder } from "../../domain/services/RTSCommandService";
import { LocalSaveService, type SavedGame } from "../service/localSaveService";

export interface GameState {
  // Resources and colony state
  resources: Resources;
  capacity: ResourceCapacity;
  lastDelta?: ResourceDelta;
  sun: number;
  alive: boolean;
  colonyName: string;
  currentScenarioId?: string | null;
  mapSeed: number;

  // Time & Speed Controls (Pauza taktyczna i prędkość symulacji)
  isPaused: boolean;
  gameSpeed: 1 | 2 | 4;

  // Emergency Life Support buffer
  emergencyLifeSupport: EmergencyLifeSupportState;

  // Colonists & Morale (Faza 7.1)
  population: ColonyPopulation;
  morale: MoraleState;

  // Time & Analytics
  tick: number;
  sol: number;
  aliensDefeated: number;
  analyticsSnapshots: GameAnalyticsSnapshot[];
  isEndless: boolean;
  victoryModalDismissed: boolean;
  defeatModalDismissed: boolean;

  // Hex Grid Terrain, Resources & Decorations
  hexGrid: HexGrid;
  resourceNodes: ResourceNode[];
  decorations: DecorItem[];
  decor?: DecorItem[];
  currentMapData?: MapExportJSON | null;

  // Buildings & Units
  placed: PlacedBuilding[];
  occupied: Record<string, string>;
  units: PlacedUnit[];

  // Weather
  weather: WeatherState;

  // Terraforming
  terraforming: number;
  o2Accumulated: number;
  waterLevel: number;
  difficulty: DifficultyLevel;
  gameMode: GameMode;
  alienState: AlienState;
  won: boolean;
  isDevFixture: boolean;

  // Research System
  researchPoints: number;
  unlockedTechs: string[];

  // Campaign Quest Engine
  activeQuests: QuestState[];

  // Actions
  setSun: (factor: number) => void;
  setColonyName: (name: string) => void;
  setDifficulty: (level: DifficultyLevel) => void;
  setGameMode: (mode: GameMode) => void;
  togglePause: () => void;
  setIsPaused: (isPaused: boolean) => void;
  setGameSpeed: (speed: 1 | 2 | 4) => void;
  placeBuilding: (cell: { x: number; z: number }, heightY: number, definitionId: string) => boolean;
  demolishBuilding: (cell: { x: number; z: number }) => boolean;
  upgradeBuilding: (buildingId: string) => boolean;
  toggleBuildingPower: (buildingId: string) => boolean;
  issueOrderToUnits: (unitIds: string[], order: RTSOrder) => void;
  updateUnits: (units: PlacedUnit[]) => void;
  addUnit: (unit: PlacedUnit) => void;
  removeUnit: (id: string) => void;
  assignColonistRole: (role: ColonistRole, delta: number) => void;
  applyEconomyTick: () => void;
  resetGame: () => void;
  startNewGame: (name: string, difficulty: DifficultyLevel, gameMode: GameMode, mapData?: MapExportJSON | null, seed?: number) => void;
  startScenarioGame: (scenario: Scenario, colonyName?: string, customSeed?: number) => void;
  saveGame: () => Promise<boolean>;
  loadGame: (name: string) => Promise<boolean>;
  hydrateSavedState: (savedState: Partial<SavedGame> & { colonyName?: string; name?: string }) => void;
  resumeLocalGame: () => boolean;
  triggerAlienWave: (wave: 0 | 1 | 2, count?: number) => void;
  forceMeteorShower: (count: number) => void;
  setWeather: (weather: WeatherState) => void;
  /** Attempt to purchase a technology. Returns true if successful. */
  purchaseTech: (techId: string) => boolean;
  /** Instantly unlock a technology (debug / cheat). */
  unlockTech: (techId: string) => void;
  /** Claim reward for a completed quest. Returns true if successful. */
  claimQuestReward: (questId: string) => boolean;
  /** Continue playing in endless mode after victory */
  continueEndless: () => void;
  /** Dismiss the victory modal */
  dismissVictoryModal: () => void;
  /** Dismiss the defeat modal */
  dismissDefeatModal: () => void;
}

function getInitialGameState(
  mapData?: MapExportJSON | null,
  seed?: number,
  startingResources?: Partial<Resources>,
  startingCapacity?: Partial<ResourceCapacity>
) {
  let defaultGrid: HexGrid;
  const s = seed ?? mapData?.meta?.seed ?? 42;
  if (mapData) {
    defaultGrid = HexGrid.fromJSON(mapData);
  } else {
    defaultGrid = new HexGrid(20, s);
    defaultGrid.generate();
    applyProceduralTerrain(defaultGrid, s);
  }

  const rawResourceNodes = mapData?.resourceNodes ?? (mapData as unknown as { resources?: ResourceNode[] })?.resources;
  const resourceNodes: ResourceNode[] = rawResourceNodes && rawResourceNodes.length > 0
    ? rawResourceNodes.map((n: Partial<ResourceNode>, idx: number) => ({
        id: n.id ?? `res-${idx}`,
        type: n.type ?? "minerals",
        pos: n.pos ? [n.pos[0], n.pos[1]] : [0, 0],
        amount: n.amount ?? 1000,
        richness: n.richness ?? "med",
        model: n.model ?? (n.type === "minerals" ? "mineral_pile_01" : n.type === "ice" ? "ice_01" : n.type === "organics" ? "organics_01" : "energy_01"),
      }))
    : generateResources(defaultGrid, s, 1);

  const rawDecor = mapData?.decor ?? (mapData as unknown as { decorations?: DecorItem[] })?.decorations;
  const decorations: DecorItem[] = rawDecor && rawDecor.length > 0
    ? rawDecor.map((d: Partial<DecorItem>) => ({
        model: d.model ?? "rock_01",
        pos: d.pos ? [d.pos[0], d.pos[1]] : [0, 0],
        rot: d.rot ?? 0,
        scale: d.scale ?? 1,
      }))
    : generateDecor(defaultGrid, s);

  // Initial Colony Center (hab) spawn placement
  const rawSpawns = mapData?.spawnPoints ?? (mapData as unknown as { playerSpawns?: unknown[] })?.playerSpawns;
  let spawnQ = 0;
  let spawnR = 0;

  if (rawSpawns && rawSpawns.length > 0) {
    const firstSpawn = rawSpawns[0];
    if (Array.isArray(firstSpawn) && typeof firstSpawn[0] === "number" && typeof firstSpawn[1] === "number") {
      spawnQ = firstSpawn[0];
      spawnR = firstSpawn[1];
    } else if (typeof firstSpawn === "object" && firstSpawn !== null) {
      const obj = firstSpawn as { pos?: [number, number]; q?: number; r?: number };
      if (obj.pos && Array.isArray(obj.pos)) {
        spawnQ = obj.pos[0];
        spawnR = obj.pos[1];
      } else if (typeof obj.q === "number" && typeof obj.r === "number") {
        spawnQ = obj.q;
        spawnR = obj.r;
      }
    }
  } else if (!mapData) {
    const procSpawns = generateSpawns(defaultGrid, s, 1);
    if (procSpawns && procSpawns.length > 0) {
      spawnQ = procSpawns[0].pos[0];
      spawnR = procSpawns[0].pos[1];
    }
  }

  const [spawnWx, spawnWz] = hexToWorld(spawnQ, spawnR);
  const spawnCell = defaultGrid.getCell(spawnQ, spawnR);
  const spawnWy = spawnCell ? spawnCell.worldY : 0;

  const habBuilding: PlacedBuilding = {
    id: "colony-center-hab",
    definitionId: "hab",
    position: { x: spawnWx, y: spawnWy, z: spawnWz },
    condition: 100,
    level: 1,
  };

  const habKey = `${Math.round(spawnWx)},${Math.round(spawnWz)}`;

  const initialUnits: PlacedUnit[] = [
    {
      id: "initial-combat-rover-1",
      definitionId: UNIT_IDS.ROVER_COMBAT,
      position: { x: spawnWx + 2.5, y: spawnWy, z: spawnWz + 2.0 },
      heading: 0,
      currentHealth: 250,
      status: "idle",
    },
    {
      id: "initial-repair-drone-1",
      definitionId: UNIT_IDS.DRONE_REPAIR,
      position: { x: spawnWx - 2.5, y: spawnWy + 1.5, z: spawnWz + 2.0 },
      heading: 0,
      currentHealth: 120,
      status: "idle",
    },
    {
      id: "initial-logistics-rover-1",
      definitionId: UNIT_IDS.ROVER,
      position: { x: spawnWx + 2.0, y: spawnWy, z: spawnWz - 2.5 },
      heading: 0,
      currentHealth: 100,
      status: "idle",
    },
  ];

  const initialResources = { ...INITIAL_COLONY_STATE.resources, ...(startingResources ?? {}) };
  const initialWaterLevel = TerraformingService.calculateWaterLevel(
    initialResources.water,
    0,
    "normal"
  );
  const initialSnapshot = GameAnalyticsService.createSnapshot({
    tick: 0,
    resources: initialResources,
    mineralsCount: resourceNodes.filter((n) => n.type === "minerals").length,
    terraforming: 0,
    o2Accumulated: 0,
    waterLevel: initialWaterLevel,
    buildingsCount: 1,
    aliensDefeated: 0,
  });

  return {
    hexGrid: defaultGrid,
    resourceNodes,
    decorations,
    decor: decorations,
    currentMapData: mapData ?? null,
    resources: initialResources,
    capacity: { ...INITIAL_COLONY_STATE.capacity, ...(startingCapacity ?? {}) },
    sun: INITIAL_COLONY_STATE.sun,
    alive: INITIAL_COLONY_STATE.alive,
    colonyName: "",
    currentScenarioId: null,
    mapSeed: s,
    tick: 0,
    sol: 1,
    aliensDefeated: 0,
    analyticsSnapshots: [initialSnapshot],
    isEndless: false,
    victoryModalDismissed: false,
    defeatModalDismissed: false,
    placed: [habBuilding],
    occupied: { [habKey]: habBuilding.id },
    units: initialUnits,
    weather: { type: "clear" as const, intensity: 0, remainingTicks: 0, cooldownTicks: WeatherService.INITIAL_GRACE_TICKS },
    terraforming: 0,
    o2Accumulated: 0,
    waterLevel: initialWaterLevel,
    won: false,
    isDevFixture: false,
    difficulty: "normal" as DifficultyLevel,
    gameMode: "exploration" as GameMode,
    alienState: INITIAL_ALIEN_STATE,
    lastDelta: {} as ResourceDelta,
    researchPoints: 0,
    unlockedTechs: [TECH_IDS.BASIC_STRUCTURES],
    activeQuests: QuestService.getInitialQuestStates(),
    population: INITIAL_POPULATION,
    morale: INITIAL_MORALE,
    isPaused: false,
    gameSpeed: 1 as const,
    emergencyLifeSupport: {
      active: false,
      secondsRemaining: EMERGENCY_LIFE_SUPPORT_DEFAULT_SECONDS,
    },
  };
}

function applyResourceDelta(
  resources: Resources,
  delta: ResourceDelta,
): Resources {
  const result = { ...resources };
  for (const [key, value] of Object.entries(delta)) {
    result[key as ResourceKey] += value ?? 0;
  }
  return result;
}

function applyCapacityDelta(
  current: ResourceCapacity,
  delta: Partial<ResourceCapacity>,
): ResourceCapacity {
  return {
    power:   current.power   + (delta.power   ?? 0),
    water:   current.water   + (delta.water   ?? 0),
    biomass: current.biomass + (delta.biomass ?? 0),
    minerals: current.minerals + (delta.minerals ?? 0),
  };
}

export const useGameStore = create<GameState>()(
  devtools(
    (set, get) => ({
      ...getInitialGameState(),

      setSun: (factor) => {
        set({ sun: Math.max(0, Math.min(1, factor)) });
      },

      setColonyName: (name) => {
        set({ colonyName: name });
      },

      setDifficulty: (level) => {
        const { resources, terraforming } = get();
        const waterLevel = TerraformingService.calculateWaterLevel(resources.water, terraforming, level);
        set({ difficulty: level, waterLevel });
      },

      setGameMode: (mode) => {
        set({ gameMode: mode });
      },

      togglePause: () => {
        set((state) => ({ isPaused: !state.isPaused }));
      },

      setIsPaused: (isPaused) => {
        set({ isPaused });
      },

      setGameSpeed: (speed) => {
        set({ gameSpeed: speed });
      },

      setWeather: (weather) => set({ weather }),

      forceMeteorShower: (count) => {
        const zones = WeatherService.generateImpactZones(count);
        const trajectories = WeatherService.generateTrajectories(zones);
        set({
          weather: {
            type: "meteor_shower",
            intensity: 1,
            remainingTicks: 5,
            impactZones: zones,
            trajectories,
            cooldownTicks: 0,
          },
        });
      },

      triggerAlienWave: (wave, count = 3) => {
        const { placed, hexGrid } = get();
        if (placed.length === 0) return;
        const ships: AlienShip[] = [];
        const groundUnits: AlienGroundUnit[] = [];

        if (wave >= 1) {
          for (let i = 0; i < count; i++) {
            ships.push(AlienService.spawnShip(placed));
          }
        }

        if (wave >= 2) {
          for (let i = 0; i < count; i++) {
            groundUnits.push(AlienService.spawnGroundUnit(hexGrid));
          }
        }

        set({
          alienState: {
            wave,
            ships,
            groundUnits,
            nextShipSpawnIn: 120,
            nextGroundSpawnIn: 80,
          },
        });
      },

      placeBuilding: (cell, heightY, definitionId) => {
        const state = get();
        const definition = BUILDING_DEFINITIONS[definitionId];
        
        if (!definition) return false;

        const result = BuildingService.placeBuilding(
          definition,
          cell,
          heightY,
          state.resources,
          state.occupied,
          state.placed,
          state.waterLevel,
        );

        if (!result.success || !result.building) return false;

        // Apply cost
        const newResources = result.costDelta
          ? applyResourceDelta(state.resources, result.costDelta)
          : { ...state.resources };

        // Apply capacity
        const newCapacity = applyCapacityDelta(
          state.capacity,
          EconomyService.calculateCapacityDelta(definition, true),
        );

        // Add building
        const key = `${Math.round(cell.x)},${Math.round(cell.z)}`;
        const newPlaced = [...state.placed, result.building];
        const habCapacity = ColonistService.calculateCapacity(newPlaced, BUILDING_DEFINITIONS);
        const newPopulation = { ...state.population, capacity: habCapacity || state.population.capacity };

        set({
          resources: newResources,
          placed: newPlaced,
          occupied: { ...state.occupied, [key]: result.building.id },
          capacity: newCapacity,
          population: newPopulation,
        });

        return true;
      },

      demolishBuilding: (cell) => {
        const state = get();
        
        const building = BuildingService.findBuildingAtCell(
          cell,
          state.placed,
          state.occupied
        );

        if (!building) return false;

        const definition = BUILDING_DEFINITIONS[building.definitionId];
        if (!definition) return false;

        const result = BuildingService.demolishBuilding(definition);
        if (!result.success) return false;

        // Apply refund
        const newResources = result.refundDelta
          ? applyResourceDelta(state.resources, result.refundDelta)
          : { ...state.resources };

        // Remove capacity
        const newCapacity = applyCapacityDelta(
          state.capacity,
          EconomyService.calculateCapacityDelta(definition, false),
        );

        // Remove building
        const key = `${Math.round(building.position.x)},${Math.round(building.position.z)}`;
        const newOccupied = { ...state.occupied };
        delete newOccupied[key];
        const newPlaced = state.placed.filter(b => b.id !== building.id);
        const habCapacity = ColonistService.calculateCapacity(newPlaced, BUILDING_DEFINITIONS);
        const newPopulation = { ...state.population, capacity: habCapacity };

        set({
          resources: newResources,
          placed: newPlaced,
          occupied: newOccupied,
          capacity: newCapacity,
          population: newPopulation,
        });

        return true;
      },

      upgradeBuilding: (buildingId) => {
        const state = get();
        const building = state.placed.find((b) => b.id === buildingId);
        if (!building) return false;

        const definition = BUILDING_DEFINITIONS[building.definitionId];
        if (!definition) return false;

        const result = BuildingService.upgradeBuilding(
          building,
          definition,
          state.resources
        );

        if (!result.success || !result.building) return false;

        const newResources = result.costDelta
          ? applyResourceDelta(state.resources, result.costDelta)
          : { ...state.resources };

        const newPlaced = state.placed.map((b) => (b.id === buildingId ? result.building! : b));
        const habCapacity = ColonistService.calculateCapacity(newPlaced, BUILDING_DEFINITIONS);
        const newPopulation = { ...state.population, capacity: habCapacity || state.population.capacity };

        set({
          resources: newResources,
          placed: newPlaced,
          population: newPopulation,
        });

        return true;
      },

      toggleBuildingPower: (buildingId) => {
        const state = get();
        const building = state.placed.find((b) => b.id === buildingId);
        if (!building) return false;

        const newPlaced = state.placed.map((b) =>
          b.id === buildingId ? { ...b, disabled: !b.disabled } : b
        );

        set({ placed: newPlaced });
        return true;
      },

      issueOrderToUnits: (unitIds: string[], order: RTSOrder) => {
        const state = get();
        const hexGrid = state.hexGrid;
        const waterLevel = state.waterLevel;
        const aliens = state.alienState;
        const buildings = state.placed;

        const updatedUnits = state.units.map((unit) => {
          if (!unitIds.includes(unit.id)) return unit;
          return RTSCommandService.applyOrder(unit, order, {
            hexGrid,
            waterLevel,
            aliens,
            buildings,
          });
        });

        set({ units: updatedUnits });
      },

      updateUnits: (units: PlacedUnit[]) => {
        set({ units });
      },

      addUnit: (unit: PlacedUnit) => {
        set((state) => ({ units: [...state.units, unit] }));
      },

      removeUnit: (id: string) => {
        set((state) => ({ units: state.units.filter((u) => u.id !== id) }));
      },

      assignColonistRole: (role: ColonistRole, delta: number) => {
        const state = get();
        const newPop = ColonistService.assignRole(state.population, role, delta);
        set({ population: newPop });
      },

      applyEconomyTick: () => {
        const state = get();
        if (state.isPaused || !state.alive) return;

        // Game mode config
        const modeCfg = GAME_MODE_CONFIGS[state.gameMode];

        // Tick Weather (debug override takes priority; adventure has no hazards)
        const { forcedWeather } = useDebugStore.getState();
        const newWeather = forcedWeather
          ? { ...state.weather, type: forcedWeather }
          : WeatherService.tick(state.weather, modeCfg.sandstormChanceMultiplier, modeCfg.meteorChanceMultiplier, modeCfg.hazardsEnabled, state.terraforming);
        const productionModifier = WeatherService.getProductionModifier(newWeather);

        // Degrade buildings during sandstorm or dust storm (scaled by game mode)
        let degradedPlaced = WeatherService.isDustStorm(newWeather.type)
          ? BuildingService.degradeBuildings(state.placed, newWeather.intensity * modeCfg.conditionDamageMultiplier)
          : state.placed;

        // Apply meteor impacts on the first tick of meteor_shower
        if (
          newWeather.type === "meteor_shower" &&
          newWeather.remainingTicks === 5 &&
          newWeather.impactZones?.length
        ) {
          degradedPlaced = MeteorService.applyImpacts(degradedPlaced, newWeather.impactZones);
        }

        const currentTick = state.tick + 1;
        const currentSol = GameAnalyticsService.tickToSol(currentTick);

        // Immigration shuttle arrival
        const shuttleResult = ColonistService.processShuttleArrival(state.population, currentTick);
        const currentPopulation = shuttleResult.population;

        // Morale and profession role bonuses
        const currentMorale = ColonistService.calculateMorale(
          state.resources,
          state.capacity,
          currentPopulation
        );
        const roleBonuses = ColonistService.calculateRoleBonuses(currentPopulation.roles);
        const totalProductionModifier = productionModifier * currentMorale.productivityMultiplier;

        const tickResult = EconomyService.tick(
          {
            resources: state.resources,
            capacity: state.capacity,
            sun: state.sun,
            alive: state.alive,
          },
          degradedPlaced,
          BUILDING_DEFINITIONS,
          totalProductionModifier,
          state.resourceNodes,
          modeCfg.depositDepletionRate,
          newWeather.type,
          currentPopulation,
          roleBonuses,
          state.emergencyLifeSupport
        );

        const newO2Accumulated = TerraformingService.accumulateO2(state.o2Accumulated, tickResult.delta);
        const newResources = {
          o2:      state.resources.o2      + (tickResult.delta.o2      ?? 0),
          power:   state.resources.power   + (tickResult.delta.power   ?? 0),
          water:   state.resources.water   + (tickResult.delta.water   ?? 0),
          biomass: state.resources.biomass + (tickResult.delta.biomass ?? 0),
          minerals: state.resources.minerals + (tickResult.delta.minerals ?? 0),
        };
        const newTerraforming = modeCfg.hasWinCondition
          ? TerraformingService.calculateProgress(newO2Accumulated, newResources, state.difficulty)
          : 0;
        const newWaterLevel = TerraformingService.calculateWaterLevel(
          newResources.water,
          newTerraforming,
          state.difficulty
        );

        // Apply alien invasion tick in survival mode or when wave is active (debug)
        let finalPlaced = degradedPlaced;
        let newAlienState = state.alienState;
        let newAliensDefeated = state.aliensDefeated;
        if (state.gameMode === "survival" || state.alienState.wave > 0) {
          const alienResult = AlienService.tick(state.alienState, degradedPlaced, newTerraforming, state.hexGrid, newWaterLevel);
          finalPlaced   = alienResult.damagedBuildings;
          newAlienState = alienResult.alienState;
          newAliensDefeated += alienResult.eliminatedUnits ?? 0;
        }

        // Apply RTS player unit combat, repairs and movement simulation
        const rtsResult = RTSCommandService.tickUnits(
          state.units,
          newAlienState,
          finalPlaced,
          state.hexGrid,
          newWaterLevel,
          1.0
        );
        const finalUnits = rtsResult.units;
        finalPlaced = rtsResult.buildings;
        newAlienState = {
          ...newAlienState,
          ships: rtsResult.aliens.ships,
          groundUnits: rtsResult.aliens.groundUnits,
        };
        newAliensDefeated += rtsResult.eliminatedAliens;

        const newRP = state.researchPoints + tickResult.researchPointsDelta;

        const evaluatedQuests = QuestService.evaluateQuests(
          {
            placed: finalPlaced,
            resources: newResources,
            unlockedTechs: state.unlockedTechs,
            terraforming: newTerraforming,
            o2Accumulated: newO2Accumulated,
            waterLevel: newWaterLevel,
            alienWave: newAlienState.wave,
          },
          state.activeQuests
        );

        // Record analytics snapshot every 10 ticks (sliding buffer up to 500)
        let updatedSnapshots = state.analyticsSnapshots;
        if (currentTick % 10 === 0) {
          const remainingMinerals = (tickResult.resourceNodes ?? state.resourceNodes).filter((n) => n.type === "minerals").length;
          const newSnapshot = GameAnalyticsService.createSnapshot({
            tick: currentTick,
            resources: newResources,
            mineralsCount: remainingMinerals,
            terraforming: newTerraforming,
            o2Accumulated: newO2Accumulated,
            waterLevel: newWaterLevel,
            buildingsCount: finalPlaced.length,
            aliensDefeated: newAliensDefeated,
          });
          updatedSnapshots = GameAnalyticsService.recordSnapshot(state.analyticsSnapshots, newSnapshot);
        }

        const isWin = modeCfg.hasWinCondition ? TerraformingService.isComplete(newTerraforming) : false;
        const won = state.won || (!state.isEndless && isWin);

        set({
          weather: newWeather,
          placed: finalPlaced,
          units: finalUnits,
          lastDelta: tickResult.delta,
          resources: newResources,
          resourceNodes: tickResult.resourceNodes ?? state.resourceNodes,
          alive: !tickResult.gameOver,
          emergencyLifeSupport: tickResult.emergencyLifeSupport,
          tick: currentTick,
          sol: currentSol,
          aliensDefeated: newAliensDefeated,
          analyticsSnapshots: updatedSnapshots,
          o2Accumulated: newO2Accumulated,
          terraforming: newTerraforming,
          waterLevel: newWaterLevel,
          alienState: newAlienState,
          won,
          researchPoints: newRP,
          activeQuests: evaluatedQuests,
          population: currentPopulation,
          morale: currentMorale,
        });
      },

      purchaseTech: (techId: string): boolean => {
        const state = get();
        const result = ResearchService.startResearch(techId, state.researchPoints, state.unlockedTechs);
        if (!result.success) return false;

        // Re-evaluate quests on tech purchase
        const evaluatedQuests = QuestService.evaluateQuests(
          {
            placed: state.placed,
            resources: state.resources,
            unlockedTechs: result.newUnlockedTechs,
            terraforming: state.terraforming,
            o2Accumulated: state.o2Accumulated,
            waterLevel: state.waterLevel,
            alienWave: state.alienState.wave,
          },
          state.activeQuests
        );

        set({
          researchPoints: result.newResearchPoints,
          unlockedTechs: result.newUnlockedTechs,
          activeQuests: evaluatedQuests,
        });
        return true;
      },

      unlockTech: (techId: string): void => {
        const state = get();
        if (state.unlockedTechs.includes(techId)) return;
        const newTechs = [...state.unlockedTechs, techId];
        const evaluatedQuests = QuestService.evaluateQuests(
          {
            placed: state.placed,
            resources: state.resources,
            unlockedTechs: newTechs,
            terraforming: state.terraforming,
            o2Accumulated: state.o2Accumulated,
            waterLevel: state.waterLevel,
            alienWave: state.alienState.wave,
          },
          state.activeQuests
        );
        set({ unlockedTechs: newTechs, activeQuests: evaluatedQuests });
      },

      claimQuestReward: (questId: string): boolean => {
        const state = get();
        const result = QuestService.claimQuestReward(
          questId,
          state.activeQuests,
          state.resources,
          state.researchPoints
        );
        if (!result.success) return false;

        // Re-evaluate to unlock newly available quests immediately
        const evaluatedQuests = QuestService.evaluateQuests(
          {
            placed: state.placed,
            resources: result.newResources,
            unlockedTechs: state.unlockedTechs,
            terraforming: state.terraforming,
            o2Accumulated: state.o2Accumulated,
            waterLevel: state.waterLevel,
            alienWave: state.alienState.wave,
          },
          result.newQuests
        );

        set({
          activeQuests: evaluatedQuests,
          resources: result.newResources,
          researchPoints: result.newRP,
        });
        return true;
      },

      continueEndless: () => {
        set({ isEndless: true, victoryModalDismissed: true });
      },

      dismissVictoryModal: () => {
        set({ victoryModalDismissed: true });
      },

      dismissDefeatModal: () => {
        set({ defeatModalDismissed: true });
      },

      resetGame: () => {
        set(getInitialGameState());
      },

      startNewGame: (name: string, diff: DifficultyLevel, mode: GameMode, mapData?: MapExportJSON | null, seed?: number) => {
        const initState = getInitialGameState(mapData, seed);
        const centerHab = initState.placed.find((b) => b.id === "colony-center-hab");
        if (centerHab) {
          useUIStore.getState().setCameraFrustum([], {
            x: centerHab.position.x,
            y: centerHab.position.y ?? 0,
            z: centerHab.position.z,
          });
        }
        set({
          ...initState,
          colonyName: name,
          difficulty: diff,
          gameMode: mode,
        });
      },

      startScenarioGame: (scenario: Scenario, colonyName?: string, customSeed?: number) => {
        const initState = ScenarioService.createInitialScenarioState(scenario, colonyName, customSeed);
        const initialState = getInitialGameState(
          initState.mapData,
          customSeed ?? scenario.seed,
          scenario.startingResources,
          scenario.startingCapacity
        );

        let alienState = INITIAL_ALIEN_STATE;
        if (scenario.modifiers.initialAlienWave && scenario.modifiers.initialAlienWave > 0) {
          alienState = {
            ...INITIAL_ALIEN_STATE,
            wave: scenario.modifiers.initialAlienWave,
          };
        }

        const centerHab = initialState.placed.find((b) => b.id === "colony-center-hab");
        if (centerHab) {
          useUIStore.getState().setCameraFrustum([], {
            x: centerHab.position.x,
            y: centerHab.position.y ?? 0,
            z: centerHab.position.z,
          });
        }

        set({
          ...initialState,
          colonyName: initState.colonyName,
          difficulty: scenario.difficulty,
          gameMode: "exploration",
          alienState,
          currentScenarioId: scenario.id,
        });
      },

      saveGame: async () => {
        const state = get();
        if (!state.colonyName) return false;

        try {
          const response = await fetch(apiUrl("/api/colony"), {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${authClient.getToken()}`
            },
            body: JSON.stringify({
              name: state.colonyName,
              state: {
                mapSeed: state.mapSeed,
                resources: state.resources,
                capacity: state.capacity,
                placed: state.placed,
                occupied: state.occupied,
                units: state.units,
                weather: state.weather,
                terraforming: state.terraforming,
                o2Accumulated: state.o2Accumulated,
                difficulty: state.difficulty,
                gameMode: state.gameMode,
                sun: state.sun,
                alienState: state.alienState,
                resourceNodes: state.resourceNodes,
                decorations: state.decorations,
                currentMapData: state.currentMapData ?? null,
                researchPoints: state.researchPoints,
                unlockedTechs: state.unlockedTechs,
                activeQuests: state.activeQuests,
                tick: state.tick,
                sol: state.sol,
                aliensDefeated: state.aliensDefeated,
                analyticsSnapshots: state.analyticsSnapshots,
                isEndless: state.isEndless,
                population: state.population,
                morale: state.morale,
              }
            })
          });
          return response.ok;
        } catch (error) {
          console.error("Save game failed", error);
          return false;
        }
      },

      hydrateSavedState: (gameState) => {
        const loadedSeed = gameState.mapSeed ?? 42;
        const loadedGrid = gameState.currentMapData
          ? HexGrid.fromJSON(gameState.currentMapData)
          : getInitialGameState(null, loadedSeed).hexGrid;

        const loadedNodes: ResourceNode[] = gameState.resourceNodes ?? (
          gameState.currentMapData?.resourceNodes?.length
            ? gameState.currentMapData.resourceNodes
            : generateResources(loadedGrid, loadedSeed, 1)
        );

        const loadedDecor: DecorItem[] = gameState.decorations ?? (gameState as unknown as { decor?: DecorItem[] }).decor ?? (
          gameState.currentMapData?.decor?.length
            ? gameState.currentMapData.decor
            : generateDecor(loadedGrid, loadedSeed)
        );

        const loadedPlaced = (gameState.placed ?? []).map((b) => ({
          ...b,
          position: { x: b.position.x, y: b.position.y ?? 0, z: b.position.z },
          condition: b.condition ?? 100,
          level: b.level ?? 1,
        }));

        const loadedResources: Resources = {
          o2: gameState.resources?.o2 ?? INITIAL_COLONY_STATE.resources.o2,
          power: gameState.resources?.power ?? INITIAL_COLONY_STATE.resources.power,
          water: gameState.resources?.water ?? INITIAL_COLONY_STATE.resources.water,
          biomass: gameState.resources?.biomass ?? INITIAL_COLONY_STATE.resources.biomass,
          minerals: gameState.resources?.minerals ?? INITIAL_COLONY_STATE.resources.minerals,
        };

        const loadedCapacity: ResourceCapacity = {
          power: gameState.capacity?.power ?? INITIAL_COLONY_STATE.capacity.power,
          water: gameState.capacity?.water ?? INITIAL_COLONY_STATE.capacity.water,
          biomass: gameState.capacity?.biomass ?? INITIAL_COLONY_STATE.capacity.biomass,
          minerals: gameState.capacity?.minerals ?? INITIAL_COLONY_STATE.capacity.minerals,
        };

        const loadedTechs = gameState.unlockedTechs ?? [TECH_IDS.BASIC_STRUCTURES];
        const loadedTerraforming = gameState.terraforming ?? 0;
        const loadedO2Accumulated = gameState.o2Accumulated ?? 0;
        const loadedDiff = (gameState.difficulty as DifficultyLevel) ?? "normal";
        const loadedAlienState = gameState.alienState ?? INITIAL_ALIEN_STATE;
        const loadedWaterLevel = TerraformingService.calculateWaterLevel(
          loadedResources.water ?? 0,
          loadedTerraforming,
          loadedDiff
        );

        const initialOrSavedQuests = gameState.activeQuests ?? QuestService.getInitialQuestStates();
        const loadedEvaluatedQuests = QuestService.evaluateQuests(
          {
            placed: loadedPlaced,
            resources: loadedResources,
            unlockedTechs: loadedTechs,
            terraforming: loadedTerraforming,
            o2Accumulated: loadedO2Accumulated,
            waterLevel: loadedWaterLevel,
            alienWave: loadedAlienState.wave,
          },
          initialOrSavedQuests
        );

        const loadedTick = gameState.tick ?? 0;
        const loadedSol = gameState.sol ?? GameAnalyticsService.tickToSol(loadedTick);
        const loadedAliensDefeated = gameState.aliensDefeated ?? 0;
        const loadedSnapshots = (gameState as unknown as { analyticsSnapshots?: GameAnalyticsSnapshot[] }).analyticsSnapshots ?? [
          GameAnalyticsService.createSnapshot({
            tick: loadedTick,
            resources: loadedResources,
            mineralsCount: loadedNodes.filter((n) => n.type === "minerals").length,
            terraforming: loadedTerraforming,
            o2Accumulated: loadedO2Accumulated,
            waterLevel: loadedWaterLevel,
            buildingsCount: loadedPlaced.length,
            aliensDefeated: loadedAliensDefeated,
          })
        ];

        const loadedPopulation: ColonyPopulation = gameState.population ?? INITIAL_POPULATION;
        const habCapacity = ColonistService.calculateCapacity(loadedPlaced, BUILDING_DEFINITIONS);
        const effectivePopulation: ColonyPopulation = {
          ...loadedPopulation,
          capacity: habCapacity > 0 ? habCapacity : loadedPopulation.capacity,
        };
        const loadedMorale: MoraleState = gameState.morale ?? ColonistService.calculateMorale(
          loadedResources,
          loadedCapacity,
          effectivePopulation
        );

        const loadedUnits: PlacedUnit[] = gameState.units
          ? (gameState.units as unknown as PlacedUnit[]).map((u) => ({
              ...u,
              position: { x: u.position.x, y: u.position.y ?? 0, z: u.position.z },
              heading: u.heading ?? 0,
              currentHealth: u.currentHealth ?? 100,
              status: u.status ?? "idle",
            }))
          : getInitialGameState().units;

        const centerHab = loadedPlaced.find((b: PlacedBuilding) => b.id === "colony-center-hab");
        if (centerHab) {
          useUIStore.getState().setCameraFrustum([], {
            x: centerHab.position.x,
            y: centerHab.position.y ?? 0,
            z: centerHab.position.z,
          });
        }

        set({
          colonyName: gameState.colonyName || (gameState as unknown as { name?: string }).name || "Mars Colony",
          mapSeed: loadedSeed,
          hexGrid: loadedGrid,
          resourceNodes: loadedNodes,
          decorations: loadedDecor,
          decor: loadedDecor,
          currentMapData: gameState.currentMapData ?? null,
          resources: loadedResources,
          capacity: loadedCapacity,
          placed: loadedPlaced,
          occupied: (gameState.occupied as Record<string, string>) ?? {},
          units: loadedUnits,
          weather: gameState.weather ?? { type: "clear", intensity: 0, remainingTicks: 0, cooldownTicks: WeatherService.INITIAL_GRACE_TICKS },
          terraforming: loadedTerraforming,
          o2Accumulated: loadedO2Accumulated,
          waterLevel: loadedWaterLevel,
          difficulty: loadedDiff,
          gameMode: (gameState.gameMode as GameMode) ?? "exploration",
          sun: gameState.sun ?? INITIAL_COLONY_STATE.sun,
          alienState: loadedAlienState,
          won: TerraformingService.isComplete(loadedTerraforming),
          isDevFixture: false,
          alive: true,
          tick: loadedTick,
          sol: loadedSol,
          aliensDefeated: loadedAliensDefeated,
          analyticsSnapshots: loadedSnapshots,
          isEndless: gameState.isEndless ?? false,
          victoryModalDismissed: false,
          defeatModalDismissed: false,
          researchPoints: gameState.researchPoints ?? 0,
          unlockedTechs: loadedTechs,
          activeQuests: loadedEvaluatedQuests,
          population: effectivePopulation,
          morale: loadedMorale,
          isPaused: false,
          gameSpeed: 1,
          emergencyLifeSupport: (gameState as unknown as { emergencyLifeSupport?: EmergencyLifeSupportState }).emergencyLifeSupport ?? {
            active: false,
            secondsRemaining: EMERGENCY_LIFE_SUPPORT_DEFAULT_SECONDS,
          },
        });
      },

      resumeLocalGame: () => {
        const saved = LocalSaveService.loadLocal();
        if (!saved || !saved.colonyName) return false;
        get().hydrateSavedState(saved);
        return true;
      },

      loadGame: async (name: string) => {
        try {
          const response = await fetch(apiUrl(`/api/colony/${name}`), {
            headers: {
              "Authorization": `Bearer ${authClient.getToken()}`
            }
          });
          if (!response.ok) return false;
          
          const data = await response.json();
          get().hydrateSavedState({ ...data.state, colonyName: data.name });
          return true;
        } catch (error) {
          console.error("Load game failed", error);
          return false;
        }
      },
    }),
    { name: "GameStore", enabled: true }
  )
);

if (typeof window !== "undefined" && import.meta.env.DEV) {
  (window as unknown as { useGameStore: typeof useGameStore }).useGameStore = useGameStore;
}



