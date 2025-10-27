import './Hud.scss';

export function Hud() {
  return (
    <div className="hud-container">
      <div className="resource-bar">
        <span>⚡ Energia: 1000</span>
        <span>💧 Woda: 500</span>
        <span>💨 Tlen: 21%</span>
      </div>
      <div className="build-menu">
        {/* Tu w przyszłości przyciski do budowania */}
        <button>Buduj</button>
      </div>
    </div>
  );
}