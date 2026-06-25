/**
 * SmoothTerrain.tsx
 *
 * Podglad terenu gry (= przyszly renderer rozgrywki). Unified mesh z rampami
 * i klifami, oteksturowany produkcyjnym SlopeMaterial (triplanar 2k_mars.jpg
 * + slope-aware skala + wysokosc + tint biomow). Klify dostaja TEN SAM
 * materiel co teren, wiec sa oswietlone i pokryte skala.
 */

import { useMemo } from 'react'
import { useTexture } from '@react-three/drei'
import { RepeatWrapping, SRGBColorSpace } from 'three'
import { useMapEditorStore } from '../../../../application/store/useMapEditorStore'
import { buildSmoothTerrainGeometry } from '../../terrain/TerrainMeshBuilder'
import { buildCliffGeometry } from '../../terrain/CliffBuilder'
import { createSlopeMaterial } from '../../terrain/SlopeMaterial'

const SmoothTerrain = () => {
  const hexGrid = useMapEditorStore(s => s.hexGrid)

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
      <mesh geometry={terrainGeo} material={terrainMat} receiveShadow castShadow />
      {cliffGeo && (
        <mesh geometry={cliffGeo} material={terrainMat} receiveShadow castShadow />
      )}
    </>
  )
}

export default SmoothTerrain
