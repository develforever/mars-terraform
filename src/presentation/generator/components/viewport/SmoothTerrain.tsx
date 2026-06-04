/**
 * SmoothTerrain.tsx
 *
 * Podgląd terenu gry — unified mesh z rampami, urwiskami i slope shaderem.
 * Renderowany zamiast HexTerrain gdy aktywny jest tryb Preview.
 *
 * Interakcja (HexInteraction) działa niezależnie i nie wymaga zmian.
 */

import { useMemo } from 'react'
import { useMapEditorStore } from '../../../../application/store/useMapEditorStore'
import { buildSmoothTerrainGeometry } from '../../terrain/TerrainMeshBuilder'
import { buildCliffGeometry } from '../../terrain/CliffBuilder'
import { createSlopeMaterial } from '../../terrain/SlopeMaterial'
import * as THREE from 'three'

// DoubleSide na klifach — widoczne niezależnie od kąta kamery
const cliffMaterial = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.95,
  metalness: 0.02,
  side: THREE.DoubleSide,
})

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

  const terrainMat = useMemo(() => createSlopeMaterial(), [])

  const cliffMat = cliffMaterial

  if (!terrainGeo) return null

  return (
    <>
      <mesh
        geometry={terrainGeo}
        material={terrainMat}
        receiveShadow
        castShadow
      />
      {cliffGeo && (
        <mesh
          geometry={cliffGeo}
          material={cliffMat}
          receiveShadow
          castShadow
        />
      )}
    </>
  )
}

export default SmoothTerrain
