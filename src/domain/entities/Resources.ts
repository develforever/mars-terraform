export type ResourceKey = "o2" | "power" | "water" | "biomass" | "minerals";

export interface Resources {
  o2: number;
  power: number;
  water: number;
  biomass: number;
  minerals: number;
}

export type ResourceCost = Partial<Record<ResourceKey, number>>;
export type ResourceDelta = Partial<Record<ResourceKey, number>>;
export type ResourceProduction = Partial<Record<ResourceKey, number>>;

export interface ResourceCapacity {
  power: number;
  water: number;
  biomass: number;
  minerals: number;
}
