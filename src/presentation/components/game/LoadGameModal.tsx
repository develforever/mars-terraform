import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useGameStore } from "../../../application/store/useGameStore";
import { useUIStore } from "../../../application/store/useUIStore";

interface ColonyEntry {
    name: string;
    updatedAt?: string;
}

interface LoadGameModalProps {
    onClose: () => void;
}

export function LoadGameModal({ onClose }: LoadGameModalProps) {
    const [colonies, setColonies] = useState<ColonyEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingName, setLoadingName] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();
    const loadGame = useGameStore((s) => s.loadGame);
    const resetUI = useUIStore((s) => s.resetUI);

    useEffect(() => {
        const fetchColonies = async () => {
            setLoading(true);
            try {
                const res = await fetch("/api/colony", {
                    headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` },
                });
                if (!res.ok) throw new Error("Błąd ładowania listy");
                const data = await res.json() as ColonyEntry[];
                setColonies(data);
            } catch {
                setError("Nie udało się pobrać listy kolonii.");
            } finally {
                setLoading(false);
            }
        };
        fetchColonies();
    }, []);

    const handleLoad = async (name: string) => {
        setLoadingName(name);
        resetUI();
        const ok = await loadGame(name);
        if (ok) {
            onClose();
            navigate("/mars");
        } else {
            setError(`Nie udało się wczytać kolonii "${name}".`);
            setLoadingName(null);
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
            <h2 style={{ fontSize: "17px", fontWeight: 800, letterSpacing: "1.5px", textTransform: "uppercase", color: "#fff", marginBottom: "4px" }}>
                📂 Wczytaj kolonię
            </h2>
            <p style={{ fontSize: "12px", color: "#6b7280", marginBottom: "20px" }}>
                Wybierz zapisaną grę do kontynuowania
            </p>

            <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
                {loading && (
                    <p style={{ color: "#6b7280", fontSize: "13px", textAlign: "center", padding: "20px 0" }}>Ładowanie…</p>
                )}
                {!loading && colonies.length === 0 && !error && (
                    <p style={{ color: "#6b7280", fontSize: "13px", textAlign: "center", padding: "20px 0" }}>
                        Brak zapisanych kolonii.
                    </p>
                )}
                {error && (
                    <p style={{ color: "#f87171", fontSize: "13px", textAlign: "center", padding: "8px 0" }}>{error}</p>
                )}
                {!loading && colonies.map((colony) => (
                    <button
                        key={colony.name}
                        onClick={() => handleLoad(colony.name)}
                        disabled={loadingName !== null}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "12px 16px",
                            background: loadingName === colony.name ? "rgba(231,76,60,0.12)" : "rgba(255,255,255,0.04)",
                            border: `1px solid ${loadingName === colony.name ? "rgba(231,76,60,0.5)" : "rgba(255,255,255,0.08)"}`,
                            borderRadius: "8px",
                            cursor: loadingName !== null ? "not-allowed" : "pointer",
                            textAlign: "left",
                            transition: "all 0.15s",
                            color: "#e5e7eb",
                        }}
                    >
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            <span style={{ fontWeight: 700, fontSize: "14px", letterSpacing: "0.5px" }}>
                                🏛 {colony.name}
                            </span>
                            {colony.updatedAt && (
                                <span style={{ fontSize: "11px", color: "#6b7280" }}>
                                    Ostatni zapis: {formatDate(colony.updatedAt)}
                                </span>
                            )}
                        </div>
                        <span style={{ fontSize: "11px", color: loadingName === colony.name ? "#fca5a5" : "#4b5563" }}>
                            {loadingName === colony.name ? "Wczytywanie…" : "▶ Wczytaj"}
                        </span>
                    </button>
                ))}
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
                Anuluj
            </button>
        </div>
    );
}
