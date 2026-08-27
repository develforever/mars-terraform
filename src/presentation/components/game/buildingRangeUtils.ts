import type { PlacedBuilding, BuildingDefinition } from "../../../domain/entities/Building";
import { BUILDING_DEFINITIONS, BuildingCategory } from "../../../domain/config/buildings";
import { BuildingService } from "../../../domain/services/BuildingService";

export interface RangeRingConfig {
  radius: number;
  color: string;
  fillColor: string;
}

export function getRangeRingConfig(building: PlacedBuilding, def?: BuildingDefinition): RangeRingConfig {
  const definition = def ?? BUILDING_DEFINITIONS[building.definitionId];

  // 1. Defense turrets -> Red
  if (definition?.category === BuildingCategory.DEFENSE || definition?.id === "turret") {
    const radius = definition?.influenceRadius ?? 4.0;
    return {
      radius,
      color: "#ef4444",
      fillColor: "#ef4444",
    };
  }

  // 2. Mines and Ice extractors (Deposit extractors) -> Cyan
  if (definition?.extractsDeposit || definition?.id === "miner" || definition?.id === "ice") {
    const hexRadius = definition ? BuildingService.getExtractionRadius(building, definition) : 1;
    const baseRadius = definition?.influenceRadius ?? 3.5;
    const radius = Math.max(baseRadius, hexRadius * 2.3);
    return {
      radius,
      color: "#00ffff",
      fillColor: "#06b6d4",
    };
  }

  // 3. Living modules and greenhouses -> Green
  if (
    definition?.category === BuildingCategory.LIVING ||
    definition?.id === "hab" ||
    definition?.id === "greenhouse" ||
    definition?.id === "biosphere_dome"
  ) {
    const radius = definition?.influenceRadius ?? 3.8;
    return {
      radius,
      color: "#00ff88",
      fillColor: "#22c55e",
    };
  }

  // Fallback for other structures with influenceRadius
  const fallbackRadius = definition?.influenceRadius ?? 3.0;
  return {
    radius: fallbackRadius,
    color: "#38bdf8",
    fillColor: "#0284c7",
  };
}
