/**
 * useHexHeight.ts
 *
 * Zwraca funkcję (q, r) => worldY odczytaną wprost z aktywnej siatki heksów.
 *
 * Środek heksa leży na cell.worldY zarówno w trybie płaskim (HexTerrain),
 * jak i w trybie Preview (SmoothTerrain — patrz TerrainMeshBuilder, gdzie
 * wierzchołek centralny ma Y = cell.worldY). Dzięki temu markery siadają
 * dokładnie na powierzchni terenu bez raycastingu.
 *
 * Hook subskrybuje hexGrid, więc markery re-renderują się po zmianie terenu.
 */

import { useCallback } from 'react'
import { useMapEditorStore } from '../../../application/store/useMapEditorStore'

export const useHexHeight = (): ((q: number, r: number) => number) => {
  const hexGrid = useMapEditorStore(s => s.hexGrid)
  return useCallback(
    (q: number, r: number): number => hexGrid?.getCell(q, r)?.worldY ?? 0,
    [hexGrid],
  )
}
