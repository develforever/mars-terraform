import { useMapEditorStore } from '../../../../application/store/useMapEditorStore'
import { hexToWorld } from '../../hex/HexMath'
import { useHexHeight } from '../../hooks/useHexHeight'
import { DecorMesh } from './DecorMeshes'

const DecorMarkers = () => {
  const decor = useMapEditorStore(s => s.decor)
  const getHeight = useHexHeight()

  return (
    <>
      {decor.map((item, i) => {
        const [q, r] = item.pos
        const [wx, wz] = hexToWorld(q, r)
        const wy = getHeight(q, r)
        return (
          <group key={i} position={[wx, wy, wz]}>
            <DecorMesh model={item.model} scale={item.scale * 1.8} rot={item.rot} />
          </group>
        )
      })}
    </>
  )
}

export default DecorMarkers
