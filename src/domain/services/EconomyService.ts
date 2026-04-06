import type { BuildingDefinition, PlacedBuilding } from "../entities/Building";
import type { Resources, ResourceDelta, ResourceCapacity, ResourceProduction } from "../entities/Resources";
import type { ColonyState } from "../entities/Colony";

const O2_CONSUMPTION_PER_TICK = 0.05;

export interface EconomyTickResult {
  delta: ResourceDelta;
  gameOver: boolean;
}

export class EconomyService {
  static calculateProduction(
    buildings: PlacedBuilding[],
    definitions: Record<string, BuildingDefinition>,
    sunFactor: number
  ): ResourceProduction {
    const production: ResourceProduction = {};

    for (const building of buildings) {
      const def = definitions[building.definitionId];
      if (!def?.production) continue;

      for (const [resourceKey, value] of Object.entries(def.production)) {
        let adjustedValue = value ?? 0;
        
        // Solar panels produce less at night
        if (def.tags?.includes("dayScaled") && resourceKey === "power") {
          adjustedValue *= sunFactor;
        }

        const key = resourceKey as keyof Resources;
        production[key] = (production[key] ?? 0) + adjustedValue;
      }
    }

    return production;
  }

  static calculateConsumption(buildingCount: number): ResourceProduction {
    return {
      o2: -O2_CONSUMPTION_PER_TICK * buildingCount, // Simplified: 1 astronaut per building
    };
  }

  static applyProductionToResources(
    resources: Resources,
    production: ResourceProduction
  ): ResourceDelta {
    const delta: ResourceDelta = {};
    
    for (const [key, value] of Object.entries(production)) {
      if (value !== undefined) {
        const resourceKey = key as keyof Resources;
        delta[resourceKey] = resources[resourceKey] + value;
      }
    }
    
    return delta;
  }

  static clampResources(
    resources: Resources,
    capacity: ResourceCapacity
  ): ResourceDelta {
    const clamped: ResourceDelta = {};

    // Clamp resources to capacity (power, water, biomass)
    (["power", "water", "biomass"] as const).forEach(key => {
      const cap = capacity[key];
      if (resources[key] > cap) {
        clamped[key] = cap;
      }
      if (resources[key] < 0) {
        clamped[key] = 0;
      }
    });

    // O2 can't go below 0
    if (resources.o2 < 0) {
      clamped.o2 = 0;
    }

    return clamped;
  }

  static checkGameOver(resources: Resources, alive: boolean): boolean {
    return alive && resources.o2 <= 0;
  }

  static calculateCapacityDelta(
    definition: BuildingDefinition,
    adding: boolean
  ): Partial<ResourceCapacity> {
    const delta: Partial<ResourceCapacity> = {};
    const multiplier = adding ? 1 : -1;

    if (definition.capacity?.power) {
      delta.power = definition.capacity.power * multiplier;
    }
    if (definition.capacity?.water) {
      delta.water = definition.capacity.water * multiplier;
    }
    if (definition.capacity?.biomass) {
      delta.biomass = definition.capacity.biomass * multiplier;
    }

    return delta;
  }

  static tick(
    colony: ColonyState,
    buildings: PlacedBuilding[],
    definitions: Record<string, BuildingDefinition>
  ): EconomyTickResult {
    const production = this.calculateProduction(buildings, definitions, colony.sun);
    const consumption = this.calculateConsumption(buildings.length);
    
    // Merge production and consumption
    const totalDelta: ResourceDelta = { ...production };
    for (const [key, value] of Object.entries(consumption)) {
      if (value !== undefined) {
        const k = key as keyof Resources;
        totalDelta[k] = (totalDelta[k] ?? 0) + value;
      }
    }

    // Apply to current resources
    const newResources: Resources = {
      o2: colony.resources.o2 + (totalDelta.o2 ?? 0),
      power: colony.resources.power + (totalDelta.power ?? 0),
      water: colony.resources.water + (totalDelta.water ?? 0),
      biomass: colony.resources.biomass + (totalDelta.biomass ?? 0),
    };

    // Clamp to capacity
    const clamped = this.clampResources(newResources, colony.capacity);
    const finalResources = { ...newResources, ...clamped };

    const gameOver = this.checkGameOver(finalResources, colony.alive);

    return {
      delta: {
        o2: finalResources.o2 - colony.resources.o2,
        power: finalResources.power - colony.resources.power,
        water: finalResources.water - colony.resources.water,
        biomass: finalResources.biomass - colony.resources.biomass,
      },
      gameOver,
    };
  }
}
