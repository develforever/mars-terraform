import { createContext, useContext, useRef, useCallback } from 'react'
import * as THREE from 'three'

// ─── Context ──────────────────────────────────────────────────────────────────

interface TerrainHeightContextValue {
  getHeight: (wx: number, wz: number) => number
  setTerrainMesh: (mesh: THREE.Mesh | null) => void
}

export const TerrainHeightContext = createContext<TerrainHeightContextValue>({
  getHeight: () => 0,
  setTerrainMesh: () => {},
})

// ─── Provider hook ─────────────────────────────────────────────────────────────

export const useTerrainHeightProvider = () => {
  const meshRef = useRef<THREE.Mesh | null>(null)
  const raycaster = useRef(new THREE.Raycaster())

  const setTerrainMesh = useCallback((mesh: THREE.Mesh | null) => {
    meshRef.current = mesh
  }, [])

  const getHeight = useCallback((wx: number, wz: number): number => {
    const mesh = meshRef.current
    if (!mesh) return 0

    raycaster.current.set(
      new THREE.Vector3(wx, 50, wz),
      new THREE.Vector3(0, -1, 0),
    )

    const hits = raycaster.current.intersectObject(mesh, false)
    if (hits.length > 0) return hits[0].point.y
    return 0
  }, [])

  return { getHeight, setTerrainMesh }
}

// ─── Consumer hook ────────────────────────────────────────────────────────────

export const useTerrainHeight = () => {
  return useContext(TerrainHeightContext).getHeight
}
