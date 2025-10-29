import { useTexture } from '@react-three/drei';
import { RepeatWrapping } from 'three';

export function MarsTerrain() {
  // Ładujemy tekstury z folderu /public
  // Używamy useTexture z 'drei' - to ułatwia ładowanie
  const [colorMap, displacementMap] = useTexture([
    '/textures/mars_color.png',
    '/textures/mars_displacement.png',
  ]);

  // Chcemy, aby tekstury się powtarzały (kafelkowały)
  [colorMap, displacementMap].forEach((texture) => {
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.repeat.set(1, 1); // Powtórz teksturę 10x10 razy na powierzchni
  });

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0, 0]}
    >
      {/* Kluczowe: Aby mapa wysokości działała, geometria musi mieć 
        BARDZO DUŻO segmentów (wierzchołków) do przesuwania.
        Zamiast 1x1, dajemy 256x256.
      */}
      <planeGeometry args={[100, 100, 256, 256]} />
      
      <meshStandardMaterial
        map={colorMap} // Tekstura koloru
        displacementMap={displacementMap} // Tekstura wysokości
        displacementScale={1.0} // Jak "wysokie" mają być góry (dostosuj wg potrzeb)
        roughness={1} // Mars jest matowy
        metalness={0} // Nie jest metaliczny
      />
    </mesh>
  );
}