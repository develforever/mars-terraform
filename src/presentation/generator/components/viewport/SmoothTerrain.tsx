import { forwardRef, useEffect, useMemo, useRef } from 'react'
import { useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { RepeatWrapping, SRGBColorSpace, MathUtils, type Mesh } from 'three'
import { useMapEditorStore } from '../../../../application/store/useMapEditorStore'
import { useGameStore } from '../../../../application/store/useGameStore'
import { buildSmoothTerrainGeometry } from '../../terrain/TerrainMeshBuilder'
import { buildCliffGeometry } from '../../terrain/CliffBuilder'
import { createSlopeMaterial } from '../../terrain/SlopeMaterial'
import { TerraformingService } from '../../../../domain/services/TerraformingService'
import type { HexGrid } from '../../hex/HexGrid'

export interface SmoothTerrainProps {
  hexGrid?: HexGrid | null
}

const SmoothTerrain = forwardRef<Mesh, SmoothTerrainProps>(
  ({ hexGrid: propHexGrid }, ref) => {
    const editorHexGrid = useMapEditorStore(s => s.hexGrid)
    const hexGrid = propHexGrid ?? editorHexGrid

    const terraforming = useGameStore(s => s.terraforming)
    const o2Accumulated = useGameStore(s => s.o2Accumulated)
    const difficulty = useGameStore(s => s.difficulty)
    const waterLevel = useGameStore(s => s.waterLevel)

    const targetBiosphere = useMemo(() => {
      if (terraforming === undefined) return 0
      return TerraformingService.calculateGlobalBiosphereSuitability(
        o2Accumulated ?? 0,
        terraforming ?? 0,
        difficulty ?? 'normal'
      )
    }, [o2Accumulated, terraforming, difficulty])

    const currentBiosphereRef = useRef<number>(targetBiosphere)
    const currentWaterLevelRef = useRef<number>(waterLevel ?? -0.5)

    const cells = useMemo(() => hexGrid?.getAllCells() ?? [], [hexGrid])

    const terrainGeo = useMemo(() =>
      cells.length > 0 ? buildSmoothTerrainGeometry(cells) : null,
      [cells]
    )

    const cliffGeo = useMemo(() =>
      cells.length > 0 ? buildCliffGeometry(cells) : null,
      [cells]
    )

    // Baza albedo = prawdziwa tekstura Marsa (spojnosc z rozgrywka i strona glowna)
    const baseTex = useTexture('/textures/2k_mars.jpg')
    useMemo(() => {
      baseTex.wrapS = baseTex.wrapT = RepeatWrapping
      baseTex.colorSpace = SRGBColorSpace
    }, [baseTex])

    const terrainMat = useMemo(() =>
      createSlopeMaterial({
        baseTexture: baseTex,
        triScale: 0.2,
      }),
      [baseTex]
    )

    useEffect(() => {
      return () => {
        terrainGeo?.dispose()
        cliffGeo?.dispose()
        terrainMat.dispose()
      }
    }, [terrainGeo, cliffGeo, terrainMat])

    useFrame((_, delta) => {
      currentBiosphereRef.current = MathUtils.damp(
        currentBiosphereRef.current,
        targetBiosphere,
        2.5,
        delta
      )
      currentWaterLevelRef.current = MathUtils.damp(
        currentWaterLevelRef.current,
        waterLevel ?? -0.5,
        2.5,
        delta
      )

      if (terrainMat.userData.uniforms) {
        if (terrainMat.userData.uniforms.uBiosphere) {
          terrainMat.userData.uniforms.uBiosphere.value = currentBiosphereRef.current
        }
        if (terrainMat.userData.uniforms.uWaterLevel) {
          terrainMat.userData.uniforms.uWaterLevel.value = currentWaterLevelRef.current
        }
      }
    })

    if (!terrainGeo) return null

    return (
      <>
        <mesh ref={ref} geometry={terrainGeo} material={terrainMat} receiveShadow castShadow />
        {cliffGeo && (
          <mesh geometry={cliffGeo} material={terrainMat} receiveShadow castShadow />
        )}
      </>
    )
  }
)

SmoothTerrain.displayName = 'SmoothTerrain'

export { SmoothTerrain }
export default SmoothTerrain
