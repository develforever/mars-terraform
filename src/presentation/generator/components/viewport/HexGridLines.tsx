/**
 * HexGridLines.tsx
 * Renders wireframe edges of the hex grid as LineSegments.
 * Toggled via the Grid button / G key.
 */

import { useMemo } from 'react'
import * as THREE from 'three'
import { useMapEditorStore } from '../../../../application/store/useMapEditorStore'
import { buildHexEdgesGeometry } from '../../hex/HexGeometry'

const HexGridLines = () => {
  const hexGrid = useMapEditorStore(s => s.hexGrid)

  const geometry = useMemo(() => {
    if (!hexGrid) return null
    return buildHexEdgesGeometry(hexGrid.getAllCells())
  }, [hexGrid])

  const material = useMemo(
    () => new THREE.LineBasicMaterial({
      color: '#3a2010',
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    }),
    [],
  )

  if (!geometry) return null

  return <lineSegments geometry={geometry} material={material} />
}

export default HexGridLines
