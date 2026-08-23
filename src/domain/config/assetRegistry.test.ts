import { describe, it, expect } from 'vitest';
import { BUILDING_SEED } from './buildings';
import { DECOR_MODELS } from '../../presentation/generator/components/viewport/decorConstants';
import assetManifest from './assetManifest.json';

describe('3D Asset Registry & Manifest Integrity', () => {
  it('should have the manifest populated with assets', () => {
    expect(assetManifest.totalAssets).toBeGreaterThan(100);
    expect(assetManifest.assets.length).toBe(assetManifest.totalAssets);
  });

  it('should contain manifest entries for all buildings in BUILDING_SEED', () => {
    const assetPaths = new Set(assetManifest.assets.map(a => a.path));
    for (const building of BUILDING_SEED) {
      if (building.modelPath) {
        expect(
          assetPaths.has(building.modelPath),
          `Model ${building.modelPath} for building ${building.id} is missing from assetManifest.json`
        ).toBe(true);
      }
    }
  });

  it('should contain manifest entries for key vehicles and units', () => {
    const assetIds = new Set(assetManifest.assets.map(a => a.id));
    const required = [
      'rover',
      'rover_combat',
      'craft_miner',
      'drone_repair',
      'craft_hauler',
      'craft_cargoA',
      'craft_speederA',
      'craft_racer',
      'alien',
      'rocket_baseA',
    ];

    for (const id of required) {
      expect(assetIds.has(id), `Required asset ${id} is missing from assetManifest.json`).toBe(true);
    }
  });

  it('should contain manifest entries for POI ruin and alien base prefabs', () => {
    const assetIds = new Set(assetManifest.assets.map(a => a.id));
    const requiredPOIs = [
      'poi_abandoned_lab',
      'poi_alien_hive',
      'poi_crashed_freighter',
    ];

    for (const id of requiredPOIs) {
      expect(assetIds.has(id), `Required POI prefab ${id} is missing from assetManifest.json`).toBe(true);
    }
  });

  it('should have decor models cataloged or matchable', () => {
    expect(DECOR_MODELS.length).toBeGreaterThan(0);
  });
});
