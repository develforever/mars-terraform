import { useMemo } from 'react'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { useMapEditorStore } from '../../../../application/store/useMapEditorStore'
import { useTerrainHeight } from '../../hooks/useTerrainHeight'

const FOOTPRINT_COLORS: Record<string, string> = {
  colony:           '#00ff88',
  oxygen_generator: '#44ffcc',
  greenhouse:       '#88ff44',
  solar_power:      '#ffff44',
  extractor:        '#ff8844',
}

const BuildNodeMarkers = () => {
  const buildNodes = useMapEditorStore(s => s.buildNodes)
  const selectedNodeId = useMapEditorStore(s => s.selectedNodeId)
  const setSelectedNodeId = useMapEditorStore(s => s.setSelectedNodeId)
  const removeBuildNode = useMapEditorStore(s => s.removeBuildNode)
  const activeTool = useMapEditorStore(s => s.activeTool)
  const getHeight = useTerrainHeight()

  return (
    <>
      {buildNodes.map(node => {
        const [tx, tz] = node.pos
        const [fw, fh] = node.footprint
        const wx = tx - 100 / 2 + fw / 2
        const wz = tz - 100 / 2 + fh / 2
        const wy = getHeight(wx, wz)
        const isSelected = selectedNodeId === node.id
        const color = FOOTPRINT_COLORS[node.allowedTypes[0]] ?? '#00ff88'

        return (
          <group key={node.id} position={[wx, wy, wz]}>
            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              position={[0, 0.12, 0]}
              onClick={e => {
                e.stopPropagation()
                if (activeTool === 'select') setSelectedNodeId(isSelected ? null : node.id)
                else if (activeTool === 'erase') removeBuildNode(node.id)
              }}
            >
              <planeGeometry args={[fw * 0.96, fh * 0.96]} />
              <meshBasicMaterial color={color} transparent opacity={isSelected ? 0.6 : 0.3}
                depthWrite={false} side={THREE.DoubleSide} />
            </mesh>

            <lineSegments position={[0, 0.14, 0]}>
              <edgesGeometry args={[new THREE.BoxGeometry(fw * 0.96, 0.01, fh * 0.96)]} />
              <lineBasicMaterial color={color} transparent opacity={isSelected ? 1 : 0.6} />
            </lineSegments>

            <Html position={[0, 1.8, 0]} center distanceFactor={60} occlude={false}>
              <div className={`px-1.5 py-0.5 rounded text-xs font-mono whitespace-nowrap pointer-events-none
                ${isSelected ? 'bg-green-500 text-white' : 'bg-zinc-900/80 text-green-400 border border-green-700'}`}>
                🏗 {node.id}
              </div>
            </Html>
          </group>
        )
      })}
    </>
  )
}

export default BuildNodeMarkers
