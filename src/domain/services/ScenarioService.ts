import type { Scenario } from '../entities/Scenario';
import { SCENARIOS } from '../config/scenarios';
import type { MapExportJSON, ResourceNode, SpawnPoint, DecorItem, HexExportCell } from '../mapEditorTypes';
import { HexGrid } from '../../presentation/generator/hex/HexGrid';
import { hexToWorld, hexDistance, HEX_SIZE } from '../../presentation/generator/hex/HexMath';
import { parseMapJSON } from '../../presentation/generator/schema/mapSchema';
import { generateDecor, generateResources, generateSpawns, generateBuildNodes } from '../../presentation/generator/terrain/ProceduralPlacement';
import { applyProceduralTerrain } from '../../presentation/generator/terrain/ProceduralTerrain';
import { INITIAL_COLONY_STATE } from '../entities/Colony';
import type { Resources, ResourceCapacity } from '../entities/Resources';

function makePrng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface ScenarioInitState {
  mapData: MapExportJSON;
  resources: Resources;
  capacity: ResourceCapacity;
  difficulty: Scenario['difficulty'];
  colonyName: string;
  scenario: Scenario;
}

export class ScenarioService {
  /**
   * Returns all available pre-defined campaign scenarios.
   */
  public static getScenarios(): Scenario[] {
    return SCENARIOS;
  }

  /**
   * Returns a scenario by ID, or undefined if not found.
   */
  public static getScenarioById(id: string): Scenario | undefined {
    return SCENARIOS.find(s => s.id === id);
  }

  /**
   * Generates a complete MapExportJSON for a specific scenario.
   */
  public static generateScenarioMap(scenario: Scenario, customSeed?: number): MapExportJSON {
    const seed = customSeed ?? scenario.seed;
    const radius = scenario.mapRadius || 20;
    const rng = makePrng(seed);

    const grid = new HexGrid(radius, seed);
    grid.generate();

    switch (scenario.terrainArchetype) {
      case 'ice_crater': {
        const craterR = radius * 0.48;
        for (const c of grid.getAllCells()) {
          const dist = hexDistance(0, 0, c.q, c.r);
          if (dist < craterR * 0.6) {
            grid.setTerrainType(c.q, c.r, 'deep_crater');
          } else if (dist < craterR) {
            grid.setTerrainType(c.q, c.r, 'lowland');
          } else if (dist < craterR * 1.35) {
            grid.setTerrainType(c.q, c.r, rng() < 0.4 ? 'peak' : 'highland');
          } else {
            const r = rng();
            grid.setTerrainType(c.q, c.r, r < 0.65 ? 'plains' : r < 0.85 ? 'highland' : 'lowland');
          }
        }
        break;
      }

      case 'canyon_valley': {
        for (const c of grid.getAllCells()) {
          const [wx, wz] = hexToWorld(c.q, c.r);
          const canyonCenterZ = Math.sin(wx * 0.12) * (radius * HEX_SIZE * 0.35);
          const distToCanyon = Math.abs(wz - canyonCenterZ);
          const canyonWidth = radius * HEX_SIZE * 0.22;

          if (distToCanyon < canyonWidth * 0.5) {
            grid.setTerrainType(c.q, c.r, 'lowland');
          } else if (distToCanyon < canyonWidth) {
            grid.setTerrainType(c.q, c.r, 'deep_crater');
          } else if (distToCanyon < canyonWidth * 1.6) {
            grid.setTerrainType(c.q, c.r, 'rocky');
          } else if (distToCanyon < canyonWidth * 2.4) {
            grid.setTerrainType(c.q, c.r, 'highland');
          } else {
            grid.setTerrainType(c.q, c.r, rng() < 0.6 ? 'plains' : 'highland');
          }
        }
        break;
      }

      case 'volcanic_caldera': {
        const rimRadius = radius * 0.55;
        for (const c of grid.getAllCells()) {
          const dist = hexDistance(0, 0, c.q, c.r);
          if (dist < rimRadius * 0.45) {
            grid.setTerrainType(c.q, c.r, 'deep_crater');
          } else if (dist < rimRadius * 0.75) {
            grid.setTerrainType(c.q, c.r, 'lowland');
          } else if (Math.abs(dist - rimRadius) < 2) {
            grid.setTerrainType(c.q, c.r, rng() < 0.6 ? 'peak' : 'rocky');
          } else if (dist < rimRadius + 4) {
            grid.setTerrainType(c.q, c.r, 'highland');
          } else {
            grid.setTerrainType(c.q, c.r, rng() < 0.7 ? 'plains' : 'lowland');
          }
        }
        break;
      }

      case 'mountains': {
        applyProceduralTerrain(grid, seed, { mountainStrength: 0.65, octaves: 5, baseFrequency: 0.045 });
        break;
      }

      case 'plains': {
        for (const c of grid.getAllCells()) {
          const r = rng();
          grid.setTerrainType(c.q, c.r, r < 0.75 ? 'plains' : r < 0.9 ? 'lowland' : 'highland');
        }
        break;
      }

      case 'oasis': {
        for (const c of grid.getAllCells()) {
          const dist = hexDistance(0, 0, c.q, c.r);
          if (dist < radius * 0.4) {
            grid.setTerrainType(c.q, c.r, 'lowland');
          } else if (dist < radius * 0.7) {
            grid.setTerrainType(c.q, c.r, 'plains');
          } else {
            grid.setTerrainType(c.q, c.r, rng() < 0.5 ? 'highland' : 'rocky');
          }
        }
        break;
      }

      case 'symmetric_arena':
      case 'procedural':
      default: {
        applyProceduralTerrain(grid, seed);
        break;
      }
    }

    // 1. Spawns
    const spawns: SpawnPoint[] = generateSpawns(grid, seed + 10, 1);
    if (spawns.length > 0) {
      grid.setTerrainType(spawns[0].pos[0], spawns[0].pos[1], 'plains');
    }

    // 2. Resources
    const resources: ResourceNode[] = generateResources(grid, seed + 20, 1);

    // 3. Build Nodes & Decor
    const buildNodes = generateBuildNodes(grid, seed + 30, 1, spawns);
    const decor: DecorItem[] = generateDecor(grid, seed + 40);

    // 4. Place Scenario Custom POIs
    if (scenario.customPOIs && scenario.customPOIs.length > 0) {
      for (const poiDef of scenario.customPOIs) {
        const count = poiDef.count ?? 1;
        const prefs = poiDef.terrainPreference ?? ['plains', 'highland', 'lowland', 'rocky', 'deep_crater'];

        for (let i = 0; i < count; i++) {
          if (poiDef.pos) {
            decor.push({
              model: poiDef.model,
              pos: [poiDef.pos[0], poiDef.pos[1]],
              rot: +(rng() * Math.PI * 2).toFixed(2),
              scale: 1.0,
            });
            continue;
          }

          const candidates = grid.getAllCells().filter(
            c =>
              prefs.includes(c.terrainType) &&
              !decor.some(d => d.pos[0] === c.q && d.pos[1] === c.r) &&
              !spawns.some(s => s.pos[0] === c.q && s.pos[1] === c.r)
          );

          if (candidates.length > 0) {
            const picked = candidates[Math.floor(rng() * candidates.length)];
            decor.push({
              model: poiDef.model,
              pos: [picked.q, picked.r],
              rot: +(rng() * Math.PI * 2).toFixed(2),
              scale: 1.0,
            });
          } else {
            const allCells = grid.getAllCells();
            if (allCells.length > 0) {
              const picked = allCells[Math.floor(rng() * allCells.length)];
              decor.push({
                model: poiDef.model,
                pos: [picked.q, picked.r],
                rot: +(rng() * Math.PI * 2).toFixed(2),
                scale: 1.0,
              });
            }
          }
        }
      }
    }

    const hexes: HexExportCell[] = grid.getAllCells().map(c => ({
      q: c.q,
      r: c.r,
      terrainType: c.terrainType,
      userType: c.userType,
      decor: c.decor,
    }));

    const mapData: MapExportJSON = {
      meta: {
        name: scenario.id,
        description: scenario.description,
        version: '2.0',
        gridType: 'hex-flat-top',
        hexSize: HEX_SIZE,
        hexRadius: radius,
        players: 1,
        seed,
      },
      hexes,
      buildNodes,
      resourceNodes: resources,
      spawnPoints: spawns,
      decor,
    };

    const parsed = parseMapJSON(mapData);
    if (!parsed.ok || !parsed.data) {
      throw new Error(`Scenario map schema error: ${parsed.error}`);
    }

    return parsed.data;
  }

  /**
   * Initializes game state variables matching the scenario setup.
   */
  public static createInitialScenarioState(
    scenario: Scenario,
    colonyName?: string,
    customSeed?: number
  ): ScenarioInitState {
    const mapData = ScenarioService.generateScenarioMap(scenario, customSeed);

    const resources: Resources = {
      ...INITIAL_COLONY_STATE.resources,
      ...scenario.startingResources,
    };

    const capacity: ResourceCapacity = {
      ...INITIAL_COLONY_STATE.capacity,
      ...(scenario.startingCapacity ?? {}),
    };

    const finalColonyName = (colonyName && colonyName.trim()) || scenario.defaultColonyName || scenario.title;

    return {
      mapData,
      resources,
      capacity,
      difficulty: scenario.difficulty,
      colonyName: finalColonyName,
      scenario,
    };
  }
}
