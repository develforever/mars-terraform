import { useRef, useMemo } from 'react'
import * as THREE from 'three'

interface GridOverlayProps {
  size?: number
  divisions?: number
}

const GridOverlay = ({ size = 100, divisions = 100 }: GridOverlayProps) => {
  const ref = useRef<THREE.LineSegments>(null)

  const geometry = useMemo(() => {
    const points: number[] = []
    const half = size / 2
    const step = size / divisions

    // Vertical lines (along Z)
    for (let i = 0; i <= divisions; i++) {
      const x = -half + i * step
      points.push(x, 0, -half, x, 0, half)
    }
    // Horizontal lines (along X)
    for (let i = 0; i <= divisions; i++) {
      const z = -half + i * step
      points.push(-half, 0, z, half, 0, z)
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
    return geo
  }, [size, divisions])

  const material = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: '#3a2010',
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
      }),
    []
  )

  return <lineSegments ref={ref} geometry={geometry} material={material} position={[0, 0.06, 0]} />
}

export default GridOverlay
