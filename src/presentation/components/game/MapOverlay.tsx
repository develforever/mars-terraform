import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { useMapConfigStore } from '../../../application/store/useMapConfigStore'

// ─── Resource colors ──────────────────────────────────────────────────────────

const RESOURCE_COLORS: Record<string, string> = {
  minerals: '#ff6600',
  ice:      '#88ddff',
  organics: '#66ff44',
  energy:   '#ffee00',
}

const RESOURCE_ICONS: Record<string, string> = {
  minerals: '⛏',
  ice:      '🧊',
  organics: '🌿',
  energy:   '⚡',
}

const PLAYER_COLORS = ['#4488ff', '#ff4444', '#44ff88', '#ffaa00']

// ─── MapOverlay ───────────────────────────────────────────────────────────────
// Renders build zones, resource markers and spawn points from loaded map JSON.
// Place this inside the r3f Canvas in Scene3D.

const MapOverlay = () => {
  const { loaded, buildNodes, resourceNodes, spawnPoints } = useMapConfigStore()

  if (!loaded) return null

  return (
    <>
      {/* Build node zones */}
      {buildNodes.map(node => {
        const [tx, tz] = node.pos
        const [fw, fh] = node.footprint
        const wx = tx - 100 / 2 + fw / 2
        const wz = tz - 100 / 2 + fh / 2

        return (
          <group key={node.id} position={[wx, 0.1, wz]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[fw * 0.95, fh * 0.95]} />
              <meshBasicMaterial
                color="#00ff88"
                transparent
                opacity={0.12}
                depthWrite={false}
                side={THREE.DoubleSide}
              />
            </mesh>
            <Html position={[0, 0.5, 0]} center distanceFactor={80} occlude={false}>
              <div className="px-1 py-0.5 rounded text-xs font-mono pointer-events-none bg-zinc-900/70 text-green-400 border border-green-900 whitespace-nowrap">
                🏗 {node.allowedTypes[0]}
              </div>
            </Html>
          </group>
        )
      })}

      {/* Resource node markers */}
      {resourceNodes.map(node => {
        const [tx, tz] = node.pos
        const wx = tx - 100 / 2 + 0.5
        const wz = tz - 100 / 2 + 0.5
        const color = RESOURCE_COLORS[node.type] ?? '#ffffff'

        return (
          <group key={node.id} position={[wx, 0, wz]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}>
              <ringGeometry args={[0.3, 0.6, 12]} />
              <meshBasicMaterial
                color={color}
                transparent
                opacity={0.5}
                depthWrite={false}
                side={THREE.DoubleSide}
              />
            </mesh>
            <Html position={[0, 1.2, 0]} center distanceFactor={80} occlude={false}>
              <div className="px-1 py-0.5 rounded text-xs font-mono pointer-events-none bg-zinc-900/70 text-zinc-200 whitespace-nowrap">
                {RESOURCE_ICONS[node.type]} {node.amount}
              </div>
            </Html>
          </group>
        )
      })}

      {/* Spawn points */}
      {spawnPoints.map(spawn => {
        const [tx, tz] = spawn.pos
        const wx = tx - 100 / 2 + 0.5
        const wz = tz - 100 / 2 + 0.5
        const color = PLAYER_COLORS[(spawn.player - 1) % 4]

        return (
          <group key={spawn.player} position={[wx, 0, wz]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}>
              <circleGeometry args={[1.5, 16]} />
              <meshBasicMaterial
                color={color}
                transparent
                opacity={0.2}
                depthWrite={false}
                side={THREE.DoubleSide}
              />
            </mesh>
            <Html position={[0, 2, 0]} center distanceFactor={80} occlude={false}>
              <div
                className="px-1.5 py-0.5 rounded text-xs font-bold font-mono pointer-events-none whitespace-nowrap"
                style={{ backgroundColor: color + 'cc', color: '#fff' }}
              >
                🚩 P{spawn.player}
              </div>
            </Html>
          </group>
        )
      })}
    </>
  )
}

export default MapOverlay
