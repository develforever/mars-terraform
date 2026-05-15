import { StartScene3D } from "../components/game/MarsStartScene";
import { usePageTitle } from "../hooks/usePageTitle";
import { useModalStore } from "../../ui/ModalManager/store";

export default function StartView() {
    usePageTitle("Start");

    const { open } = useModalStore();

    return (
        <>
            <StartScene3D onClick={() => {
                open("colony-name");
            }} />
        </>
    );
}
