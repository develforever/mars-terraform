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
            <StartScene3D onClick={() => {
                open("colony-name");
            }} />
        </div>
    );
}
