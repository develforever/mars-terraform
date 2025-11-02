import { Scene3D } from "../mars3d/Scene3D";
import { HUD } from "../ui/HUD";
import "./MarsView.scss";

export default function MarsView(){
  return (
    <div className="mars-root">
      <Scene3D />
      <HUD />
    </div>
  );
}
