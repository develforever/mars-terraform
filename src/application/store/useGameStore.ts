import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { PlacedBuilding } from "../../domain/entities/Building";
import type { Resources, ResourceCapacity } from "../../domain/entities/Resources";
import { INITIAL_COLONY_STATE } from "../../domain/entities/Colony";
import { BUILDING_DEFINITIONS } from "../../domain/config/buildings";
import { BuildingService } from "../../domain/services/BuildingService";
import { EconomyService } from "../../domain/services/EconomyService";

export interface GameState {
  // Resources and colony state
  resources: Resources;
  capacity: ResourceCapacity;
  sun: number;
  alive: boolean;
  colonyName: string;

  // Buildings
  placed: PlacedBuilding[];
  occupied: Record<string, string>;

  // Actions
  setSun: (factor: number) => void;
  setColonyName: (name: string) => void;
  placeBuilding: (cell: { x: number; z: number }, heightY: number, definitionId: string) => boolean;
  demolishBuilding: (cell: { x: number; z: number }) => boolean;
  applyEconomyTick: () => void;
  resetGame: () => void;
}

export const useGameStore = create<GameState>()(
  devtools(
    (set, get) => ({
      resources: INITIAL_COLONY_STATE.resources,
      capacity: INITIAL_COLONY_STATE.capacity,
      sun: INITIAL_COLONY_STATE.sun,
      alive: INITIAL_COLONY_STATE.alive,
      colonyName: "",
      placed: [],
      occupied: {},

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
          state.occupied
        );

        if (!result.success || !result.building) return false;

        // Apply cost
        if (result.costDelta) {
          const newResources = { ...state.resources };
          for (const [key, value] of Object.entries(result.costDelta)) {
            if (value !== undefined) {
              newResources[key as keyof Resources] += value;
            }
          }
          set({ resources: newResources });
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
        if (result.refundDelta) {
          const newResources = { ...state.resources };
          for (const [key, value] of Object.entries(result.refundDelta)) {
            if (value !== undefined) {
              newResources[key as keyof Resources] += value;
            }
          }
          set({ resources: newResources });
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
          placed: state.placed.filter(b => b.id !== building.id),
          occupied: newOccupied,
          capacity: newCapacity,
        });

        return true;
      },

      applyEconomyTick: () => {
        const state = get();
        if (!state.alive) return;

        const tickResult = EconomyService.tick(
          {
            resources: state.resources,
            capacity: state.capacity,
            sun: state.sun,
            alive: state.alive,
          },
          state.placed,
          BUILDING_DEFINITIONS
        );

        const newResources: Resources = {
          o2: state.resources.o2 + (tickResult.delta.o2 ?? 0),
          power: state.resources.power + (tickResult.delta.power ?? 0),
          water: state.resources.water + (tickResult.delta.water ?? 0),
          biomass: state.resources.biomass + (tickResult.delta.biomass ?? 0),
        };

        // Clamp resources
        const clamped = EconomyService.clampResources(newResources, state.capacity);
        const finalResources = { ...newResources, ...clamped };

        set({
          resources: finalResources,
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
    }),
    { name: "GameStore", enabled: true }
  )
);
