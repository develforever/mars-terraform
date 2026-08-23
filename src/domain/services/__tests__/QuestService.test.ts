import { describe, it, expect } from "vitest";
import { QuestService } from "../QuestService";
import { QUEST_IDS, CAMPAIGN_QUESTS } from "../../config/quests";
import { TECH_IDS } from "../../config/technologies";
import type { PlacedBuilding } from "../../entities/Building";
import type { Resources } from "../../entities/Resources";

describe("QuestService", () => {
  const initialResources: Resources = {
    o2: 100,
    power: 50,
    water: 50,
    biomass: 10,
  };

  it("initializes quests with correct initial statuses", () => {
    const initialStates = QuestService.getInitialQuestStates();
    expect(initialStates.length).toBe(CAMPAIGN_QUESTS.length);

    const solarState = initialStates.find((q) => q.id === QUEST_IDS.SOLAR_POWER);
    expect(solarState?.status).toBe("active");

    const iceState = initialStates.find((q) => q.id === QUEST_IDS.ICE_WATER);
    expect(iceState?.status).toBe("locked");
  });

  it("evaluates build_count objective and completes quest when target is reached", () => {
    let states = QuestService.getInitialQuestStates();

    // Before building solar
    states = QuestService.evaluateQuests(
      {
        placed: [],
        resources: initialResources,
        unlockedTechs: [TECH_IDS.BASIC_STRUCTURES],
        terraforming: 0,
        o2Accumulated: 0,
      },
      states
    );

    let solarQuest = states.find((q) => q.id === QUEST_IDS.SOLAR_POWER);
    expect(solarQuest?.status).toBe("active");
    expect(solarQuest?.progress.obj_solar_1).toBe(0);

    // After building solar
    const placedSolar: PlacedBuilding = {
      id: "b-solar-1",
      definitionId: "solar",
      position: { x: 10, y: 0, z: 10 },
      condition: 100,
      level: 1,
    };

    states = QuestService.evaluateQuests(
      {
        placed: [placedSolar],
        resources: initialResources,
        unlockedTechs: [TECH_IDS.BASIC_STRUCTURES],
        terraforming: 0,
        o2Accumulated: 0,
      },
      states
    );

    solarQuest = states.find((q) => q.id === QUEST_IDS.SOLAR_POWER);
    expect(solarQuest?.status).toBe("completed");
    expect(solarQuest?.progress.obj_solar_1).toBe(1);
    expect(solarQuest?.completedAt).toBeDefined();
  });

  it("unlocks dependent quests once prerequisite is completed or claimed", () => {
    let states = QuestService.getInitialQuestStates();

    const placedSolar: PlacedBuilding = {
      id: "b-solar-1",
      definitionId: "solar",
      position: { x: 10, y: 0, z: 10 },
      condition: 100,
      level: 1,
    };

    // First evaluate completes solar quest
    states = QuestService.evaluateQuests(
      {
        placed: [placedSolar],
        resources: initialResources,
        unlockedTechs: [TECH_IDS.BASIC_STRUCTURES],
        terraforming: 0,
        o2Accumulated: 0,
      },
      states
    );

    // Dependent ice water quest should now transition from locked to active
    const iceQuest = states.find((q) => q.id === QUEST_IDS.ICE_WATER);
    expect(iceQuest?.status).toBe("active");
  });

  it("successfully claims quest rewards and grants resources & RP", () => {
    let states = QuestService.getInitialQuestStates();

    const placedSolar: PlacedBuilding = {
      id: "b-solar-1",
      definitionId: "solar",
      position: { x: 10, y: 0, z: 10 },
      condition: 100,
      level: 1,
    };

    states = QuestService.evaluateQuests(
      {
        placed: [placedSolar],
        resources: initialResources,
        unlockedTechs: [TECH_IDS.BASIC_STRUCTURES],
        terraforming: 0,
        o2Accumulated: 0,
      },
      states
    );

    const initialRP = 10;
    const claimResult = QuestService.claimQuestReward(
      QUEST_IDS.SOLAR_POWER,
      states,
      initialResources,
      initialRP
    );

    expect(claimResult.success).toBe(true);
    expect(claimResult.newRP).toBe(initialRP + 5);
    expect(claimResult.newResources.power).toBe(initialResources.power + 15);
    expect(claimResult.newResources.biomass).toBe(initialResources.biomass + 5);

    const claimedState = claimResult.newQuests.find((q) => q.id === QUEST_IDS.SOLAR_POWER);
    expect(claimedState?.status).toBe("claimed");
    expect(claimedState?.claimedAt).toBeDefined();

    // Trying to claim again should fail
    const secondClaim = QuestService.claimQuestReward(
      QUEST_IDS.SOLAR_POWER,
      claimResult.newQuests,
      claimResult.newResources,
      claimResult.newRP
    );
    expect(secondClaim.success).toBe(false);
  });

  it("evaluates tech_unlocked and resource_amount objectives accurately", () => {
    let states = QuestService.getInitialQuestStates();

    // Set deep mining quest to active for testing
    states = states.map((q) =>
      q.id === QUEST_IDS.DEEP_MINING ? { ...q, status: "active" as const } : q
    );

    const minerBuilding: PlacedBuilding = {
      id: "b-miner-1",
      definitionId: "miner",
      position: { x: 0, y: 0, z: 0 },
      condition: 100,
      level: 1,
    };

    states = QuestService.evaluateQuests(
      {
        placed: [minerBuilding],
        resources: { ...initialResources, biomass: 55 },
        unlockedTechs: [TECH_IDS.BASIC_STRUCTURES, TECH_IDS.DEEP_MINING],
        terraforming: 0,
        o2Accumulated: 0,
      },
      states
    );

    const miningQuest = states.find((q) => q.id === QUEST_IDS.DEEP_MINING);
    expect(miningQuest?.status).toBe("completed");
    expect(miningQuest?.progress.obj_tech_mining).toBe(1);
    expect(miningQuest?.progress.obj_miner_1).toBe(1);
    expect(miningQuest?.progress.obj_stock_biomass).toBe(55);
  });

  it("correctly identifies tracked quest and unclaimed rewards", () => {
    const states = QuestService.getInitialQuestStates();
    expect(QuestService.hasUnclaimedRewards(states)).toBe(false);

    const tracked = QuestService.getTrackedQuest(states);
    expect(tracked).not.toBeNull();
    expect(tracked?.questDef.id).toBe(QUEST_IDS.SOLAR_POWER);
  });
});
