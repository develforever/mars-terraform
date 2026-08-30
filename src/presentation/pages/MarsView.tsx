import { Scene3D } from "../components/game/Scene3D";
import { HUD } from "../components/game/HUD";
import { usePageTitle } from "../hooks/usePageTitle";

export default function MarsView() {
    usePageTitle("Play");

    return (
        <div className="w-full h-full relative">
            <Scene3D />
            <HUD />
        </div>
    );
}

