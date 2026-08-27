import type { PlacedBuilding, BuildingDefinition } from "../entities/Building";
import type { Resources, ResourceCapacity, ResourceProduction } from "../entities/Resources";
import type {
  ColonistRole,
  ColonistRoleDistribution,
  ColonyPopulation,
  MoraleState,
  RoleBonuses,
} from "../entities/Colonist";
import { INITIAL_MORALE } from "../entities/Colonist";

export class ColonistService {
  static readonly O2_PER_COLONIST = 0.01;
  static readonly WATER_PER_COLONIST = 0.01;
  static readonly FOOD_PER_COLONIST = 0.008;
  static readonly SHUTTLE_INTERVAL_TICKS = 30;
  static readonly SHUTTLE_MAX_ARRIVALS = 3;

  /**
   * Calculates total housing capacity from placed habitat structures and their upgrades.
   */
  static calculateCapacity(
    placedBuildings: PlacedBuilding[],
    definitions: Record<string, BuildingDefinition>
  ): number {
    let capacity = 0;
    for (const b of placedBuildings) {
      const def = definitions[b.definitionId];
      if (b.definitionId === "hab" || def?.colonistCapacity) {
        const base = def?.colonistCapacity ?? 10;
        const level = b.level ?? 1;
        if (level === 1) {
          capacity += base;
        } else if (level === 2) {
          capacity += base * 2;
        } else if (level >= 3) {
          capacity += Math.round(base * 3.5);
        }
      }
    }
    return capacity;
  }

  /**
   * Assigns or unassigns colonists to/from specialized roles.
   * If delta > 0, moves colonists from unassigned to the target role.
   * If delta < 0, moves colonists from the target role back to unassigned.
   */
  static assignRole(
    population: ColonyPopulation,
    role: ColonistRole,
    delta: number
  ): ColonyPopulation {
    if (delta === 0 || role === "unassigned") {
      return population;
    }

    const newRoles: ColonistRoleDistribution = { ...population.roles };

    if (delta > 0) {
      const availableUnassigned = newRoles.unassigned;
      const toAssign = Math.min(delta, availableUnassigned);
      if (toAssign <= 0) return population;

      newRoles.unassigned -= toAssign;
      newRoles[role] += toAssign;
    } else {
      const availableInRole = newRoles[role];
      const toUnassign = Math.min(Math.abs(delta), availableInRole);
      if (toUnassign <= 0) return population;

      newRoles[role] -= toUnassign;
      newRoles.unassigned += toUnassign;
    }

    return {
      ...population,
      roles: newRoles,
    };
  }

  /**
   * Calculates per-tick resource consumption for the current colonist population.
   */
  static calculateConsumption(population: ColonyPopulation): ResourceProduction {
    if (population.total <= 0) {
      return {};
    }

    return {
      o2: -parseFloat((population.total * this.O2_PER_COLONIST).toFixed(4)),
      water: -parseFloat((population.total * this.WATER_PER_COLONIST).toFixed(4)),
      biomass: -parseFloat((population.total * this.FOOD_PER_COLONIST).toFixed(4)),
    };
  }

  /**
   * Calculates colony morale (0-100) and productivity multiplier based on vital resource availability and housing.
   */
  static calculateMorale(
    resources: Resources,
    _capacity: ResourceCapacity,
    population: ColonyPopulation
  ): MoraleState {
    if (population.total <= 0) {
      return INITIAL_MORALE;
    }

    // Housing satisfaction
    const housingSatisfaction =
      population.capacity >= population.total
        ? 100
        : Math.max(0, Math.round((population.capacity / population.total) * 100));

    // Vital needs satisfaction
    const o2Threshold = Math.max(0.5, population.total * 0.05);
    const o2Satisfaction =
      resources.o2 <= 0
        ? 0
        : Math.min(100, Math.max(0, Math.round((resources.o2 / o2Threshold) * 100)));

    const waterThreshold = Math.max(0.5, population.total * 0.05);
    const waterSatisfaction =
      resources.water <= 0
        ? 0
        : Math.min(100, Math.max(0, Math.round((resources.water / waterThreshold) * 100)));

    const foodThreshold = Math.max(0.5, population.total * 0.04);
    const foodSatisfaction =
      resources.biomass <= 0
        ? 0
        : Math.min(100, Math.max(0, Math.round((resources.biomass / foodThreshold) * 100)));

    // Weighted Morale score
    const moraleValue = Math.min(
      100,
      Math.max(
        0,
        Math.round(
          o2Satisfaction * 0.35 +
            waterSatisfaction * 0.25 +
            foodSatisfaction * 0.20 +
            housingSatisfaction * 0.20
        )
      )
    );

    // Productivity modifier
    let productivityMultiplier = 1.0;
    if (moraleValue > 75) {
      productivityMultiplier = 1.15;
    } else if (moraleValue < 30) {
      productivityMultiplier = 0.70;
    }

    return {
      value: moraleValue,
      factors: {
        foodSatisfaction,
        waterSatisfaction,
        o2Satisfaction,
        housingSatisfaction,
      },
      productivityMultiplier,
    };
  }

  /**
   * Computes production and research bonuses based on assigned colonist professions.
   */
  static calculateRoleBonuses(roles: ColonistRoleDistribution): RoleBonuses {
    return {
      engineerPowerMultiplier: 1 + roles.engineer * 0.03,
      farmerBonusMultiplier: 1 + roles.farmer * 0.04,
      minerBonusMultiplier: 1 + roles.miner * 0.05,
      scientistRPDelta: roles.scientist * 0.1,
    };
  }

  /**
   * Periodically brings new immigrant colonists from Earth when habitat capacity is available.
   */
  static processShuttleArrival(
    population: ColonyPopulation,
    tick: number
  ): { population: ColonyPopulation; arrived: number } {
    if (tick > 0 && tick % this.SHUTTLE_INTERVAL_TICKS === 0 && population.total < population.capacity) {
      const availableCapacity = population.capacity - population.total;
      const arrived = Math.min(this.SHUTTLE_MAX_ARRIVALS, availableCapacity);
      if (arrived > 0) {
        return {
          population: {
            ...population,
            total: population.total + arrived,
            roles: {
              ...population.roles,
              unassigned: population.roles.unassigned + arrived,
            },
          },
          arrived,
        };
      }
    }

    return { population, arrived: 0 };
  }
}
