/**
 * HexTerrain.tsx
 * Renders hex terrain as a single InstancedMesh (one draw call).
 * Pure rendering — interaction is handled by HexInteraction.
 */

import { useMemo, useRef, useEffect } from 'react'
import * as THREE from 'three'
import { useMapEditorStore } from '../../../../application/store/useMapEditorStore'
import { TERRAIN_COLORS } from '../../hex/HexGrid'
import { createFlatHexGeometry } from '../../hex/HexGeometry'
import { hexToWorld, HEX_SIZE } from '../../hex/HexMath'

// ─── User type overlay colors ─────────────────────────────────────────────────

const USER_COLORS: Record<string, [number, number, number]> = {
  build:    [0.0,  0.85, 0.45],
  resource: [0.9,  0.72, 0.0],
  blocked:  [0.85, 0.18, 0.0],
  spawn:    [0.0,  0.45, 0.85],
}

// ─── Component ────────────────────────────────────────────────────────────────

const HexTerrain = () => {
  const hexGrid = useMapEditorStore(s => s.hexGrid)
  const meshRef = useRef<THREE.InstancedMesh>(null)

  const cells = useMemo(() => hexGrid?.getAllCells() ?? [], [hexGrid])
  const count  = cells.length

  const geometry = useMemo(() => createFlatHexGeometry(HEX_SIZE), [])
  const material = useMemo(() => new THREE.MeshStandardMaterial({
    roughness: 0.96, metalness: 0.0, color: 0xffffff,
  }), [])

  // Update instance matrices + colors whenever cells change
  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh || count === 0) return

    const dummy = new THREE.Object3D()
    const color = new THREE.Color()

    cells.forEach((cell, i) => {
      const [x, z] = hexToWorld(cell.q, cell.r)
      dummy.position.set(x, cell.worldY, z)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)

      if (cell.userType && cell.userType !== 'empty') {
        const [r, g, b] = USER_COLORS[cell.userType] ?? [1, 1, 1]
        color.setRGB(r, g, b)
      } else {
        const [r, g, b] = TERRAIN_COLORS[cell.terrainType]
        // Deterministyczna wariacja per heks — likwiduje jednolity, plastikowy wygląd
        const h = Math.sin(cell.q * 12.9898 + cell.r * 78.233) * 43758.5453
        const jitter = 0.90 + (h - Math.floor(h)) * 0.16   // 0.90..1.06
        color.setRGB(r * jitter, g * jitter, b * jitter)
      }
      mesh.setColorAt(i, color)
    })

    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [cells, count])

  if (count === 0) return null

  return (
    <instancedMesh
      key={count}
      ref={meshRef}
      args={[geometry, material, count]}
      receiveShadow
      castShadow
      frustumCulled={false}
    />
  )
}

export default HexTerrain
