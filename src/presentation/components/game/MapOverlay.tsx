import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { useGameStore } from '../../../application/store/useGameStore'
import { hexToWorld } from '../../generator/hex/HexMath'
import { useTerrainHeight } from './TerrainHeightContext'

const PLAYER_COLORS = ['#4488ff', '#ff4444', '#44ff88', '#ffaa00']

/**
 * MapOverlay renders build node hints and player spawn markers on hex grid.
 */
export const MapOverlay = () => {
  const currentMapData = useGameStore((s) => s.currentMapData)
  const getTerrainY = useTerrainHeight()

  const buildNodes = currentMapData?.buildNodes ?? []
  const spawnPoints = currentMapData?.spawnPoints ?? (currentMapData as unknown as { playerSpawns?: { player: number; pos: [number, number] }[] })?.playerSpawns ?? []

  if (buildNodes.length === 0 && spawnPoints.length === 0) return null

  return (
    <>
      {/* Build node zones */}
      {buildNodes.map((node) => {
        const [q, r] = node.pos
        const [wx, wz] = hexToWorld(q, r)
        const wy = getTerrainY(wx, wz)

        return (
          <group key={node.id} position={[wx, wy + 0.08, wz]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.5, 1.1, 16]} />
              <meshBasicMaterial
                color="#00ff88"
                transparent
                opacity={0.2}
                depthWrite={false}
                side={THREE.DoubleSide}
              />
            </mesh>
            <Html position={[0, 0.8, 0]} center distanceFactor={80} occlude={false}>
              <div className="px-1.5 py-0.5 rounded text-[11px] font-mono pointer-events-none bg-zinc-950/80 text-emerald-300 border border-emerald-500/50 whitespace-nowrap shadow-lg">
                🏗 {node.allowedTypes?.[0] ?? 'build'}
              </div>
            </Html>
          </group>
        )
      })}

      {/* Spawn points markers */}
      {spawnPoints.map((spawn, idx) => {
        const pos = Array.isArray(spawn) ? spawn : spawn.pos
        if (!pos) return null
        const [q, r] = pos
        const [wx, wz] = hexToWorld(q, r)
        const wy = getTerrainY(wx, wz)
        const playerNum = typeof spawn === 'object' && 'player' in spawn ? (spawn as { player: number }).player : idx + 1
        const color = PLAYER_COLORS[(playerNum - 1) % 4]

        return (
          <group key={`spawn-${playerNum}-${q}-${r}`} position={[wx, wy + 0.08, wz]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[1.2, 16]} />
              <meshBasicMaterial
                color={color}
                transparent
                opacity={0.25}
                depthWrite={false}
                side={THREE.DoubleSide}
              />
            </mesh>
            <Html position={[0, 1.8, 0]} center distanceFactor={80} occlude={false}>
              <div
                className="px-1.5 py-0.5 rounded text-xs font-bold font-mono pointer-events-none whitespace-nowrap shadow-lg"
                style={{ backgroundColor: color + 'dd', color: '#fff' }}
              >
                🚩 P{playerNum}
              </div>
            </Html>
          </group>
        )
      })}
    </>
  )
}

export default MapOverlay

