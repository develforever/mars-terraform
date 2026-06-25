/**
 * GeneratorPostFX.tsx
 *
 * Post-processing dla generatora — montowany TYLKO w trybie Preview.
 * Sam bloom (jak strona glowna, subtelniej): rozjasnia szczyty/szron i
 * jasne krawedzie, daje kinowy polysk bez psucia czytelnosci edycji.
 */

import { EffectComposer, Bloom } from '@react-three/postprocessing'

const GeneratorPostFX = () => (
  <EffectComposer>
    <Bloom
      intensity={0.9}
      luminanceThreshold={0.45}
      luminanceSmoothing={0.3}
      mipmapBlur
    />
  </EffectComposer>
)

export default GeneratorPostFX
