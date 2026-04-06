import { useModalStore, type ModalType } from "../../../ui/ModalManager/store";
import { ColonyNameModal } from "../game/ColonyNameModal";

const MODAL_COMPONENTS: Record<Exclude<ModalType, null>, React.FC<{ onConfirm: () => void; onCancel: () => void }>> = {
    "colony-name": ColonyNameModal,
};

export default function ModalManager() {
    const { isOpen, modalType, close } = useModalStore();

    if (!isOpen || !modalType) return null;

    const ModalContent = MODAL_COMPONENTS[modalType];
    if (!ModalContent) return null;

    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <ModalContent
                onConfirm={close}
                onCancel={close}
            />
        </div>
    );
}
