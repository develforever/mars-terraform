export type ColonistRole = "unassigned" | "engineer" | "scientist" | "farmer" | "miner";

export const COLONIST_ROLES: ColonistRole[] = [
  "unassigned",
  "engineer",
  "scientist",
  "farmer",
  "miner",
];

export interface ColonistRoleDistribution {
  unassigned: number;
  engineer: number;
  scientist: number;
  farmer: number;
  miner: number;
}

export interface ColonyPopulation {
  total: number;
  capacity: number;
  roles: ColonistRoleDistribution;
}

export interface MoraleFactors {
  foodSatisfaction: number;
  waterSatisfaction: number;
  o2Satisfaction: number;
  housingSatisfaction: number;
}

export interface MoraleState {
  value: number;
  factors: MoraleFactors;
  productivityMultiplier: number;
}

export interface RoleBonuses {
  engineerPowerMultiplier: number;
  farmerBonusMultiplier: number;
  minerBonusMultiplier: number;
  scientistRPDelta: number;
}

export const INITIAL_POPULATION: ColonyPopulation = {
  total: 6,
  capacity: 10,
  roles: {
    unassigned: 2,
    engineer: 1,
    scientist: 1,
    farmer: 1,
    miner: 1,
  },
};

export const INITIAL_MORALE: MoraleState = {
  value: 100,
  factors: {
    foodSatisfaction: 100,
    waterSatisfaction: 100,
    o2Satisfaction: 100,
    housingSatisfaction: 100,
  },
  productivityMultiplier: 1.15,
};
