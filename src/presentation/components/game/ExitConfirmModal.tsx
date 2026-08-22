import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { useGameStore } from "../../../application/store/useGameStore";
import { useUIStore } from "../../../application/store/useUIStore";
import { useAuthStore } from "../../../application/store/useAuthStore";

interface ExitConfirmModalProps {
    onClose: () => void;
}

export function ExitConfirmModal({ onClose }: ExitConfirmModalProps) {
    const { t } = useTranslation();
    const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "ok" | "err">("idle");
    const navigate = useNavigate();
    const saveGame = useGameStore((s) => s.saveGame);
    const resetGame = useGameStore((s) => s.resetGame);
    const resetUI = useUIStore((s) => s.resetUI);
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
    const colonyName = useGameStore((s) => s.colonyName);
    const canSave = isAuthenticated && !!colonyName;

    const doExit = () => {
        resetGame();
        resetUI();
        onClose();
        navigate("/");
    };

    const handleSaveAndExit = async () => {
        setSaveStatus("saving");
        const ok = await saveGame();
        if (ok) {
            setSaveStatus("ok");
            setTimeout(doExit, 600);
        } else {
            setSaveStatus("err");
        }
    };

    const handleExitWithout = () => {
        doExit();
    };

    const btnBase: React.CSSProperties = {
        padding: "10px 20px",
        borderRadius: "8px",
        fontSize: "13px",
        fontWeight: 700,
        cursor: "pointer",
        transition: "all 0.2s",
        border: "1px solid",
        letterSpacing: "0.5px",
    };

    return (
        <div style={{
            position: "relative",
            background: "rgba(8, 12, 22, 0.97)",
            border: "1px solid rgba(231, 76, 60, 0.35)",
            borderRadius: "14px",
            padding: "28px 32px",
            width: "420px",
            maxWidth: "95vw",
            boxShadow: "0 20px 56px rgba(0,0,0,0.7)",
            color: "#e5e7eb",
            fontFamily: "system-ui, 'Segoe UI', Roboto, sans-serif",
        }}>
            <button
                type="button"
                onClick={onClose}
                style={{
                    position: "absolute",
                    top: "16px",
                    right: "16px",
                    background: "transparent",
                    border: "none",
                    color: "#9ca3af",
                    fontSize: "16px",
                    cursor: "pointer",
                    padding: "4px 8px",
                    borderRadius: "4px",
                }}
                aria-label="Zamknij"
            >
                ✕
            </button>
            <h2 style={{ fontSize: "17px", fontWeight: 800, letterSpacing: "1.5px", textTransform: "uppercase", color: "#fff", marginBottom: "8px" }}>
                {t("modal.exit.title")}
            </h2>
            <p style={{ fontSize: "13px", color: "#9ca3af", marginBottom: "24px", lineHeight: 1.6 }}>
                {t("modal.exit.message")}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {canSave && (
                    <button
                        onClick={handleSaveAndExit}
                        disabled={saveStatus === "saving" || saveStatus === "ok"}
                        style={{
                            ...btnBase,
                            background: saveStatus === "ok" ? "rgba(74,222,128,0.15)" : "rgba(231,76,60,0.15)",
                            borderColor: saveStatus === "ok" ? "rgba(74,222,128,0.5)" : "rgba(231,76,60,0.5)",
                            color: saveStatus === "ok" ? "#4ade80" : saveStatus === "err" ? "#f87171" : "#fca5a5",
                        }}
                    >
                        {saveStatus === "saving" && t("modal.exit.saving")}
                        {saveStatus === "ok" && t("modal.exit.saved")}
                        {saveStatus === "err" && t("modal.exit.saveErr")}
                        {saveStatus === "idle" && t("modal.exit.saveAndExit")}
                    </button>
                )}
                <button
                    onClick={handleExitWithout}
                    style={{
                        ...btnBase,
                        background: "rgba(255,255,255,0.04)",
                        borderColor: "rgba(255,255,255,0.12)",
                        color: "#9ca3af",
                    }}
                >
                    {t("modal.exit.exitWithout")}
                </button>
                <button
                    onClick={onClose}
                    style={{
                        ...btnBase,
                        background: "transparent",
                        borderColor: "transparent",
                        color: "#4b5563",
                        fontSize: "12px",
                        fontWeight: 400,
                        padding: "6px 20px",
                    }}
                >
                    {t("modal.exit.cancel")}
                </button>
            </div>
        </div>
    );
}
