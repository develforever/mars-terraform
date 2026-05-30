import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { PlacedBuilding } from "../../domain/entities/Building";
import type { Resources, ResourceCapacity, ResourceDelta } from "../../domain/entities/Resources";
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
import type { AlienState } from "../../domain/entities/Alien";

export interface GameState {
  // Resources and colony state
  resources: Resources;
  capacity: ResourceCapacity;
  lastDelta?: ResourceDelta;
  sun: number;
  alive: boolean;
  colonyName: string;

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
  startNewGame: (name: string, difficulty: DifficultyLevel, gameMode: GameMode) => void;
  saveGame: () => Promise<boolean>;
  loadGame: (name: string) => Promise<boolean>;
}

export const useGameStore = create<GameState>()(
  devtools(
    (set, get) => ({
      resources: INITIAL_COLONY_STATE.resources,
      capacity: INITIAL_COLONY_STATE.capacity,
      lastDelta: {},
      sun: INITIAL_COLONY_STATE.sun,
      alive: INITIAL_COLONY_STATE.alive,
      colonyName: "",
      placed: [],
      occupied: {},
      weather: { type: "clear", intensity: 0, remainingTicks: 0, cooldownTicks: 0 },
      terraforming: 0,
      o2Accumulated: 0,
      difficulty: "normal" as DifficultyLevel,
      gameMode: "exploration" as GameMode,
      alienState: INITIAL_ALIEN_STATE,
      won: false,

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
        const newResources = { ...state.resources };
        if (result.costDelta) {
          for (const [key, value] of Object.entries(result.costDelta)) {
            if (value !== undefined) {
              newResources[key as keyof Resources] += value;
            }
          }
        }

        // Apply capacity
        const capacityDelta = EconomyService.calculateCapacityDelta(definition, true);
        const newCapacity = { ...state.capacity };
        if (capacityDelta.power) newCapacity.power += capacityDelta.power;
        if (capacityDelta.water) newCapacity.water += capacityDelta.water;
        if (capacityDelta.biomass) newCapacity.biomass += capacityDelta.biomass;

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
        const newResources = { ...state.resources };
        if (result.refundDelta) {
          for (const [key, value] of Object.entries(result.refundDelta)) {
            if (value !== undefined) {
              newResources[key as keyof Resources] += value;
            }
          }
        }

        // Remove capacity
        const capacityDelta = EconomyService.calculateCapacityDelta(definition, false);
        const newCapacity = { ...state.capacity };
        if (capacityDelta.power) newCapacity.power += capacityDelta.power;
        if (capacityDelta.water) newCapacity.water += capacityDelta.water;
        if (capacityDelta.biomass) newCapacity.biomass += capacityDelta.biomass;

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
    let newWeather = forcedWeather
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
      productionModifier
    );

    const newO2Accumulated = TerraformingService.accumulateO2(state.o2Accumulated, tickResult.delta);
    const newResources = {
      o2: state.resources.o2 + (tickResult.delta.o2 ?? 0),
      power: state.resources.power + (tickResult.delta.power ?? 0),
      water: state.resources.water + (tickResult.delta.water ?? 0),
      biomass: state.resources.biomass + (tickResult.delta.biomass ?? 0),
    };
    const newTerraforming = modeCfg.hasWinCondition
      ? TerraformingService.calculateProgress(newO2Accumulated, newResources, state.difficulty)
      : 0;

    // Apply alien invasion tick in survival mode
    let finalPlaced = degradedPlaced;
    let newAlienState = state.alienState;
    if (state.gameMode === "survival") {
      const alienResult = AlienService.tick(state.alienState, degradedPlaced, newTerraforming);
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
        set({
          resources: INITIAL_COLONY_STATE.resources,
          capacity: INITIAL_COLONY_STATE.capacity,
          sun: INITIAL_COLONY_STATE.sun,
          alive: INITIAL_COLONY_STATE.alive,
          colonyName: "",
          placed: [],
          occupied: {},
          weather: { type: "clear", intensity: 0, remainingTicks: 0, cooldownTicks: 0 },
          terraforming: 0,
          o2Accumulated: 0,
          won: false,
          gameMode: "exploration" as GameMode,
          alienState: INITIAL_ALIEN_STATE,
        });
      },

      startNewGame: (name: string, diff: DifficultyLevel, mode: GameMode) => {
        set({
          resources: INITIAL_COLONY_STATE.resources,
          capacity: INITIAL_COLONY_STATE.capacity,
          sun: INITIAL_COLONY_STATE.sun,
          alive: INITIAL_COLONY_STATE.alive,
          colonyName: name,
          placed: [],
          occupied: {},
          weather: { type: "clear", intensity: 0, remainingTicks: 0, cooldownTicks: 0 },
          terraforming: 0,
          o2Accumulated: 0,
          won: false,
          difficulty: diff,
          gameMode: mode,
          alienState: INITIAL_ALIEN_STATE,
          lastDelta: {},
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
              "Authorization": `Bearer ${localStorage.getItem("token")}`
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
              "Authorization": `Bearer ${localStorage.getItem("token")}`
            }
          });
          if (!response.ok) return false;
          
          const data = await response.json();
          const gameState = data.state;

          set({
            colonyName: data.name,
            resources: gameState.resources,
            capacity: gameState.capacity,
            placed: gameState.placed,
            occupied: gameState.occupied,
            weather: gameState.weather ?? { type: "clear", intensity: 0, remainingTicks: 0, cooldownTicks: 0 },
            terraforming: gameState.terraforming ?? 0,
            o2Accumulated: gameState.o2Accumulated ?? 0,
            difficulty: gameState.difficulty ?? "normal",
            gameMode: gameState.gameMode ?? "exploration",
            won: TerraformingService.isComplete(gameState.terraforming ?? 0),
            alive: true
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


