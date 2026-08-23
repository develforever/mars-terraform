import type { QuestDefinition } from "../entities/Quest";
import { TECH_IDS } from "./technologies";

export const QUEST_IDS = {
  SOLAR_POWER: "quest_solar_power",
  ICE_WATER: "quest_ice_water",
  O2_GENERATOR: "quest_o2_generator",
  BATTERY_STORAGE: "quest_battery_storage",
  GREENHOUSE_FOOD: "quest_greenhouse_food",
  DEEP_MINING: "quest_deep_mining",
  RESEARCH_CENTER: "quest_research_center",
  DEFENSE_GRID: "quest_defense_grid",
  ALIEN_SURVIVAL: "quest_alien_survival",
  GREEN_MARS: "quest_green_mars",
} as const;

export const CAMPAIGN_QUESTS: QuestDefinition[] = [
  // ── ETAP 1: START KOLONII ─────────────────────────────────────────────
  {
    id: QUEST_IDS.SOLAR_POWER,
    titleKey: "quests.solar_power.title",
    descriptionKey: "quests.solar_power.desc",
    category: "colony_start",
    stage: 1,
    prerequisites: [],
    isMainQuest: true,
    objectives: [
      {
        id: "obj_solar_1",
        type: "build_count",
        buildingType: "solar",
        target: 1,
        descriptionKey: "quests.objectives.build_solar",
      },
    ],
    reward: {
      resources: { power: 15, biomass: 5 },
      researchPoints: 5,
    },
  },
  {
    id: QUEST_IDS.ICE_WATER,
    titleKey: "quests.ice_water.title",
    descriptionKey: "quests.ice_water.desc",
    category: "colony_start",
    stage: 1,
    prerequisites: [QUEST_IDS.SOLAR_POWER],
    isMainQuest: false,
    objectives: [
      {
        id: "obj_ice_1",
        type: "build_count",
        buildingType: "ice",
        target: 1,
        descriptionKey: "quests.objectives.build_ice",
      },
    ],
    reward: {
      resources: { water: 25, power: 10 },
      researchPoints: 5,
    },
  },
  {
    id: QUEST_IDS.O2_GENERATOR,
    titleKey: "quests.o2_generator.title",
    descriptionKey: "quests.o2_generator.desc",
    category: "colony_start",
    stage: 1,
    prerequisites: [QUEST_IDS.ICE_WATER],
    isMainQuest: true,
    objectives: [
      {
        id: "obj_tech_o2",
        type: "tech_unlocked",
        techId: TECH_IDS.O2_SYNTHESIS,
        target: 1,
        descriptionKey: "quests.objectives.unlock_o2_tech",
      },
      {
        id: "obj_o2_1",
        type: "build_count",
        buildingType: "o2-gen",
        target: 1,
        descriptionKey: "quests.objectives.build_o2_gen",
      },
    ],
    reward: {
      resources: { o2: 50, power: 20 },
      researchPoints: 10,
    },
  },

  // ── ETAP 2: SAMOWYSTARCZALNOŚĆ ────────────────────────────────────────
  {
    id: QUEST_IDS.BATTERY_STORAGE,
    titleKey: "quests.battery_storage.title",
    descriptionKey: "quests.battery_storage.desc",
    category: "self_sufficiency",
    stage: 2,
    prerequisites: [QUEST_IDS.O2_GENERATOR],
    isMainQuest: false,
    objectives: [
      {
        id: "obj_tech_battery",
        type: "tech_unlocked",
        techId: TECH_IDS.SOLAR_ARRAY,
        target: 1,
        descriptionKey: "quests.objectives.unlock_solar_array",
      },
      {
        id: "obj_battery_1",
        type: "build_count",
        buildingType: "battery",
        target: 1,
        descriptionKey: "quests.objectives.build_battery",
      },
    ],
    reward: {
      resources: { power: 50, biomass: 10 },
      researchPoints: 10,
    },
  },
  {
    id: QUEST_IDS.GREENHOUSE_FOOD,
    titleKey: "quests.greenhouse_food.title",
    descriptionKey: "quests.greenhouse_food.desc",
    category: "self_sufficiency",
    stage: 2,
    prerequisites: [QUEST_IDS.O2_GENERATOR],
    isMainQuest: false,
    objectives: [
      {
        id: "obj_tech_greenhouse",
        type: "tech_unlocked",
        techId: TECH_IDS.ADVANCED_HAB,
        target: 1,
        descriptionKey: "quests.objectives.unlock_adv_hab",
      },
      {
        id: "obj_greenhouse_1",
        type: "build_count",
        buildingType: "greenhouse",
        target: 1,
        descriptionKey: "quests.objectives.build_greenhouse",
      },
    ],
    reward: {
      resources: { biomass: 30, water: 25 },
      researchPoints: 10,
    },
  },
  {
    id: QUEST_IDS.DEEP_MINING,
    titleKey: "quests.deep_mining.title",
    descriptionKey: "quests.deep_mining.desc",
    category: "self_sufficiency",
    stage: 2,
    prerequisites: [QUEST_IDS.BATTERY_STORAGE, QUEST_IDS.GREENHOUSE_FOOD],
    isMainQuest: true,
    objectives: [
      {
        id: "obj_tech_mining",
        type: "tech_unlocked",
        techId: TECH_IDS.DEEP_MINING,
        target: 1,
        descriptionKey: "quests.objectives.unlock_deep_mining",
      },
      {
        id: "obj_miner_1",
        type: "build_count",
        buildingType: "miner",
        target: 1,
        descriptionKey: "quests.objectives.build_miner",
      },
      {
        id: "obj_stock_biomass",
        type: "resource_amount",
        resource: "biomass",
        target: 50,
        descriptionKey: "quests.objectives.stock_biomass_50",
      },
    ],
    reward: {
      resources: { biomass: 50, power: 30 },
      researchPoints: 15,
    },
  },

  // ── ETAP 3: OBRONNOŚĆ I PRZEMYSŁ ──────────────────────────────────────
  {
    id: QUEST_IDS.RESEARCH_CENTER,
    titleKey: "quests.research_center.title",
    descriptionKey: "quests.research_center.desc",
    category: "defense",
    stage: 3,
    prerequisites: [QUEST_IDS.DEEP_MINING],
    isMainQuest: false,
    objectives: [
      {
        id: "obj_tech_nuclear",
        type: "tech_unlocked",
        techId: TECH_IDS.NUCLEAR_POWER,
        target: 1,
        descriptionKey: "quests.objectives.unlock_nuclear",
      },
      {
        id: "obj_lab_1",
        type: "build_count",
        buildingType: "lab",
        target: 1,
        descriptionKey: "quests.objectives.build_lab",
      },
    ],
    reward: {
      resources: { power: 50, water: 30 },
      researchPoints: 25,
    },
  },
  {
    id: QUEST_IDS.DEFENSE_GRID,
    titleKey: "quests.defense_grid.title",
    descriptionKey: "quests.defense_grid.desc",
    category: "defense",
    stage: 3,
    prerequisites: [QUEST_IDS.DEEP_MINING],
    isMainQuest: true,
    objectives: [
      {
        id: "obj_tech_defense",
        type: "tech_unlocked",
        techId: TECH_IDS.PERIMETER_DEFENSE,
        target: 1,
        descriptionKey: "quests.objectives.unlock_defense",
      },
      {
        id: "obj_turret_1",
        type: "build_count",
        buildingType: "turret",
        target: 1,
        descriptionKey: "quests.objectives.build_turret",
      },
    ],
    reward: {
      resources: { power: 40, biomass: 20 },
      researchPoints: 20,
    },
  },
  {
    id: QUEST_IDS.ALIEN_SURVIVAL,
    titleKey: "quests.alien_survival.title",
    descriptionKey: "quests.alien_survival.desc",
    category: "defense",
    stage: 3,
    prerequisites: [QUEST_IDS.DEFENSE_GRID],
    isMainQuest: false,
    objectives: [
      {
        id: "obj_stock_power",
        type: "resource_amount",
        resource: "power",
        target: 100,
        descriptionKey: "quests.objectives.stock_power_100",
      },
      {
        id: "obj_stock_water",
        type: "resource_amount",
        resource: "water",
        target: 100,
        descriptionKey: "quests.objectives.stock_water_100",
      },
    ],
    reward: {
      resources: { power: 60, water: 60, biomass: 30 },
      researchPoints: 25,
    },
  },

  // ── ETAP 4: ZIELONY MARS ──────────────────────────────────────────────
  {
    id: QUEST_IDS.GREEN_MARS,
    titleKey: "quests.green_mars.title",
    descriptionKey: "quests.green_mars.desc",
    category: "green_mars",
    stage: 4,
    prerequisites: [QUEST_IDS.ALIEN_SURVIVAL, QUEST_IDS.RESEARCH_CENTER],
    isMainQuest: true,
    objectives: [
      {
        id: "obj_stat_o2",
        type: "terraforming_stat",
        stat: "o2Accumulated",
        target: 300,
        descriptionKey: "quests.objectives.o2_accumulated_300",
      },
      {
        id: "obj_stat_terraforming",
        type: "terraforming_stat",
        stat: "terraforming",
        target: 15,
        descriptionKey: "quests.objectives.terraforming_15",
      },
    ],
    reward: {
      resources: { o2: 200, power: 100, water: 100, biomass: 100 },
      researchPoints: 50,
    },
  },
];

export const QUEST_DEFINITIONS: Record<string, QuestDefinition> =
  Object.fromEntries(CAMPAIGN_QUESTS.map((q) => [q.id, q]));
