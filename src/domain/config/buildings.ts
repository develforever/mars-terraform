import type { BuildingDefinition } from "../entities/Building";

export const BuildingCategory = {
  LIVING: "living",
  PRODUCTION: "production",
  STORAGE: "storage",
  INFRASTRUCTURE: "infrastructure",
  DEFENSE: "defense",
} as const;

export type BuildingCategory = typeof BuildingCategory[keyof typeof BuildingCategory];


export const BUILDING_SEED: BuildingDefinition[] = [
  // LIVING
  {
    id: "hab",
    name: "Centrum Kolonii",
    category: BuildingCategory.LIVING,
    color: "#93c5fd",
    cost: { power: 5, water: 1 },
    production: { o2: 0.15, power: -0.10, water: -0.05 },
    modelPath: "/models/mars/rocket_baseA.glb",
    modelScale: 2.5,
    influenceRadius: 5,
  },
  {
    id: "greenhouse",
    name: "Szklarnia Bio",
    category: BuildingCategory.LIVING,
    color: "#86efac",
    cost: { power: 3, water: 4 },
    production: { o2: 0.30, biomass: 0.20, power: -0.10, water: -0.15 },
    modelPath: "/models/mars/hangar_roundGlass.glb",
    modelScale: 2.5,
    dependsOn: ["hab"],
    connectionType: "water" as const,
    bonusNeighbors: [
      { neighborId: "o2-gen", bonusPercent: 20, description: "+20% O₂ obok Generatora" },
      { neighborId: "ice",    bonusPercent: 15, description: "+15% Bio obok Ekstraktora" },
    ],
    influenceRadius: 4,
  },

  // PRODUCTION
  {
    id: "o2-gen",
    name: "Generator Tlenu",
    category: BuildingCategory.PRODUCTION,
    color: "#67e8f9",
    cost: { power: 4, water: 2 },
    production: { o2: 0.60, power: -0.15 },
    modelPath: "/models/mars/machine_generator.glb",
    modelScale: 2.5,
    dependsOn: ["hab"],
    connectionType: "power" as const,
    influenceRadius: 3,
  },
  {
    id: "solar",
    name: "Generator Solarny",
    category: BuildingCategory.PRODUCTION,
    color: "#fde68a",
    cost: { biomass: 0.5 },
    production: { power: 0.50 },
    tags: ["dayScaled"],
    modelPath: "/models/mars/machine_generator.glb",
    modelScale: 3.0,
    connectionType: "power" as const,
    bonusNeighbors: [
      { neighborId: "battery", bonusPercent: 15, description: "+15% Power obok Stacji" },
    ],
    influenceRadius: 2,
  },
  {
    id: "rtg",
    name: "Blok RTG",
    category: BuildingCategory.PRODUCTION,
    color: "#f472b6",
    cost: { biomass: 5, water: 2 },
    production: { power: 0.60 },
    modelPath: "/models/mars/machine_generatorLarge.glb",
    modelScale: 3.0,
    dependsOn: ["solar"],
    influenceRadius: 2.5,
  },
  {
    id: "ice",
    name: "Ekstraktor Lodu",
    category: BuildingCategory.PRODUCTION,
    color: "#a5f3fc",
    cost: { power: 4 },
    production: { water: 0.40, power: -0.20 },
    modelPath: "/models/mars/pipe_entrance.glb",
    modelScale: 2.5,
    dependsOn: ["hab"],
    influenceRadius: 3,
  },
  {
    id: "miner",
    name: "Kopalnia",
    category: BuildingCategory.PRODUCTION,
    color: "#94a3b8",
    cost: { power: 6, water: 2 },
    production: { biomass: 0.40, power: -0.30 },
    modelPath: "/models/mars/craft_miner.glb",
    modelScale: 3.0,
    dependsOn: ["ice"],
    connectionType: "biomass" as const,
    bonusNeighbors: [
      { neighborId: "silo",  bonusPercent: 10, description: "+10% Biomasa obok Silosu" },
    ],
    influenceRadius: 3.5,
  },

  // STORAGE
  {
    id: "battery",
    name: "Stacja Przekaźnikowa",
    category: BuildingCategory.STORAGE,
    color: "#fbbf24",
    cost: { biomass: 1, water: 1 },
    capacity: { power: 50 },
    modelPath: "/models/mars/machine_wireless.glb",
    modelScale: 2.5,
    dependsOn: ["solar"],
    influenceRadius: 2,
  },
  {
    id: "watertank",
    name: "Zbiornik H2O",
    category: BuildingCategory.STORAGE,
    color: "#60a5fa",
    cost: { power: 2, biomass: 0.5 },
    capacity: { water: 50 },
    modelPath: "/models/mars/machine_barrel.glb",
    modelScale: 2.5,
    dependsOn: ["ice"],
    influenceRadius: 2.5,
  },
  {
    id: "silo",
    name: "Silos Materiałowy",
    category: BuildingCategory.STORAGE,
    color: "#a3e635",
    cost: { power: 2, water: 1 },
    capacity: { biomass: 40 },
    modelPath: "/models/mars/machine_barrelLarge.glb",
    modelScale: 2.5,
    dependsOn: ["miner"],
    influenceRadius: 2.5,
  },

  // INFRASTRUCTURE
  {
    id: "lab",
    name: "Laboratorium",
    category: BuildingCategory.INFRASTRUCTURE,
    color: "#d8b4fe",
    cost: { power: 10, biomass: 5 },
    production: { power: -0.40, water: -0.20, biomass: 0.10 },
    modelPath: "/models/mars/machine_wireless.glb",
    modelScale: 2.5,
    dependsOn: ["hab", "rtg"],
    connectionType: "data" as const,
    bonusNeighbors: [
      { neighborId: "hab",  bonusPercent: 25, description: "+25% Biomasa obok Kolonii" },
    ],
    influenceRadius: 3.5,
  },

  // DEFENSE
  {
    id: "turret",
    name: "Wieżyczka",
    category: BuildingCategory.DEFENSE,
    color: "#ef4444",
    cost: { power: 10, biomass: 2 },
    production: { power: -0.05 },
    modelPath: "/models/mars/turret_single.glb",
    modelScale: 3.0,
    dependsOn: ["hab", "solar"],
    influenceRadius: 4,
  },
];

export const BUILDING_DEFINITIONS: Record<string, BuildingDefinition> =
  Object.fromEntries(BUILDING_SEED.map(d => [d.id, d]));
