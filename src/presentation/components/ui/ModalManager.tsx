import { useModalStore } from "../../../ui/ModalManager/store";
import { ColonyNameModal } from "../game/ColonyNameModal";
import { ExitConfirmModal } from "../game/ExitConfirmModal";
import { LoadGameModal } from "../game/LoadGameModal";
import LoginModal from "../auth/LoginModal";
import RegisterModal from "../auth/RegisterModal";
import ForgotPasswordModal from "../auth/ForgotPasswordModal";
import ResetPasswordModal from "../auth/ResetPasswordModal";
import VerifyEmailModal from "../auth/VerifyEmailModal";

export default function ModalManager() {
    const { isOpen, modalType, close } = useModalStore();

    if (!isOpen || !modalType) return null;

    const renderModal = () => {
        switch (modalType) {
            case "colony-name":
                return <ColonyNameModal onConfirm={close} onCancel={close} />;
            case "login":
                return <LoginModal />;
            case "register":
                return <RegisterModal />;
            case "forgot-password":
                return <ForgotPasswordModal />;
            case "reset-password":
                return <ResetPasswordModal />;
            case "verify-email":
                return <VerifyEmailModal />;
            case "exit-confirm":
                return <ExitConfirmModal onClose={close} />;
            case "load-game":
                return <LoadGameModal onClose={close} />;
            default:
                return null;
        }
    };

    const content = renderModal();
    if (!content) return null;

    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            {content}
        </div>
    );
}
