import { Scene3D } from "../components/game/Scene3D";
import { HUD } from "../components/game/HUD";
import { usePageTitle } from "../hooks/usePageTitle";
import { useGameStore } from "../../application/store/useGameStore";

export default function MarsView() {
    usePageTitle("Play");
    const colonyName = useGameStore(state => state.colonyName);
    const mapSeed = useGameStore(state => state.mapSeed);

    return (
        <div key={`${colonyName}_${mapSeed}`} className="w-full h-full relative">
            <Scene3D />
            <HUD />
        </div>
    );
}
