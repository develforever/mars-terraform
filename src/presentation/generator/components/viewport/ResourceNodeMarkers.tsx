import { useRef } from 'react'
import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useMapEditorStore } from '../../../../application/store/useMapEditorStore'
import { useTerrainHeight } from '../../hooks/useTerrainHeight'
import type { ResourceType } from '../../../../domain/mapEditorTypes'

const RESOURCE_COLORS: Record<ResourceType, string> = {
  minerals: '#ff6600',
  ice:      '#88ddff',
  organics: '#66ff44',
  energy:   '#ffee00',
}

const RESOURCE_ICONS: Record<ResourceType, string> = {
  minerals: '⛏',
  ice:      '🧊',
  organics: '🌿',
  energy:   '⚡',
}

// Floating animated marker
const ResourceMarker = ({ nodeId }: { nodeId: string }) => {
  const node = useMapEditorStore(s => s.resourceNodes.find(n => n.id === nodeId))
  const selectedNodeId = useMapEditorStore(s => s.selectedNodeId)
  const setSelectedNodeId = useMapEditorStore(s => s.setSelectedNodeId)
  const removeResourceNode = useMapEditorStore(s => s.removeResourceNode)
  const activeTool = useMapEditorStore(s => s.activeTool)
  const getHeight = useTerrainHeight()

  const groupRef = useRef<THREE.Group>(null)
  const t = useRef(Math.random() * Math.PI * 2)

  useFrame((_, delta) => {
    if (!groupRef.current) return
    t.current += delta * 1.2
    groupRef.current.position.y = 1.5 + Math.sin(t.current) * 0.15
    groupRef.current.rotation.y += delta * 0.8
  })

  if (!node) return null

  const [tx, tz] = node.pos
  const wx = tx - 100 / 2 + 0.5
  const wz = tz - 100 / 2 + 0.5
  const wy = getHeight(wx, wz)
  const color = RESOURCE_COLORS[node.type]
  const isSelected = selectedNodeId === node.id

  return (
    <group position={[wx, wy, wz]}>
      {/* Floating cube */}
      <group ref={groupRef} position={[0, 1.5, 0]}>
        <mesh
          onClick={e => {
            e.stopPropagation()
            if (activeTool === 'select') {
              setSelectedNodeId(isSelected ? null : node.id)
            } else if (activeTool === 'erase') {
              removeResourceNode(node.id)
            }
          }}
        >
          <boxGeometry args={[0.6, 0.6, 0.6]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={isSelected ? 0.8 : 0.3}
            roughness={0.3}
            metalness={0.6}
          />
        </mesh>
      </group>

      {/* Ground glow ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.09, 0]}>
        <ringGeometry args={[0.4, 0.7, 16]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={isSelected ? 0.5 : 0.25}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Label */}
      <Html position={[0, 3, 0]} center distanceFactor={60} occlude={false}>
        <div
          className={`px-1.5 py-0.5 rounded text-xs font-mono whitespace-nowrap pointer-events-none
            ${isSelected ? 'text-white' : 'text-zinc-200 border border-zinc-600'}
          `}
          style={{
            backgroundColor: isSelected ? color + 'dd' : '#18181bcc',
          }}
        >
          {RESOURCE_ICONS[node.type]} {node.type} · {node.amount}
        </div>
      </Html>
    </group>
  )
}

const ResourceNodeMarkers = () => {
  const resourceNodes = useMapEditorStore(s => s.resourceNodes)
  return (
    <>
      {resourceNodes.map(n => (
        <ResourceMarker key={n.id} nodeId={n.id} />
      ))}
    </>
  )
}

export default ResourceNodeMarkers
