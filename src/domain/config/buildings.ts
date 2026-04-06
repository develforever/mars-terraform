import type { BuildingDefinition } from "../entities/Building";

export const BUILDING_SEED: BuildingDefinition[] = [
  {
    id: "hab",
    name: "Kapsuła",
    color: "#93c5fd",
    cost: { power: 5, water: 1 },
    production: { o2: 0.10 },
    modelPath: "/models/habitat.glb",
  },
  {
    id: "greenhouse",
    name: "Szklarnia",
    color: "#86efac",
    cost: { power: 2, water: 2 },
    production: { o2: 0.20, biomass: 0.10, power: -0.05, water: -0.05 },
    modelPath: "/models/greenhouse.glb",
  },
  {
    id: "solar",
    name: "Panel",
    color: "#fde68a",
    cost: { biomass: 0.5 },
    production: { power: 0.30 },
    tags: ["dayScaled"],
    modelPath: "/models/solar_panel.glb",
  },
  {
    id: "ice",
    name: "Kolektor lodu",
    color: "#a5f3fc",
    cost: { power: 1 },
    production: { water: 0.20, power: -0.05 },
  },
  {
    id: "battery",
    name: "Magazyn energii",
    color: "#fbbf24",
    cost: { biomass: 0.5, water: 0.5 },
    capacity: { power: 20 },
    modelPath: "/models/energy_station.glb",
  },
  {
    id: "watertank",
    name: "Zbiornik wody",
    color: "#60a5fa",
    cost: { power: 1, biomass: 0.2 },
    capacity: { water: 20 },
  },
  {
    id: "silo",
    name: "Silos biomasy",
    color: "#a3e635",
    cost: { power: 1, water: 0.5 },
    capacity: { biomass: 15 },
    modelPath: "/models/biomass_silo.glb",
  },
  {
    id: "recycler",
    name: "Recykler wody",
    color: "#34d399",
    cost: { power: 2, biomass: 1 },
    production: { water: 0.08, power: -0.10 },
  },
  {
    id: "rtg",
    name: "RTG",
    color: "#f472b6",
    cost: { biomass: 3, water: 1 },
    production: { power: 0.25 },
  },
];

export const BUILDING_DEFINITIONS: Record<string, BuildingDefinition> = 
  Object.fromEntries(BUILDING_SEED.map(d => [d.id, d]));
