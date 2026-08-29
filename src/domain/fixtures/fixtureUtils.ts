import type { PlacedBuilding } from "../entities/Building";
import type { ResourceCapacity } from "../entities/Resources";
import { BUILDING_DEFINITIONS } from "../config/buildings";
import { hexToWorld, worldToHex, hexesInRadius } from "../../presentation/generator/hex/HexMath";
import type { GameStoreInstance } from "./types";

export interface FixtureBuildingSpec {
  definitionId: string;
  level?: number;
  condition?: number;
  disabled?: boolean;
}

export function placeDeterministicBuildings(
  store: GameStoreInstance,
  specs: FixtureBuildingSpec[],
  startingPlaced?: PlacedBuilding[]
): { placed: PlacedBuilding[]; occupied: Record<string, string>; capacity: ResourceCapacity } {
  const state = store.getState();
  const grid = state.hexGrid;

  const placed: PlacedBuilding[] = startingPlaced ? [...startingPlaced] : [...state.placed];
  const occupied: Record<string, string> = {};

  for (const b of placed) {
    const key = `${Math.round(b.position.x)},${Math.round(b.position.z)}`;
    occupied[key] = b.id;
  }

  const centerHab = placed.find((b) => b.id === "colony-center-hab") || placed[0];
  const [centerQ, centerR] = centerHab
    ? worldToHex(centerHab.position.x, centerHab.position.z)
    : [0, 0];

  const candidateCoords = hexesInRadius(centerQ, centerR, 10);
  let specIndex = 0;

  for (const [q, r] of candidateCoords) {
    if (specIndex >= specs.length) break;
    if (q === centerQ && r === centerR) continue;

    const cell = grid.getCell(q, r);
    if (!cell || cell.terrainType === "peak" || cell.terrainType === "deep_crater") continue;

    const [wx, wz] = hexToWorld(q, r);
    const key = `${Math.round(wx)},${Math.round(wz)}`;
    if (occupied[key]) continue;

    const spec = specs[specIndex];
    const building: PlacedBuilding = {
      id: `fixture-${spec.definitionId}-${specIndex + 1}`,
      definitionId: spec.definitionId,
      position: { x: wx, y: cell.worldY, z: wz },
      condition: spec.condition ?? 100,
      level: spec.level ?? 1,
      disabled: spec.disabled ?? false,
    };

    placed.push(building);
    occupied[key] = building.id;
    specIndex++;
  }

  let powerCap = 20;
  let waterCap = 20;
  let biomassCap = 20;
  let mineralsCap = 200;

  for (const b of placed) {
    const def = BUILDING_DEFINITIONS[b.definitionId];
    if (def?.capacity) {
      if (def.capacity.power) powerCap += def.capacity.power;
      if (def.capacity.water) waterCap += def.capacity.water;
      if (def.capacity.biomass) biomassCap += def.capacity.biomass;
      if (def.capacity.minerals) mineralsCap += def.capacity.minerals;
    }
  }

  const capacity: ResourceCapacity = {
    power: powerCap,
    water: waterCap,
    biomass: biomassCap,
    minerals: mineralsCap,
  };

  return { placed, occupied, capacity };
}

