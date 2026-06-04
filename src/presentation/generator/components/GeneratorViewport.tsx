import { Suspense, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, GizmoHelper, GizmoViewport, Html, useProgress } from '@react-three/drei'
import { useMapEditorStore } from '../../../application/store/useMapEditorStore'
import HexTerrain from './viewport/HexTerrain'
import HexGridLines from './viewport/HexGridLines'
import TileOverlay from './viewport/TileOverlay'
import BuildNodeMarkers from './viewport/BuildNodeMarkers'
import ResourceNodeMarkers from './viewport/ResourceNodeMarkers'
import SpawnPointMarkers from './viewport/SpawnPointMarkers'
import DecorMarkers from './viewport/DecorMarkers'
import Minimap from './viewport/Minimap'
import { TerrainHeightContext, useTerrainHeightProvider } from '../hooks/useTerrainHeight'
import { CineonToneMapping } from 'three'

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

// ─── Scene lighting ───────────────────────────────────────────────────────────

const SceneLighting = () => (
  <>
    <ambientLight intensity={0.6} color="#ffddcc" />
    <directionalLight
      position={[30, 60, 30]}
      intensity={2.5}
      color="#fff5e0"
      castShadow
      shadow-mapSize={[2048, 2048]}
      shadow-camera-near={1}
      shadow-camera-far={300}
      shadow-camera-left={-80}
      shadow-camera-right={80}
      shadow-camera-top={80}
      shadow-camera-bottom={-80}
    />
    <directionalLight position={[-20, 30, -20]} intensity={0.8} color="#ff8844" />
    <hemisphereLight args={['#ffaa66', '#3d1f0a', 0.4]} />
  </>
)

// ─── Viewport ─────────────────────────────────────────────────────────────────

const GeneratorViewport = () => {
  const showGrid = useMapEditorStore(s => s.showGrid)
  const activeTool = useMapEditorStore(s => s.activeTool)
  const generateHexGrid = useMapEditorStore(s => s.generateHexGrid)
  const hexGrid = useMapEditorStore(s => s.hexGrid)
  const terrainHeightCtx = useTerrainHeightProvider()
  const orbitEnabled = activeTool === 'select'

  // Generate hex grid on mount if not already done
  useEffect(() => {
    if (!hexGrid) generateHexGrid()
  }, [])

  return (
    <div className="relative w-full h-full bg-zinc-950" style={{ cursor: orbitEnabled ? 'default' : 'crosshair' }}>
      <Canvas
        camera={{ position: [0, 70, 65], fov: 45, near: 0.1, far: 1000 }}
        shadows={false}
        gl={{ antialias: true, toneMapping: CineonToneMapping, toneMappingExposure: 1.97 }}
        onCreated={({ gl }) => { gl.toneMappingExposure = 1.0 }}
      >
        <TerrainHeightContext.Provider value={terrainHeightCtx}>
          <SceneLighting />

          <Suspense fallback={<Loader />}>
            <HexTerrain />
          </Suspense>

          <TileOverlay />
          <BuildNodeMarkers />
          <ResourceNodeMarkers />
          <SpawnPointMarkers />
          <DecorMarkers />

          {showGrid && <HexGridLines />}

          {/* <OrbitControls
            minPolarAngle={Math.PI / 6}
            maxPolarAngle={Math.PI / 2.35}
            minDistance={25}
            maxDistance={140}
            target={[0, 2, 0]}
            enablePan={false}
            enableDamping
            dampingFactor={0.08}
            enabled={orbitEnabled}
          /> */}

          <OrbitControls
            target={[0, 2, 0]}
            enablePan={false}
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
