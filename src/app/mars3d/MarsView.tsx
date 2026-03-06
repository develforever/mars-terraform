import { Scene3D } from "./Scene3D";
import { HUD } from "./ui/HUD";
import "./MarsView.css";
import { usePageTitle } from "../../hooks/usePageTitle";

export default function MarsView() {

  usePageTitle('Play');

  return (
    <>
      <Scene3D />
      <HUD />
    </>
  );
}
