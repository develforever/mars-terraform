// imports
import type { UnitDefinition } from "../entities/Unit";

// constants
export const UNIT_IDS = {
  ROVER: "rover",
  ROVER_COMBAT: "rover_combat",
  CRAFT_MINER: "craft_miner",
  DRONE_REPAIR: "drone_repair",
  CRAFT_HAULER: "craft_hauler",
} as const;

export type UnitId = typeof UNIT_IDS[keyof typeof UNIT_IDS];

export const UNIT_DEFINITIONS: Record<string, UnitDefinition> = {
  [UNIT_IDS.ROVER]: {
    id: UNIT_IDS.ROVER,
    name: "Łazik Logistyczny",
    role: "logistics",
    category: "ground",
    description: "Standardowy autonomiczny łazik naziemny do transportu surowców ze złóż do bazy.",
    stats: {
      health: 100,
      maxHealth: 100,
      speed: 2.6,
      powerConsumption: 0.05,
      cargoCapacity: 20,
    },
    modelPath: "/models/mars/rover.glb",
    iconPath: "/icons/units/rover.webp",
    modelScale: 1.8,
    color: "#fbbf24",
  },
  [UNIT_IDS.ROVER_COMBAT]: {
    id: UNIT_IDS.ROVER_COMBAT,
    name: "Łazik Bojowy (Combat Rover)",
    role: "combat",
    category: "ground",
    description: "Ciężko opancerzony łazik patrolowy wyposażony w obrotową wieżyczkę działkową do eliminacji zagrożeń obcych.",
    stats: {
      health: 250,
      maxHealth: 250,
      speed: 2.2,
      powerConsumption: 0.15,
      attackRange: 6.0,
      attackDamage: 35,
      attackCooldown: 1.2,
    },
    modelPath: "/models/mars/rover_combat.glb",
    iconPath: "/icons/units/rover_combat.webp",
    modelScale: 1.8,
    color: "#ef4444",
    requiredTech: "perimeter_defense",
  },
  [UNIT_IDS.CRAFT_MINER]: {
    id: UNIT_IDS.CRAFT_MINER,
    name: "Dron Górniczy (Mining Drone)",
    role: "mining",
    category: "air",
    description: "Szybki dron powietrzny omijający przeszkody terenowe i transportujący urobek ze złóż.",
    stats: {
      health: 80,
      maxHealth: 80,
      speed: 4.5,
      powerConsumption: 0.10,
      cargoCapacity: 15,
    },
    modelPath: "/models/mars/craft_miner.glb",
    iconPath: "/icons/units/craft_miner.webp",
    modelScale: 1.8,
    color: "#38bdf8",
    requiredTech: "drone_logistics",
  },
  [UNIT_IDS.DRONE_REPAIR]: {
    id: UNIT_IDS.DRONE_REPAIR,
    name: "Dron Naprawczy (Repair Drone)",
    role: "repair",
    category: "air",
    description: "Specjalistyczny dron inżynieryjny z modułem telemetrycznym i palnikiem łukowym do naprawy uszkodzonych instalacji.",
    stats: {
      health: 120,
      maxHealth: 120,
      speed: 3.8,
      powerConsumption: 0.12,
      repairRate: 15,
      repairRange: 4.0,
    },
    modelPath: "/models/mars/drone_repair.glb",
    iconPath: "/icons/units/drone_repair.webp",
    modelScale: 1.8,
    color: "#00e5ff",
    requiredTech: "drone_logistics",
  },
  [UNIT_IDS.CRAFT_HAULER]: {
    id: UNIT_IDS.CRAFT_HAULER,
    name: "Transporter Ciężki (Heavy Hauler)",
    role: "transport",
    category: "air",
    description: "Ciężki transportowiec cargo z podwójnymi zasobnikami ładunkowymi i wzmocnionym napędem do masowego transferu surowców.",
    stats: {
      health: 300,
      maxHealth: 300,
      speed: 3.0,
      powerConsumption: 0.25,
      cargoCapacity: 60,
    },
    modelPath: "/models/mars/craft_hauler.glb",
    iconPath: "/icons/units/craft_hauler.webp",
    modelScale: 1.8,
    color: "#f59e0b",
    requiredTech: "drone_logistics",
  },
};

// main logic
export const UNIT_LIST: UnitDefinition[] = Object.values(UNIT_DEFINITIONS);

export function getUnitDefinition(id: string): UnitDefinition | undefined {
  return UNIT_DEFINITIONS[id];
}
