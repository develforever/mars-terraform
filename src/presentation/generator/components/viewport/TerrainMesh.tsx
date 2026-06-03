import { useGLTF, useTexture } from '@react-three/drei'
import { useMemo, useEffect, useContext, useRef } from 'react'
import * as THREE from 'three'
import type { GLTF } from 'three-stdlib'
import { TerrainHeightContext } from '../../hooks/useTerrainHeight'

type MarsTerrainGLTF = GLTF & {
  nodes: { [key: string]: THREE.Object3D }
}

const TerrainMesh = () => {
  const { nodes } = useGLTF('/models/mars_terrain.glb') as MarsTerrainGLTF
  const { setTerrainMesh } = useContext(TerrainHeightContext)
  const meshRef = useRef<THREE.Mesh>(null)

  const [colorMap, displacementMap] = useTexture([
    '/textures/mars_color.png',
    '/textures/mars_displacement.png',
  ])

  useMemo(() => {
    for (const tex of [colorMap, displacementMap]) {
      tex.wrapS = THREE.RepeatWrapping
      tex.wrapT = THREE.RepeatWrapping
      tex.repeat.set(4, 4)
      tex.needsUpdate = true
    }
  }, [colorMap, displacementMap])

  const terrainMesh = useMemo(() => {
    return Object.values(nodes).find(
      (n): n is THREE.Mesh => (n as THREE.Mesh).isMesh === true
    )
  }, [nodes])

  // Register terrain mesh in context so markers can raycast against it
  useEffect(() => {
    if (meshRef.current) {
      setTerrainMesh(meshRef.current)
    }
    return () => setTerrainMesh(null)
  }, [setTerrainMesh, terrainMesh])

  if (!terrainMesh) return null

  return (
    <mesh
      ref={meshRef}
      geometry={terrainMesh.geometry}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial
        map={colorMap}
        displacementMap={displacementMap}
        displacementScale={0}
        roughness={0.92}
        metalness={0.05}
        envMapIntensity={0.3}
      />
    </mesh>
  )
}

useGLTF.preload('/models/mars_terrain.glb')

export default TerrainMesh
