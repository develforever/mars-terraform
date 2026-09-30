import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { useAuthStore } from "../../../application/store/useAuthStore";
import { useModalStore } from "../../../ui/ModalManager/store";
import { downloadBlob } from "./downloadFile";

const ACCOUNT_FILE_NAME = "mars-terraform-account-number.txt";

/**
 * Tworzenie konta bez danych osobowych (T13): serwer nadaje numer konta, pokazywany TYLKO raz.
 * Gracz musi go zapisać (kopiuj / pobierz plik) i potwierdzić, zanim zamknie okno.
 */
export default function RegisterModal() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { register, isLoading } = useAuthStore();
  const { open, close } = useModalStore();
  const [accountNumber, setAccountNumber] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async () => {
    setError("");
    try {
      setAccountNumber(await register());
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.register.failed"));
    }
  };

  const handleCopy = async () => {
    if (!accountNumber) return;
    try {
      await navigator.clipboard.writeText(accountNumber);
      setCopied(true);
    } catch {
      setError(t("auth.register.copyFailed"));
    }
  };

  const handleDownload = () => {
    if (!accountNumber) return;
    const text = `${t("auth.register.fileHeader")}\n\n${accountNumber}\n`;
    downloadBlob(new Blob([text], { type: "text/plain;charset=utf-8" }), ACCOUNT_FILE_NAME);
  };

  const openPrivacy = () => {
    close();
    navigate("/privacy");
  };

  return (
    <div className="bg-gray-900 text-white p-6 rounded-lg w-full max-w-md relative">
      {!accountNumber && (
        <button
          type="button"
          onClick={close}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors text-lg p-1 rounded hover:bg-gray-800"
          aria-label={t("auth.account.close")}
        >
          ✕
        </button>
      )}
      <h2 className="text-xl font-bold mb-4">{t("auth.register.title")}</h2>
      {error && <p className="text-red-400 mb-3 text-sm" role="alert">{error}</p>}

      {!accountNumber ? (
        <>
          <p className="text-sm text-gray-300 mb-4">{t("auth.register.intro")}</p>
          <button
            type="button"
            onClick={handleCreate}
            disabled={isLoading}
            className="w-full py-2 bg-blue-600 hover:bg-blue-500 rounded font-medium disabled:opacity-50"
          >
            {isLoading ? t("auth.register.submitting") : t("auth.register.submit")}
          </button>
          <p className="mt-3 text-xs text-gray-400">
            <button type="button" onClick={openPrivacy} className="text-blue-400 hover:underline">
              {t("privacy.link")}
            </button>
          </p>
          <div className="mt-4 text-sm text-center">
            <button type="button" onClick={() => open("login")} className="text-blue-400 hover:underline">
              {t("auth.register.haveAccount")}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-gray-300 mb-2">{t("auth.register.yourNumber")}</p>
          <p
            className="font-mono text-lg tracking-wider text-center bg-gray-800 border border-[#e74c3c] rounded py-3 mb-2 select-all"
            data-testid="account-number"
          >
            {accountNumber}
          </p>
          <p className="text-sm text-[#ec7063] mb-3" role="note">{t("auth.register.warning")}</p>
          <div className="flex gap-2 mb-3">
            <button type="button" onClick={handleCopy} className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm">
              {copied ? t("auth.register.copied") : t("auth.register.copy")}
            </button>
            <button type="button" onClick={handleDownload} className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm">
              {t("auth.register.download")}
            </button>
          </div>
          <label className="flex items-start gap-2 text-sm mb-3">
            <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="mt-1" />
            <span>{t("auth.register.savedConfirm")}</span>
          </label>
          <button
            type="button"
            onClick={close}
            disabled={!saved}
            className="w-full py-2 bg-blue-600 hover:bg-blue-500 rounded font-medium disabled:opacity-50"
          >
            {t("auth.register.done")}
          </button>
        </>
      )}
    </div>
  );
}
