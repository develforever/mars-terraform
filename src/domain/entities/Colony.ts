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
    power: 5,
    water: 3,
    biomass: 1,
  },
  capacity: {
    power: 10,
    water: 10,
    biomass: 10,
  },
  sun: 1,
  alive: true,
};
