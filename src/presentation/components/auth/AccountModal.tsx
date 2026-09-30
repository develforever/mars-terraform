import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { useAuthStore } from "../../../application/store/useAuthStore";
import { authClient, type TotpSetupResponse } from "../../../application/service/authService";
import { useModalStore } from "../../../ui/ModalManager/store";
import { downloadBlob } from "./downloadFile";

const EXPORT_FILE_NAME = "mars-terraform-my-data.json";

/**
 * Konto gracza (T12/T13): pseudonim, authenticator (TOTP), pobranie danych (RODO art. 15/20)
 * i trwałe usunięcie konta (art. 17) z potwierdzeniem wpisanym słowem.
 */
export default function AccountModal() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, setUser, deleteAccount, isLoading } = useAuthStore();
  const { close } = useModalStore();
  const [nickname, setNickname] = useState(user?.nickname ?? "");
  const [nicknameSaved, setNicknameSaved] = useState(false);
  const [totpSetup, setTotpSetup] = useState<TotpSetupResponse | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [deleted, setDeleted] = useState(false);

  const run = async (action: () => Promise<void>, fallback: string) => {
    setError("");
    setInfo("");
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : t(fallback));
    }
  };

  const handleNickname = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      setUser(await authClient.updateNickname(nickname.trim()));
      setNicknameSaved(true);
    }, "auth.account.nicknameFailed");
  };

  const handleTotpSetup = () =>
    run(async () => {
      setTotpSetup(await authClient.totpSetup());
      setTotpCode("");
    }, "auth.account.totpFailed");

  const handleTotpEnable = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      await authClient.totpEnable(totpCode);
      setTotpSetup(null);
      setTotpCode("");
      setUser(await authClient.me());
      setInfo(t("auth.account.totpEnabled"));
    }, "auth.account.totpFailed");
  };

  const handleTotpDisable = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      await authClient.totpDisable(totpCode);
      setTotpCode("");
      setUser(await authClient.me());
      setInfo(t("auth.account.totpDisabled"));
    }, "auth.account.totpFailed");
  };

  const handleExport = () =>
    run(async () => {
      setIsExporting(true);
      try {
        downloadBlob(await authClient.exportMyData(), EXPORT_FILE_NAME);
      } finally {
        setIsExporting(false);
      }
    }, "auth.account.exportFailed");

  const handleDelete = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      await deleteAccount();
      setDeleted(true);
    }, "auth.account.deleteFailed");
  };

  const openPrivacy = () => {
    close();
    navigate("/privacy");
  };

  const confirmWord = t("auth.account.deleteConfirmWord");
  const canDelete = confirmation.trim().toUpperCase() === confirmWord.toUpperCase();

  return (
    <div className="bg-gray-900 text-white p-6 rounded-lg w-full max-w-md relative max-h-[90vh] overflow-y-auto">
      <button
        type="button"
        onClick={close}
        className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors text-lg p-1 rounded hover:bg-gray-800"
        aria-label={t("auth.account.close")}
      >
        ✕
      </button>
      <h2 className="text-xl font-bold mb-2">{t("auth.account.title")}</h2>

      {deleted ? (
        <p className="text-green-400 text-sm" role="status">{t("auth.account.deleted")}</p>
      ) : (
        <>
          {user && (
            <p className="text-sm text-gray-400 mb-4">
              {t("auth.account.signedInAs")} <span className="text-white">{user.nickname || `#${user.id}`}</span>
            </p>
          )}
          {error && <p className="text-red-400 mb-3 text-sm" role="alert">{error}</p>}
          {info && <p className="text-green-400 mb-3 text-sm" role="status">{info}</p>}

          <section className="mb-5">
            <h3 className="font-semibold mb-1">{t("auth.account.nicknameTitle")}</h3>
            <form onSubmit={handleNickname} className="flex gap-2">
              <input
                aria-label={t("auth.account.nicknameTitle")}
                type="text"
                value={nickname}
                maxLength={32}
                onChange={(e) => {
                  setNickname(e.target.value);
                  setNicknameSaved(false);
                }}
                className="flex-1 px-3 py-2 rounded bg-gray-800 border border-gray-700 focus:border-blue-500 outline-none"
              />
              <button
                type="submit"
                disabled={nickname.trim().length === 0}
                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm disabled:opacity-50"
              >
                {nicknameSaved ? t("auth.account.nicknameSaved") : t("auth.account.nicknameSave")}
              </button>
            </form>
            <p className="text-xs text-gray-400 mt-1">{t("auth.account.nicknameHint")}</p>
          </section>

          <section className="mb-5">
            <h3 className="font-semibold mb-1">{t("auth.account.totpTitle")}</h3>
            {user?.totpEnabled ? (
              <form onSubmit={handleTotpDisable} className="space-y-2">
                <p className="text-sm text-green-400">{t("auth.account.totpOn")}</p>
                <input
                  aria-label={t("auth.login.totpCode")}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  placeholder="123456"
                  className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 outline-none font-mono tracking-widest"
                />
                <button type="submit" className="w-full py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm">
                  {t("auth.account.totpDisable")}
                </button>
              </form>
            ) : totpSetup ? (
              <form onSubmit={handleTotpEnable} className="space-y-2">
                <p className="text-sm text-gray-300">{t("auth.account.totpStep1")}</p>
                <p className="font-mono text-sm break-all bg-gray-800 rounded p-2 select-all" data-testid="totp-secret">
                  {totpSetup.secret}
                </p>
                <a href={totpSetup.otpauthUri} className="text-xs text-blue-400 hover:underline break-all">
                  {t("auth.account.totpLink")}
                </a>
                <p className="text-sm text-gray-300">{t("auth.account.totpStep2")}</p>
                <input
                  aria-label={t("auth.login.totpCode")}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  placeholder="123456"
                  className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 outline-none font-mono tracking-widest"
                />
                <button type="submit" className="w-full py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm">
                  {t("auth.account.totpEnable")}
                </button>
              </form>
            ) : (
              <>
                <p className="text-sm text-gray-400 mb-2">{t("auth.account.totpDesc")}</p>
                <button type="button" onClick={handleTotpSetup} className="w-full py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm">
                  {t("auth.account.totpSetup")}
                </button>
              </>
            )}
          </section>

          <section className="mb-5">
            <h3 className="font-semibold mb-1">{t("auth.account.exportTitle")}</h3>
            <p className="text-sm text-gray-400 mb-2">{t("auth.account.exportDesc")}</p>
            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting}
              className="w-full py-2 bg-blue-600 hover:bg-blue-500 rounded font-medium disabled:opacity-50"
            >
              {isExporting ? t("auth.account.exporting") : t("auth.account.exportBtn")}
            </button>
          </section>

          <section className="border-t border-gray-700 pt-4">
            <h3 className="font-semibold text-red-400 mb-1">{t("auth.account.deleteTitle")}</h3>
            <p className="text-sm text-gray-400 mb-2">{t("auth.account.deleteDesc")}</p>
            <form onSubmit={handleDelete} className="space-y-2">
              <label className="block text-sm" htmlFor="account-delete-confirm">
                {t("auth.account.deleteConfirmLabel", { word: confirmWord })}
              </label>
              <input
                id="account-delete-confirm"
                type="text"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                autoComplete="off"
                className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 focus:border-red-500 outline-none"
              />
              <button
                type="submit"
                disabled={!canDelete || isLoading}
                className="w-full py-2 bg-red-700 hover:bg-red-600 rounded font-medium disabled:opacity-50"
              >
                {isLoading ? t("auth.account.deleting") : t("auth.account.deleteBtn")}
              </button>
            </form>
          </section>
        </>
      )}

      <div className="mt-4 text-sm text-center">
        <button type="button" onClick={openPrivacy} className="text-blue-400 hover:underline">
          {t("privacy.link")}
        </button>
      </div>
    </div>
  );
}
