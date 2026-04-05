import { Scene3D } from "./Scene3D";
import { HUD } from "./ui/HUD";
import "./MarsView.css";
import { usePageTitle } from "../../hooks/usePageTitle";
import { useEffect } from "react";
import { startEconomyTimer, stopEconomyTimer } from "./store";

export default function MarsView() {
  usePageTitle('Play');

  // Start/stop economy timer on component lifecycle
  useEffect(() => {
    startEconomyTimer();
    return () => stopEconomyTimer();
  }, []);

  return (
    <>
      <Scene3D />
      <HUD />
    </>
  );
}
