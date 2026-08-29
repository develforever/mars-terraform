import { z } from "zod";
import type { GameState } from "../store/useGameStore";

export const LOCAL_SAVE_STORAGE_KEY = "mars-terraform:autosave:v1";

const resourcesSchema = z.object({
  o2: z.number(),
  power: z.number(),
  water: z.number(),
  biomass: z.number(),
  minerals: z.number(),
});

const resourceCapacitySchema = z.object({
  power: z.number(),
  water: z.number(),
  biomass: z.number(),
  minerals: z.number(),
});

const placedBuildingSchema = z.object({
  id: z.string(),
  definitionId: z.string(),
  position: z.object({
    x: z.number(),
    y: z.number().optional().default(0),
    z: z.number(),
  }),
  condition: z.number().optional(),
  level: z.number().optional(),
});

const placedUnitSchema = z.object({
  id: z.string(),
  definitionId: z.string(),
  position: z.object({
    x: z.number(),
    y: z.number().optional().default(0),
    z: z.number(),
  }),
  heading: z.number().optional(),
  currentHealth: z.number().optional(),
  status: z.string().optional(),
});

const weatherStateSchema = z.object({
  type: z.enum(["clear", "warning", "sandstorm", "dust_storm", "meteor_warning", "meteor_shower", "polar_aurora"]),
  intensity: z.number(),
  remainingTicks: z.number(),
  cooldownTicks: z.number(),
  impactZones: z.array(z.object({ x: z.number(), z: z.number() })).optional(),
  trajectories: z.array(z.any()).optional(),
});

export const savedGameSchema = z.object({
  version: z.number().default(1),
  timestamp: z.number(),
  colonyName: z.string().min(1),
  currentScenarioId: z.string().nullable().optional(),
  mapSeed: z.number().default(42),
  currentMapData: z.any().nullable().optional(),
  difficulty: z.enum(["easy", "normal", "hard"]).default("normal"),
  gameMode: z.enum(["adventure", "exploration", "survival"]).default("exploration"),
  resources: resourcesSchema,
  capacity: resourceCapacitySchema,
  placed: z.array(placedBuildingSchema),
  occupied: z.record(z.string(), z.string()).optional(),
  units: z.array(placedUnitSchema).optional(),
  weather: weatherStateSchema.optional(),
  terraforming: z.number().default(0),
  o2Accumulated: z.number().default(0),
  sun: z.number().default(1),
  alienState: z.any().optional(),
  researchPoints: z.number().default(0),
  unlockedTechs: z.array(z.string()).default([]),
  activeQuests: z.array(z.any()).optional(),
  population: z.any().optional(),
  morale: z.any().optional(),
  tick: z.number().default(0),
  sol: z.number().default(1),
  aliensDefeated: z.number().default(0),
  analyticsSnapshots: z.array(z.any()).optional(),
  isEndless: z.boolean().default(false),
  resourceNodes: z.array(z.any()).optional(),
  decorations: z.array(z.any()).optional(),
});

export type SavedGame = z.infer<typeof savedGameSchema>;

export class LocalSaveService {
  public static saveLocal(state: Partial<GameState>): boolean {
    if (state.isDevFixture) {
      return false;
    }
    if (!state.colonyName || !state.alive || state.won) {
      return false;
    }
    try {
      const dataToSave: SavedGame = {
        version: 1,
        timestamp: Date.now(),
        colonyName: state.colonyName,
        currentScenarioId: state.currentScenarioId ?? null,
        mapSeed: state.mapSeed ?? 42,
        currentMapData: state.currentMapData ?? null,
        difficulty: state.difficulty ?? "normal",
        gameMode: state.gameMode ?? "exploration",
        resources: {
          o2: state.resources?.o2 ?? 0,
          power: state.resources?.power ?? 0,
          water: state.resources?.water ?? 0,
          biomass: state.resources?.biomass ?? 0,
          minerals: state.resources?.minerals ?? 0,
        },
        capacity: {
          power: state.capacity?.power ?? 20,
          water: state.capacity?.water ?? 20,
          biomass: state.capacity?.biomass ?? 20,
          minerals: state.capacity?.minerals ?? 200,
        },
        placed: (state.placed ?? []).map((b) => ({
          id: b.id,
          definitionId: b.definitionId,
          position: b.position,
          condition: b.condition,
          level: b.level,
        })),
        occupied: state.occupied ?? {},
        units: state.units ?? [],
        weather: state.weather ?? {
          type: "clear",
          intensity: 0,
          remainingTicks: 0,
          cooldownTicks: 180,
        },
        terraforming: state.terraforming ?? 0,
        o2Accumulated: state.o2Accumulated ?? 0,
        sun: state.sun ?? 1,
        alienState: state.alienState,
        researchPoints: state.researchPoints ?? 0,
        unlockedTechs: state.unlockedTechs ?? [],
        activeQuests: state.activeQuests ?? [],
        population: state.population,
        morale: state.morale,
        tick: state.tick ?? 0,
        sol: state.sol ?? 1,
        aliensDefeated: state.aliensDefeated ?? 0,
        isEndless: state.isEndless ?? false,
        resourceNodes: state.resourceNodes,
        decorations: state.decorations ?? state.decor,
      };

      const parsed = savedGameSchema.parse(dataToSave);
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(LOCAL_SAVE_STORAGE_KEY, JSON.stringify(parsed));
      }
      return true;
    } catch (e) {
      console.warn("Failed to save game locally to localStorage:", e);
      return false;
    }
  }

  public static loadLocal(): SavedGame | null {
    try {
      if (typeof window === "undefined" || !window.localStorage) {
        return null;
      }
      const raw = window.localStorage.getItem(LOCAL_SAVE_STORAGE_KEY);
      if (!raw) return null;

      const parsedJson = JSON.parse(raw);
      const validated = savedGameSchema.safeParse(parsedJson);
      if (!validated.success) {
        console.warn("Invalid local save format, clearing save:", validated.error);
        LocalSaveService.clearLocal();
        return null;
      }
      return validated.data;
    } catch (e) {
      console.warn("Error reading local save from localStorage, clearing save:", e);
      LocalSaveService.clearLocal();
      return null;
    }
  }

  public static clearLocal(): void {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.removeItem(LOCAL_SAVE_STORAGE_KEY);
      }
    } catch (e) {
      console.warn("Error clearing localStorage:", e);
    }
  }

  public static hasLocalSave(): boolean {
    return LocalSaveService.loadLocal() !== null;
  }
}

