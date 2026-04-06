import { Scene3D } from "../components/game/Scene3D";
import { HUD } from "../components/game/HUD";
import { usePageTitle } from "../hooks/usePageTitle";
import { useEffect } from "react";
import { useEconomy } from "../../application/hooks/useEconomy";

export default function MarsView() {
    usePageTitle("Play");
    const { start, stop } = useEconomy();

    useEffect(() => {
        start();
        return () => stop();
    }, [start, stop]);

    return (
        <>
            <Scene3D />
            <HUD />
        </>
    );
}
