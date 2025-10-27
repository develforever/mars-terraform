import { Hud } from './components/Hud';
import { Scene } from './components/Scene';
import './App.scss'; // Importujemy style

function App() {
  return (
    // Główny kontener gry
    <div className="game-container">
      {/* Renderujemy Scenę 3D (Canvas) jako tło.
        Zajmie całą dostępną przestrzeń.
      */}
      <Scene />
      
      {/* Renderujemy Interfejs Użytkownika (HUD) "NA" scenie.
        Dzięki stylowi CSS (position: absolute) HUD nałoży się na canvas.
      */}
      <Hud />
    </div>
  );
}

export default App;