import { useState } from "react";
import type { DifficultyLevel } from "../../../domain/services/TerraformingService";
import { VictorySummaryModal } from "./VictorySummaryModal";
import { useModalStore } from "../../../ui/ModalManager/store";

export interface WinOverlayProps {
    difficulty?: DifficultyLevel;
    onPlayAgain: () => void;
    onSelectScenario?: () => void;
    onContinueEndless?: () => void;
    onClose?: () => void;
}

export function WinOverlay({
    onPlayAgain,
    onSelectScenario,
    onContinueEndless,
    onClose,
}: WinOverlayProps) {
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
            isVictory={true}
            onPlayAgain={onPlayAgain}
            onSelectScenario={handleSelectScenario}
            onContinueEndless={onContinueEndless}
            onClose={handleDismiss}
        />
    );
}
