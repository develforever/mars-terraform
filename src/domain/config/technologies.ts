// types/interfaces
export type TechCategory =
  | "foundations"
  | "biology"
  | "energy"
  | "mining"
  | "terraforming"
  | "defense";

export interface Technology {
  id: string;
  name: string;
  description: string;
  costRP: number;
  category: TechCategory;
  /** IDs of technologies that must be researched first */
  prereqs: string[];
  /** Building definition IDs unlocked by this tech */
  unlocksBuildings: string[];
  /** Optional textual description of additional effects */
  unlockEffects?: string;
}

// constants
export const TECH_IDS = {
  BASIC_STRUCTURES:        "basic_structures",
  ADVANCED_HAB:            "advanced_hab",
  GREENHOUSE_TECH:         "greenhouse_tech",
  BIODOME:                 "biodome",
  SOLAR_ARRAY:             "solar_array",
  NUCLEAR_POWER:           "nuclear_power",
  FUSION_POWER:            "fusion_power",
  DEEP_MINING:             "deep_mining",
  DRONE_LOGISTICS:         "drone_logistics",
  O2_SYNTHESIS:            "o2_synthesis",
  ATMOSPHERE_TERRAFORMING: "atmosphere_terraforming",
  WATER_CYCLE:             "water_cycle",
  PERIMETER_DEFENSE:       "perimeter_defense",
  SHIELD_GRID:             "shield_grid",
} as const;

export type TechId = typeof TECH_IDS[keyof typeof TECH_IDS];

export const TECHNOLOGY_LIST: Technology[] = [
  // ── FOUNDATIONS ──────────────────────────────────────────────────────────
  {
    id: TECH_IDS.BASIC_STRUCTURES,
    name: "Podstawowe Struktury",
    description: "Fundament kolonii marsjańskiej. Odblokowany od startu.",
    costRP: 0,
    category: "foundations",
    prereqs: [],
    unlocksBuildings: ["hab", "solar", "ice"],
    unlockEffects: "Odblokowanie: Centrum Kolonii, Generator Solarny, Ekstraktor Lodu",
  },
  {
    id: TECH_IDS.ADVANCED_HAB,
    name: "Zaawansowane Habitaty",
    description: "Rozszerzone moduły mieszkalne zwiększające efektywność kolonii.",
    costRP: 30,
    category: "foundations",
    prereqs: [TECH_IDS.BASIC_STRUCTURES],
    unlocksBuildings: ["greenhouse"],
    unlockEffects: "+10% produkcji O₂ we wszystkich habitatach",
  },

  // ── BIOLOGY ──────────────────────────────────────────────────────────────
  {
    id: TECH_IDS.GREENHOUSE_TECH,
    name: "Technologia Szklarniowa",
    description: "Zaawansowane systemy hydroponiczne dla wydajnej uprawy.",
    costRP: 50,
    category: "biology",
    prereqs: [TECH_IDS.ADVANCED_HAB],
    unlocksBuildings: [],
    unlockEffects: "+25% produkcji biomasy w Szklarniach",
  },
  {
    id: TECH_IDS.BIODOME,
    name: "Biodom",
    description: "Zamknięty ekosystem zdolny do samoregeneracji. Maksymalizuje produkcję biologiczną.",
    costRP: 120,
    category: "biology",
    prereqs: [TECH_IDS.GREENHOUSE_TECH],
    unlocksBuildings: ["biosphere_dome"],
    unlockEffects: "Odblokowanie: Kopuła Biosfery. Szklarnia produkuje dwukrotnie więcej biomasy",
  },

  // ── ENERGY ───────────────────────────────────────────────────────────────
  {
    id: TECH_IDS.SOLAR_ARRAY,
    name: "Baterie Słoneczne",
    description: "Zaawansowane ogniwa fotowoltaiczne zwiększające pozysk energii.",
    costRP: 40,
    category: "energy",
    prereqs: [TECH_IDS.BASIC_STRUCTURES],
    unlocksBuildings: ["battery"],
    unlockEffects: "+15% wydajności Generatorów Solarnych",
  },
  {
    id: TECH_IDS.NUCLEAR_POWER,
    name: "Reaktor Atomowy",
    description: "Stabilne i wydajne źródło energii niezależne od słońca.",
    costRP: 100,
    category: "energy",
    prereqs: [TECH_IDS.SOLAR_ARRAY],
    unlocksBuildings: ["rtg", "lab"],
    unlockEffects: "Odblokowanie: Blok RTG, Laboratorium",
  },
  {
    id: TECH_IDS.FUSION_POWER,
    name: "Fuzja Termojądrowa",
    description: "Czysta i potężna energia z kontrolowanej reakcji termojądrowej.",
    costRP: 160,
    category: "energy",
    prereqs: [TECH_IDS.NUCLEAR_POWER],
    unlocksBuildings: ["fusion_reactor"],
    unlockEffects: "Odblokowanie: Reaktor Fuzyjny (+150 kW energii)",
  },

  // ── MINING ───────────────────────────────────────────────────────────────
  {
    id: TECH_IDS.DEEP_MINING,
    name: "Głębokie Wydobycie",
    description: "Zaawansowane techniki wydobywcze docierające do głębokich złóż.",
    costRP: 60,
    category: "mining",
    prereqs: [TECH_IDS.BASIC_STRUCTURES],
    unlocksBuildings: ["miner", "watertank", "silo"],
    unlockEffects: "Odblokowanie: Kopalnia, Zbiornik H2O, Silos. +10% wydajności Ekstraktora",
  },
  {
    id: TECH_IDS.DRONE_LOGISTICS,
    name: "Logistyka Dronów",
    description: "Autonomiczne drony transportujące surowce przez całą kolonię.",
    costRP: 150,
    category: "mining",
    prereqs: [TECH_IDS.DEEP_MINING, TECH_IDS.NUCLEAR_POWER],
    unlocksBuildings: [],
    unlockEffects: "Wydobycie Lv3 i Kopalnia Lv3 mogą używać dronów powietrznych",
  },

  // ── TERRAFORMING ─────────────────────────────────────────────────────────
  {
    id: TECH_IDS.O2_SYNTHESIS,
    name: "Synteza Tlenu",
    description: "Skalowalne procesy chemiczne uwalniające O₂ z regolitu marsjańskiego.",
    costRP: 80,
    category: "terraforming",
    prereqs: [TECH_IDS.NUCLEAR_POWER],
    unlocksBuildings: ["o2-gen"],
    unlockEffects: "Odblokowanie: Generator Tlenu. +20% akumulacji O₂",
  },
  {
    id: TECH_IDS.ATMOSPHERE_TERRAFORMING,
    name: "Inżynieria Atmosferyczna",
    description: "Przemysłowe generatory gazów cieplarnianych do masowej regulacji ciśnienia i temperatury.",
    costRP: 140,
    category: "terraforming",
    prereqs: [TECH_IDS.O2_SYNTHESIS],
    unlocksBuildings: ["atmosphere_factory"],
    unlockEffects: "Odblokowanie: Fabryka Atmosfery. Przyspiesza ogrzewanie Marsa i wzrost ciśnienia",
  },
  {
    id: TECH_IDS.WATER_CYCLE,
    name: "Cykl Wodny",
    description: "Zarządzanie zasobami wodnymi i systemy atmosferyczne.",
    costRP: 90,
    category: "terraforming",
    prereqs: [TECH_IDS.O2_SYNTHESIS, TECH_IDS.DEEP_MINING],
    unlocksBuildings: [],
    unlockEffects: "+15% efektywności Ekstraktorów Lodu. Aktywuje wskaźnik Pokrycia Wodą",
  },

  // ── DEFENSE ──────────────────────────────────────────────────────────────
  {
    id: TECH_IDS.PERIMETER_DEFENSE,
    name: "Obrona Perymetru",
    description: "Zautomatyzowane systemy obronne chroniące kolonię przed zagrożeniami.",
    costRP: 70,
    category: "defense",
    prereqs: [TECH_IDS.SOLAR_ARRAY],
    unlocksBuildings: ["turret"],
    unlockEffects: "Odblokowanie: Wieżyczka",
  },
  {
    id: TECH_IDS.SHIELD_GRID,
    name: "Siatka Osłon",
    description: "Elektromagnetyczne pole osłonowe absorbujące impakty meteorytów.",
    costRP: 180,
    category: "defense",
    prereqs: [TECH_IDS.PERIMETER_DEFENSE, TECH_IDS.NUCLEAR_POWER],
    unlocksBuildings: [],
    unlockEffects: "Budynki w zasięgu wieżyczek otrzymują -50% obrażeń od meteorytów",
  },
];

// main logic
export const TECHNOLOGIES: Record<string, Technology> = Object.fromEntries(
  TECHNOLOGY_LIST.map((t) => [t.id, t])
);

/** Technologies ordered for display by category */
export const TECH_CATEGORIES: TechCategory[] = [
  "foundations",
  "energy",
  "biology",
  "mining",
  "terraforming",
  "defense",
];
