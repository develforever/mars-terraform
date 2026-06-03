import { useMemo } from 'react'
import * as THREE from 'three'
import { useMapEditorStore } from '../../../../application/store/useMapEditorStore'
import { useTerrainHeight } from '../../hooks/useTerrainHeight'

// Simple procedural rock mesh using scaled icosahedron
const RockMesh = ({ scale, rot }: { scale: number; rot: number }) => {
  const geometry = useMemo(() => {
    const geo = new THREE.IcosahedronGeometry(0.5, 0)
    // Randomize vertices slightly for organic look
    const pos = geo.attributes.position
    for (let i = 0; i < pos.count; i++) {
      pos.setXYZ(
        i,
        pos.getX(i) * (0.8 + Math.sin(i * 7.3) * 0.25),
        pos.getY(i) * (0.6 + Math.sin(i * 3.1) * 0.3),
        pos.getZ(i) * (0.8 + Math.sin(i * 5.7) * 0.25),
      )
    }
    geo.computeVertexNormals()
    return geo
  }, [])

  return (
    <mesh
      geometry={geometry}
      rotation={[0.2, rot, 0.1]}
      scale={[scale, scale * 0.7, scale]}
      position={[0, scale * 0.25, 0]}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial
        color="#6b4c32"
        roughness={0.95}
        metalness={0.05}
      />
    </mesh>
  )
}

const DecorMarkers = () => {
  const decor = useMapEditorStore(s => s.decor)
  const getHeight = useTerrainHeight()

  return (
    <>
      {decor.map((item, i) => {
        const [tx, tz] = item.pos
        const wx = tx - 100 / 2 + 0.5
        const wz = tz - 100 / 2 + 0.5
        const wy = getHeight(wx, wz)
        return (
          <group key={i} position={[wx, wy, wz]}>
            <RockMesh scale={item.scale} rot={item.rot} />
          </group>
        )
      })}
    </>
  )
}

export default DecorMarkers
