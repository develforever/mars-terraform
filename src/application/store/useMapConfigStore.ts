import { create } from 'zustand'
import type { MapExportJSON, BuildNode, ResourceNode, SpawnPoint, DecorItem } from '../../domain/mapEditorTypes'

// ─── Store ────────────────────────────────────────────────────────────────────
// Lightweight read-only store for the loaded map config in the game scene.
// Populated by loading a JSON exported from the Map Generator (/generate).

interface MapConfigState {
  loaded: boolean
  mapName: string
  buildNodes: BuildNode[]
  resourceNodes: ResourceNode[]
  spawnPoints: SpawnPoint[]
  decor: DecorItem[]
  terrainFile: string

  loadMapJSON: (data: MapExportJSON) => void
  loadMapFromFile: () => Promise<void>
  clearMap: () => void
}

export const useMapConfigStore = create<MapConfigState>((set) => ({
  loaded: false,
  mapName: '',
  buildNodes: [],
  resourceNodes: [],
  spawnPoints: [],
  decor: [],
  terrainFile: 'mars_terrain.glb',

  loadMapJSON: (data) => {
    set({
      loaded: true,
      mapName: data.meta.name,
      buildNodes: data.buildNodes ?? [],
      resourceNodes: data.resourceNodes ?? [],
      spawnPoints: data.spawnPoints ?? [],
      decor: data.decor ?? [],
      terrainFile: 'mars_terrain.glb',
    })
  },

  loadMapFromFile: async () => {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.json'
      input.onchange = async () => {
        const file = input.files?.[0]
        if (!file) { resolve(); return }
        try {
          const text = await file.text()
          const data: MapExportJSON = JSON.parse(text)
          set({
            loaded: true,
            mapName: data.meta.name,
            buildNodes: data.buildNodes ?? [],
            resourceNodes: data.resourceNodes ?? [],
            spawnPoints: data.spawnPoints ?? [],
            decor: data.decor ?? [],
            terrainFile: 'mars_terrain.glb',
          })
          resolve()
        } catch {
          reject(new Error('Invalid map JSON file.'))
        }
      }
      input.click()
    })
  },

  clearMap: () => set({
    loaded: false,
    mapName: '',
    buildNodes: [],
    resourceNodes: [],
    spawnPoints: [],
    decor: [],
    terrainFile: 'mars_terrain.glb',
  }),
}))
