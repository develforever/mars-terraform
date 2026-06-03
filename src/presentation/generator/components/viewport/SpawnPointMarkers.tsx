import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { useMapEditorStore } from '../../../../application/store/useMapEditorStore'
import { useTerrainHeight } from '../../hooks/useTerrainHeight'

const PLAYER_COLORS = ['#4488ff', '#ff4444', '#44ff88', '#ffaa00']
const PLAYER_LABELS = ['P1', 'P2', 'P3', 'P4']

const SpawnPointMarkers = () => {
  const spawnPoints = useMapEditorStore(s => s.spawnPoints)
  const selectedNodeId = useMapEditorStore(s => s.selectedNodeId)
  const setSelectedNodeId = useMapEditorStore(s => s.setSelectedNodeId)
  const removeSpawnPoint = useMapEditorStore(s => s.removeSpawnPoint)
  const activeTool = useMapEditorStore(s => s.activeTool)

  const getHeight = useTerrainHeight()

  return (
    <>
      {spawnPoints.map(spawn => {
        const [tx, tz] = spawn.pos
        const wx = tx - 100 / 2 + 0.5
        const wz = tz - 100 / 2 + 0.5
        const wy = getHeight(wx, wz)
        const color = PLAYER_COLORS[(spawn.player - 1) % 4]
        const isSelected = selectedNodeId === `spawn-${spawn.player}`

        return (
          <group key={spawn.player} position={[wx, wy, wz]}>
            {/* Flag pole */}
            <mesh position={[0, 1.5, 0]}>
              <cylinderGeometry args={[0.05, 0.05, 3, 6]} />
              <meshStandardMaterial color="#888888" metalness={0.8} roughness={0.3} />
            </mesh>

            {/* Flag */}
            <mesh
              position={[0.4, 2.7, 0]}
              onClick={e => {
                e.stopPropagation()
                if (activeTool === 'select') {
                  setSelectedNodeId(isSelected ? null : `spawn-${spawn.player}`)
                } else if (activeTool === 'erase') {
                  removeSpawnPoint(spawn.player)
                }
              }}
            >
              <planeGeometry args={[0.8, 0.5]} />
              <meshBasicMaterial
                color={color}
                transparent
                opacity={isSelected ? 1 : 0.85}
                side={THREE.DoubleSide}
              />
            </mesh>

            {/* Base disc */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
              <circleGeometry args={[0.6, 16]} />
              <meshBasicMaterial
                color={color}
                transparent
                opacity={isSelected ? 0.5 : 0.25}
                depthWrite={false}
                side={THREE.DoubleSide}
              />
            </mesh>

            {/* Label */}
            <Html position={[0, 4, 0]} center distanceFactor={60} occlude={false}>
              <div
                className="px-2 py-0.5 rounded text-xs font-bold font-mono whitespace-nowrap pointer-events-none"
                style={{ backgroundColor: color + 'dd', color: '#fff' }}
              >
                🚩 {PLAYER_LABELS[(spawn.player - 1) % 4]}
              </div>
            </Html>
          </group>
        )
      })}
    </>
  )
}

export default SpawnPointMarkers
