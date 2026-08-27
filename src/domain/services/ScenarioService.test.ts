import { describe, it, expect } from "vitest";
import { ScenarioService } from "./ScenarioService";
import { SCENARIOS } from "../config/scenarios";
import { parseMapJSON } from "../../presentation/generator/schema/mapSchema";

describe("ScenarioService", () => {
    it("should return all 5 predefined scenarios", () => {
        const scenarios = ScenarioService.getScenarios();
        expect(scenarios).toHaveLength(5);

        const ids = scenarios.map((s) => s.id);
        expect(ids).toContain("scenario_gale_crater");
        expect(ids).toContain("scenario_olympus_rescue");
        expect(ids).toContain("scenario_alien_infestation");
        expect(ids).toContain("scenario_cydonia_plains");
        expect(ids).toContain("scenario_valles_marineris");
    });

    it("should get a scenario by its id", () => {
        const gale = ScenarioService.getScenarioById("scenario_gale_crater");
        expect(gale).toBeDefined();
        expect(gale?.difficulty).toBe("easy");
        expect(gale?.terrainArchetype).toBe("plains");

        const nonexistent = ScenarioService.getScenarioById("scenario_nonexistent");
        expect(nonexistent).toBeUndefined();
    });

    it("should generate a valid MapExportJSON adhering to v2.0 schema for each scenario", () => {
        for (const scenario of SCENARIOS) {
            const mapData = ScenarioService.generateScenarioMap(scenario);

            expect(mapData.meta.name).toBe(scenario.id);
            expect(mapData.meta.version).toBe("2.0");
            expect(mapData.meta.hexRadius).toBe(scenario.mapRadius);
            expect(mapData.hexes.length).toBeGreaterThan(0);
            expect(mapData.spawnPoints.length).toBeGreaterThanOrEqual(1);
            expect(mapData.resourceNodes.length).toBeGreaterThan(0);

            // Validate against schema
            const parsed = parseMapJSON(mapData);
            expect(parsed.ok).toBe(true);
            expect(parsed.data).toBeDefined();
        }
    });

    it("should place custom POI prefabs on the map according to scenario definitions", () => {
        // Olympus rescue has abandoned lab and crashed freighter
        const olympus = ScenarioService.getScenarioById("scenario_olympus_rescue")!;
        const olympusMap = ScenarioService.generateScenarioMap(olympus);
        const labDecor = olympusMap.decor.filter((d) => d.model === "poi_abandoned_lab");
        expect(labDecor.length).toBeGreaterThanOrEqual(1);

        // Alien infestation has alien hive
        const alienScenario = ScenarioService.getScenarioById("scenario_alien_infestation")!;
        const alienMap = ScenarioService.generateScenarioMap(alienScenario);
        const hiveDecor = alienMap.decor.filter((d) => d.model === "poi_alien_hive");
        expect(hiveDecor.length).toBeGreaterThanOrEqual(2);

        // Cydonia plains has crashed freighter
        const cydonia = ScenarioService.getScenarioById("scenario_cydonia_plains")!;
        const cydoniaMap = ScenarioService.generateScenarioMap(cydonia);
        const freighterDecor = cydoniaMap.decor.filter((d) => d.model === "poi_crashed_freighter");
        expect(freighterDecor.length).toBeGreaterThanOrEqual(1);
    });

    it("should create initial scenario state merging starting resources, capacity, and custom name", () => {
        const scenario = ScenarioService.getScenarioById("scenario_valles_marineris")!;
        const initState = ScenarioService.createInitialScenarioState(scenario, "My Oceanic Colony", 9999);

        expect(initState.colonyName).toBe("My Oceanic Colony");
        expect(initState.difficulty).toBe("normal");
        expect(initState.resources.water).toBe(scenario.startingResources.water);
        expect(initState.resources.biomass).toBe(scenario.startingResources.biomass);
        expect(initState.capacity.water).toBe(scenario.startingCapacity?.water);
        expect(initState.mapData.meta.seed).toBe(9999);
    });

    it("should use default colony name if custom name is empty or not provided", () => {
        const scenario = ScenarioService.getScenarioById("scenario_gale_crater")!;
        const initState = ScenarioService.createInitialScenarioState(scenario, "   ");

        expect(initState.colonyName).toBe(scenario.defaultColonyName);
    });
});
