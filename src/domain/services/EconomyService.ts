import type { BuildingDefinition, PlacedBuilding } from "../entities/Building";
import type { Resources, ResourceDelta, ResourceCapacity, ResourceProduction } from "../entities/Resources";
import type { ColonyState } from "../entities/Colony";
import type { ResourceNode } from "../mapEditorTypes";
import type { ColonyPopulation, RoleBonuses } from "../entities/Colonist";
import { ColonistService } from "./ColonistService";
import { BuildingService } from "./BuildingService";
import { NeighborService } from "./NeighborService";
import { ResearchService } from "./ResearchService";
import { WeatherService, type WeatherType } from "./WeatherService";

export const O2_CONSUMPTION_PER_TICK = 0.05;
export const EMERGENCY_LIFE_SUPPORT_DEFAULT_SECONDS = 60;

export interface EmergencyLifeSupportState {
  active: boolean;
  secondsRemaining: number;
}

export interface EconomyTickResult {
  delta: ResourceDelta;
  gameOver: boolean;
  resourceNodes?: ResourceNode[];
  /** Research Points produced this tick (from Lab buildings and Scientist colonists) */
  researchPointsDelta: number;
  emergencyLifeSupport: EmergencyLifeSupportState;
}

export class EconomyService {
  static calculateProduction(
    buildings: PlacedBuilding[],
    definitions: Record<string, BuildingDefinition>,
    sunFactor: number,
    productionModifier: number = 1,
    resourceNodes: ResourceNode[] = [],
    weatherType: WeatherType = "clear",
    roleBonuses?: RoleBonuses
  ): ResourceProduction {
    const production: ResourceProduction = {};
    const isDustStorm = WeatherService.isDustStorm(weatherType);

    for (const building of buildings) {
      if (building.disabled) continue;
      const def = definitions[building.definitionId];
      if (!def?.production) continue;

      const condFactor = BuildingService.conditionFactor(building.condition);
      const neighborMult = NeighborService.getProductionMultiplier(building, def, buildings, definitions);
      const depositMult = BuildingService.getDepositMultiplier(building, def, resourceNodes);
      const levelMult = BuildingService.getLevelMultiplier(building, def);

      for (const [resourceKey, value] of Object.entries(def.production)) {
        let adjustedValue = value ?? 0;

        // Solar panels produce less at night and lose 50% efficiency during dust/sand storm
        if (def.tags?.includes("dayScaled") && resourceKey === "power") {
          let solarFactor = sunFactor;
          if (isDustStorm) {
            solarFactor *= 0.5;
          }
          adjustedValue *= solarFactor;
        }

        adjustedValue *= productionModifier;

        // Condition, neighbor bonus, deposit bonus, and level upgrade only scale positive production, not consumption
        if (adjustedValue > 0) {
          // Colonist role bonuses
          if (resourceKey === "power" && roleBonuses?.engineerPowerMultiplier) {
            adjustedValue *= roleBonuses.engineerPowerMultiplier;
          }
          if (def.id === "greenhouse" && roleBonuses?.farmerBonusMultiplier) {
            adjustedValue *= roleBonuses.farmerBonusMultiplier;
          }
          if ((def.id === "miner" || def.id === "ice") && roleBonuses?.minerBonusMultiplier) {
            adjustedValue *= roleBonuses.minerBonusMultiplier;
          }

          adjustedValue *= condFactor * neighborMult * depositMult * levelMult;
        }

        const key = resourceKey as keyof Resources;
        production[key] = (production[key] ?? 0) + adjustedValue;
      }
    }

    return production;
  }

  static calculateConsumption(
    buildingCount: number,
    population?: ColonyPopulation
  ): ResourceProduction {
    const baseBuildingConsumption = -O2_CONSUMPTION_PER_TICK * buildingCount;

    if (!population || population.total <= 0) {
      return {
        o2: baseBuildingConsumption,
      };
    }

    const colonistCons = ColonistService.calculateConsumption(population);

    return {
      o2: baseBuildingConsumption + (colonistCons.o2 ?? 0),
      water: colonistCons.water ?? 0,
      biomass: colonistCons.biomass ?? 0,
    };
  }

  static clampResources(
    resources: Resources,
    capacity: ResourceCapacity
  ): ResourceDelta {
    const clamped: ResourceDelta = {};

    // Clamp resources to capacity (power, water, biomass, minerals)
    (["power", "water", "biomass", "minerals"] as const).forEach(key => {
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

  static checkGameOver(
    resources: Resources,
    alive: boolean,
    emergencyLifeSupport?: EmergencyLifeSupportState
  ): boolean {
    if (!alive) return true;
    if (resources.o2 <= 0) {
      if (emergencyLifeSupport) {
        return emergencyLifeSupport.secondsRemaining <= 0;
      }
      return true;
    }
    return false;
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
    if (definition.capacity?.minerals) {
      delta.minerals = definition.capacity.minerals * multiplier;
    }

    return delta;
  }

  /**
   * Depletes active resource nodes extracted by placed buildings.
   * If depletionRate <= 0, returns the original resourceNodes without mutation.
   */
  static depleteDeposits(
    buildings: PlacedBuilding[],
    definitions: Record<string, BuildingDefinition>,
    resourceNodes: ResourceNode[],
    depletionRate: number
  ): ResourceNode[] {
    if (depletionRate <= 0 || resourceNodes.length === 0 || buildings.length === 0) {
      return resourceNodes;
    }

    const extractedNodeIds = new Set<string>();
    for (const building of buildings) {
      if (building.disabled) continue;
      const def = definitions[building.definitionId];
      if (!def?.extractsDeposit) continue;

      const efficiency = BuildingService.getDepositEfficiencyAtCell(
        def,
        { x: building.position.x, z: building.position.z },
        resourceNodes
      );
      for (const node of efficiency.matchingNodes) {
        extractedNodeIds.add(node.id);
      }
    }

    if (extractedNodeIds.size === 0) {
      return resourceNodes;
    }

    return resourceNodes.map((node) => {
      if (extractedNodeIds.has(node.id) && node.amount > 0) {
        return {
          ...node,
          amount: Math.max(0, Math.round((node.amount - depletionRate) * 100) / 100),
        };
      }
      return node;
    });
  }

  static tick(
    colony: ColonyState,
    buildings: PlacedBuilding[],
    definitions: Record<string, BuildingDefinition>,
    productionModifier: number = 1,
    resourceNodes: ResourceNode[] = [],
    depletionRate: number = 0,
    weatherType: WeatherType = "clear",
    population?: ColonyPopulation,
    roleBonuses?: RoleBonuses,
    emergencyLifeSupport?: EmergencyLifeSupportState
  ): EconomyTickResult {
    const production = this.calculateProduction(
      buildings,
      definitions,
      colony.sun,
      productionModifier,
      resourceNodes,
      weatherType,
      roleBonuses
    );
    const consumption = this.calculateConsumption(buildings.length, population);
    const updatedResourceNodes = this.depleteDeposits(
      buildings,
      definitions,
      resourceNodes,
      depletionRate
    );

    // Research Points from Lab buildings + Scientist colonists
    const labRPDelta = ResearchService.calculateRPProduction(buildings, definitions);
    const researchPointsDelta = labRPDelta + (roleBonuses?.scientistRPDelta ?? 0);
    
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
      minerals: colony.resources.minerals + (totalDelta.minerals ?? 0),
    };

    // Clamp to capacity
    const clamped = this.clampResources(newResources, colony.capacity);
    const finalResources = { ...newResources, ...clamped };

    // Emergency Life Support calculation
    let newEmergencyLifeSupport: EmergencyLifeSupportState;
    if (finalResources.o2 <= 0) {
      const prevSeconds = emergencyLifeSupport
        ? emergencyLifeSupport.secondsRemaining
        : EMERGENCY_LIFE_SUPPORT_DEFAULT_SECONDS;
      const nextSeconds = emergencyLifeSupport?.active
        ? Math.max(0, prevSeconds - 1)
        : Math.max(0, EMERGENCY_LIFE_SUPPORT_DEFAULT_SECONDS - 1);
      
      newEmergencyLifeSupport = {
        active: true,
        secondsRemaining: nextSeconds,
      };
    } else {
      newEmergencyLifeSupport = {
        active: false,
        secondsRemaining: EMERGENCY_LIFE_SUPPORT_DEFAULT_SECONDS,
      };
    }

    const gameOver = this.checkGameOver(finalResources, colony.alive, newEmergencyLifeSupport);

    return {
      delta: {
        o2: finalResources.o2 - colony.resources.o2,
        power: finalResources.power - colony.resources.power,
        water: finalResources.water - colony.resources.water,
        biomass: finalResources.biomass - colony.resources.biomass,
        minerals: finalResources.minerals - colony.resources.minerals,
      },
      gameOver,
      resourceNodes: updatedResourceNodes,
      researchPointsDelta,
      emergencyLifeSupport: newEmergencyLifeSupport,
    };
  }
}
