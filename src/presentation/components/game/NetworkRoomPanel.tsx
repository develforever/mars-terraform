import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNetworkStore } from "../../../application/store/useNetworkStore";
import { inviteLink } from "../../../application/service/networkClient";

const REJECTED_VISIBLE_MS = 4000;

/**
 * F9-T5: panel gry sieciowej w HUD. W pokoju: kod, link zaproszenia, gracze, wyjście.
 * Po końcu sesji: komunikat, że gra toczy się dalej solo. Przycisk „Zaproś” jest w pasku narzędzi HUD.
 */
export const NetworkRoomPanel = () => {
    const { t } = useTranslation();
    const { phase, roomCode, playerId, players, issue, lastRejected, leaveRoom, clearIssue } = useNetworkStore();
    const [copied, setCopied] = useState(false);
    const [showRejected, setShowRejected] = useState(false);

    useEffect(() => {
        if (!lastRejected) return;
        setShowRejected(true);
        const timer = setTimeout(() => setShowRejected(false), REJECTED_VISIBLE_MS);
        return () => clearTimeout(timer);
    }, [lastRejected]);

    // `.hud` ma `pointer-events: none`, więc panel musi je włączyć sam (inaczej kliknięcia trafiają w canvas).
    const panel = "pointer-events-auto absolute top-14 left-4 z-40 w-60rounded-xl border border-white/10 bg-[rgba(8,12,22,0.9)] p-3 text-xs text-gray-200 shadow-xl backdrop-blur";
    const button = "px-2.5 py-1 rounded-md border border-white/15 bg-white/5 hover:bg-white/10 cursor-pointer";

    if (phase === "idle") {
        if (issue) {
            return (
                <div className={panel} role="alert">
                    <div className="flex items-start gap-2">
                        <span className="flex-1 text-red-300">{t(`network.issue.${issue}`)} {t("network.leftSolo")}</span>
                        <button type="button" onClick={clearIssue} aria-label={t("network.close")} className="text-gray-400 hover:text-white cursor-pointer">✕</button>
                    </div>
                </div>
            );
        }
        return null;
    }

    const handleCopy = async () => {
        if (!roomCode) return;
        try {
            await navigator.clipboard.writeText(inviteLink(window.location.origin, roomCode));
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            setCopied(false);
        }
    };

    return (
        <div className={panel} data-testid="network-room-panel">
            <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-gray-400">{t("network.room")}</span>
                <span className="font-mono text-sm tracking-widest text-white">{roomCode ?? "…"}</span>
            </div>
            {phase !== "in_room" && (
                <p className="mb-2 text-amber-300" role="status">{phase === "reconnecting" ? t("network.reconnecting") : t("network.connecting")}</p>
            )}
            <div className="text-gray-400 mb-1">{t("network.players")} ({players.length}/4)</div>
            <ul className="mb-3 flex flex-col gap-0.5">
                {players.map((player) => (
                    <li key={player.id} className="truncate">
                        {player.nickname}
                        {player.id === playerId && <span className="text-[#ec7063]"> · {t("network.you")}</span>}
                    </li>
                ))}
            </ul>
            {showRejected && lastRejected && <p className="mb-2 text-amber-300">{t("network.rejected", { reason: lastRejected })}</p>}
            {issue && <p className="mb-2 text-amber-300">{t(`network.issue.${issue}`)}</p>}
            <div className="flex gap-2">
                <button type="button" className={button} onClick={handleCopy} disabled={!roomCode}>
                    {copied ? t("network.copied") : t("network.copyLink")}
                </button>
                <button type="button" className={`${button} text-[#fca5a5]`} onClick={leaveRoom}>
                    {t("network.leave")}
                </button>
            </div>
        </div>
    );
};
