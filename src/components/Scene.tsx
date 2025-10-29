import { OrbitControls, Grid } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { MarsTerrain } from './MarsTerrain'; // Importujemy nasz nowy komponent

export function Scene() {
  return (
    <Canvas
      className="main-canvas"
      camera={{ fov: 75, position: [0, 15, 20] }}
    >
      {/* Ustawiamy światło trochę mocniejsze dla tekstur */}
      <ambientLight intensity={0.3} />
      <directionalLight position={[10, 15, 5]} intensity={1.5} />

      {/* Nasz nowy, realistyczny teren Marsa */}
      <MarsTerrain />

      {/* Siatka (Grid)
        Podnosimy ją trochę wyżej (np. y=0.1), aby na pewno
        była widoczna ponad nierównościami terenu.
      */}
      <Grid
        position={[0, 0.1, 0]}
        args={[100, 100]}
        cellSize={1.0}
        cellColor="#cecece"
        sectionSize={5.0}
        sectionColor="#006eff"
        fadeDistance={50}
        infiniteGrid
      />

      {/* Kontrolki kamery - pozwól im operować bliżej terenu */}
      <OrbitControls 
        minDistance={5} // Minimalny zoom
        maxDistance={50} // Maksymalny zoom
        maxPolarAngle={Math.PI / 2.1} // Ogranicz kąt kamery, by nie patrzeć "pod" teren
      />
    </Canvas>
  );
}