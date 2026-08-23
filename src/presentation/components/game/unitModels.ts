// imports
import { useGLTF } from "@react-three/drei";
import { UNIT_DEFINITIONS, UNIT_IDS } from "../../../domain/config/units";

// constants
export const UNIT_MODELS: Record<string, string> = {
  [UNIT_IDS.ROVER]: "/models/mars/rover.glb",
  [UNIT_IDS.ROVER_COMBAT]: "/models/mars/rover_combat.glb",
  [UNIT_IDS.CRAFT_MINER]: "/models/mars/craft_miner.glb",
  [UNIT_IDS.DRONE_REPAIR]: "/models/mars/drone_repair.glb",
  [UNIT_IDS.CRAFT_HAULER]: "/models/mars/craft_hauler.glb",
};

/** All unique unit model paths for pre-loading in Three.js / R3F */
export const UNIT_MODEL_PATHS: string[] = Array.from(
  new Set([
    ...Object.values(UNIT_MODELS),
    ...Object.values(UNIT_DEFINITIONS).map((u) => u.modelPath),
  ])
);

// main logic / preload
for (const path of UNIT_MODEL_PATHS) {
  useGLTF.preload(path);
}

export function getUnitModelPath(unitId: string): string {
  return UNIT_MODELS[unitId] || UNIT_DEFINITIONS[unitId]?.modelPath || "/models/mars/rover.glb";
}
