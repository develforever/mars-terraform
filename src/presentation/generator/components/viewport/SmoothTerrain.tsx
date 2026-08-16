/**
 * SmoothTerrain.tsx
 *
 * Podglad terenu gry (= przyszly renderer rozgrywki). Unified mesh z rampami
 * i klifami, oteksturowany produkcyjnym SlopeMaterial (triplanar 2k_mars.jpg
 * + slope-aware skala + wysokosc + tint biomow). Klify dostaja TEN SAM
 * materiel co teren, wiec sa oswietlone i pokryte skala.
 */

import { forwardRef, useMemo } from 'react'
import { useTexture } from '@react-three/drei'
import { RepeatWrapping, SRGBColorSpace, type Mesh } from 'three'
import { useMapEditorStore } from '../../../../application/store/useMapEditorStore'
import { buildSmoothTerrainGeometry } from '../../terrain/TerrainMeshBuilder'
import { buildCliffGeometry } from '../../terrain/CliffBuilder'
import { createSlopeMaterial } from '../../terrain/SlopeMaterial'
import type { HexGrid } from '../../hex/HexGrid'

export interface SmoothTerrainProps {
  hexGrid?: HexGrid | null
}

const SmoothTerrain = forwardRef<Mesh, SmoothTerrainProps>(
  ({ hexGrid: propHexGrid }, ref) => {
    const editorHexGrid = useMapEditorStore(s => s.hexGrid)
    const hexGrid = propHexGrid ?? editorHexGrid

    const cells = useMemo(() => hexGrid?.getAllCells() ?? [], [hexGrid])

    const terrainGeo = useMemo(() =>
      cells.length > 0 ? buildSmoothTerrainGeometry(cells) : null,
      [cells]
    )

    const cliffGeo = useMemo(() =>
      cells.length > 0 ? buildCliffGeometry(cells) : null,
      [cells]
    )

    // Baza albedo = prawdziwa tekstura Marsa (spojnosc z rozgrywka i strona glowna)
    const baseTex = useTexture('/textures/2k_mars.jpg')
    useMemo(() => {
      baseTex.wrapS = baseTex.wrapT = RepeatWrapping
      baseTex.colorSpace = SRGBColorSpace
    }, [baseTex])

    const terrainMat = useMemo(() =>
      createSlopeMaterial({ baseTexture: baseTex, triScale: 0.2 }),
      [baseTex]
    )

    if (!terrainGeo) return null

    return (
      <>
        <mesh ref={ref} geometry={terrainGeo} material={terrainMat} receiveShadow castShadow />
        {cliffGeo && (
          <mesh geometry={cliffGeo} material={terrainMat} receiveShadow castShadow />
        )}
      </>
    )
  }
)

SmoothTerrain.displayName = 'SmoothTerrain'

export { SmoothTerrain }
export default SmoothTerrain
