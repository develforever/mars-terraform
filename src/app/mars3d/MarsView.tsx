import { Scene3D } from "./Scene3D";
import { HUD } from "./ui/HUD";
import "./MarsView.css";

export default function MarsView() {
  return (
    <>
      <Scene3D />
      <HUD />
    </>
  );
}
