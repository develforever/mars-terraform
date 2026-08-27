import type { DifficultyLevel } from '../services/TerraformingService';
import type { Resources, ResourceCapacity } from './Resources';
import type { HexTerrainType } from '../../presentation/generator/hex/HexGrid';

export type TerrainArchetype =
  | 'ice_crater'
  | 'canyon_valley'
  | 'symmetric_arena'
  | 'volcanic_caldera'
  | 'oasis'
  | 'mountains'
  | 'plains'
  | 'procedural';

export interface ScenarioPOI {
  model: string;
  count?: number;
  pos?: [number, number];
  terrainPreference?: HexTerrainType[];
}

export interface ScenarioModifiers {
  stormFrequency?: number;
  alienAggression?: number;
  tempOffset?: number;
  solarEfficiency?: number;
  depositDepletionRate?: number;
  initialAlienWave?: 0 | 1 | 2;
}

export interface Scenario {
  id: string;
  title: string;
  description: string;
  difficulty: DifficultyLevel;
  seed: number;
  terrainArchetype: TerrainArchetype;
  mapRadius: number;
  startingResources: Partial<Resources>;
  startingCapacity?: Partial<ResourceCapacity>;
  customPOIs: ScenarioPOI[];
  modifiers: ScenarioModifiers;
  tags?: string[];
  objectives?: string[];
  icon?: string;
  defaultColonyName?: string;
}
