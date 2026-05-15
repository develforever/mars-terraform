import { Scene3D } from "../components/game/Scene3D";
import { HUD } from "../components/game/HUD";
import { usePageTitle } from "../hooks/usePageTitle";
import { useEffect } from "react";
import { useEconomy } from "../../application/hooks/useEconomy";
import { useGameStore } from "../../application/store/useGameStore";

export default function MarsView() {
    usePageTitle("Play");
    const alive = useGameStore((s) => s.alive);
    const { start, stop } = useEconomy();

    useEffect(() => {
        if (!alive) {
            stop();
            return;
        }
        start();
        return () => stop();
    }, [alive, start, stop]);

    return (
        <>
            <Scene3D />
            <HUD />
        </>
    );
}
