import type { PlacedBuilding } from "../entities/Building";
import type { Resources, ResourceCapacity, ResourceDelta } from "../entities/Resources";
import type { AlienState } from "../entities/Alien";
import type { PlacedUnit } from "../entities/Unit";
import type { QuestState } from "../entities/Quest";
import type { GameAnalyticsSnapshot } from "../entities/GameStats";
import type { ColonyPopulation, MoraleState } from "../entities/Colonist";
import type { ResourceNode } from "../mapEditorTypes";
import type { HexGrid } from "../../presentation/generator/hex/HexGrid";
import { BUILDING_DEFINITIONS } from "../config/buildings";
import { BuildingService } from "../services/BuildingService";
import { EconomyService, type EmergencyLifeSupportState } from "../services/EconomyService";
import { WeatherService, type WeatherState, type WeatherType } from "../services/WeatherService";
import { TerraformingService, type DifficultyLevel } from "../services/TerraformingService";
import { MeteorService } from "../services/MeteorService";
import { GAME_MODE_CONFIGS, type GameMode } from "../services/GameModeService";
import { AlienService } from "../services/AlienService";
import { QuestService } from "../services/QuestService";
import { GameAnalyticsService } from "../services/GameAnalyticsService";
import { ColonistService } from "../services/ColonistService";
import { RTSCommandService } from "../services/RTSCommandService";
import type { Rng } from "../random/Rng";

/**
 * Rdzeń symulacji (Faza 9, F9-T2): jeden tick gry jako czysta funkcja, bez Zustand i bez UI.
 * Używa go store gry solo (`applyEconomyTick`), a docelowo serwer gry sieciowej (ten sam kod).
 * Logika przeniesiona 1:1 z dawnego `applyEconomyTick`; zgodność pilnuje test złoty
 * (`src/application/store/__tests__/simulationGolden.test.ts`).
 */

/** Stan potrzebny do policzenia ticka (podzbiór `GameState`). */
export interface SimulationState {
  gameMode: GameMode;
  difficulty: DifficultyLevel;
  alive: boolean;
  won: boolean;
  isEndless: boolean;
  tick: number;
  weather: WeatherState;
  terraforming: number;
  o2Accumulated: number;
  resources: Resources;
  capacity: ResourceCapacity;
  sun: number;
  placed: PlacedBuilding[];
  units: PlacedUnit[];
  resourceNodes: ResourceNode[];
  hexGrid: HexGrid;
  population: ColonyPopulation;
  emergencyLifeSupport: EmergencyLifeSupportState;
  alienState: AlienState;
  aliensDefeated: number;
  researchPoints: number;
  unlockedTechs: string[];
  activeQuests: QuestState[];
  analyticsSnapshots: GameAnalyticsSnapshot[];
}

/** Zmiany stanu po ticku (do scalenia z pełnym stanem gry). */
export interface SimulationUpdate {
  weather: WeatherState;
  placed: PlacedBuilding[];
  units: PlacedUnit[];
  lastDelta: ResourceDelta;
  resources: Resources;
  resourceNodes: ResourceNode[];
  alive: boolean;
  emergencyLifeSupport: EmergencyLifeSupportState;
  tick: number;
  sol: number;
  aliensDefeated: number;
  analyticsSnapshots: GameAnalyticsSnapshot[];
  o2Accumulated: number;
  terraforming: number;
  waterLevel: number;
  alienState: AlienState;
  won: boolean;
  researchPoints: number;
  activeQuests: QuestState[];
  population: ColonyPopulation;
  morale: MoraleState;
}

export interface SimulationOptions {
  /** Źródło losowości (pogoda, obcy). Domyślnie `Math.random`; serwer i testy podają generator z ziarnem. */
  rng?: Rng;
  /** Wymuszona pogoda (narzędzie debug) - pomija losowanie pogody. */
  forcedWeather?: WeatherType | null;
}

export const stepSimulation = (state: SimulationState, options: SimulationOptions = {}): SimulationUpdate => {
  const { rng = Math.random, forcedWeather = null } = options;
  const modeCfg = GAME_MODE_CONFIGS[state.gameMode];

  // Pogoda (wymuszona w debug ma pierwszeństwo; tryb przygody bez zagrożeń)
  const newWeather = forcedWeather
    ? { ...state.weather, type: forcedWeather }
    : WeatherService.tick(state.weather, modeCfg.sandstormChanceMultiplier, modeCfg.meteorChanceMultiplier, modeCfg.hazardsEnabled, state.terraforming, rng);
  const productionModifier = WeatherService.getProductionModifier(newWeather);

  // Degradacja budynków w burzy pyłowej (skalowana trybem gry)
  let degradedPlaced = WeatherService.isDustStorm(newWeather.type)
    ? BuildingService.degradeBuildings(state.placed, newWeather.intensity * modeCfg.conditionDamageMultiplier)
    : state.placed;

  // Uderzenia meteorów w pierwszym ticku deszczu meteorów
  if (newWeather.type === "meteor_shower" && newWeather.remainingTicks === 5 && newWeather.impactZones?.length) {
    degradedPlaced = MeteorService.applyImpacts(degradedPlaced, newWeather.impactZones);
  }

  const currentTick = state.tick + 1;
  const currentSol = GameAnalyticsService.tickToSol(currentTick);

  // Przylot promu z kolonistami
  const shuttleResult = ColonistService.processShuttleArrival(state.population, currentTick);
  const currentPopulation = shuttleResult.population;

  // Morale i bonusy zawodów
  const currentMorale = ColonistService.calculateMorale(state.resources, state.capacity, currentPopulation);
  const roleBonuses = ColonistService.calculateRoleBonuses(currentPopulation.roles);
  const totalProductionModifier = productionModifier * currentMorale.productivityMultiplier;

  const tickResult = EconomyService.tick(
    { resources: state.resources, capacity: state.capacity, sun: state.sun, alive: state.alive },
    degradedPlaced,
    BUILDING_DEFINITIONS,
    totalProductionModifier,
    state.resourceNodes,
    modeCfg.depositDepletionRate,
    newWeather.type,
    currentPopulation,
    roleBonuses,
    state.emergencyLifeSupport,
  );

  const newO2Accumulated = TerraformingService.accumulateO2(state.o2Accumulated, tickResult.delta);
  const newResources = {
    o2: state.resources.o2 + (tickResult.delta.o2 ?? 0),
    power: state.resources.power + (tickResult.delta.power ?? 0),
    water: state.resources.water + (tickResult.delta.water ?? 0),
    biomass: state.resources.biomass + (tickResult.delta.biomass ?? 0),
    minerals: state.resources.minerals + (tickResult.delta.minerals ?? 0),
  };
  const newTerraforming = modeCfg.hasWinCondition
    ? TerraformingService.calculateProgress(newO2Accumulated, newResources, state.difficulty)
    : 0;
  const newWaterLevel = TerraformingService.calculateWaterLevel(newResources.water, newTerraforming, state.difficulty);

  // Inwazja obcych w trybie przetrwania albo przy aktywnej fali (debug)
  let finalPlaced = degradedPlaced;
  let newAlienState = state.alienState;
  let newAliensDefeated = state.aliensDefeated;
  if (state.gameMode === "survival" || state.alienState.wave > 0) {
    const alienResult = AlienService.tick(state.alienState, degradedPlaced, newTerraforming, state.hexGrid, newWaterLevel, rng);
    finalPlaced = alienResult.damagedBuildings;
    newAlienState = alienResult.alienState;
    newAliensDefeated += alienResult.eliminatedUnits ?? 0;
  }

  // Jednostki gracza: walka, naprawy, ruch
  const rtsResult = RTSCommandService.tickUnits(state.units, newAlienState, finalPlaced, state.hexGrid, newWaterLevel, 1.0);
  const finalUnits = rtsResult.units;
  finalPlaced = rtsResult.buildings;
  newAlienState = { ...newAlienState, ships: rtsResult.aliens.ships, groundUnits: rtsResult.aliens.groundUnits };
  newAliensDefeated += rtsResult.eliminatedAliens;

  const newRP = state.researchPoints + tickResult.researchPointsDelta;

  const evaluatedQuests = QuestService.evaluateQuests(
    {
      placed: finalPlaced,
      resources: newResources,
      unlockedTechs: state.unlockedTechs,
      terraforming: newTerraforming,
      o2Accumulated: newO2Accumulated,
      waterLevel: newWaterLevel,
      alienWave: newAlienState.wave,
    },
    state.activeQuests,
  );

  // Snapshot analityki co 10 ticków (bufor do 500)
  let updatedSnapshots = state.analyticsSnapshots;
  if (currentTick % 10 === 0) {
    const remainingMinerals = (tickResult.resourceNodes ?? state.resourceNodes).filter((n) => n.type === "minerals").length;
    const newSnapshot = GameAnalyticsService.createSnapshot({
      tick: currentTick,
      resources: newResources,
      mineralsCount: remainingMinerals,
      terraforming: newTerraforming,
      o2Accumulated: newO2Accumulated,
      waterLevel: newWaterLevel,
      buildingsCount: finalPlaced.length,
      aliensDefeated: newAliensDefeated,
    });
    updatedSnapshots = GameAnalyticsService.recordSnapshot(state.analyticsSnapshots, newSnapshot);
  }

  const isWin = modeCfg.hasWinCondition ? TerraformingService.isComplete(newTerraforming) : false;
  const won = state.won || (!state.isEndless && isWin);

  return {
    weather: newWeather,
    placed: finalPlaced,
    units: finalUnits,
    lastDelta: tickResult.delta,
    resources: newResources,
    resourceNodes: tickResult.resourceNodes ?? state.resourceNodes,
    alive: !tickResult.gameOver,
    emergencyLifeSupport: tickResult.emergencyLifeSupport,
    tick: currentTick,
    sol: currentSol,
    aliensDefeated: newAliensDefeated,
    analyticsSnapshots: updatedSnapshots,
    o2Accumulated: newO2Accumulated,
    terraforming: newTerraforming,
    waterLevel: newWaterLevel,
    alienState: newAlienState,
    won,
    researchPoints: newRP,
    activeQuests: evaluatedQuests,
    population: currentPopulation,
    morale: currentMorale,
  };
};
