import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { PlacedBuilding } from "../../domain/entities/Building";
import type { Resources, ResourceCapacity, ResourceDelta } from "../../domain/entities/Resources";
import { INITIAL_COLONY_STATE } from "../../domain/entities/Colony";
import { BUILDING_DEFINITIONS } from "../../domain/config/buildings";
import { BuildingService } from "../../domain/services/BuildingService";
import { EconomyService } from "../../domain/services/EconomyService";
import { WeatherService } from "../../domain/services/WeatherService";

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
  weather: {
    type: "clear" | "warning" | "sandstorm";
    intensity: number;
    remainingTicks: number;
  };

  // Actions
  setSun: (factor: number) => void;
  setColonyName: (name: string) => void;
  placeBuilding: (cell: { x: number; z: number }, heightY: number, definitionId: string) => boolean;
  demolishBuilding: (cell: { x: number; z: number }) => boolean;
  applyEconomyTick: () => void;
  resetGame: () => void;
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
      weather: { type: "clear", intensity: 0, remainingTicks: 0 },

      setSun: (factor) => {
        set({ sun: Math.max(0, Math.min(1, factor)) });
      },

      setColonyName: (name) => {
        set({ colonyName: name });
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

    // Tick Weather
    const newWeather = WeatherService.tick(state.weather);
    const productionModifier = WeatherService.getProductionModifier(newWeather);

    const tickResult = EconomyService.tick(
      {
        resources: state.resources,
        capacity: state.capacity,
        sun: state.sun,
        alive: state.alive,
      },
      state.placed,
      BUILDING_DEFINITIONS,
      productionModifier
    );

    set({
      weather: newWeather,
      lastDelta: tickResult.delta,
      resources: {
        o2: state.resources.o2 + (tickResult.delta.o2 ?? 0),
        power: state.resources.power + (tickResult.delta.power ?? 0),
        water: state.resources.water + (tickResult.delta.water ?? 0),
        biomass: state.resources.biomass + (tickResult.delta.biomass ?? 0),
      },
      alive: !tickResult.gameOver,
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

if (typeof window !== "undefined") {
  (window as any).useGameStore = useGameStore;
}

