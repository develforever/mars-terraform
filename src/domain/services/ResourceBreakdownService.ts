import type { PlacedBuilding, BuildingDefinition } from "../entities/Building";
import type { ResourceKey } from "../entities/Resources";
import type { ResourceNode } from "../mapEditorTypes";
import { BuildingService } from "./BuildingService";
import { NeighborService } from "./NeighborService";
import { O2_CONSUMPTION_PER_TICK } from "./EconomyService";

export interface BuildingContribution {
  buildingId: string;
  label: string;
  definitionId: string;
  value: number;
  condition: number;
}

export interface ResourceBreakdown {
  producers: BuildingContribution[];
  consumers: BuildingContribution[];
  net: number;
}

export class ResourceBreakdownService {
  static getBreakdown(
    resource: ResourceKey,
    placed: PlacedBuilding[],
    definitions: Record<string, BuildingDefinition>,
    sunFactor: number,
    productionModifier: number = 1,
    resourceNodes: ResourceNode[] = []
  ): ResourceBreakdown {
    const producers: BuildingContribution[] = [];
    const consumers: BuildingContribution[] = [];

    for (const building of placed) {
      const def = definitions[building.definitionId];
      if (!def) continue;

      const condFactor = BuildingService.conditionFactor(building.condition);
      const neighborMult = NeighborService.getProductionMultiplier(building, def, placed, definitions);
      const depositMult = BuildingService.getDepositMultiplier(building, def, resourceNodes);

      if (def.production?.[resource] !== undefined) {
        let value = def.production[resource] ?? 0;

        if (def.tags?.includes("dayScaled") && resource === "power") {
          value *= sunFactor;
        }
        value *= productionModifier;

        if (value > 0) {
          value *= condFactor * neighborMult * depositMult;
        }

        const contribution: BuildingContribution = {
          buildingId: building.id,
          label: def.name,
          definitionId: def.id,
          value: parseFloat(value.toFixed(3)),
          condition: building.condition,
        };

        if (value > 0) producers.push(contribution);
        else if (value < 0) consumers.push(contribution);
        else if ((def.production[resource] ?? 0) > 0) {
          producers.push(contribution);
        }
      }
    }

    // O2 base consumption (all buildings)
    if (resource === "o2") {
      const totalO2Consumption = -O2_CONSUMPTION_PER_TICK * placed.length;
      consumers.push({
        buildingId: "__colony",
        label: "hint.colony_breathing",
        definitionId: "__colony",
        value: parseFloat(totalO2Consumption.toFixed(3)),
        condition: 100,
      });
    }

    const producedSum = producers.reduce((s, p) => s + p.value, 0);
    const consumedSum = consumers.reduce((s, c) => s + c.value, 0);
    const net = parseFloat((producedSum + consumedSum).toFixed(3));

    return { producers, consumers, net };
  }
}
