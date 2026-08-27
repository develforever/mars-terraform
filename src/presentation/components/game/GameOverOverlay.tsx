import { useState } from "react";
import { VictorySummaryModal } from "./VictorySummaryModal";
import { useModalStore } from "../../../ui/ModalManager/store";

export interface GameOverOverlayProps {
    onNewGame: () => void;
    onSelectScenario?: () => void;
    onClose?: () => void;
}

export function GameOverOverlay({ onNewGame, onSelectScenario, onClose }: GameOverOverlayProps) {
    const [dismissed, setDismissed] = useState(false);
    const openModal = useModalStore((s) => s.open);

    const handleDismiss = () => {
        setDismissed(true);
        onClose?.();
    };

    const handleSelectScenario = () => {
        if (onSelectScenario) {
            onSelectScenario();
        } else {
            openModal("scenario-select");
        }
    };

    if (dismissed) return null;

    return (
        <VictorySummaryModal
            isVictory={false}
            onPlayAgain={onNewGame}
            onSelectScenario={handleSelectScenario}
            onClose={handleDismiss}
        />
    );
}
