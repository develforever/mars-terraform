import { Suspense, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, GizmoHelper, GizmoViewport, Html, useProgress } from '@react-three/drei'
import { useMapEditorStore } from '../../../application/store/useMapEditorStore'
import HexTerrain from './viewport/HexTerrain'
import SmoothTerrain from './viewport/SmoothTerrain'
import HexGridLines from './viewport/HexGridLines'
import HexInteraction from './viewport/HexInteraction'
import BuildNodeMarkers from './viewport/BuildNodeMarkers'
import ResourceNodeMarkers from './viewport/ResourceNodeMarkers'
import SpawnPointMarkers from './viewport/SpawnPointMarkers'
import DecorMarkers from './viewport/DecorMarkers'
import Minimap from './viewport/Minimap'
import GeneratorPostFX from './viewport/GeneratorPostFX'
import { CineonToneMapping } from 'three'

// ─── Loading overlay ──────────────────────────────────────────────────────────

const Loader = () => {
  const { progress } = useProgress()
  return (
    <Html center>
      <div className="flex flex-col items-center gap-2 text-[#ec7063]">
        <div className="w-32 h-1 bg-zinc-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#e74c3c] transition-all duration-200"
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
    {/* Spójne z MarsStartScene (strona główna) */}
    <ambientLight intensity={0.30} color="#ffffff" />
    <directionalLight
      position={[40, 70, 25]}
      intensity={1.45}
      color="#ffeedd"
      castShadow
      shadow-mapSize={[2048, 2048]}
      shadow-camera-near={1}
      shadow-camera-far={300}
      shadow-camera-left={-80}
      shadow-camera-right={80}
      shadow-camera-top={80}
      shadow-camera-bottom={-80}
    />
    {/* Chłodny fill kosmosu — jak na stronie głównej */}
    <directionalLight position={[-30, -10, -20]} intensity={0.4} color="#445588" />
    <hemisphereLight args={['#7a4a36', '#1a0f0a', 0.35]} />
  </>
)

// ─── Viewport ─────────────────────────────────────────────────────────────────

const GeneratorViewport = () => {
  const showGrid      = useMapEditorStore(s => s.showGrid)
  const activeTool    = useMapEditorStore(s => s.activeTool)
  const isPreviewMode = useMapEditorStore(s => s.isPreviewMode)
  const generateHexGrid = useMapEditorStore(s => s.generateHexGrid)
  const hexGrid       = useMapEditorStore(s => s.hexGrid)
  const orbitEnabled  = activeTool === 'select'

  useEffect(() => {
    if (!hexGrid) generateHexGrid()
  }, [hexGrid, generateHexGrid])

  return (
    <div className="relative w-full h-full bg-zinc-950" style={{ cursor: orbitEnabled ? 'default' : 'crosshair' }}>
      <Canvas
        camera={{ position: [0, 70, 65], fov: 45, near: 0.1, far: 1000 }}
        shadows={false}
        gl={{ antialias: true, toneMapping: CineonToneMapping, toneMappingExposure: 0.92 }}
        onCreated={({ gl }) => { gl.toneMappingExposure = 0.92 }}
      >
        <color attach="background" args={['#050308']} />
        <SceneLighting />

        <Suspense fallback={<Loader />}>
          {isPreviewMode ? <SmoothTerrain /> : <HexTerrain />}
        </Suspense>

        <HexInteraction />
        <BuildNodeMarkers />
        <ResourceNodeMarkers />
        <SpawnPointMarkers />
        <DecorMarkers />

        {showGrid && <HexGridLines />}

        <OrbitControls
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI / 2.35}
          minDistance={25}
          maxDistance={140}
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

        {isPreviewMode && <GeneratorPostFX />}
      </Canvas>
      <Minimap />
    </div>
  )
}

export default GeneratorViewport
