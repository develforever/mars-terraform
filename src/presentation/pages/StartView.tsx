import { StartScene3D } from "../components/game/MarsStartScene";
import { usePageTitle } from "../hooks/usePageTitle";
import { useModalStore } from "../../ui/ModalManager/store";
import { WeatherAlert } from "../components/game/WeatherAlert";

export default function StartView() {
    usePageTitle("Start");

    const { open } = useModalStore();

    return (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <WeatherAlert />
            <button
                onClick={() => open("colony-name")}
                style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    padding: '16px 48px',
                    fontSize: '24px',
                    fontWeight: 'bold',
                    color: '#ffffff',
                    backgroundColor: '#e74c3c',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(231, 76, 60, 0.4)',
                    textTransform: 'uppercase',
                    letterSpacing: '2px',
                    zIndex: 10,
                    transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#c0392b';
                    e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1.05)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#e74c3c';
                    e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1)';
                }}
            >
                Start Game
            </button>
            <StartScene3D onClick={() => {
                open("colony-name");
            }} />
        </div>
    );
}
