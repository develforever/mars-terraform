import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, GizmoHelper, GizmoViewport, Html, useProgress } from '@react-three/drei'
import { useMapEditorStore } from '../../../application/store/useMapEditorStore'
import TerrainMesh from './viewport/TerrainMesh'
import GridOverlay from './viewport/GridOverlay'
import TileOverlay from './viewport/TileOverlay'
import BuildNodeMarkers from './viewport/BuildNodeMarkers'
import ResourceNodeMarkers from './viewport/ResourceNodeMarkers'
import SpawnPointMarkers from './viewport/SpawnPointMarkers'
import DecorMarkers from './viewport/DecorMarkers'
import Minimap from './viewport/Minimap'
import { TerrainHeightContext, useTerrainHeightProvider } from '../hooks/useTerrainHeight'

// ─── Loading overlay ──────────────────────────────────────────────────────────

const Loader = () => {
  const { progress } = useProgress()
  return (
    <Html center>
      <div className="flex flex-col items-center gap-2 text-orange-400">
        <div className="w-32 h-1 bg-zinc-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-orange-500 transition-all duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-xs font-mono">{Math.round(progress)}%</span>
      </div>
    </Html>
  )
}

// ─── Scene lighting matching Blender Sun_Mars ─────────────────────────────────

const SceneLighting = () => (
  <>
    <ambientLight intensity={0.25} color="#ffddcc" />
    <directionalLight
      position={[30, 60, 30]}
      intensity={2}
      color="#fff5e0"
      castShadow
      shadow-mapSize={[2048, 2048]}
      shadow-camera-near={1}
      shadow-camera-far={300}
      shadow-camera-left={-60}
      shadow-camera-right={60}
      shadow-camera-top={60}
      shadow-camera-bottom={-60}
    />
    {/* Subtle fill light from below for crater depth */}
    <hemisphereLight args={['#c1440e', '#1a0a00', 0.15]} />
  </>
)

// ─── Viewport ─────────────────────────────────────────────────────────────────

const GeneratorViewport = () => {
  const showGrid = useMapEditorStore(s => s.showGrid)
  const activeTool = useMapEditorStore(s => s.activeTool)
  const terrainHeightCtx = useTerrainHeightProvider()
  const orbitEnabled = activeTool === 'select'

  return (
    <div className="relative w-full h-full bg-zinc-950" style={{ cursor: orbitEnabled ? 'default' : 'crosshair' }}>
      <Canvas
        camera={{ position: [0, 70, 70], fov: 50, near: 0.1, far: 1000 }}
        shadows
        gl={{ antialias: true, toneMapping: 2 }}
        onCreated={({ gl }) => { gl.toneMappingExposure = 1.2 }}
      >
        <TerrainHeightContext.Provider value={terrainHeightCtx}>
        <SceneLighting />

          <Suspense fallback={<Loader />}>
            <TerrainMesh />
          </Suspense>

          <TileOverlay />
          <BuildNodeMarkers />
          <ResourceNodeMarkers />
          <SpawnPointMarkers />
          <DecorMarkers />

          {showGrid && <GridOverlay />}

          <OrbitControls
            maxPolarAngle={Math.PI / 2.1}
            minDistance={15}
            maxDistance={160}
            target={[0, 0, 0]}
            enableDamping
            dampingFactor={0.08}
            enabled={orbitEnabled}
          />

          <GizmoHelper alignment="bottom-right" margin={[60, 60]}>
            <GizmoViewport
              axisColors={['#ff4444', '#44ff44', '#4488ff']}
              labelColor="white"
            />
          </GizmoHelper>
        </TerrainHeightContext.Provider>
      </Canvas>
      <Minimap />
    </div>
  )
}

export default GeneratorViewport
