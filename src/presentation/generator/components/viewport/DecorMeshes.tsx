/**
 * DecorMeshes.tsx
 *
 * Proceduralne low-poly meshe dekoracji (flat shading, pod stepowy styl mapy).
 * Docelowo mozna podmienic na modele .glb z Blendera (ten sam klucz `model`).
 */

import { Suspense, useMemo, useEffect } from 'react'
import * as THREE from 'three'
import { Detailed, useGLTF } from '@react-three/drei'
import { POI_MODEL_PATHS, POI_LOD_MODEL_PATHS, getLOD1Path } from './decorConstants'

// Czysta, fasetowana skala (lekka nieregularnosc — bez kolcow)
function makeRockGeo(detail: number, squash: number, seed: number): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(0.5, detail)
  const pos = g.attributes.position
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    const h = Math.sin((v.x + seed) * 3.1) * Math.cos((v.z - seed) * 2.7)
    v.multiplyScalar(1 + h * 0.12)
    v.y *= squash
    pos.setXYZ(i, v.x, v.y, v.z)
  }
  g.computeVertexNormals()
  return g
}

const Rock = ({ scale, rot }: { scale: number; rot: number }) => {
  const geo = useMemo(() => makeRockGeo(0, 0.72, 1.3), [])
  useEffect(() => {
    return () => {
      geo.dispose()
    }
  }, [geo])
  return (
    <mesh geometry={geo} rotation={[0.12, rot, 0.05]} scale={scale * 0.6}
      position={[0, scale * 0.6 * 0.36, 0]} castShadow receiveShadow>
      <meshStandardMaterial color="#6b4a3a" roughness={0.96} metalness={0.04} flatShading />
    </mesh>
  )
}

const Boulder = ({ scale, rot }: { scale: number; rot: number }) => {
  const geo = useMemo(() => makeRockGeo(1, 0.85, 1.7), [])
  useEffect(() => {
    return () => {
      geo.dispose()
    }
  }, [geo])
  return (
    <mesh geometry={geo} rotation={[0.08, rot, 0.04]} scale={scale * 0.95}
      position={[0, scale * 0.95 * 0.42, 0]} castShadow receiveShadow>
      <meshStandardMaterial color="#5e4636" roughness={0.97} metalness={0.03} flatShading />
    </mesh>
  )
}

const Stones = ({ scale, rot }: { scale: number; rot: number }) => {
  const geos = useMemo(() => [makeRockGeo(0, 0.7, 0.5), makeRockGeo(0, 0.7, 2.1), makeRockGeo(0, 0.7, 3.3)], [])
  useEffect(() => {
    return () => {
      geos.forEach((g) => g.dispose())
    }
  }, [geos])
  const items = [
    { p: [0, 0] as const, s: 0.5, r: 0.0 },
    { p: [0.24, 0.08] as const, s: 0.32, r: 1.2 },
    { p: [-0.18, 0.2] as const, s: 0.38, r: 2.4 },
  ]
  return (
    <group rotation={[0, rot, 0]} scale={scale}>
      {items.map((it, i) => (
        <mesh key={i} geometry={geos[i]} position={[it.p[0], it.s * 0.32, it.p[1]]}
          rotation={[0.1, it.r, 0.05]} scale={it.s} castShadow receiveShadow>
          <meshStandardMaterial color="#5a3f30" roughness={0.96} metalness={0.04} flatShading />
        </mesh>
      ))}
    </group>
  )
}

const Crystal = ({ scale, rot }: { scale: number; rot: number }) => {
  const shards = [
    { p: [0, 0] as const, s: 1.0, r: 0.0 },
    { p: [0.16, 0.1] as const, s: 0.6, r: 0.5 },
    { p: [-0.15, 0.12] as const, s: 0.7, r: -0.4 },
    { p: [0.05, -0.16] as const, s: 0.5, r: 0.8 },
  ]
  return (
    <group rotation={[0, rot, 0]} scale={scale}>
      {shards.map((sh, i) => (
        <mesh key={i} position={[sh.p[0], 0.22 * sh.s, sh.p[1]]} rotation={[0.08, sh.r, 0.05]}
          scale={[0.12, 0.5 * sh.s, 0.12]} castShadow>
          <octahedronGeometry args={[0.5, 0]} />
          <meshStandardMaterial color="#d98a4a" emissive="#a8531c" emissiveIntensity={0.4}
            roughness={0.35} metalness={0.1} flatShading />
        </mesh>
      ))}
    </group>
  )
}

const Wreck = ({ scale, rot }: { scale: number; rot: number }) => (
  <group rotation={[0, rot, 0]} scale={scale}>
    <mesh position={[0, 0.12, 0]} rotation={[0.2, 0.3, 0.1]} castShadow receiveShadow>
      <boxGeometry args={[0.5, 0.22, 0.32]} />
      <meshStandardMaterial color="#3a322e" roughness={0.7} metalness={0.5} flatShading />
    </mesh>
    <mesh position={[0.28, 0.08, 0.12]} rotation={[0.5, 0.8, 0.2]} castShadow>
      <cylinderGeometry args={[0.06, 0.085, 0.42, 6]} />
      <meshStandardMaterial color="#4a3f38" roughness={0.6} metalness={0.6} flatShading />
    </mesh>
    <mesh position={[-0.2, 0.05, -0.1]} rotation={[0.1, 0.4, 0.6]} castShadow>
      <boxGeometry args={[0.2, 0.1, 0.18]} />
      <meshStandardMaterial color="#332b28" roughness={0.7} metalness={0.5} flatShading />
    </mesh>
  </group>
)

// Preload POI models (LOD0 & LOD1)
if (typeof window !== 'undefined') {
  Object.values(POI_MODEL_PATHS).forEach((path) => {
    useGLTF.preload(path)
  })
  Object.values(POI_LOD_MODEL_PATHS).forEach((path) => {
    useGLTF.preload(path)
  })
}

const GLTFMeshLevel = ({ path }: { path: string }) => {
  const gltf = useGLTF(path) as { scene: THREE.Group }
  const sceneClone = useMemo(() => {
    const clone = gltf.scene.clone(true)
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true
        child.receiveShadow = true
      }
    })
    return clone
  }, [gltf.scene])

  return <primitive object={sceneClone} />
}

export const GLTFDecor = ({ path, lodPath, scale, rot }: { path: string; lodPath?: string | null; scale: number; rot: number }) => {
  return (
    <group rotation={[0, rot, 0]} scale={scale}>
      <Suspense fallback={null}>
        {lodPath ? (
          <Detailed distances={[0, 45]}>
            <GLTFMeshLevel path={path} />
            <GLTFMeshLevel path={lodPath} />
          </Detailed>
        ) : (
          <GLTFMeshLevel path={path} />
        )}
      </Suspense>
    </group>
  )
}

export const DecorMesh = ({ model, scale, rot }: { model: string; scale: number; rot: number }) => {
  if (model in POI_MODEL_PATHS) {
    const path = POI_MODEL_PATHS[model]
    const lodPath = getLOD1Path(model)
    return <GLTFDecor path={path} lodPath={lodPath} scale={scale} rot={rot} />
  }
  if (model.startsWith('/models/') || model.endsWith('.glb')) {
    const lodPath = getLOD1Path(model)
    return <GLTFDecor path={model} lodPath={lodPath} scale={scale} rot={rot} />
  }

  switch (model) {
    case 'rocks':   return <Stones  scale={scale} rot={rot} />
    case 'boulder': return <Boulder scale={scale} rot={rot} />
    case 'crystal': return <Crystal scale={scale} rot={rot} />
    case 'wreck':   return <Wreck   scale={scale} rot={rot} />
    case 'rock_01':
    default:        return <Rock    scale={scale} rot={rot} />
  }
}

