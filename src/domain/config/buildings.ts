import type { BuildingDefinition } from "../entities/Building";

export const BUILDING_SEED: BuildingDefinition[] = [
  // LIVING
  {
    id: "hab",
    name: "Centrum Kolonii",
    category: "living",
    color: "#93c5fd",
    cost: { power: 5, water: 1 },
    production: { o2: 0.15 },
    modelPath: "/models/mars/structure_detailed.glb",
  },
  {
    id: "greenhouse",
    name: "Szklarnia Bio",
    category: "living",
    color: "#86efac",
    cost: { power: 3, water: 4 },
    production: { o2: 0.30, biomass: 0.20, power: -0.10, water: -0.15 },
    modelPath: "/models/mars/hangar_roundGlass.glb",
    dependsOn: ["hab"],
  },

  // PRODUCTION
  {
    id: "solar",
    name: "Generator Solarny",
    category: "production",
    color: "#fde68a",
    cost: { biomass: 0.5 },
    production: { power: 0.50 },
    tags: ["dayScaled"],
    modelPath: "/models/mars/machine_generator.glb",
  },
  {
    id: "rtg",
    name: "Blok RTG",
    category: "production",
    color: "#f472b6",
    cost: { biomass: 5, water: 2 },
    production: { power: 0.60 },
    modelPath: "/models/mars/machine_generatorLarge.glb",
    dependsOn: ["solar"],
  },
  {
    id: "ice",
    name: "Ekstraktor Lodu",
    category: "production",
    color: "#a5f3fc",
    cost: { power: 4 },
    production: { water: 0.40, power: -0.20 },
    modelPath: "/models/mars/pipe_entrance.glb",
    dependsOn: ["hab"],
  },
  {
    id: "miner",
    name: "Kopalnia",
    category: "production",
    color: "#94a3b8",
    cost: { power: 6, water: 2 },
    production: { biomass: 0.40, power: -0.30 },
    modelPath: "/models/mars/craft_miner.glb",
    dependsOn: ["ice"],
  },

  // STORAGE
  {
    id: "battery",
    name: "Stacja Przekaźnikowa",
    category: "storage",
    color: "#fbbf24",
    cost: { biomass: 1, water: 1 },
    capacity: { power: 50 },
    modelPath: "/models/mars/machine_wireless.glb",
    dependsOn: ["solar"],
  },
  {
    id: "watertank",
    name: "Zbiornik H2O",
    category: "storage",
    color: "#60a5fa",
    cost: { power: 2, biomass: 0.5 },
    capacity: { water: 50 },
    modelPath: "/models/mars/machine_barrel.glb",
    dependsOn: ["ice"],
  },
  {
    id: "silo",
    name: "Silos Materiałowy",
    category: "storage",
    color: "#a3e635",
    cost: { power: 2, water: 1 },
    capacity: { biomass: 40 },
    modelPath: "/models/mars/machine_barrelLarge.glb",
    dependsOn: ["miner"],
  },

  // DEFENSE
  {
    id: "turret",
    name: "Wieżyczka",
    category: "defense",
    color: "#ef4444",
    cost: { power: 10, biomass: 2 },
    production: { power: -0.05 },
    modelPath: "/models/mars/turret_single.glb",
    dependsOn: ["hab", "solar"],
  },
];

export const BUILDING_DEFINITIONS: Record<string, BuildingDefinition> = 
  Object.fromEntries(BUILDING_SEED.map(d => [d.id, d]));
