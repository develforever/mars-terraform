import { describe, it, expect, beforeEach, vi } from "vitest";
import { useGameStore } from "../useGameStore";
import type { MapExportJSON } from "../../../domain/mapEditorTypes";

const sampleMapData: MapExportJSON = {
  meta: {
    name: "Custom Olympus Mons",
    description: "Volcanic research site",
    version: "2.0",
    gridType: "hex-flat-top",
    hexSize: 1,
    hexRadius: 15,
    players: 4,
    seed: 99,
  },
  hexes: [
    { q: 0, r: 0, terrainType: "rocky", userType: "build", decor: null },
    { q: 1, r: 0, terrainType: "peak", userType: "resource", decor: null },
  ],
  buildNodes: [],
  resourceNodes: [],
  spawnPoints: [],
  decor: [],
};

describe("useGameStore — custom map selection & game lifecycle", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useGameStore.getState().resetGame();
  });

  it("initializes procedural hexGrid when mapData is not provided to startNewGame", () => {
    useGameStore.getState().startNewGame("New Colony", "normal", "exploration");

    const state = useGameStore.getState();
    expect(state.colonyName).toBe("New Colony");
    expect(state.currentMapData).toBeNull();
    expect(state.hexGrid).toBeDefined();
    expect(state.hexGrid.getCellCount()).toBeGreaterThan(0);
    expect(state.hexGrid.seed).toBe(42);
  });

  it("initializes procedural hexGrid with explicit seed in startNewGame", () => {
    useGameStore.getState().startNewGame("Seeded Colony", "hard", "exploration", null, 12345);

    const state = useGameStore.getState();
    expect(state.colonyName).toBe("Seeded Colony");
    expect(state.currentMapData).toBeNull();
    expect(state.hexGrid.seed).toBe(12345);
    expect(state.hexGrid.getCellCount()).toBeGreaterThan(0);
  });

  it("initializes custom hexGrid when valid mapData is passed to startNewGame", () => {
    useGameStore.getState().startNewGame("Custom Colony", "hard", "survival", sampleMapData);

    const state = useGameStore.getState();
    expect(state.colonyName).toBe("Custom Colony");
    expect(state.currentMapData).toEqual(sampleMapData);
    expect(state.hexGrid.radius).toBe(15);
    expect(state.hexGrid.seed).toBe(99);

    const cell00 = state.hexGrid.getCell(0, 0);
    expect(cell00).toBeDefined();
    expect(cell00?.terrainType).toBe("rocky");
    expect(cell00?.userType).toBe("build");
  });

  it("persists currentMapData in saveGame payload", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ status: "ok" }),
    } as Response);

    useGameStore.getState().startNewGame("Cloud Colony", "easy", "adventure", sampleMapData);
    const saveResult = await useGameStore.getState().saveGame();

    expect(saveResult).toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/colony",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"currentMapData"'),
      })
    );

    const callBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
    expect(callBody.state.currentMapData).toEqual(sampleMapData);
  });

  it("restores custom mapData and rebuilds hexGrid on loadGame", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        name: "Loaded Colony",
        state: {
          colonyName: "Loaded Colony",
          resources: { o2: 100, power: 50, water: 50, biomass: 10 },
          capacity: { power: 100, water: 100, biomass: 100 },
          placed: [],
          occupied: {},
          currentMapData: sampleMapData,
        },
      }),
    } as Response);

    const loadResult = await useGameStore.getState().loadGame("Loaded Colony");

    expect(loadResult).toBe(true);
    const state = useGameStore.getState();
    expect(state.colonyName).toBe("Loaded Colony");
    expect(state.currentMapData).toEqual(sampleMapData);
    expect(state.hexGrid.radius).toBe(15);
    expect(state.hexGrid.getCell(1, 0)?.terrainType).toBe("peak");
  });

  it("generates and manages resourceNodes during startNewGame and economy tick", () => {
    useGameStore.getState().startNewGame("Resource Colony", "normal", "exploration");

    const state = useGameStore.getState();
    expect(state.resourceNodes).toBeDefined();
    expect(state.resourceNodes.length).toBeGreaterThan(0);

    // Place an ice extractor directly on one of the ice deposits
    const iceDeposit = state.resourceNodes.find((n) => n.type === "ice");
    expect(iceDeposit).toBeDefined();

    if (iceDeposit) {
      const initialAmount = iceDeposit.amount;
      // Trigger economy tick with placed ice extractor
      useGameStore.setState({
        placed: [
          {
            id: "test-extractor",
            definitionId: "ice",
            position: { x: iceDeposit.pos[0] * 1.8, y: 0, z: iceDeposit.pos[1] * 2.07 },
            condition: 100,
            level: 1,
          },
        ],
        resources: { o2: 50, power: 50, water: 50, biomass: 50, minerals: 50 },
      });

      useGameStore.getState().applyEconomyTick();
      const updatedState = useGameStore.getState();
      const updatedDeposit = updatedState.resourceNodes.find((n) => n.id === iceDeposit.id);
      expect(updatedDeposit).toBeDefined();
      // Depletion should decrease deposit in exploration mode (rate = 0.05)
      expect(updatedDeposit?.amount).toBeLessThanOrEqual(initialAmount);
    }
  });

  it("upgrades a placed building and deducts resources via upgradeBuilding", () => {
    useGameStore.getState().startNewGame("Upgrade Colony", "normal", "exploration");

    useGameStore.setState({
      resources: { o2: 100, power: 100, water: 100, biomass: 100, minerals: 200 },
      placed: [
        {
          id: "placed-miner-1",
          definitionId: "miner",
          position: { x: 0, y: 0, z: 0 },
          condition: 100,
          level: 1,
        },
      ],
    });

    // Upgrade to Lvl 2
    const successLvl2 = useGameStore.getState().upgradeBuilding("placed-miner-1");
    expect(successLvl2).toBe(true);

    let state = useGameStore.getState();
    const minerLvl2 = state.placed.find((b) => b.id === "placed-miner-1");
    expect(minerLvl2?.level).toBe(2);
    // Cost of miner lvl 2: minerals: 38
    expect(state.resources.minerals).toBe(162);

    // Upgrade to Lvl 3
    const successLvl3 = useGameStore.getState().upgradeBuilding("placed-miner-1");
    expect(successLvl3).toBe(true);
    state = useGameStore.getState();
    const minerLvl3 = state.placed.find((b) => b.id === "placed-miner-1");
    expect(minerLvl3?.level).toBe(3);
    // Cost of miner lvl 3: minerals: 63 (162 - 63 = 99)
    expect(state.resources.minerals).toBe(99);

    // Upgrade beyond Lvl 3 should fail
    const successLvl4 = useGameStore.getState().upgradeBuilding("placed-miner-1");
    expect(successLvl4).toBe(false);
  });

  it("places initial Colony Center (hab) at primary spawn with correct terrain elevation worldY", () => {
    const customMapWithSpawn: MapExportJSON = {
      meta: {
        name: "Spawn Testing Site",
        description: "Testing spawn and elevation",
        version: "2.0",
        gridType: "hex-flat-top",
        hexSize: 1.2,
        hexRadius: 10,
        players: 2,
        seed: 777,
      },
      hexes: [
        { q: 3, r: -2, terrainType: "highland", userType: "spawn", decor: null },
        { q: 0, r: 0, terrainType: "plains", userType: null, decor: null },
      ],
      buildNodes: [],
      resourceNodes: [
        { id: "res-ice-1", type: "ice", pos: [2, -1], amount: 2500, richness: "high", model: "ice_01" },
      ],
      spawnPoints: [
        { player: 1, pos: [3, -2] },
        { player: 2, pos: [-3, 2] },
      ],
      decor: [
        { model: "crystal", pos: [1, 1], rot: 1.57, scale: 1.2 },
      ],
    };

    useGameStore.getState().startNewGame("Spawn Colony", "hard", "exploration", customMapWithSpawn);

    const state = useGameStore.getState();
    expect(state.placed.length).toBe(1);
    const hab = state.placed[0];
    expect(hab).toBeDefined();
    expect(hab.definitionId).toBe("hab");

    // Spawn was at [3, -2] with terrainType "highland" (worldY = 2.0)
    // hexToWorld(3, -2) for hexSize=1.2:
    // x = 1.2 * 1.5 * 3 = 5.4
    // z = 1.2 * sqrt(3) * (-2 + 3/2) = 1.2 * 1.73205 * (-0.5) = -1.03923
    expect(hab.position.y).toBe(2.0);
    expect(hab.position.x).toBeCloseTo(5.4, 2);
    expect(hab.position.z).toBeCloseTo(-1.039, 2);

    // Verify occupied key matches rounded coordinates
    const key = `${Math.round(hab.position.x)},${Math.round(hab.position.z)}`;
    expect(state.occupied[key]).toBe(hab.id);

    // Verify resourceNodes & decor
    expect(state.resourceNodes.length).toBe(1);
    expect(state.resourceNodes[0].id).toBe("res-ice-1");
    expect(state.resourceNodes[0].pos).toEqual([2, -1]);
    expect(state.decorations.length).toBe(1);
    expect(state.decorations[0].model).toBe("crystal");
  });

  it("handles legacy alias fields playerSpawns and decorations in mapData", () => {
    const aliasMapData = {
      meta: {
        name: "Legacy Map",
        description: "Legacy fields test",
        version: "2.0",
        gridType: "hex-flat-top",
        hexSize: 1.2,
        hexRadius: 10,
        players: 1,
        seed: 123,
      },
      hexes: [
        { q: 2, r: 1, terrainType: "rocky", userType: null, decor: null },
      ],
      playerSpawns: [
        { player: 1, pos: [2, 1] },
      ],
      decorations: [
        { model: "wreck", pos: [0, 1], rot: 0.8, scale: 1.5 },
      ],
      resourceNodes: [],
      buildNodes: [],
    } as unknown as MapExportJSON;

    useGameStore.getState().startNewGame("Legacy Colony", "normal", "adventure", aliasMapData);

    const state = useGameStore.getState();
    expect(state.placed.length).toBe(1);
    const hab = state.placed[0];
    expect(hab.definitionId).toBe("hab");
    // Rocky terrain has worldY = 2.8
    expect(hab.position.y).toBe(2.8);

    expect(state.decorations.length).toBe(1);
    expect(state.decorations[0].model).toBe("wreck");
  });

  it("initializes activeQuests in game state and evaluates on economy tick", () => {
    useGameStore.getState().startNewGame("Quest Colony", "normal", "exploration");

    const stateBefore = useGameStore.getState();
    expect(stateBefore.activeQuests).toBeDefined();
    expect(stateBefore.activeQuests.length).toBeGreaterThan(0);

    const solarQuest = stateBefore.activeQuests.find((q) => q.id === "quest_solar_power");
    expect(solarQuest?.status).toBe("active");

    // Place a solar generator
    useGameStore.getState().placeBuilding({ x: 5, z: 5 }, 1.2, "solar");

    // Run economy tick
    useGameStore.getState().applyEconomyTick();

    const stateAfter = useGameStore.getState();
    const updatedSolarQuest = stateAfter.activeQuests.find((q) => q.id === "quest_solar_power");
    expect(updatedSolarQuest?.status).toBe("completed");

    // Claim reward
    const initialPower = stateAfter.resources.power;
    const initialBiomass = stateAfter.resources.biomass;
    const initialRP = stateAfter.researchPoints;

    const claimed = useGameStore.getState().claimQuestReward("quest_solar_power");
    expect(claimed).toBe(true);

    const stateClaimed = useGameStore.getState();
    expect(stateClaimed.resources.power).toBe(initialPower + 15);
    expect(stateClaimed.resources.biomass).toBe(initialBiomass + 5);
    expect(stateClaimed.researchPoints).toBe(initialRP + 20);

    const claimedQuest = stateClaimed.activeQuests.find((q) => q.id === "quest_solar_power");
    expect(claimedQuest?.status).toBe("claimed");
  });

  it("advances tick, sol, and records analytics snapshots every 10 ticks", () => {
    useGameStore.getState().startNewGame("Analytics Colony", "normal", "exploration");
    const stateInit = useGameStore.getState();
    expect(stateInit.tick).toBe(0);
    expect(stateInit.sol).toBe(1);
    expect(stateInit.analyticsSnapshots.length).toBe(1);

    // Run 10 ticks
    for (let i = 0; i < 10; i++) {
      useGameStore.getState().applyEconomyTick();
    }

    const state10 = useGameStore.getState();
    expect(state10.tick).toBe(10);
    expect(state10.sol).toBe(1);
    expect(state10.analyticsSnapshots.length).toBe(2);
    expect(state10.analyticsSnapshots[1].tick).toBe(10);

    // Run up to 60 ticks (Sol 2)
    for (let i = 0; i < 50; i++) {
      useGameStore.getState().applyEconomyTick();
    }

    const state60 = useGameStore.getState();
    expect(state60.tick).toBe(60);
    expect(state60.sol).toBe(2);
    expect(state60.analyticsSnapshots.length).toBe(7);
  });

  it("handles continueEndless and modal dismissals", () => {
    useGameStore.getState().startNewGame("Endless Colony", "normal", "exploration");

    expect(useGameStore.getState().isEndless).toBe(false);
    expect(useGameStore.getState().victoryModalDismissed).toBe(false);
    expect(useGameStore.getState().defeatModalDismissed).toBe(false);

    useGameStore.getState().continueEndless();
    expect(useGameStore.getState().isEndless).toBe(true);
    expect(useGameStore.getState().victoryModalDismissed).toBe(true);

    useGameStore.getState().dismissDefeatModal();
    expect(useGameStore.getState().defeatModalDismissed).toBe(true);
  });

  it("handles tactical pause and speed controls properly", () => {
    useGameStore.getState().startNewGame("Speed Colony", "normal", "exploration");

    expect(useGameStore.getState().isPaused).toBe(false);
    expect(useGameStore.getState().gameSpeed).toBe(1);

    // Toggle pause
    useGameStore.getState().togglePause();
    expect(useGameStore.getState().isPaused).toBe(true);

    const initialTick = useGameStore.getState().tick;
    // applyEconomyTick should do nothing when paused
    useGameStore.getState().applyEconomyTick();
    expect(useGameStore.getState().tick).toBe(initialTick);

    // Unpause
    useGameStore.getState().setIsPaused(false);
    expect(useGameStore.getState().isPaused).toBe(false);

    useGameStore.getState().applyEconomyTick();
    expect(useGameStore.getState().tick).toBe(initialTick + 1);

    // Set speed
    useGameStore.getState().setGameSpeed(4);
    expect(useGameStore.getState().gameSpeed).toBe(4);
  });

  it("activates emergencyLifeSupport buffer and handles countdown in applyEconomyTick", () => {
    useGameStore.getState().startNewGame("LifeSupport Colony", "normal", "exploration");

    // Force O2 to 0 and replace placed hab with a solar panel that produces no O2
    useGameStore.setState({
      placed: [
        { id: "sol-1", definitionId: "solar", position: { x: 0, y: 0, z: 0 }, condition: 100, level: 1 },
      ],
      resources: { o2: 0, power: 50, water: 50, biomass: 50, minerals: 50 },
    });

    useGameStore.getState().applyEconomyTick();

    const stateTick1 = useGameStore.getState();
    expect(stateTick1.alive).toBe(true);
    expect(stateTick1.emergencyLifeSupport.active).toBe(true);
    expect(stateTick1.emergencyLifeSupport.secondsRemaining).toBe(59);

    // Set remaining seconds to 1 and run tick to test gameOver
    useGameStore.setState({
      emergencyLifeSupport: { active: true, secondsRemaining: 1 },
    });

    useGameStore.getState().applyEconomyTick();
    const stateGameOver = useGameStore.getState();
    expect(stateGameOver.emergencyLifeSupport.secondsRemaining).toBe(0);
    expect(stateGameOver.alive).toBe(false);
  });
});

