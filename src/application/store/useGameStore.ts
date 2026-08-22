import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { PlacedBuilding } from "../../domain/entities/Building";
import type { Resources, ResourceCapacity, ResourceDelta, ResourceKey } from "../../domain/entities/Resources";
import { INITIAL_COLONY_STATE } from "../../domain/entities/Colony";
import { BUILDING_DEFINITIONS } from "../../domain/config/buildings";
import { BuildingService } from "../../domain/services/BuildingService";
import { EconomyService } from "../../domain/services/EconomyService";
import { WeatherService } from "../../domain/services/WeatherService";
import type { WeatherState } from "../../domain/services/WeatherService";
import { TerraformingService } from "../../domain/services/TerraformingService";
import { MeteorService } from "../../domain/services/MeteorService";
import type { DifficultyLevel } from "../../domain/services/TerraformingService";
import { useDebugStore } from "./useDebugStore";
import type { GameMode } from "../../domain/services/GameModeService";
import { GAME_MODE_CONFIGS } from "../../domain/services/GameModeService";
import { AlienService, INITIAL_ALIEN_STATE } from "../../domain/services/AlienService";
import type { AlienState, AlienShip, AlienGroundUnit } from "../../domain/entities/Alien";
import { authClient } from "../service/authService";
import { HexGrid } from "../../presentation/generator/hex/HexGrid";
import { applyProceduralTerrain } from "../../presentation/generator/terrain/ProceduralTerrain";
import type { MapExportJSON } from "../../domain/mapEditorTypes";

export interface GameState {
  // Resources and colony state
  resources: Resources;
  capacity: ResourceCapacity;
  lastDelta?: ResourceDelta;
  sun: number;
  alive: boolean;
  colonyName: string;

  // Hex Grid Terrain
  hexGrid: HexGrid;
  currentMapData?: MapExportJSON | null;

  // Buildings
  placed: PlacedBuilding[];
  occupied: Record<string, string>;

  // Weather
  weather: WeatherState;

  // Terraforming
  terraforming: number;
  o2Accumulated: number;
  difficulty: DifficultyLevel;
  gameMode: GameMode;
  alienState: AlienState;
  won: boolean;

  // Actions
  setSun: (factor: number) => void;
  setColonyName: (name: string) => void;
  setDifficulty: (level: DifficultyLevel) => void;
  setGameMode: (mode: GameMode) => void;
  placeBuilding: (cell: { x: number; z: number }, heightY: number, definitionId: string) => boolean;
  demolishBuilding: (cell: { x: number; z: number }) => boolean;
  applyEconomyTick: () => void;
  resetGame: () => void;
  startNewGame: (name: string, difficulty: DifficultyLevel, gameMode: GameMode, mapData?: MapExportJSON | null, seed?: number) => void;
  saveGame: () => Promise<boolean>;
  loadGame: (name: string) => Promise<boolean>;
  triggerAlienWave: (wave: 0 | 1 | 2, count?: number) => void;
  forceMeteorShower: (count: number) => void;
  setWeather: (weather: WeatherState) => void;
}

function getInitialGameState(mapData?: MapExportJSON | null, seed?: number) {
  let defaultGrid: HexGrid;
  const s = seed ?? mapData?.meta?.seed ?? 42;
  if (mapData) {
    defaultGrid = HexGrid.fromJSON(mapData);
  } else {
    defaultGrid = new HexGrid(20, s);
    defaultGrid.generate();
    applyProceduralTerrain(defaultGrid, s);
  }

  return {
    hexGrid: defaultGrid,
    currentMapData: mapData ?? null,
    resources: INITIAL_COLONY_STATE.resources,
    capacity: INITIAL_COLONY_STATE.capacity,
    sun: INITIAL_COLONY_STATE.sun,
    alive: INITIAL_COLONY_STATE.alive,
    colonyName: "",
    placed: [] as PlacedBuilding[],
    occupied: {} as Record<string, string>,
    weather: { type: "clear" as const, intensity: 0, remainingTicks: 0, cooldownTicks: 0 },
    terraforming: 0,
    o2Accumulated: 0,
    won: false,
    difficulty: "normal" as DifficultyLevel,
    gameMode: "exploration" as GameMode,
    alienState: INITIAL_ALIEN_STATE,
    lastDelta: {} as ResourceDelta,
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
        set({ difficulty: level });
      },

      setGameMode: (mode) => {
        set({ gameMode: mode });
      },

      setWeather: (weather) => set({ weather }),

      forceMeteorShower: (count) => {
        const zones = WeatherService.generateImpactZones(count);
        set({
          weather: {
            type: "meteor_shower",
            intensity: 1,
            remainingTicks: 5,
            impactZones: zones,
            cooldownTicks: 0,
          },
        });
      },

      triggerAlienWave: (wave, count = 3) => {
        const { placed } = get();
        if (placed.length === 0) return;
        const ships: AlienShip[] = [];
        const groundUnits: AlienGroundUnit[] = [];

        if (wave >= 1) {
          for (let i = 0; i < count; i++) {
            const target = placed[Math.floor(Math.random() * placed.length)];
            const angle = Math.random() * Math.PI * 2;
            ships.push({
              id: `ship-dbg-${Date.now()}-${i}`,
              position: {
                x: Math.cos(angle + i * 0.5) * (50 + Math.random() * 20),
                y: 15 + Math.random() * 10,
                z: Math.sin(angle + i * 0.5) * (30 + Math.random() * 20),
              },
              targetBuildingId: target?.id ?? null,
              phase: "approaching" as const,
              phaseProgress: 0,
              active: true,
            });
          }
        }

        if (wave >= 2) {
          for (let i = 0; i < count; i++) {
            const side = Math.floor(Math.random() * 4);
            let x = 0, z = 0;
            if (side === 0) { x = -48; z = (Math.random() * 2 - 1) * 22; }
            if (side === 1) { x =  48; z = (Math.random() * 2 - 1) * 22; }
            if (side === 2) { x = (Math.random() * 2 - 1) * 48; z = -22; }
            if (side === 3) { x = (Math.random() * 2 - 1) * 48; z =  22; }
            groundUnits.push({
              id: `ground-dbg-${Date.now()}-${i}`,
              position: { x, z },
              targetBuildingId: null,
              attackCooldown: 0,
              active: true,
            });
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
          state.placed
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
        set({
          resources: newResources,
          placed: [...state.placed, result.building],
          occupied: { ...state.occupied, [key]: result.building.id },
          capacity: newCapacity,
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

        set({
          resources: newResources,
          placed: state.placed.filter(b => b.id !== building.id),
          occupied: newOccupied,
          capacity: newCapacity,
        });

        return true;
      },

      applyEconomyTick: () => {
        const state = get();
        if (!state.alive) return;

        // Game mode config
        const modeCfg = GAME_MODE_CONFIGS[state.gameMode];

        // Tick Weather (debug override takes priority; adventure has no hazards)
        const { forcedWeather } = useDebugStore.getState();
        const newWeather = forcedWeather
          ? { ...state.weather, type: forcedWeather }
          : WeatherService.tick(state.weather, modeCfg.sandstormChanceMultiplier, modeCfg.meteorChanceMultiplier, modeCfg.hazardsEnabled);
        const productionModifier = WeatherService.getProductionModifier(newWeather);

        // Degrade buildings during sandstorm (scaled by game mode)
        let degradedPlaced = newWeather.type === "sandstorm"
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

        const tickResult = EconomyService.tick(
          {
            resources: state.resources,
            capacity: state.capacity,
            sun: state.sun,
            alive: state.alive,
          },
          degradedPlaced,
          BUILDING_DEFINITIONS,
          productionModifier,
        );

        const newO2Accumulated = TerraformingService.accumulateO2(state.o2Accumulated, tickResult.delta);
        const newResources = {
          o2:      state.resources.o2      + (tickResult.delta.o2      ?? 0),
          power:   state.resources.power   + (tickResult.delta.power   ?? 0),
          water:   state.resources.water   + (tickResult.delta.water   ?? 0),
          biomass: state.resources.biomass + (tickResult.delta.biomass ?? 0),
        };
        const newTerraforming = modeCfg.hasWinCondition
          ? TerraformingService.calculateProgress(newO2Accumulated, newResources, state.difficulty)
          : 0;

        // Apply alien invasion tick in survival mode or when wave is active (debug)
        let finalPlaced = degradedPlaced;
        let newAlienState = state.alienState;
        if (state.gameMode === "survival" || state.alienState.wave > 0) {
          const alienResult = AlienService.tick(state.alienState, degradedPlaced, newTerraforming, state.hexGrid);
          finalPlaced   = alienResult.damagedBuildings;
          newAlienState = alienResult.alienState;
        }

        set({
          weather: newWeather,
          placed: finalPlaced,
          lastDelta: tickResult.delta,
          resources: newResources,
          alive: !tickResult.gameOver,
          o2Accumulated: newO2Accumulated,
          terraforming: newTerraforming,
          alienState: newAlienState,
          won: TerraformingService.isComplete(newTerraforming),
        });
      },

      resetGame: () => {
        set(getInitialGameState());
      },

      startNewGame: (name: string, diff: DifficultyLevel, mode: GameMode, mapData?: MapExportJSON | null, seed?: number) => {
        set({
          ...getInitialGameState(mapData, seed),
          colonyName: name,
          difficulty: diff,
          gameMode: mode,
        });
      },

      saveGame: async () => {
        const state = get();
        if (!state.colonyName) return false;

        try {
          const response = await fetch("/api/colony", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${authClient.getToken()}`
            },
            body: JSON.stringify({
              name: state.colonyName,
              state: {
                resources: state.resources,
                capacity: state.capacity,
                placed: state.placed,
                occupied: state.occupied,
                weather: state.weather,
                terraforming: state.terraforming,
                o2Accumulated: state.o2Accumulated,
                difficulty: state.difficulty,
                gameMode: state.gameMode,
                sun: state.sun,
                alienState: state.alienState,
                currentMapData: state.currentMapData ?? null,
              }
            })
          });
          return response.ok;
        } catch (error) {
          console.error("Save game failed", error);
          return false;
        }
      },

      loadGame: async (name: string) => {
        try {
          const response = await fetch(`/api/colony/${name}`, {
            headers: {
              "Authorization": `Bearer ${authClient.getToken()}`
            }
          });
          if (!response.ok) return false;
          
          const data = await response.json();
          const gameState = data.state;

          const loadedGrid = gameState.currentMapData
            ? HexGrid.fromJSON(gameState.currentMapData)
            : getInitialGameState().hexGrid;

          set({
            colonyName: data.name,
            hexGrid: loadedGrid,
            currentMapData: gameState.currentMapData ?? null,
            resources: gameState.resources,
            capacity: gameState.capacity,
            placed: gameState.placed,
            occupied: gameState.occupied,
            weather: gameState.weather ?? { type: "clear", intensity: 0, remainingTicks: 0, cooldownTicks: 0 },
            terraforming: gameState.terraforming ?? 0,
            o2Accumulated: gameState.o2Accumulated ?? 0,
            difficulty: gameState.difficulty ?? "normal",
            gameMode: gameState.gameMode ?? "exploration",
            sun: gameState.sun ?? INITIAL_COLONY_STATE.sun,
            alienState: gameState.alienState ?? INITIAL_ALIEN_STATE,
            won: TerraformingService.isComplete(gameState.terraforming ?? 0),
            alive: true,
          });
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


