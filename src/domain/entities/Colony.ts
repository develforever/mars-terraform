import type { Resources, ResourceCapacity } from "./Resources";

export interface ColonyState {
  resources: Resources;
  capacity: ResourceCapacity;
  sun: number;
  alive: boolean;
}

export const INITIAL_COLONY_STATE: ColonyState = {
  resources: {
    o2: 5,
    power: 8,
    water: 6,
    biomass: 3,
    minerals: 60,
  },
  capacity: {
    power: 20,
    water: 20,
    biomass: 20,
    minerals: 200,
  },
  sun: 1,
  alive: true,
};
