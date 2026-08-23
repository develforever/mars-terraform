import { BUILDING_DEFINITIONS } from "../../../domain/config/buildings";

/** Mapping of building definition IDs (and aliases) to their level-specific GLB model paths */
export const BUILDING_LEVEL_MODELS: Record<string, Record<number, string>> = {
  ice: {
    1: "/models/mars/pipe_entrance.glb",
    2: "/models/mars/ice_lvl2.glb",
    3: "/models/mars/ice_lvl3.glb",
  },
  ice_extractor: {
    1: "/models/mars/pipe_entrance.glb",
    2: "/models/mars/ice_lvl2.glb",
    3: "/models/mars/ice_lvl3.glb",
  },
  miner: {
    1: "/models/mars/craft_miner.glb",
    2: "/models/mars/miner_lvl2.glb",
    3: "/models/mars/miner_lvl3.glb",
  },
  lab: {
    1: "/models/mars/machine_wireless.glb",
    2: "/models/mars/lab_lvl2.glb",
    3: "/models/mars/lab_lvl3.glb",
  },
  solar: {
    1: "/models/mars/machine_generator.glb",
    2: "/models/mars/solar_lvl2.glb",
    3: "/models/mars/solar_lvl3.glb",
  },
  rtg: {
    1: "/models/mars/machine_generatorLarge.glb",
    2: "/models/mars/rtg_lvl2.glb",
    3: "/models/mars/rtg_lvl3.glb",
  },
  greenhouse: {
    1: "/models/mars/hangar_roundGlass.glb",
    2: "/models/mars/greenhouse_lvl2.glb",
    3: "/models/mars/greenhouse_lvl3.glb",
  },
  "o2-gen": {
    1: "/models/mars/machine_generator.glb",
    2: "/models/mars/o2-gen_lvl2.glb",
    3: "/models/mars/o2-gen_lvl3.glb",
  },
};

/**
 * Returns the appropriate GLB model path for a given building type and upgrade level.
 * Level 1 returns the default model, while levels 2 and 3 load upgraded kitbashed variants.
 */
export function getBuildingModel(type: string, level: number = 1): string | undefined {
  const levelModels = BUILDING_LEVEL_MODELS[type];
  if (levelModels && levelModels[level]) {
    return levelModels[level];
  }
  if (levelModels && levelModels[1]) {
    return levelModels[1];
  }
  const def = BUILDING_DEFINITIONS[type];
  return def?.modelPath;
}

/** Unique model paths from building definitions and level variants for pre-loading. */
export const MODEL_PATHS = Array.from(
  new Set([
    ...Object.values(BUILDING_DEFINITIONS)
      .map((d) => d.modelPath)
      .filter((p): p is string => !!p),
    ...Object.values(BUILDING_LEVEL_MODELS).flatMap((levels) => Object.values(levels)),
  ])
);
