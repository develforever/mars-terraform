import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { useGameStore } from "../../../application/store/useGameStore";
import { useUIStore } from "../../../application/store/useUIStore";
import { apiUrl } from "../../../application/config/apiConfig";

/** Element `GET /api/colony` (`ColonySummary` w `src_backend/model/types.ts`), bez `state`. */
interface ColonySummary {
    id: number;
    name: string;
    createdAt: string;
    updatedAt: string;
}

interface LoadGameModalProps {
    onClose: () => void;
}

export function LoadGameModal({ onClose }: LoadGameModalProps) {
    const { t } = useTranslation();
    const [colonies, setColonies] = useState<ColonySummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingName, setLoadingName] = useState<string | null>(null);
    const [deletingName, setDeletingName] = useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();
    const loadGame = useGameStore((s) => s.loadGame);
    const resetUI = useUIStore((s) => s.resetUI);

    useEffect(() => {
        const fetchColonies = async () => {
            setLoading(true);
            try {
                const res = await fetch(apiUrl("/api/colony"), {
                    headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` },
                });
                if (!res.ok) throw new Error(t("modal.loadGame.errorList"));
                const data = await res.json() as ColonySummary[];
                setColonies(data);
            } catch {
                setError(t("modal.loadGame.errorFetch"));
            } finally {
                setLoading(false);
            }
        };
        fetchColonies();
    }, [t]);

    const handleLoad = async (name: string) => {
        setLoadingName(name);
        resetUI();
        const ok = await loadGame(name);
        if (ok) {
            onClose();
            navigate("/mars");
        } else {
            setError(t("modal.loadGame.errorLoad", { name }));
            setLoadingName(null);
        }
    };

    const handleDelete = async (name: string) => {
        setDeletingName(name);
        try {
            const res = await fetch(apiUrl(`/api/colony/${encodeURIComponent(name)}`), {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` },
            });
            if (!res.ok) throw new Error(t("modal.loadGame.errorDelete"));
            setColonies((prev) => prev.filter((c) => c.name !== name));
            setConfirmDelete(null);
        } catch {
            setError(t("modal.loadGame.errorDelete"));
        } finally {
            setDeletingName(null);
        }
    };

    const formatDate = (iso?: string) => {
        if (!iso) return "";
        try {
            return new Date(iso).toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short" });
        } catch {
            return "";
        }
    };

    return (
        <div style={{
            position: "relative",
            background: "rgba(8, 12, 22, 0.97)",
            border: "1px solid rgba(231, 76, 60, 0.35)",
            borderRadius: "14px",
            padding: "28px 32px",
            width: "460px",
            maxWidth: "95vw",
            boxShadow: "0 20px 56px rgba(0,0,0,0.7)",
            color: "#e5e7eb",
            fontFamily: "system-ui, 'Segoe UI', Roboto, sans-serif",
            maxHeight: "80vh",
            display: "flex",
            flexDirection: "column",
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
            <h2 style={{ fontSize: "17px", fontWeight: 800, letterSpacing: "1.5px", textTransform: "uppercase", color: "#fff", marginBottom: "4px" }}>
                {t("modal.loadGame.title")}
            </h2>
            <p style={{ fontSize: "12px", color: "#6b7280", marginBottom: "20px" }}>
                {t("modal.loadGame.subtitle")}
            </p>

            <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
                {loading && (
                    <p style={{ color: "#6b7280", fontSize: "13px", textAlign: "center", padding: "20px 0" }}>{t("modal.loadGame.loading")}</p>
                )}
                {!loading && colonies.length === 0 && !error && (
                    <p style={{ color: "#6b7280", fontSize: "13px", textAlign: "center", padding: "20px 0" }}>
                        {t("modal.loadGame.empty")}
                    </p>
                )}
                {error && (
                    <p style={{ color: "#f87171", fontSize: "13px", textAlign: "center", padding: "8px 0" }}>{error}</p>
                )}
                {!loading && colonies.map((colony) => {
                    const isConfirming = confirmDelete === colony.name;
                    const isDeleting = deletingName === colony.name;
                    const isLoading = loadingName === colony.name;
                    const isBusy = loadingName !== null || deletingName !== null;
                    return (
                        <div
                            key={colony.name}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                padding: "12px 16px",
                                background: isLoading ? "rgba(231,76,60,0.12)" : "rgba(255,255,255,0.04)",
                                border: `1px solid ${isLoading ? "rgba(231,76,60,0.5)" : "rgba(255,255,255,0.08)"}`,
                                borderRadius: "8px",
                                transition: "all 0.15s",
                                color: "#e5e7eb",
                                gap: "12px",
                            }}
                        >
                            <div style={{ display: "flex", flexDirection: "column", gap: "2px", flex: 1, minWidth: 0 }}>
                                <span style={{ fontWeight: 700, fontSize: "14px", letterSpacing: "0.5px" }}>
                                    🏛 {colony.name}
                                </span>
                                {colony.updatedAt && (
                                    <span style={{ fontSize: "11px", color: "#6b7280" }}>
                                        {t("modal.loadGame.lastSave")}: {formatDate(colony.updatedAt)}
                                    </span>
                                )}
                                {isConfirming && (
                                    <span style={{ fontSize: "11px", color: "#fca5a5" }}>
                                        {t("modal.loadGame.deleteConfirm", { name: colony.name })}
                                    </span>
                                )}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                                {!isConfirming ? (
                                    <>
                                        <button
                                            onClick={() => handleLoad(colony.name)}
                                            disabled={isBusy}
                                            style={{
                                                padding: "6px 12px",
                                                background: isLoading ? "rgba(231,76,60,0.2)" : "rgba(255,255,255,0.06)",
                                                border: "1px solid rgba(255,255,255,0.1)",
                                                borderRadius: "6px",
                                                color: isLoading ? "#fca5a5" : "#e5e7eb",
                                                cursor: isBusy ? "not-allowed" : "pointer",
                                                fontSize: "12px",
                                                fontWeight: 600,
                                                transition: "all 0.15s",
                                            }}
                                        >
                                            {isLoading ? t("modal.loadGame.loadingBtn") : t("modal.loadGame.loadBtn")}
                                        </button>
                                        <button
                                            onClick={() => setConfirmDelete(colony.name)}
                                            disabled={isBusy}
                                            style={{
                                                padding: "6px 12px",
                                                background: "transparent",
                                                border: "1px solid rgba(239,68,68,0.3)",
                                                borderRadius: "6px",
                                                color: "#ef4444",
                                                cursor: isBusy ? "not-allowed" : "pointer",
                                                fontSize: "12px",
                                                fontWeight: 600,
                                                transition: "all 0.15s",
                                            }}
                                        >
                                            {t("modal.loadGame.deleteBtn")}
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            onClick={() => handleDelete(colony.name)}
                                            disabled={isDeleting}
                                            style={{
                                                padding: "6px 12px",
                                                background: "rgba(239,68,68,0.15)",
                                                border: "1px solid rgba(239,68,68,0.4)",
                                                borderRadius: "6px",
                                                color: "#fca5a5",
                                                cursor: isDeleting ? "not-allowed" : "pointer",
                                                fontSize: "12px",
                                                fontWeight: 600,
                                                transition: "all 0.15s",
                                            }}
                                        >
                                            {isDeleting ? t("modal.loadGame.deleting") : t("modal.loadGame.deleteBtn")}
                                        </button>
                                        <button
                                            onClick={() => setConfirmDelete(null)}
                                            disabled={isDeleting}
                                            style={{
                                                padding: "6px 12px",
                                                background: "rgba(255,255,255,0.06)",
                                                border: "1px solid rgba(255,255,255,0.1)",
                                                borderRadius: "6px",
                                                color: "#9ca3af",
                                                cursor: isDeleting ? "not-allowed" : "pointer",
                                                fontSize: "12px",
                                                fontWeight: 600,
                                                transition: "all 0.15s",
                                            }}
                                        >
                                            {t("modal.loadGame.cancel")}
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            <button
                onClick={onClose}
                style={{
                    marginTop: "16px",
                    padding: "8px 20px",
                    background: "transparent",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "8px",
                    color: "#6b7280",
                    cursor: "pointer",
                    fontSize: "13px",
                    transition: "all 0.2s",
                }}
            >
                {t("modal.loadGame.cancel")}
            </button>
        </div>
    );
}
