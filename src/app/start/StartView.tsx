
import { Scene3D } from "./Scene3D";
import "./StartView.css";
import { usePageTitle } from "../../hooks/usePageTitle";
import { useModalStore } from "../../ui/ModalManager/store";
import { useNavigate } from "react-router";

export default function StartView() {

  usePageTitle('Start');

  const navigate = useNavigate();
  const { open: openModal } = useModalStore();

  return (
    <>
      <Scene3D onClick={() => {
        openModal(() => {
          navigate('/mars');
        });
      }} />
    </>
  );
}
