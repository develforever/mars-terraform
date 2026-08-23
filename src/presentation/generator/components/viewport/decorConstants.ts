export interface DecorModelDef { model: string; label: string }

export const DECOR_MODELS: DecorModelDef[] = [
  { model: 'rock_01', label: 'Rock' },
  { model: 'rocks',   label: 'Stones' },
  { model: 'boulder', label: 'Boulder' },
  { model: 'crystal', label: 'Crystal' },
  { model: 'wreck',   label: 'Wreck' },
  { model: 'poi_abandoned_lab',     label: '🏚️ Abandoned Lab (POI)' },
  { model: 'poi_alien_hive',        label: '👾 Alien Hive (POI)' },
  { model: 'poi_crashed_freighter', label: '🚀 Crashed Freighter (POI)' },
]

export const POI_MODEL_PATHS: Record<string, string> = {
  poi_abandoned_lab: '/models/mars/poi_abandoned_lab.glb',
  poi_alien_hive: '/models/mars/poi_alien_hive.glb',
  poi_crashed_freighter: '/models/mars/poi_crashed_freighter.glb',
}

export const POI_LOD_MODEL_PATHS: Record<string, string> = {
  poi_abandoned_lab: '/models/mars/poi_abandoned_lab_lod1.glb',
  poi_alien_hive: '/models/mars/poi_alien_hive_lod1.glb',
  poi_crashed_freighter: '/models/mars/poi_crashed_freighter_lod1.glb',
}

/**
 * Zwraca ścieżkę do wariantu LOD1 dla danego modelu lub null jeśli wariant nie istnieje.
 */
export function getLOD1Path(modelPathOrId: string): string | null {
  if (POI_LOD_MODEL_PATHS[modelPathOrId]) {
    return POI_LOD_MODEL_PATHS[modelPathOrId]
  }
  if (modelPathOrId.endsWith('.glb') && !modelPathOrId.endsWith('_lod1.glb')) {
    return modelPathOrId.replace(/\.glb$/, '_lod1.glb')
  }
  return null
}

