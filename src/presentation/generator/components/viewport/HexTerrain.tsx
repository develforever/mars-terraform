/**
 * HexTerrain.tsx
 * Renders the full hex terrain as a single merged BufferGeometry with vertex colors.
 * No textures — 1 draw call for the entire map.
 */

import { useMemo, useRef, useContext, useEffect } from 'react'
import * as THREE from 'three'
import { useMapEditorStore } from '../../../../application/store/useMapEditorStore'
import { buildHexTerrainGeometry } from '../../hex/HexGeometry'
import { TerrainHeightContext } from '../../hooks/useTerrainHeight'

const HexTerrain = () => {
  const hexGrid = useMapEditorStore(s => s.hexGrid)
  const meshRef = useRef<THREE.Mesh>(null)
  const { setTerrainMesh } = useContext(TerrainHeightContext)

  const geometry = useMemo(() => {
    if (!hexGrid) return null
    return buildHexTerrainGeometry(hexGrid.getAllCells())
  }, [hexGrid])

  // Register mesh in context so markers can raycast against it
  useEffect(() => {
    if (meshRef.current) setTerrainMesh(meshRef.current)
    return () => setTerrainMesh(null)
  }, [setTerrainMesh, geometry])

  if (!geometry) return null

  return (
    <mesh ref={meshRef} geometry={geometry} castShadow receiveShadow>
      <meshBasicMaterial vertexColors />
    </mesh>
  )
}

export default HexTerrain
