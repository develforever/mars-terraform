import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { nicknameSchema, roomCodeSchema } from "../../../domain/network/NetworkProtocol";
import { useGameStore } from "../../../application/store/useGameStore";
import { useNetworkStore } from "../../../application/store/useNetworkStore";

interface NetworkGameModalProps {
    onClose: () => void;
    /** Kod z linku zaproszenia (`?join=MARS-XXXX`). */
    initialCode?: string;
}

/** F9-T5: utworzenie pokoju z bieżącej kolonii albo dołączenie po kodzie (D3: tylko gdy stronę serwuje serwer gry). */
export const NetworkGameModal = ({ onClose, initialCode = "" }: NetworkGameModalProps) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const colonyName = useGameStore((s) => s.colonyName);
    const inNetworkGame = useGameStore((s) => s.remoteCommandSink !== null);
    const { serverAvailable, phase, issue, nickname: lastNickname, checkServer, createRoom, joinRoom, clearIssue } = useNetworkStore();
    const [nickname, setNickname] = useState(lastNickname);
    const [code, setCode] = useState(initialCode);

    useEffect(() => {
        if (serverAvailable === null) void checkServer();
    }, [serverAvailable, checkServer]);

    useEffect(() => {
        if (phase === "in_room") {
            onClose();
            navigate("/mars");
        }
    }, [phase, onClose, navigate]);

    const nicknameValid = nicknameSchema.safeParse(nickname).success;
    const codeValid = roomCodeSchema.safeParse(code).success;
    const busy = phase === "connecting" || phase === "reconnecting";
    const canCreate = !!colonyName && !inNetworkGame;

    const handleJoin = () => {
        clearIssue();
        joinRoom(code, nickname.trim());
    };

    const handleCreate = () => {
        clearIssue();
        createRoom(nickname.trim());
    };

    const input = "w-full px-3 py-2 rounded-lg bg-black/40 border border-white/15 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-[#e74c3c]";
    const primary = "w-full px-4 py-2.5 rounded-lg text-sm font-bold tracking-wide border border-[#e74c3c]/60 bg-[#e74c3c]/15 text-[#fca5a5] hover:bg-[#e74c3c]/25 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer";

    return (
        <div
            role="dialog"
            aria-labelledby="network-modal-title"
            className="relative w-[440px] max-w-[95vw] rounded-2xl border border-[#e74c3c]/35 bg-[rgba(8,12,22,0.97)] p-7 text-gray-200 shadow-[0_20px_56px_rgba(0,0,0,0.7)]"
        >
            <button
                type="button"
                onClick={onClose}
                aria-label={t("network.close")}
                className="absolute top-4 right-4 px-2 py-1 rounded text-gray-400 hover:text-white cursor-pointer"
            >
                ✕
            </button>
            <h2 id="network-modal-title" className="text-[17px] font-extrabold tracking-[1.5px] uppercase text-white mb-2">
                {t("network.title")}
            </h2>
            <p className="text-[13px] text-gray-400 leading-relaxed mb-5">{t("network.intro")}</p>

            {serverAvailable === null && <p className="text-sm text-gray-400">{t("network.checking")}</p>}
            {serverAvailable === false && <p className="text-sm text-amber-300/90 leading-relaxed">{t("network.unavailable")}</p>}

            {serverAvailable && (
                <div className="flex flex-col gap-4">
                    <label className="flex flex-col gap-1 text-xs text-gray-400">
                        {t("network.nickname")}
                        <input
                            className={input}
                            value={nickname}
                            maxLength={20}
                            onChange={(e) => setNickname(e.target.value)}
                            disabled={busy}
                            autoFocus
                        />
                        <span className="text-[11px] text-gray-500">{t("network.nicknameHint")}</span>
                    </label>

                    <div className="flex flex-col gap-2 pt-3 border-t border-white/10">
                        <label className="flex flex-col gap-1 text-xs text-gray-400">
                            {t("network.code")}
                            <input
                                className={`${input} font-mono uppercase tracking-widest`}
                                value={code}
                                placeholder={t("network.codeHint")}
                                maxLength={12}
                                onChange={(e) => setCode(e.target.value)}
                                disabled={busy}
                            />
                        </label>
                        <button type="button" className={primary} onClick={handleJoin} disabled={busy || !nicknameValid || !codeValid}>
                            {t("network.join")}
                        </button>
                    </div>

                    <div className="flex flex-col gap-2 pt-3 border-t border-white/10">
                        <button type="button" className={primary} onClick={handleCreate} disabled={busy || !nicknameValid || !canCreate}>
                            {t("network.create")}
                        </button>
                        <span className="text-[11px] text-gray-500">{canCreate ? t("network.createHint") : t("network.createNeedsColony")}</span>
                    </div>

                    {busy && <p className="text-sm text-gray-300" role="status">{phase === "reconnecting" ? t("network.reconnecting") : t("network.connecting")}</p>}
                    {issue && <p className="text-sm text-red-300" role="alert">{t(`network.issue.${issue}`)}</p>}
                </div>
            )}
        </div>
    );
};
